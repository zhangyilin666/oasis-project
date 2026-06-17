"""add_payment_and_membership_tables

Revision ID: 3b4672aeb634
Revises: 5b8e9f1c2d3a
Create Date: 2026-06-14 15:44:28.207215

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3b4672aeb634'
down_revision = '5b8e9f1c2d3a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('payment_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='关联用户ID'),
        sa.Column('order_no', sa.String(length=32), nullable=False, comment='订单号（PAY + 时间戳 + 随机码）'),
        sa.Column('plan_type', sa.String(length=20), nullable=False, comment='计划类型: single_report / monthly_premium / yearly_premium'),
        sa.Column('amount_fen', sa.Integer(), nullable=False, comment='金额（分），¥9.9 = 990'),
        sa.Column('pay_method', sa.String(length=20), nullable=False, comment='支付方式: wxpay_app / alipay_app'),
        sa.Column('provider', sa.String(length=20), nullable=False, comment='支付服务商: wxpay / alipay / mock'),
        sa.Column('status', sa.String(length=20), nullable=False, comment='订单状态: pending / paid / expired / refunded'),
        sa.Column('provider_trade_no', sa.String(length=64), nullable=True, comment='微信/支付宝交易号（回调时填入）'),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True, comment='支付完成时间'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='最后更新时间'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_orders_order_no'), 'payment_orders', ['order_no'], unique=True)
    op.create_index(op.f('ix_payment_orders_status'), 'payment_orders', ['status'], unique=False)
    op.create_index(op.f('ix_payment_orders_user_id'), 'payment_orders', ['user_id'], unique=False)

    op.create_table('user_memberships',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='关联用户ID'),
        sa.Column('level', sa.String(length=20), nullable=False, comment='会员等级: free / premium'),
        sa.Column('credits_remaining', sa.Integer(), nullable=False, comment='单次报告剩余次数'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True, comment='会员生效时间'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True, comment='会员到期时间，NULL=永不过期'),
        sa.Column('source_order_id', sa.Integer(), nullable=True, comment='来源支付订单ID'),
        sa.Column('is_active', sa.Boolean(), nullable=False, comment='是否为当前有效会员记录'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='最后更新时间'),
        sa.ForeignKeyConstraint(['source_order_id'], ['payment_orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_memberships_expires_at'), 'user_memberships', ['expires_at'], unique=False)
    op.create_index(op.f('ix_user_memberships_user_id'), 'user_memberships', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_memberships_user_id'), table_name='user_memberships')
    op.drop_index(op.f('ix_user_memberships_expires_at'), table_name='user_memberships')
    op.drop_table('user_memberships')
    op.drop_index(op.f('ix_payment_orders_user_id'), table_name='payment_orders')
    op.drop_index(op.f('ix_payment_orders_status'), table_name='payment_orders')
    op.drop_index(op.f('ix_payment_orders_order_no'), table_name='payment_orders')
    op.drop_table('payment_orders')
