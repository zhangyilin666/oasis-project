# -*- coding: utf-8 -*-
"""每日一签：固定签库、一天一支、问题不落库、模型失败时用静态解说。"""
from app.core.config import settings
from app.db.database import SessionLocal
from app.models.fortune_stick_model import FortuneStick
from app.models.user_model import User
from app.services import fortune_stick_service as sticks

DRAW = "/api/v1/app/oasis/fortune-stick"
TODAY = DRAW


def test_library_has_one_hundred_public_signs():
    signs = sticks.load_signs()
    assert [item["number"] for item in signs] == list(range(1, 101))
    assert signs[0]["poem"].startswith("天开地辟结良缘")
    assert set(item["grade"] for item in signs) <= {"上上", "上", "中", "下"}


def test_prompt_stays_short_and_avoids_banned_words():
    messages = sticks.build_messages(sticks.sign_by_number(1), "今晚要不要把信发出去")
    packed = "\n".join(item["content"] for item in messages)
    assert len(packed) < 500
    assert "算命" not in packed
    assert "彩票" not in packed
    assert "今晚要不要把信发出去" in packed


def test_draw_once_per_day_and_question_is_not_stored(client, fresh_user, monkeypatch):
    calls = {"n": 0}

    def fake_model(sign, question):
        calls["n"] += 1
        assert question == "要不要换一条路"
        return "先把路看清。", "喵，换不换都可以，先走一小步。"

    monkeypatch.setattr(settings, "AI_PROVIDER", "deepseek")
    monkeypatch.setattr(settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(sticks, "_ask_model", fake_model)

    secret = "要不要换一条路"
    first = client.post(DRAW, json={"question": secret}, headers=fresh_user["headers"])
    assert first.status_code == 200
    data = first.json()["data"]
    assert data["already_drawn"] is False
    assert data["plain"] == "先把路看清。"
    assert data["disclaimer"] == "仅供娱乐参考"
    assert calls["n"] == 1

    second = client.post(DRAW, json={"question": "另一件完全不同的事"}, headers=fresh_user["headers"])
    assert second.status_code == 200
    again = second.json()["data"]
    assert again["already_drawn"] is True
    assert again["number"] == data["number"]
    assert again["plain"] == data["plain"]
    assert calls["n"] == 1

    today = client.get(TODAY, headers=fresh_user["headers"])
    assert today.json()["data"]["number"] == data["number"]

    with SessionLocal() as db:
        row = db.get(FortuneStick, db.query(FortuneStick).filter_by(user_id=fresh_user["user_id"]).one().id)
        assert "question" not in FortuneStick.__table__.columns
        stored = f"{row.title}{row.poem}{row.plain}{row.cat}{row.line}"
        assert secret not in stored
        assert "另一件完全不同的事" not in stored


def test_model_failure_still_locks_the_day_with_static_copy(client, fresh_user, monkeypatch):
    def boom(sign, question):
        raise RuntimeError("down")

    monkeypatch.setattr(settings, "AI_PROVIDER", "deepseek")
    monkeypatch.setattr(settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(sticks, "_ask_model", boom)

    response = client.post(DRAW, json={"question": "会好吗"}, headers=fresh_user["headers"])
    data = response.json()["data"]
    sign = sticks.sign_by_number(data["number"])
    plain, cat = sticks.fallback_text(sign, True)
    assert data["plain"] == plain
    assert data["cat"] == cat
    assert "算命" not in data["plain"] + data["cat"]

    with SessionLocal() as db:
        row = db.query(FortuneStick).filter_by(user_id=fresh_user["user_id"]).one()
        assert row.used_fallback is True

    again = client.post(DRAW, json={}, headers=fresh_user["headers"])
    assert again.json()["data"]["number"] == data["number"]
    assert again.json()["data"]["already_drawn"] is True


def test_blank_question_uses_the_general_cat_line(client, fresh_user):
    response = client.post(DRAW, json={"question": "   "}, headers=fresh_user["headers"])
    data = response.json()["data"]
    sign = sticks.sign_by_number(data["number"])
    plain, cat = sticks.fallback_text(sign, False)
    assert data["plain"] == plain
    assert data["cat"] == cat


def test_long_question_is_rejected(client, fresh_user):
    response = client.post(DRAW, json={"question": "问" * 41}, headers=fresh_user["headers"])
    assert response.status_code == 422
    assert client.get(TODAY, headers=fresh_user["headers"]).json()["data"] is None


def test_admin_also_gets_one_stick_per_day(client, fresh_user):
    with SessionLocal() as db:
        user = db.get(User, fresh_user["user_id"])
        user.is_admin = True
        db.commit()
    first = client.post(DRAW, json={}, headers=fresh_user["headers"]).json()["data"]
    second = client.post(DRAW, json={"question": "再来一支"}, headers=fresh_user["headers"]).json()["data"]
    assert second["number"] == first["number"]
    assert second["already_drawn"] is True
