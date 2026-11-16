# -*- coding: utf-8 -*-
"""每日一签：固定签库、短提示词，以及模型失败时的静态解说。"""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.models.fortune_stick_model import FortuneStick
from app.models.user_model import User

_LIBRARY_PATH = Path(__file__).resolve().parents[1] / "data" / "guanyin_signs.json"
_GRADES = ("上上", "上", "中", "下")
_DISCLAIMER = "仅供娱乐参考"
_PLAIN = {
    "上上": "这支签说的是开头顺利。事情可以往前走，仍要自己把步骤做完。",
    "上": "这支签偏向顺。先把眼前这一小步做扎实，后面会轻松一些。",
    "中": "这支签是慢慢来。先守住现在，等事情清楚了，再决定下一步。",
    "下": "这支签提醒先停一停。别硬推，照顾好自己，再看要不要行动。",
}
_CAT = {
    "上上": "喵，今天的风是软的。你想的那件事，可以轻轻试一下。",
    "上": "喵，小猫觉得可以走，但别跑。走稳了也算赢。",
    "中": "喵，先坐下喝口水。急不来的事，急了也不会更快。",
    "下": "喵，先把爪子收回来。今天适合歇一歇，明天再看。",
}
_CAT_WITH_QUESTION = {
    "上上": "喵，你默念的那件事，可以轻轻试一下，小猫在旁边看着。",
    "上": "喵，你心里那件事可以走，但别跑。走稳了也算赢。",
    "中": "喵，你默念的事先放一放。喝口水，等它自己清楚。",
    "下": "喵，你心里那件事今天先别推。歇一歇，明天再看。",
}


def china_today():
    return datetime.now(timezone(timedelta(hours=8))).date()


def load_signs() -> list[dict]:
    payload = json.loads(_LIBRARY_PATH.read_text(encoding="utf-8"))
    signs = payload["signs"]
    if len(signs) != 100:
        raise RuntimeError("观音灵签需要 100 支")
    numbers = [item["number"] for item in signs]
    if numbers != list(range(1, 101)):
        raise RuntimeError("签号必须是 1 到 100")
    for item in signs:
        if item["grade"] not in _GRADES or not item["poem"].strip() or not item["line"].strip():
            raise RuntimeError(f"第 {item['number']} 签不完整")
    return signs


def sign_by_number(number: int) -> dict:
    return load_signs()[number - 1]


def fallback_text(sign: dict, has_question: bool) -> tuple[str, str]:
    grade = sign["grade"] if sign["grade"] in _PLAIN else "中"
    cat = _CAT_WITH_QUESTION[grade] if has_question else _CAT[grade]
    return _PLAIN[grade], cat


def build_messages(sign: dict, question: str) -> list[dict]:
    asked = question or "无"
    return [
        {
            "role": "system",
            "content": (
                "你是三花小先生，一只温暖的小猫。"
                "只输出 JSON：{\"plain\":\"\",\"cat\":\"\"}。"
                "plain 是大白话解签，不超过 60 字。"
                "cat 是喵语气的一句，不超过 40 字，有问题时轻轻接住，没有就鼓励一下。"
                "把它写成轻松的生活参考，不要预测金钱游戏，也不要说成注定的结论。"
            ),
        },
        {
            "role": "user",
            "content": f"第{sign['number']}签 {sign['grade']}\n{sign['poem']}\n问题：{asked}",
        },
    ]


def sanitize_copy(text: str, limit: int) -> str:
    cleaned = " ".join(str(text or "").replace("算命", "参考").replace("彩票", "游戏").split())
    return cleaned[:limit]


def _ask_model(sign: dict, question: str) -> tuple[str, str]:
    from openai import OpenAI

    client = OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        max_retries=0,
        timeout=20.0,
    )
    response = client.chat.completions.create(
        model=settings.DEEPSEEK_DEFAULT_MODEL,
        temperature=0.7,
        max_tokens=180,
        messages=build_messages(sign, question),
    )
    content = response.choices[0].message.content or ""
    content = content.strip()
    if content.startswith("```"):
        content = content.strip("`")
        content = content.split("\n", 1)[-1]
    data = json.loads(content)
    plain = sanitize_copy(data.get("plain"), 80)
    cat = sanitize_copy(data.get("cat"), 60)
    if not plain or not cat:
        raise ValueError("empty stick copy")
    return plain, cat


def interpret_sign(sign: dict, question: str) -> tuple[str, str, bool]:
    """返回 (白话, 猫语气, 是否用了静态兜底)。问题只进入提示词，不落库。"""
    if settings.AI_PROVIDER == "deepseek" and settings.DEEPSEEK_API_KEY:
        try:
            plain, cat = _ask_model(sign, question)
            return plain, cat, False
        except Exception as exc:
            logger.warning("Fortune stick copy fell back: %s", type(exc).__name__)
    plain, cat = fallback_text(sign, bool(question.strip()))
    return plain, cat, True


def to_public(row: FortuneStick, already_drawn: bool) -> dict:
    return {
        "number": row.sign_number,
        "grade": row.grade,
        "title": row.title,
        "poem": row.poem,
        "line": row.line,
        "plain": row.plain,
        "cat": row.cat,
        "date": row.stick_date.isoformat(),
        "already_drawn": already_drawn,
        "disclaimer": _DISCLAIMER,
    }


def get_today_stick(user_id: int, db: Session) -> dict | None:
    row = db.scalar(
        select(FortuneStick).where(
            FortuneStick.user_id == user_id,
            FortuneStick.stick_date == china_today(),
        )
    )
    return to_public(row, True) if row else None


def draw_stick(user_id: int, db: Session, question: str = "") -> dict:
    today = china_today()
    db.execute(select(User.id).where(User.id == user_id).with_for_update()).first()
    existing = db.scalar(
        select(FortuneStick).where(
            FortuneStick.user_id == user_id,
            FortuneStick.stick_date == today,
        )
    )
    if existing:
        return to_public(existing, True)

    sign = sign_by_number(secrets.randbelow(100) + 1)
    plain, cat, used_fallback = interpret_sign(sign, question)
    row = FortuneStick(
        user_id=user_id,
        stick_date=today,
        sign_number=sign["number"],
        grade=sign["grade"],
        title=sign["title"][:64],
        poem=sign["poem"],
        line=sign["line"][:40],
        plain=plain,
        cat=cat,
        used_fallback=used_fallback,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        saved = db.scalar(
            select(FortuneStick).where(
                FortuneStick.user_id == user_id,
                FortuneStick.stick_date == today,
            )
        )
        if saved is None:
            raise
        return to_public(saved, True)
    db.refresh(row)
    return to_public(row, False)
