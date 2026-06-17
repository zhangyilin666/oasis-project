"""add daily_fortunes table

Revision ID: 35229dce3d2f
Revises: 9197e852ba5f
Create Date: 2026-06-02 16:19:01.619247

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '35229dce3d2f'
down_revision: Union[str, None] = '9197e852ba5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_fortunes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            comment="关联用户ID",
        ),
        sa.Column(
            "report_id",
            sa.Integer(),
            sa.ForeignKey("reports.id", ondelete="CASCADE"),
            nullable=False,
            comment="关联八字报告ID（用于提取八字数据）",
        ),
        sa.Column(
            "fortune_date",
            sa.Date(),
            nullable=False,
            comment="运势日期（今天）",
        ),
        sa.Column(
            "day_gan_zhi",
            sa.String(10),
            nullable=False,
            comment="今日干支，如 壬寅",
        ),
        sa.Column(
            "day_relation",
            sa.String(20),
            nullable=False,
            comment="今日日干与日主的十神关系，如 偏印",
        ),
        sa.Column(
            "clash_info",
            sa.String(50),
            nullable=True,
            comment="日支冲合提示，如 子午冲·注意口舌",
        ),
        sa.Column(
            "fortune_text",
            sa.Text(),
            nullable=False,
            comment="AI生成的运势解读（200字以内）",
        ),
        sa.Column(
            "lucky_color",
            sa.String(20),
            nullable=True,
            comment="幸运色",
        ),
        sa.Column(
            "lucky_direction",
            sa.String(20),
            nullable=True,
            comment="幸运方位",
        ),
        sa.Column(
            "warning",
            sa.String(200),
            nullable=True,
            comment="注意事项/提醒",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="生成时间",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "fortune_date", name="uq_daily_fortune_user_date"),
    )
    op.create_index(op.f("ix_daily_fortunes_id"), "daily_fortunes", ["id"])
    op.create_index(op.f("ix_daily_fortunes_user_id"), "daily_fortunes", ["user_id"])
    op.create_index(op.f("ix_daily_fortunes_report_id"), "daily_fortunes", ["report_id"])
    op.create_index(op.f("ix_daily_fortunes_fortune_date"), "daily_fortunes", ["fortune_date"])


def downgrade() -> None:
    op.drop_index(op.f("ix_daily_fortunes_fortune_date"), table_name="daily_fortunes")
    op.drop_index(op.f("ix_daily_fortunes_report_id"), table_name="daily_fortunes")
    op.drop_index(op.f("ix_daily_fortunes_user_id"), table_name="daily_fortunes")
    op.drop_index(op.f("ix_daily_fortunes_id"), table_name="daily_fortunes")
    op.drop_table("daily_fortunes")
