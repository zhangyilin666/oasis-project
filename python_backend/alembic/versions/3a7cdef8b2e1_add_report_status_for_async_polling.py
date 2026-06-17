"""add report status for async polling

Revision ID: 3a7cdef8b2e1
Revises: 35229dce3d2f
Create Date: 2026-06-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a7cdef8b2e1'
down_revision: Union[str, None] = '35229dce3d2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Relax nullability for pending reports
    op.alter_column(
        "reports",
        "ai_analysis",
        existing_type=sa.Text(),
        nullable=True,
        existing_comment="AI生成运势分析（pending/processing 时为 NULL）",
    )
    op.alter_column(
        "reports",
        "calendar_data",
        existing_type=sa.JSON(),
        nullable=True,
        existing_comment="lunar-python 排盘结果（pending/processing 时为 NULL）",
    )

    # 2. Add status column
    op.add_column(
        "reports",
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="报告状态: pending/processing/completed/failed",
        ),
    )
    op.create_index(op.f("ix_reports_status"), "reports", ["status"])

    # 3. Add error_message column
    op.add_column(
        "reports",
        sa.Column(
            "error_message",
            sa.Text(),
            nullable=True,
            comment="失败原因（仅 status=failed 时有值）",
        ),
    )

    # 4. Composite index for rate-limit queries
    op.create_index(op.f("ix_reports_user_id_status"), "reports", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_reports_user_id_status"), table_name="reports")
    op.drop_index(op.f("ix_reports_status"), table_name="reports")
    op.drop_column("reports", "error_message")
    op.drop_column("reports", "status")
    op.alter_column("reports", "calendar_data", existing_type=sa.JSON(), nullable=False)
    op.alter_column("reports", "ai_analysis", existing_type=sa.Text(), nullable=False)
