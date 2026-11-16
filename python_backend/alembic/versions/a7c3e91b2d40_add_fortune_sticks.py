"""Add the daily fortune-stick table.

Revision ID: a7c3e91b2d40
Revises: f4c2b91e7a30

One row per user per China calendar date. The optional question is not stored.
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c3e91b2d40"
down_revision = "f4c2b91e7a30"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "fortune_sticks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("stick_date", sa.Date(), nullable=False),
        sa.Column("sign_number", sa.Integer(), nullable=False),
        sa.Column("grade", sa.String(length=8), nullable=False),
        sa.Column("title", sa.String(length=64), nullable=False),
        sa.Column("poem", sa.Text(), nullable=False),
        sa.Column("line", sa.String(length=40), nullable=False),
        sa.Column("plain", sa.Text(), nullable=False),
        sa.Column("cat", sa.Text(), nullable=False),
        sa.Column("used_fallback", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "stick_date", name="uq_fortune_stick_user_date"),
    )
    op.create_index("ix_fortune_sticks_user_id", "fortune_sticks", ["user_id"])


def downgrade():
    op.drop_index("ix_fortune_sticks_user_id", table_name="fortune_sticks")
    op.drop_table("fortune_sticks")
