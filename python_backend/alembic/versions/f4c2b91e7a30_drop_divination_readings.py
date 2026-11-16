"""Drop divination readings after removing 问卦.

Revision ID: f4c2b91e7a30
Revises: e2a73c9b4d10

Downgrade recreates an empty table. Old reading rows are not restored.
"""
from alembic import op
import sqlalchemy as sa

revision = "f4c2b91e7a30"
down_revision = "e2a73c9b4d10"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("ix_divination_user_created", table_name="divination_readings")
    op.drop_table("divination_readings")


def downgrade():
    op.create_table(
        "divination_readings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(64), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=True),
        sa.Column("rule_version", sa.String(64), nullable=True),
        sa.Column("input_data", sa.JSON(), nullable=True),
        sa.Column("facts", sa.JSON(), nullable=True),
        sa.Column("analysis", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("error_message", sa.String(300), nullable=True),
        sa.Column("model_name", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "request_id", name="uq_divination_user_request"),
        sa.CheckConstraint("status IN ('pending','processing','completed','failed')", name="ck_divination_status"),
    )
    op.create_index("ix_divination_user_created", "divination_readings", ["user_id", "created_at"])
