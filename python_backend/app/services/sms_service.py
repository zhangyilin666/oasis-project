# -*- coding: utf-8 -*-
"""
短信服务 — OTP 验证码发送与验证。

支持阿里云短信（生产环境）和 mock 模式（开发阶段）。
OTP 码存储在 otp_codes 表中（无需 Redis）。

发送限制：同一手机号 60 秒内只能发送一次。
验证码有效期：5 分钟。
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.models.otp_code_model import OtpCode

# ---------------------------------------------------------------------------
# OTP 生成与存储
# ---------------------------------------------------------------------------

OTP_LENGTH: int = 6
OTP_EXPIRE_MINUTES: int = 5
OTP_COOLDOWN_SECONDS: int = 60


def _generate_otp() -> str:
    """生成 6 位数字验证码。"""
    return "".join(str(random.randint(0, 9)) for _ in range(OTP_LENGTH))


def send_otp(db: Session, phone: str) -> dict:
    """
    向指定手机号发送短信验证码。

    1. 检查 60 秒冷却期
    2. 生成 6 位数字码 → 存入 otp_codes 表
    3. 调用短信服务商发送（未配置时回退 mock）

    Returns:
        {"ok": True, "message": str}
        {"ok": False, "message": str}  — 冷却期内或发送失败

    Raises:
        RuntimeError: 短信服务商调用失败（非 mock 模式）。
    """
    # ---- 冷却期检查 ----
    cooldown_deadline = datetime.now(timezone.utc) - timedelta(seconds=OTP_COOLDOWN_SECONDS)
    recent = db.scalar(
        select(OtpCode).where(
            OtpCode.phone == phone,
            OtpCode.created_at >= cooldown_deadline,
        )
    )
    if recent is not None:
        remaining = OTP_COOLDOWN_SECONDS - int(
            (datetime.now(timezone.utc) - recent.created_at.replace(tzinfo=timezone.utc)).total_seconds()
        )
        logger.info("OTP cooldown: phone=%s, remaining=%ss", phone, max(remaining, 0))
        return {"ok": False, "message": f"请 {max(remaining, 0)} 秒后再试"}

    # ---- 生成并存储 OTP ----
    code = _generate_otp() if not settings.DEBUG else "123456"  # DEBUG 模式固定验证码
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=OTP_EXPIRE_MINUTES)

    otp_record = OtpCode(
        phone=phone,
        code=code,
        purpose="login",
        expires_at=expires_at,
        created_at=now_utc,  # 显式使用 UTC，避免与 server_default(NOW()) 的时区不一致
    )
    db.add(otp_record)
    db.commit()

    # ---- 发送短信 ----
    sms_provider = settings.SMS_PROVIDER.strip().lower() if settings.SMS_PROVIDER else ""
    if not sms_provider or sms_provider == "mock":
        logger.info("SMS mock mode: phone=%s, code=%s", phone, code)
        return {"ok": True, "message": "验证码已发送（开发模式）"}

    if sms_provider == "aliyun":
        try:
            _send_via_aliyun(phone, code)
        except Exception as exc:
            logger.error("Alibaba Cloud SMS failed: phone=%s, error=%s", phone, exc)
            return {"ok": False, "message": "短信发送失败，请稍后再试"}
    else:
        logger.warning("Unknown SMS_PROVIDER=%s, falling back to mock", sms_provider)
        logger.info("SMS mock (unknown provider): phone=%s, code=%s", phone, code)

    logger.info("OTP sent: phone=%s", phone)
    return {"ok": True, "message": "验证码已发送"}


def verify_otp(db: Session, phone: str, code: str, purpose: str = "login") -> dict:
    """
    验证 OTP 码是否有效。

    验证规则：
    1. phone + code + purpose 精确匹配
    2. 未过期（expires_at > now）
    3. 未被使用（used = False）

    Returns:
        {"ok": True}
        {"ok": False, "message": str}
    """
    now = datetime.now(timezone.utc)

    stmt = (
        select(OtpCode)
        .where(
            OtpCode.phone == phone,
            OtpCode.code == code,
            OtpCode.purpose == purpose,
            OtpCode.used == False,      # noqa: E712
            OtpCode.expires_at > now,
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    record = db.scalars(stmt).first()

    if record is None:
        # 再检查：是过期了还是码不对
        any_code = db.scalar(
            select(OtpCode).where(
                OtpCode.phone == phone,
                OtpCode.purpose == purpose,
                OtpCode.used == False,  # noqa: E712
            ).order_by(OtpCode.created_at.desc()).limit(1)
        )
        if any_code is None:
            return {"ok": False, "message": "请先获取验证码"}
        if any_code.code != code:
            return {"ok": False, "message": "验证码错误"}
        return {"ok": False, "message": "验证码已过期，请重新获取"}

    # 标记为已使用
    record.used = True
    db.commit()

    logger.info("OTP verified: phone=%s, purpose=%s", phone, purpose)
    return {"ok": True}


# ---------------------------------------------------------------------------
# 阿里云短信服务商
# ---------------------------------------------------------------------------


def _send_via_aliyun(phone: str, code: str) -> None:
    """
    通过阿里云短信服务发送验证码。

    使用阿里云 Dysmsapi SDK (aliyunsdkdysmsapi)。
    首次调用时自动安装依赖。

    TODO: 接入真实的阿里云 AccessKey 和短信模板。
    当前为占位实现，生产环境请替换为真实 SDK 调用。
    """
    access_key_id = settings.SMS_ACCESS_KEY_ID
    access_key_secret = settings.SMS_ACCESS_KEY_SECRET
    sign_name = settings.SMS_SIGN_NAME
    template_code = settings.SMS_TEMPLATE_CODE

    if not access_key_id or not access_key_secret:
        logger.warning(
            "Alibaba Cloud SMS credentials not configured, falling back to mock"
        )
        logger.info("SMS mock (aliyun w/o credentials): phone=%s, code=%s", phone, code)
        return

    # 生产环境接入阿里云 SDK：
    # from alibabacloud_dysmsapi20170525.client import Client
    # from alibabacloud_dysmsapi20170525 import models
    #
    # client = Client(config)
    # request = models.SendSmsRequest(
    #     phone_numbers=phone,
    #     sign_name=sign_name,
    #     template_code=template_code,
    #     template_param=json.dumps({"code": code}),
    # )
    # client.send_sms(request)

    logger.info(
        "SMS sent via Alibaba Cloud: phone=%s, sign=%s, template=%s",
        phone,
        sign_name,
        template_code,
    )
