"""Administrator quotas and renamed identities use only isolated databases."""
import importlib.util
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, func, inspect, select, text, update
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import divination_api, oasis_api
from app.core.config import settings
from app.db.base import Base
from app.db.database import SessionLocal, get_db
from app.main import app
from app.models.divination_model import DivinationReading
from app.models.report_model import Report
from app.models.report_status import ReportStatus
from app.models.user_id_alias_model import UserIdAlias
from app.models.user_model import User
from app.services.divination_service import create_reading
from app.schemas.divination_schema import CreateDivination
from app.utils.security import create_access_token, verify_token


ME = "/api/v1/app/me"
DIVINATIONS = "/api/v1/app/oasis/divinations"
ANALYZE = "/api/v1/app/oasis/analyze"
BIRTH = {"name": "隔离测试", "birth_date": "1990-06-15", "birth_time": "08:30", "gender": "男", "location": "北京", "is_solar_time": True}


def divination_payload():
    return {"request_id": str(uuid.uuid4()), "rule_version": "divination-v1", "input": {
        "method": "liuyao-manual", "question": "如何安排学习计划？", "date": "2026-10-03",
        "time": "12:00", "utcOffset": 8, "lines": [7, 8, 7, 8, 7, 8],
    }}


def set_admin(user_id, enabled, factory=SessionLocal):
    with factory() as db:
        db.execute(update(User).where(User.id == user_id).values(is_admin=enabled))
        db.commit()


def failed_report(user_id, factory=SessionLocal):
    with factory() as db:
        report = Report(user_id=user_id, birth_info="隔离的失败报告", status=ReportStatus.FAILED, input_data=BIRTH)
        db.add(report)
        db.commit()
        return report.id


@pytest.fixture(autouse=True)
def bounded_quota_without_ai(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ANALYZE_PER_DAY", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_DIVINATION_PER_DAY", 1)
    monkeypatch.setattr(oasis_api, "process_report_in_background", lambda *args: None)
    dispatched = []
    monkeypatch.setattr(divination_api, "_dispatch", dispatched.append)
    return dispatched


def test_me_requires_auth_and_returns_only_current_database_identity(client, fresh_user, other_user):
    assert client.get(ME).status_code == 401
    assert client.get(ME, headers={"Authorization": "Bearer invalid"}).status_code == 401
    set_admin(other_user["user_id"], True)
    response = client.get(ME, headers=fresh_user["headers"], params={"user_id": other_user["user_id"], "is_admin": "true"})
    assert response.json() == {"code": 200, "message": "ok", "data": {"user_id": fresh_user["user_id"], "is_admin": False}}
    assert client.post(ME, headers=fresh_user["headers"], json={"is_admin": True}).status_code == 405


@pytest.mark.parametrize("admin", [False, True])
def test_bazi_app_wechat_and_failed_retry_obey_database_role(client, fresh_user, admin):
    set_admin(fresh_user["user_id"], admin)
    original = failed_report(fresh_user["user_id"])
    expected = 200 if admin else 429
    responses = [client.post(path, json=BIRTH, headers=fresh_user["headers"]) for path in (
        ANALYZE, "/api/v1/wechat/oasis/analyze",
    )]
    responses.append(client.post(f"/api/v1/app/oasis/report/{original}/retry", headers=fresh_user["headers"]))
    assert [response.status_code for response in responses] == [expected] * 3
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Report).where(Report.user_id == fresh_user["user_id"])) == (4 if admin else 1)
    if admin:
        assert len({original, *(response.json()["data"]["report_id"] for response in responses)}) == 4


@pytest.mark.parametrize("admin", [False, True])
def test_divination_quota_and_visible_remaining_obey_role_without_losing_idempotency(client, fresh_user, admin, bounded_quota_without_ai):
    set_admin(fresh_user["user_id"], admin)
    body = divination_payload()
    first = client.post(DIVINATIONS, json=body, headers=fresh_user["headers"])
    assert first.status_code == 200
    first_id = first.json()["data"]["reading_id"]
    repeated = client.post(DIVINATIONS, json=body, headers=fresh_user["headers"])
    assert repeated.json()["data"]["reading_id"] == first_id
    assert bounded_quota_without_ai == [first_id]
    assert client.post(DIVINATIONS, json=divination_payload(), headers=fresh_user["headers"]).status_code == (200 if admin else 429)
    quota = client.get(DIVINATIONS, headers=fresh_user["headers"]).json()["data"]
    assert (quota["daily_limit"], quota["remaining_today"]) == ((0, None) if admin else (1, 0))


def test_existing_token_observes_grant_and_revocation_for_both_ai_quotas(client, fresh_user):
    headers = fresh_user["headers"]
    failed_report(fresh_user["user_id"])
    assert client.post(DIVINATIONS, json=divination_payload(), headers=headers).status_code == 200
    for enabled in (False, True, False):
        set_admin(fresh_user["user_id"], enabled)
        assert client.get(ME, headers=headers).json()["data"]["is_admin"] is enabled
        expected = 200 if enabled else 429
        assert client.post(ANALYZE, json=BIRTH, headers=headers).status_code == expected
        assert client.post(DIVINATIONS, json=divination_payload(), headers=headers).status_code == expected


def test_payload_and_signed_role_claims_cannot_promote_an_account(client, fresh_user):
    response = client.post("/api/v1/app/anonymous-login", json={"device_id": str(uuid.uuid4()), "is_admin": True, "role": "admin"})
    created = response.json()["data"]
    headers = {"Authorization": "Bearer " + created["token"]}
    assert client.get(ME, headers=headers).json()["data"]["is_admin"] is False

    # Even an issuer-signed legacy role claim is ignored; authority is the DB row.
    claimed = create_access_token({"sub": str(fresh_user["user_id"]), "is_admin": True, "role": "admin", "user_id": 0})
    headers = {"Authorization": "Bearer " + claimed}
    assert client.get(ME, headers=headers).json()["data"]["is_admin"] is False
    first = client.post(ANALYZE, json={**BIRTH, "is_admin": True}, headers=headers)
    assert first.status_code == 200
    assert client.post(ANALYZE, json={**BIRTH, "is_admin": True}, headers=headers).status_code == 429
    assert client.post(DIVINATIONS, json=divination_payload(), headers=headers).status_code == 200
    assert client.post(DIVINATIONS, json=divination_payload(), headers=headers).status_code == 429


def test_admin_quota_privilege_does_not_grant_other_users_private_records(client, fresh_user, other_user):
    set_admin(fresh_user["user_id"], True)
    report_id = failed_report(other_user["user_id"])
    reading_id = client.post(DIVINATIONS, json=divination_payload(), headers=other_user["headers"]).json()["data"]["reading_id"]
    headers = fresh_user["headers"]
    for prefix in ("app", "wechat"):
        path = f"/api/v1/{prefix}/oasis/report/{report_id}"
        assert client.get(path, headers=headers).status_code == 404
        assert client.delete(path, headers=headers).status_code == 404
    assert client.post(f"/api/v1/app/oasis/report/{report_id}/retry", headers=headers).status_code == 404
    assert client.get(f"{DIVINATIONS}/{reading_id}", headers=headers).status_code == 404
    assert client.delete(f"{DIVINATIONS}/{reading_id}", headers=headers).status_code == 404
    assert client.get("/api/v1/app/oasis/reports", headers=headers).json()["data"]["total"] == 0
    assert client.get(DIVINATIONS, headers=headers).json()["data"]["total"] == 0


@pytest.fixture
def renamed_account(client):
    """Simulate an operator's 1 -> 0 transaction in a separate in-memory DB."""
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def temporary_db():
        with factory() as db:
            yield db

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = temporary_db
    device_id = str(uuid.uuid4())
    try:
        with factory() as db:
            db.add(User(id=1, device_id=device_id))
            db.commit()
        original = client.post("/api/v1/app/anonymous-login", json={"device_id": device_id}).json()["data"]
        assert original["user_id"] == 1
        assert client.get(ME, headers={"Authorization": "Bearer " + original["token"]}).json()["data"]["is_admin"] is False
        report_id = failed_report(1, factory)
        with factory() as db:
            reading, _ = create_reading(db, 1, CreateDivination.model_validate(divination_payload()))
            reading_id = reading.id
            db.execute(update(User).where(User.id == 1).values(id=0, is_admin=True))
            db.execute(update(Report).where(Report.user_id == 1).values(user_id=0))
            db.execute(update(DivinationReading).where(DivinationReading.user_id == 1).values(user_id=0))
            db.add(UserIdAlias(old_user_id=1, user_id=0))
            db.commit()
        yield {"factory": factory, "device_id": device_id, "headers": {"Authorization": "Bearer " + original["token"]},
               "report_id": report_id, "reading_id": reading_id}
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        engine.dispose()


def test_renumbered_account_keeps_old_session_history_and_device_login(client, renamed_account):
    account = renamed_account
    assert client.get(ME, headers=account["headers"]).json()["data"] == {"user_id": 0, "is_admin": True}
    report = client.get(f"/api/v1/app/oasis/report/{account['report_id']}", headers=account["headers"])
    assert report.status_code == 200
    assert report.json()["data"]["user_id"] == 0
    assert client.get(f"{DIVINATIONS}/{account['reading_id']}", headers=account["headers"]).status_code == 200
    for path in ("anonymous-login", "restore"):
        response = client.post(f"/api/v1/app/{path}", json={"device_id": account["device_id"]})
        data = response.json()["data"]
        assert data["user_id"] == 0
        assert verify_token(data["token"])["sub"] == "0"
        assert client.get(ME, headers={"Authorization": "Bearer " + data["token"]}).json()["data"]["user_id"] == 0
    with account["factory"]() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 1


@pytest.mark.parametrize("path", ["/api/v1/app/refresh", "/api/v1/wechat/refresh"])
@pytest.mark.parametrize("expired", [False, True])
def test_refresh_resolves_old_id_and_issues_actual_zero_id(client, renamed_account, path, expired):
    headers = renamed_account["headers"]
    if expired:
        headers = {"Authorization": "Bearer " + create_access_token({"sub": "1"}, expires_delta=timedelta(days=-1))}
    response = client.post(path, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["user_id"] == 0
    assert verify_token(data["token"])["sub"] == "0"
    assert client.get(ME, headers={"Authorization": "Bearer " + data["token"]}).json()["data"] == {"user_id": 0, "is_admin": True}


def test_alias_is_identity_only_and_live_database_role_still_controls_both_quotas(client, renamed_account):
    headers = {"Authorization": "Bearer " + create_access_token({"sub": "1", "is_admin": True, "role": "admin"})}
    for enabled in (False, True, False):
        set_admin(0, enabled, renamed_account["factory"])
        assert client.get(ME, headers=headers).json()["data"] == {"user_id": 0, "is_admin": enabled}
        assert client.post(ANALYZE, json=BIRTH, headers=headers).status_code == (200 if enabled else 429)
        assert client.post(DIVINATIONS, json=divination_payload(), headers=headers).status_code == (200 if enabled else 429)


def test_alias_resolution_is_generic_and_does_not_assign_the_admin_account(client, renamed_account):
    with renamed_account["factory"]() as db:
        db.add(User(id=7))
        db.commit()
        db.add(UserIdAlias(old_user_id=77, user_id=7))
        db.commit()
    headers = {"Authorization": "Bearer " + create_access_token({"sub": "77", "is_admin": True})}
    assert client.get(ME, headers=headers).json()["data"] == {"user_id": 7, "is_admin": False}
    refreshed = client.post("/api/v1/app/refresh", headers=headers).json()["data"]
    assert refreshed["user_id"] == 7
    assert verify_token(refreshed["token"])["sub"] == "7"


def test_reused_alias_id_fails_closed_instead_of_selecting_the_wrong_account(client, renamed_account):
    with renamed_account["factory"]() as db:
        db.add(User(id=1))
        db.commit()
    assert client.get(ME, headers=renamed_account["headers"]).status_code == 401
    for path in ("/api/v1/app/refresh", "/api/v1/wechat/refresh"):
        assert client.post(path, headers=renamed_account["headers"]).status_code == 401
    current = {"Authorization": "Bearer " + create_access_token({"sub": "0"})}
    assert client.get(ME, headers=current).json()["data"]["user_id"] == 0


def test_model_default_does_not_automatically_promote_id_zero_or_one():
    engine = create_engine("sqlite://")
    try:
        User.__table__.create(engine)
        with Session(engine) as db:
            db.add_all([User(id=0), User(id=1)])
            db.commit()
            assert db.get(User, 0).is_admin is False
            assert db.get(User, 1).is_admin is False
    finally:
        engine.dispose()


def test_migration_preserves_existing_users_defaults_to_non_admin_and_creates_empty_aliases(monkeypatch):
    path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "e2a73c9b4d10_user_admin_role.py"
    spec = importlib.util.spec_from_file_location("test_admin_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "d9f2a67b103c"
    engine = create_engine("sqlite://")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, nickname VARCHAR(255))"))
            connection.execute(text("INSERT INTO users (id, nickname) VALUES (0, 'zero'), (1, 'one')"))
            monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
            migration.upgrade()
            assert connection.execute(text("SELECT id, nickname, is_admin FROM users ORDER BY id")).all() == [(0, "zero", 0), (1, "one", 0)]
            assert connection.scalar(text("SELECT COUNT(*) FROM user_id_aliases")) == 0
            connection.execute(text("INSERT INTO users (id, nickname) VALUES (2, 'new')"))
            assert connection.scalar(text("SELECT is_admin FROM users WHERE id = 2")) == 0
            fk = inspect(connection).get_foreign_keys("user_id_aliases")[0]
            assert fk["referred_table"] == "users" and fk["options"]["ondelete"] == "CASCADE"
            migration.downgrade()
            assert "user_id_aliases" not in inspect(connection).get_table_names()
            assert connection.execute(text("SELECT id, nickname FROM users ORDER BY id")).all() == [(0, "zero"), (1, "one"), (2, "new")]
    finally:
        engine.dispose()
