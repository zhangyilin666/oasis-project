"""add device_id to users

Revision ID: a1b2c3d4e5f6
Revises: 35229dce3d2f
Create Date: 2026-06-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3b4672aeb634'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "device_id",
            sa.String(64),
            nullable=True,
            comment="设备唯一标识（匿名登录用）",
        ),
    )
    op.create_index(op.f("ix_users_device_id"), "users", ["device_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_device_id"), table_name="users")
    op.drop_column("users", "device_id")
