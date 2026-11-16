"""Deletion must isolate accounts, clear content and preserve accepted AI quotas."""
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.daily_fortune_model import DailyFortune
from app.models.log_model import AnalysisLog
from app.models.report_model import Report
from app.models.report_status import ReportStatus
from tests.conftest import create_analysis

PATH = "/api/v1/app/oasis/report/"


def test_delete_clears_content_and_daily_cache_but_preserves_other_reports_and_usage(client, fresh_user):
    headers = fresh_user["headers"]
    first = create_analysis(client, headers)
    second = create_analysis(client, headers)
    report_id = first["report_id"]
    assert client.get("/api/v1/app/oasis/daily-fortune", params={"report_id": report_id}, headers=headers).json()["code"] == 200
    with SessionLocal() as db:
        log_ids = db.scalars(select(AnalysisLog.id).where(AnalysisLog.report_id == report_id)).all()
        assert log_ids

    deleted = client.delete(PATH + str(report_id), headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["data"]["report_id"] == report_id
    assert client.get(PATH + str(report_id), headers=headers).status_code == 404
    assert client.post(PATH + str(report_id) + "/retry", headers=headers).status_code == 404
    assert client.delete(PATH + str(report_id), headers=headers).status_code == 404
    listed = client.get("/api/v1/app/oasis/reports", headers=headers).json()["data"]
    assert listed["total"] == 1
    assert [item["id"] for item in listed["reports"]] == [second["report_id"]]
    assert client.get("/api/v1/app/oasis/daily-fortune", params={"report_id": report_id}, headers=headers).json()["code"] == 400
    assert client.get("/api/v1/app/oasis/daily-fortune", headers=headers).json()["data"]["report_id"] == second["report_id"]

    with SessionLocal() as db:
        tombstone = db.get(Report, report_id)
        assert tombstone.deleted_at is not None
        assert tombstone.birth_info == ""
        assert tombstone.input_data is tombstone.calendar_data is tombstone.ai_analysis is tombstone.error_message is None
        assert not db.scalars(select(DailyFortune).where(DailyFortune.report_id == report_id)).all()
        logs = db.scalars(select(AnalysisLog).where(AnalysisLog.id.in_(log_ids))).all()
        assert len(logs) == len(log_ids)
        assert all(log.report_id is None for log in logs)
        assert db.get(Report, second["report_id"]).deleted_at is None


def test_delete_requires_login_and_owner(client, fresh_user, other_user):
    report = create_analysis(client, fresh_user["headers"])
    path = PATH + str(report["report_id"])
    assert client.delete(path).status_code == 401
    assert client.delete(path, headers=other_user["headers"]).status_code == 404
    assert client.get(path, headers=fresh_user["headers"]).json()["data"]["status"] == "completed"


@pytest.mark.parametrize("status", [ReportStatus.PENDING, ReportStatus.PROCESSING])
def test_in_progress_report_cannot_be_deleted(client, fresh_user, status):
    with SessionLocal() as db:
        report = Report(user_id=fresh_user["user_id"], birth_info="生成中的测试", status=status)
        db.add(report)
        db.commit()
        report_id = report.id
    response = client.delete(PATH + str(report_id), headers=fresh_user["headers"])
    assert response.status_code == 409
    with SessionLocal() as db:
        report = db.get(Report, report_id)
        assert report.deleted_at is None and report.status == status


def test_failed_report_can_be_deleted(client, fresh_user):
    with SessionLocal() as db:
        report = Report(user_id=fresh_user["user_id"], birth_info="失败的测试", status=ReportStatus.FAILED,
                        input_data={"name": "测试"}, error_message="生成失败")
        db.add(report)
        db.commit()
        report_id = report.id
    assert client.delete(PATH + str(report_id), headers=fresh_user["headers"]).status_code == 200
    assert client.get(PATH + str(report_id), headers=fresh_user["headers"]).status_code == 404


def test_deletion_does_not_restore_daily_quota(client, fresh_user, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ANALYZE_PER_DAY", 1)
    report = create_analysis(client, fresh_user["headers"])
    assert client.delete(PATH + str(report["report_id"]), headers=fresh_user["headers"]).status_code == 200
    response = client.post("/api/v1/app/oasis/analyze", headers=fresh_user["headers"], json={
        "name": "测试", "birth_date": "1990-06-15", "birth_time": "08:30", "gender": "男",
        "location": "北京", "is_solar_time": True,
    })
    assert response.status_code == 429


def test_deleted_report_cannot_supply_daily_or_yun_data(client, fresh_user):
    headers = fresh_user["headers"]
    report = create_analysis(client, headers)
    assert client.delete(PATH + str(report["report_id"]), headers=headers).status_code == 200
    assert client.get("/api/v1/app/oasis/daily-fortune", headers=headers).json()["code"] == 400
    assert client.get("/api/v1/app/oasis/yun", headers=headers).json()["code"] == 400
