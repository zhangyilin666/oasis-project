"""add phone auth and otp_codes table

Revision ID: 5b8e9f1c2d3a
Revises: 9c112361dfcb
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b8e9f1c2d3a'
down_revision: Union[str, None] = '9c112361dfcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users 表: openid 改为可空（App 手机号用户无 openid）
    op.alter_column(
        "users",
        "openid",
        existing_type=sa.String(128),
        nullable=True,
        existing_comment="微信小程序用户唯一标识（App 手机号用户为 NULL）",
    )

    # 2. users 表: 新增手机号相关列
    op.add_column(
        "users",
        sa.Column(
            "phone",
            sa.String(20),
            nullable=True,
            comment="手机号（App 登录用）",
        ),
    )
    op.create_index(op.f("ix_users_phone"), "users", ["phone"], unique=True)

    op.add_column(
        "users",
        sa.Column(
            "phone_verified",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="手机号是否已验证",
        ),
    )

    # 3. users 表: 新增最近登录时间
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(),
            nullable=True,
            comment="最近登录时间",
        ),
    )

    # 4. 新建 otp_codes 表
    op.create_table(
        "otp_codes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("phone", sa.String(20), nullable=False, comment="接收短信的手机号"),
        sa.Column("code", sa.String(6), nullable=False, comment="6 位数字验证码"),
        sa.Column(
            "purpose",
            sa.String(20),
            nullable=False,
            server_default="'login'",
            comment="用途: login | bind | reset",
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False, comment="验证码过期时间"),
        sa.Column(
            "used",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否已使用",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_otp_codes_phone"), "otp_codes", ["phone"])


def downgrade() -> None:
    op.drop_index(op.f("ix_otp_codes_phone"), table_name="otp_codes")
    op.drop_table("otp_codes")

    op.drop_column("users", "last_login_at")
    op.drop_column("users", "phone_verified")
    op.drop_index(op.f("ix_users_phone"), table_name="users")
    op.drop_column("users", "phone")

    op.alter_column(
        "users",
        "openid",
        existing_type=sa.String(128),
        nullable=False,
    )
