"""Preserve report input for explicit retry.

Revision ID: b7e61c942a01
Revises: a1b2c3d4e5f6
"""
from alembic import op
import sqlalchemy as sa

revision = "b7e61c942a01"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("reports", sa.Column("input_data", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("reports", "input_data")
