"""Add administrator roles and previous account IDs without changing accounts.

Revision ID: e2a73c9b4d10
Revises: d9f2a67b103c
"""
from alembic import op
import sqlalchemy as sa

revision = "e2a73c9b4d10"
down_revision = "d9f2a67b103c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_table(
        "user_id_aliases",
        sa.Column("old_user_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("old_user_id"),
    )
    op.create_index("ix_user_id_aliases_user_id", "user_id_aliases", ["user_id"])


def downgrade():
    op.drop_index("ix_user_id_aliases_user_id", table_name="user_id_aliases")
    op.drop_table("user_id_aliases")
    op.drop_column("users", "is_admin")
