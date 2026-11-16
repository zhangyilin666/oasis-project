"""add reports and analysis_logs

Revision ID: 9197e852ba5f
Revises:
Create Date: 2026-05-30 12:28:47.918624
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9197e852ba5f'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 最早版本曾依赖手工创建 users；全新数据库也必须能够从零迁移。
    if not sa.inspect(op.get_bind()).has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("openid", sa.String(255), nullable=False, unique=True),
            sa.Column("nickname", sa.String(255), nullable=True),
            sa.Column("avatar_url", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
    # ---- reports ----
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            comment="关联用户ID",
        ),
        sa.Column(
            "birth_info",
            sa.String(100),
            nullable=False,
            comment="用户输入出生时间字符串",
        ),
        sa.Column(
            "calendar_data",
            sa.JSON(),
            nullable=False,
            comment="lunar-python 排盘结果",
        ),
        sa.Column(
            "ai_analysis",
            sa.Text(),
            nullable=False,
            comment="AI生成运势分析",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
            comment="最后更新时间（重新生成分析时更新）",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reports_id"), "reports", ["id"])
    op.create_index(op.f("ix_reports_user_id"), "reports", ["user_id"])

    # ---- analysis_logs ----
    op.create_table(
        "analysis_logs",
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
            sa.ForeignKey("reports.id", ondelete="SET NULL"),
            nullable=True,
            comment="关联报告ID（删除报告时保留日志，仅置空）",
        ),
        sa.Column(
            "model_name",
            sa.String(50),
            nullable=False,
            comment="使用的LLM模型名称",
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="success",
            comment="调用状态: success / failed / timeout",
        ),
        sa.Column(
            "prompt_tokens",
            sa.Integer(),
            nullable=True,
            comment="Prompt token 用量（失败时为 NULL）",
        ),
        sa.Column(
            "completion_tokens",
            sa.Integer(),
            nullable=True,
            comment="Completion token 用量（失败时为 NULL）",
        ),
        sa.Column(
            "total_tokens",
            sa.Integer(),
            nullable=True,
            comment="总 token 用量（失败时为 NULL）",
        ),
        sa.Column(
            "latency_ms",
            sa.Integer(),
            nullable=False,
            comment="API响应延迟(毫秒)",
        ),
        sa.Column(
            "trace_id",
            sa.String(64),
            nullable=True,
            comment="请求追踪ID，用于串联日志",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="记录创建时间",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_analysis_logs_id"), "analysis_logs", ["id"])
    op.create_index(op.f("ix_analysis_logs_user_id"), "analysis_logs", ["user_id"])
    op.create_index(op.f("ix_analysis_logs_report_id"), "analysis_logs", ["report_id"])
    op.create_index(op.f("ix_analysis_logs_model_name"), "analysis_logs", ["model_name"])
    op.create_index(op.f("ix_analysis_logs_trace_id"), "analysis_logs", ["trace_id"])
    op.create_index(op.f("ix_analysis_logs_created_at"), "analysis_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_analysis_logs_created_at"), table_name="analysis_logs")
    op.drop_index(op.f("ix_analysis_logs_trace_id"), table_name="analysis_logs")
    op.drop_index(op.f("ix_analysis_logs_model_name"), table_name="analysis_logs")
    op.drop_index(op.f("ix_analysis_logs_report_id"), table_name="analysis_logs")
    op.drop_index(op.f("ix_analysis_logs_user_id"), table_name="analysis_logs")
    op.drop_index(op.f("ix_analysis_logs_id"), table_name="analysis_logs")
    op.drop_table("analysis_logs")
    op.drop_index(op.f("ix_reports_user_id"), table_name="reports")
    op.drop_index(op.f("ix_reports_id"), table_name="reports")
    op.drop_table("reports")
