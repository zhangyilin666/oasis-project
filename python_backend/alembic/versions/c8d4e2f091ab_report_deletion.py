"""Track deleted reports while retaining their submission count.

Revision ID: c8d4e2f091ab
Revises: b7e61c942a01
"""
from alembic import op
import sqlalchemy as sa

revision = "c8d4e2f091ab"
down_revision = "b7e61c942a01"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("reports", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("reports", "deleted_at")
