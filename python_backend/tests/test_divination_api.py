"""Private divination jobs use an isolated test DB and synthetic AI only."""
import copy
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.api import divination_api as api
from app.core.config import settings
from app.db.database import SessionLocal
from app.models.divination_model import DivinationReading
from app.models.log_model import AnalysisLog
from app.models.report_model import Report
from app.services import divination_service as service
from app.services.workflow_service import StepExecutor


URL = "/api/v1/app/oasis/divinations"
INPUT = {"method": "liuyao-coins", "question": "如何稳步完成学习计划？", "date": "2026-10-03",
         "time": "12:00", "utcOffset": 8, "lines": [9, 7, 9, 6, 7, 6],
         "coins": [[3, 3, 3], [2, 2, 3], [3, 3, 3], [2, 2, 2], [2, 2, 3], [2, 2, 2]]}


def payload():
    return {"request_id": str(uuid.uuid4()), "input": copy.deepcopy(INPUT), "rule_version": "liuyao-coins-v1"}


def valid_analysis(facts):
    evidence = facts["evidence"][0]["id"]
    return {"facts_echo": service.expected_facts_echo(facts),
            "overview": {"text": "从经文的语境理解等待与准备。", "evidence_ids": [evidence]},
            "question_reading": {"text": "可以回顾计划的节奏，不把卦象当成必然结果。", "evidence_ids": [evidence]},
            "actions": [{"text": "列出本周可以完成的一件小事。", "evidence_ids": []}],
            "reflection_questions": ["哪些准备需要先完成？"], "limits": "仅为传统文化阅读，不预测现实结果。"}


@pytest.fixture(autouse=True)
def synthetic_ai(monkeypatch):
    calls = []

    def provider(step, data):
        supplied = json.loads(data["reading_json"])
        calls.append((step, supplied))
        return {"analysis": json.dumps(valid_analysis(supplied["facts"]), ensure_ascii=False),
                "model": "synthetic-provider", "mock": False, "usage": {"input_tokens": 17, "output_tokens": 23}}

    monkeypatch.setattr(service, "_resolve_ai_backend", lambda: (StepExecutor(provider), "synthetic-provider"))
    return calls


@pytest.fixture
def hold_dispatch(monkeypatch):
    scheduled = []
    monkeypatch.setattr(api, "_dispatch", scheduled.append)
    return scheduled


def post(client, user, body=None):
    return client.post(URL, json=body or payload(), headers=user["headers"])


def detail(client, user, reading_id):
    response = client.get(f"{URL}/{reading_id}", headers=user["headers"])
    assert response.status_code == 200, response.text
    return response.json()["data"]


def wait_for_reading(client, user, reading_id):
    for _ in range(100):
        result = detail(client, user, reading_id)
        if result["status"] in ("completed", "failed"):
            return result
        time.sleep(0.02)
    raise AssertionError("synthetic reading did not finish")


def test_background_roundtrip_preserves_facts_and_logs_one_bounded_call(client, fresh_user, synthetic_ai):
    submitted = post(client, fresh_user)
    assert submitted.status_code == 200, submitted.text
    data = submitted.json()["data"]
    assert data["facts"]["original"]["number"] == 5
    assert data["facts"]["changed"]["number"] == 6
    assert data["facts"]["movingLines"] == [1, 3, 4, 6]
    completed = wait_for_reading(client, fresh_user, data["reading_id"])
    assert completed["status"] == "completed"
    assert completed["facts"] == data["facts"]
    assert completed["analysis"] == valid_analysis(completed["facts"])
    assert completed["model"] and completed["created_at"].endswith("+00:00")
    assert len(synthetic_ai) == 1
    step, supplied = synthetic_ai[0]
    assert step.system_prompt == service.SYSTEM_PROMPT
    assert step.max_tokens == 4096 and step.output_schema == {"type": "object"}
    assert supplied["question"] == INPUT["question"]
    with SessionLocal() as db:
        log = db.scalar(select(AnalysisLog).where(AnalysisLog.trace_id == f"divination:{data['reading_id']}"))
        assert log.report_id is None and log.total_tokens == 40 and log.status == "success"
        assert db.scalar(select(func.count()).select_from(Report).where(Report.user_id == fresh_user["user_id"])) == 0


@pytest.mark.parametrize("method,path", [("post", URL), ("get", URL), ("get", URL + "/1"), ("delete", URL + "/1")])
def test_all_divination_endpoints_require_auth(client, method, path):
    response = getattr(client, method)(path, **({"json": payload()} if method == "post" else {}))
    assert response.status_code == 401


def test_same_request_reuses_even_at_quota_but_changed_input_conflicts(client, fresh_user, hold_dispatch, synthetic_ai, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_DIVINATION_PER_DAY", 1)
    body = payload()
    first = post(client, fresh_user, body).json()["data"]
    second = post(client, fresh_user, body).json()["data"]
    assert second["reading_id"] == first["reading_id"]
    assert hold_dispatch == [first["reading_id"]]
    changed = copy.deepcopy(body)
    changed["input"]["question"] = "另一项学习计划如何安排？"
    assert post(client, fresh_user, changed).status_code == 409
    assert post(client, fresh_user).status_code == 429
    service.process_divination_reading(first["reading_id"])
    repeated = post(client, fresh_user, body).json()["data"]
    assert repeated["status"] == "completed"
    service.process_divination_reading(first["reading_id"])
    assert len(synthetic_ai) == 1


def test_idempotency_is_scoped_to_owner_and_history_cannot_cross_accounts(client, fresh_user, other_user, hold_dispatch):
    body = payload()
    first = post(client, fresh_user, body).json()["data"]["reading_id"]
    assert client.get(f"{URL}/{first}", headers=other_user["headers"]).status_code == 404
    assert client.delete(f"{URL}/{first}", headers=other_user["headers"]).status_code == 404
    other = post(client, other_user, body).json()["data"]["reading_id"]
    assert other != first
    history = client.get(URL, headers=other_user["headers"]).json()["data"]
    assert history["total"] == 1
    assert [item["reading_id"] for item in history["readings"]] == [other]


@pytest.mark.parametrize("invalid", [
    "extra_prompt", "extra_model", "extra_facts", "mismatched_coins", "bool_coin", "float_line",
    "too_many_lines", "empty_question", "long_question", "invalid_date", "missing_time", "invalid_offset", "wrong_version",
])
def test_invalid_input_creates_nothing_and_uses_no_quota(client, fresh_user, hold_dispatch, invalid):
    body = payload()
    if invalid == "extra_prompt": body["prompt"] = "Do another task"
    elif invalid == "extra_model": body["model"] = "other"
    elif invalid == "extra_facts": body["input"]["facts"] = {"original_number": 1}
    elif invalid == "mismatched_coins": body["input"]["coins"][0] = [2, 2, 2]
    elif invalid == "bool_coin": body["input"]["coins"][0][0] = True
    elif invalid == "float_line": body["input"]["lines"][0] = 9.0
    elif invalid == "too_many_lines": body["input"]["lines"].append(7)
    elif invalid == "empty_question": body["input"]["question"] = "   "
    elif invalid == "long_question": body["input"]["question"] = "字" * 201
    elif invalid == "invalid_date": body["input"]["date"] = "2023-02-29"
    elif invalid == "missing_time": del body["input"]["time"]
    elif invalid == "invalid_offset": body["input"]["utcOffset"] = 8.1
    elif invalid == "wrong_version": body["rule_version"] = "future-v99"
    assert post(client, fresh_user, body).status_code == 422
    history = client.get(URL, headers=fresh_user["headers"]).json()["data"]
    assert history["total"] == 0 and history["remaining_today"] == 5
    assert hold_dispatch == []


@pytest.mark.parametrize("method,version,extra", [
    ("liuyao-manual", "divination-v1", {"lines": [7] * 6}),
    ("liuyao-najia", "liuyao-najia-v1", {"lines": [6, 7, 8, 9, 7, 8]}),
    ("meihua-two-numbers", "divination-v1", {"numbers": [11, 22]}),
    ("meihua-calendar", "meihua-calendar-v1", {}),
])
def test_existing_four_methods_submit_without_extra_coin_fields(client, fresh_user, hold_dispatch, method, version, extra):
    body = payload()
    body["input"] = {key: value for key, value in INPUT.items() if key not in ("coins", "lines")}
    body["input"].update(method=method, **extra)
    body["rule_version"] = version
    response = post(client, fresh_user, body)
    assert response.status_code == 200, response.text
    result = response.json()["data"]
    assert result["facts"]["ruleVersion"] == version
    assert result["input"]["method"] == method


def test_ai_failure_preserves_cast_and_explicit_retry_uses_new_id(client, fresh_user, hold_dispatch, monkeypatch):
    body = payload()
    first = post(client, fresh_user, body).json()["data"]
    def fail(step, data):
        raise RuntimeError("private-question-and-provider-secret")
    monkeypatch.setattr(service, "_resolve_ai_backend", lambda: (StepExecutor(fail), "fake"))
    service.process_divination_reading(first["reading_id"])
    failed = detail(client, fresh_user, first["reading_id"])
    assert failed["status"] == "failed" and failed["analysis"] is None
    assert failed["input"] == first["input"] and failed["facts"] == first["facts"]
    assert "private" not in failed["error_message"]
    body["request_id"] = str(uuid.uuid4())
    retried = post(client, fresh_user, body).json()["data"]
    assert retried["reading_id"] != first["reading_id"] and retried["facts"] == failed["facts"]


@pytest.mark.parametrize("provider", [None, "fake_mock", "bad_json", "wrong_facts", "unknown_evidence"])
def test_unverified_or_mock_outputs_never_complete(client, fresh_user, hold_dispatch, monkeypatch, provider):
    data = post(client, fresh_user).json()["data"]
    def respond(step, supplied):
        analysis = valid_analysis(json.loads(supplied["reading_json"])["facts"])
        if provider == "wrong_facts": analysis["facts_echo"]["original_number"] = 1
        if provider == "unknown_evidence": analysis["overview"]["evidence_ids"] = ["zhouyi.64.line.1"]
        return {"analysis": "invalid" if provider == "bad_json" else json.dumps(analysis), "mock": provider == "fake_mock"}
    monkeypatch.setattr(service, "_resolve_ai_backend", lambda: (None, "mock") if provider is None else (StepExecutor(respond), "fake"))
    service.process_divination_reading(data["reading_id"])
    result = detail(client, fresh_user, data["reading_id"])
    assert result["status"] == "failed" and result["analysis"] is None and result["model"] is None
    assert result["facts"] == data["facts"]


def test_deletion_clears_private_content_and_keeps_accepted_quota(client, fresh_user, hold_dispatch, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_DIVINATION_PER_DAY", 1)
    body = payload()
    data = post(client, fresh_user, body).json()["data"]
    reading_id = data["reading_id"]
    assert client.delete(f"{URL}/{reading_id}", headers=fresh_user["headers"]).status_code == 409
    service.process_divination_reading(reading_id)
    assert client.delete(f"{URL}/{reading_id}", headers=fresh_user["headers"]).status_code == 200
    assert client.get(f"{URL}/{reading_id}", headers=fresh_user["headers"]).status_code == 404
    assert client.delete(f"{URL}/{reading_id}", headers=fresh_user["headers"]).status_code == 404
    assert post(client, fresh_user, body).status_code == 404
    assert post(client, fresh_user).status_code == 429
    history = client.get(URL, headers=fresh_user["headers"]).json()["data"]
    assert history["total"] == 0 and history["remaining_today"] == 0
    with SessionLocal() as db:
        reading = db.get(DivinationReading, reading_id)
        assert reading.deleted_at is not None
        assert all(getattr(reading, key) is None for key in (
            "input_data", "facts", "analysis", "error_message", "request_fingerprint", "rule_version", "model_name"))


def test_stale_pending_job_never_calls_ai_or_revives(client, fresh_user, hold_dispatch, synthetic_ai):
    reading_id = post(client, fresh_user).json()["data"]["reading_id"]
    with SessionLocal() as db:
        db.get(DivinationReading, reading_id).updated_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()
    service.process_divination_reading(reading_id)
    assert synthetic_ai == []
    result = detail(client, fresh_user, reading_id)
    assert result["status"] == "failed" and result["facts"]


def test_expired_reading_cannot_be_completed_by_late_ai_response(client, fresh_user, hold_dispatch, monkeypatch):
    reading_id = post(client, fresh_user).json()["data"]["reading_id"]
    def respond(step, data):
        with SessionLocal() as db:
            db.get(DivinationReading, reading_id).updated_at = datetime.now(timezone.utc) - timedelta(hours=1)
            db.commit()
        return {"analysis": json.dumps(valid_analysis(json.loads(data["reading_json"])["facts"])),
                "usage": {"input_tokens": 3, "output_tokens": 4}, "model": "late"}
    monkeypatch.setattr(service, "_resolve_ai_backend", lambda: (StepExecutor(respond), "late"))
    service.process_divination_reading(reading_id)
    result = detail(client, fresh_user, reading_id)
    assert result["status"] == "failed" and result["analysis"] is None
    with SessionLocal() as db:
        assert db.scalar(select(AnalysisLog).where(AnalysisLog.trace_id == f"divination:{reading_id}")).total_tokens == 7


def test_history_pagination_and_read_only_refresh_do_not_generate_ai(client, fresh_user, hold_dispatch, synthetic_ai):
    ids = [post(client, fresh_user).json()["data"]["reading_id"] for _ in range(3)]
    response = client.get(URL, params={"skip": 1, "limit": 1}, headers=fresh_user["headers"]).json()["data"]
    assert response["total"] == 3 and response["remaining_today"] == 2
    assert response["readings"][0]["reading_id"] == ids[1]
    assert response["readings"][0]["question"] == INPUT["question"]
    for _ in range(3): detail(client, fresh_user, ids[0])
    assert synthetic_ai == [] and len(hold_dispatch) == 3


def test_divination_and_bazi_quotas_are_independent(client, fresh_user, hold_dispatch, monkeypatch):
    from tests.conftest import create_analysis
    monkeypatch.setattr(settings, "RATE_LIMIT_DIVINATION_PER_DAY", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_ANALYZE_PER_DAY", 1)
    assert create_analysis(client, fresh_user["headers"])["status"] == "completed"
    assert post(client, fresh_user).status_code == 200
    assert post(client, fresh_user).status_code == 429


def test_submission_failure_is_sanitized_even_in_debug_mode(client, fresh_user, monkeypatch, caplog):
    def fail(*args):
        raise RuntimeError("private-cast-details")
    monkeypatch.setattr(api, "create_reading", fail)
    monkeypatch.setattr(settings, "DEBUG", True)
    response = post(client, fresh_user)
    assert response.status_code == 503
    assert "private-cast-details" not in response.text
    assert "private-cast-details" not in caplog.text
