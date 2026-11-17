"""Regression coverage for the mobile report lifecycle, quotas and account recovery."""
import time
import json
import pytest
from datetime import datetime, timedelta, timezone

from app.db.database import SessionLocal
from app.models.report_model import Report
from app.models.report_status import ReportStatus
from app.services import background_analysis
from app.services.workflow_service import StepExecutor
from app.core.config import settings
from tests.conftest import create_analysis

PAYLOAD = dict(name="测试", birth_date="1990-06-15", birth_time="08:30", gender="男", location="北京", is_solar_time=True)


@pytest.mark.parametrize("text", ['[]', 'null', '{}', 'not JSON', '{"fortune_text":42}', json.dumps({"fortune_text":"内容", "lucky_color":"红" * 21})])
def test_invalid_daily_ai_result_is_rejected(text):
    from app.services.daily_fortune_service import _parse_ai_response
    with pytest.raises(RuntimeError):
        _parse_ai_response(text)


def test_daily_ai_text_may_be_a_few_hundred_characters_and_stops_at_2000():
    from app.services.daily_fortune_service import _parse_ai_response
    essay = "今" * 320
    assert 250 <= len(essay) <= 400
    parsed = _parse_ai_response(json.dumps({"fortune_text": essay}))
    assert parsed["fortune_text"] == essay
    with pytest.raises(RuntimeError):
        _parse_ai_response(json.dumps({"fortune_text": "今" * 2001}))


def test_daily_ai_markdown_json_is_accepted_without_fabricating_fields():
    from app.services.daily_fortune_service import _parse_ai_response
    result = _parse_ai_response('```json\n{"fortune_text":" 今日建议 "}\n```')
    assert result["fortune_text"] == "今日建议"
    assert result["lucky_color"] == result["lucky_direction"] == ""


def wait_report(client, headers, report_id):
    for _ in range(100):
        result = client.get(f"/api/v1/app/oasis/report/{report_id}", headers=headers).json()["data"]
        if result["status"] in ("completed", "failed"):
            return result
        time.sleep(.05)
    raise AssertionError("report did not finish")


def test_ai_failure_is_failed_and_retry_creates_new_report(client, fresh_user, monkeypatch):
    def fail(step, data):
        raise RuntimeError("private provider error")
    with monkeypatch.context() as patch:
        patch.setattr(background_analysis, "_resolve_ai_backend", lambda: (StepExecutor(fail), "fake"))
        response = client.post("/api/v1/app/oasis/analyze", json=PAYLOAD, headers=fresh_user["headers"])
        report_id = response.json()["data"]["report_id"]
        failed = wait_report(client, fresh_user["headers"], report_id)
        assert failed["status"] == "failed"
        assert failed["can_retry"]
        assert "private provider" not in failed["error_message"]
        assert any(log["status"] == "error" for log in failed["analysis_logs"])
    retry = client.post(f"/api/v1/app/oasis/report/{report_id}/retry", headers=fresh_user["headers"])
    assert retry.status_code == 200
    new_id = retry.json()["data"]["report_id"]
    assert new_id != report_id
    completed = wait_report(client, fresh_user["headers"], new_id)
    assert completed["status"] == "completed"
    assert len(completed["calendar_data"]["yun"]["da_yun"]) == 8
    assert completed["calendar_data"]["suggestion"]


def test_five_reports_allowed_regardless_of_four_logs_each(client, fresh_user, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ANALYZE_PER_DAY", 5)
    for _ in range(5):
        report = create_analysis(client, fresh_user["headers"])
        assert report["status"] == "completed"
    response = client.post("/api/v1/app/oasis/analyze", json=PAYLOAD, headers=fresh_user["headers"])
    assert response.status_code == 429


@pytest.mark.parametrize("birth_date", ["1899-12-31", "2099-01-01"])
def test_out_of_range_solar_birth_date_is_rejected_without_using_quota(client, fresh_user, monkeypatch, birth_date):
    monkeypatch.setattr(settings, "RATE_LIMIT_ANALYZE_PER_DAY", 1)
    headers = fresh_user["headers"]
    response = client.post(
        "/api/v1/app/oasis/analyze",
        json={**PAYLOAD, "birth_date": birth_date},
        headers=headers,
    )
    assert response.status_code == 422
    assert client.get("/api/v1/app/oasis/reports", headers=headers).json()["data"]["total"] == 0

    valid = create_analysis(client, headers)
    assert valid["status"] == "completed"


def test_abandoned_report_expires_without_changing_completed(client, fresh_user):
    completed = create_analysis(client, fresh_user["headers"])
    with SessionLocal() as db:
        report = Report(user_id=fresh_user["user_id"], birth_info="interrupted", status=ReportStatus.PROCESSING,
                        input_data=PAYLOAD, updated_at=datetime.now(timezone.utc) - timedelta(hours=1))
        db.add(report); db.commit(); stale_id = report.id
    stale = client.get(f"/api/v1/app/oasis/report/{stale_id}", headers=fresh_user["headers"]).json()["data"]
    assert stale["status"] == "failed" and stale["can_retry"]
    assert client.get(f'/api/v1/app/oasis/report/{completed["report_id"]}', headers=fresh_user["headers"]).json()["data"]["status"] == "completed"


def test_daily_query_uses_selected_completed_report_and_rejects_other_user(client, fresh_user, other_user):
    first = create_analysis(client, fresh_user["headers"])
    second = create_analysis(client, fresh_user["headers"], {"name": "家人", "birth_date": "1995-01-01"})
    headers = fresh_user["headers"]
    path = "/api/v1/app/oasis/daily-fortune"
    for report_id in (first["report_id"], second["report_id"], first["report_id"]):
        res = client.get(path, params={"report_id": report_id}, headers=headers).json()
        assert res["code"] == 200
        assert res["data"]["report_id"] == report_id
    assert client.get(path, params={"report_id": first["report_id"]}, headers=headers).json()["data"]["is_cached"]
    assert client.get(path, params={"report_id": first["report_id"]}, headers=other_user["headers"]).json()["code"] == 400
    assert client.post(f'/api/v1/app/oasis/report/{first["report_id"]}/retry', headers=other_user["headers"]).status_code == 404




def test_restore_does_not_register_unknown_account(client):
    import uuid
    device_id = uuid.uuid4().hex
    assert client.post("/api/v1/app/restore", json={"device_id": device_id}).status_code == 404
    user = client.post("/api/v1/app/anonymous-login", json={"device_id": device_id}).json()["data"]
    headers = {"Authorization": f"Bearer {user['token']}"}
    report = create_analysis(client, headers)
    restored = client.post("/api/v1/app/restore", json={"device_id": device_id}).json()["data"]
    assert restored["user_id"] == user["user_id"]
    restored_headers = {"Authorization": f"Bearer {restored['token']}"}
    detail = client.get(f"/api/v1/app/oasis/report/{report['report_id']}", headers=restored_headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["status"] == "completed"


def test_ai_missing_configuration_does_not_make_fake_report(client, fresh_user, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_MOCK_AI", False)
    response = client.post("/api/v1/app/oasis/analyze", json=PAYLOAD, headers=fresh_user["headers"])
    result = wait_report(client, fresh_user["headers"], response.json()["data"]["report_id"])
    assert result["status"] == "failed"
    assert not result["ai_analysis"]


def test_bazi_fields_are_consistent_at_solar_term_and_midnight_boundaries():
    from lunar_python import Solar
    from app.services.calendar_service import calculate_bazi
    for date, hour in (("2024-02-04", 15), ("2024-02-04", 17), ("2000-01-01", 23)):
        y, m, d = map(int, date.split("-"))
        expected = Solar.fromYmdHms(y, m, d, hour, 0, 0).getLunar().getEightChar()
        result = calculate_bazi(date, f"{hour:02}:00", True)
        assert result.full_bazi == expected.toString()
        assert sum(result.wu_xing_summary.values()) == 8
        assert result.ming_gong == expected.getMingGong()
