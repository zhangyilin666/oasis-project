#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
猫来运转 项目 .env 交互式生成工具。

在当前目录（python_backend/）生成 .env 文件，
交互式提示输入各项配置，最终写入带注释的 .env。

用法::

    cd python_backend
    python generate_env.py
"""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path


def _prompt(label: str, default: str = "", secret: bool = False) -> str:
    """交互式输入，支持默认值和隐藏输入。"""
    if default:
        hint = f"{label} [{default}]: "
    else:
        hint = f"{label}: "

    value = input(hint).strip()
    if not value and default:
        value = default

    if secret and value:
        # 显示掩码确认
        masked = value[:4] + "***" if len(value) > 8 else "***"
        print(f"  → {masked}")

    return value


def main():
    env_path = Path(__file__).resolve().parent / ".env"

    if env_path.exists():
        overwrite = input(".env 已存在，覆盖? [y/N]: ").strip().lower()
        if overwrite != "y":
            print("已取消。要重新生成请先删除 .env 或改名。")
            return

    print("=" * 60)
    print("  猫来运转 项目 .env 生成器")
    print("  按提示输入，直接回车使用默认值")
    print("=" * 60)
    print()

    # ── 基础配置 ──
    app_name = _prompt("应用名称", "猫来运转")
    debug = _prompt("调试模式 (True/False)", "False")

    # ── 数据库 ──
    print("\n--- 数据库 ---")
    db_host = _prompt("  主机地址", "127.0.0.1")
    db_port = _prompt("  端口", "3306")
    db_name = _prompt("  数据库名", "oasis_db")
    db_user = _prompt("  用户名", "oasis_user")
    db_password = _prompt("  密码", "", secret=True)
    db_url = f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"

    # ── JWT ──
    print("\n--- JWT ---")
    jwt_secret = _prompt(
        "  JWT 签名密钥（回车自动生成）",
        secrets.token_hex(32),
    )

    # ── AI Provider ──
    print("\n--- AI Provider ---")
    ai_provider = _prompt("  后端 (deepseek/anthropic)", "deepseek")

    if ai_provider == "deepseek":
        ds_key = _prompt("  DeepSeek API Key", "", secret=True)
        ds_url = _prompt("  DeepSeek Base URL", "https://api.deepseek.com")
        ds_model = _prompt("  DeepSeek 模型", "deepseek-chat")
        anthropic_key = ""
        anthropic_model = "claude-sonnet-4-6"
    else:
        ds_key = ""
        ds_url = "https://api.deepseek.com"
        ds_model = "deepseek-chat"
        anthropic_key = _prompt("  Anthropic API Key", "", secret=True)
        anthropic_model = _prompt("  Anthropic 模型", "claude-sonnet-4-6")

    # ── 微信小程序 ──
    print("\n--- 微信小程序 ---")
    wx_appid = _prompt("  AppID（默认 wx02953379e1c05a27）", "wx02953379e1c05a27")
    wx_secret = _prompt("  AppSecret", "", secret=True)

    # ── CORS ──
    print("\n--- CORS ---")
    cors_origins = _prompt(
        "  CORS 允许来源（* = 全部；生产环境填具体域名，逗号分隔）",
        "https://your-domain.com",
    )

    # ── 速率限制 ──
    rate_limit = _prompt("  每用户每天最大分析次数（0=无限制）", "5")

    # ── 组装 .env 文件 ──
    env_content = f"""# 猫来运转 项目环境配置 — 由 generate_env.py 生成
# 生成时间: {__import__('datetime').datetime.now().isoformat()}

# ── 基础配置 ──
APP_NAME={app_name}
APP_VERSION=1.0.0
DEBUG={debug}

# ── 数据库 ──
DATABASE_URL={db_url}

# ── JWT ──
JWT_SECRET_KEY={jwt_secret}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080

# ── AI Provider ──
AI_PROVIDER={ai_provider}
DEEPSEEK_API_KEY={ds_key}
DEEPSEEK_BASE_URL={ds_url}
DEEPSEEK_DEFAULT_MODEL={ds_model}
ANTHROPIC_API_KEY={anthropic_key}
ANTHROPIC_DEFAULT_MODEL={anthropic_model}

# ── 微信小程序 ──
WECHAT_APPID={wx_appid}
WECHAT_SECRET={wx_secret}

# ── CORS ──
CORS_ORIGINS={cors_origins}

# ── 速率限制 ──
RATE_LIMIT_ANALYZE_PER_DAY={rate_limit}
"""

    env_path.write_text(env_content, encoding="utf-8")
    print(f"\n✅ .env 已写入: {env_path}")
    print(f"   需要时可再次运行 `python generate_env.py` 修改配置。")


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\n\n已取消。")
        sys.exit(0)
