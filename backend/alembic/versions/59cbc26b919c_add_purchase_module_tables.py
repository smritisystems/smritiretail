"""add_purchase_module_tables

Revision ID: 59cbc26b919c
Revises: 8cf33df7b76a
Create Date: 2026-07-11 19:55:58.697645

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '59cbc26b919c'
down_revision: Union[str, Sequence[str], None] = '8cf33df7b76a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ── suppliers ─────────────────────────────────────────────────────────────
    op.create_table(
        'suppliers',
        sa.Column('name',        sa.String(255),    nullable=False),
        sa.Column('code',        sa.String(50),     nullable=False),
        sa.Column('gst_number',  sa.String(20),     nullable=True),
        sa.Column('mobile',      sa.String(20),     nullable=True),
        sa.Column('email',       sa.String(255),    nullable=True),
        sa.Column('address',     sa.Text(),         nullable=True),
        sa.Column('city',        sa.String(100),    nullable=True),
        sa.Column('state',       sa.String(100),    nullable=True),
        sa.Column('pincode',     sa.String(10),     nullable=True),
        sa.Column('outstanding', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        # BaseEntity columns
        sa.Column('id',          sa.String(50),     nullable=False),
        sa.Column('uuid',        sa.String(36),     nullable=False, unique=True),
        sa.Column('company_id',  sa.String(50),     sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id',   sa.String(50),     sa.ForeignKey('branches.id',  ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by',  sa.String(100),    nullable=True),
        sa.Column('updated_by',  sa.String(100),    nullable=True),
        sa.Column('is_active',   sa.Boolean(),      server_default='true'),
        sa.Column('is_deleted',  sa.Boolean(),      server_default='false'),
        sa.Column('deleted_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by',  sa.String(100),    nullable=True),
        sa.Column('version',     sa.Integer(),      server_default='1'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── purchase_orders ───────────────────────────────────────────────────────
    op.create_table(
        'purchase_orders',
        sa.Column('order_no',    sa.String(100),    nullable=False, unique=True),
        sa.Column('supplier_id', sa.String(50),     sa.ForeignKey('suppliers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status',      sa.String(20),     nullable=False, server_default='DRAFT'),
        sa.Column('notes',       sa.Text(),         nullable=True),
        sa.Column('subtotal',    sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('tax_total',   sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('grand_total', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('id',          sa.String(50),     nullable=False),
        sa.Column('uuid',        sa.String(36),     nullable=False, unique=True),
        sa.Column('company_id',  sa.String(50),     sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id',   sa.String(50),     sa.ForeignKey('branches.id',  ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by',  sa.String(100),    nullable=True),
        sa.Column('updated_by',  sa.String(100),    nullable=True),
        sa.Column('is_active',   sa.Boolean(),      server_default='true'),
        sa.Column('is_deleted',  sa.Boolean(),      server_default='false'),
        sa.Column('deleted_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by',  sa.String(100),    nullable=True),
        sa.Column('version',     sa.Integer(),      server_default='1'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── purchase_order_items ──────────────────────────────────────────────────
    op.create_table(
        'purchase_order_items',
        sa.Column('order_id',   sa.String(50), sa.ForeignKey('purchase_orders.id', ondelete='CASCADE'),  nullable=False),
        sa.Column('product_id', sa.String(50), sa.ForeignKey('products.id',        ondelete='RESTRICT'), nullable=False),
        sa.Column('code',       sa.String(50),     nullable=False),
        sa.Column('name',       sa.String(255),    nullable=False),
        sa.Column('quantity',   sa.Numeric(10, 2), nullable=False),
        sa.Column('cost_price', sa.Numeric(15, 2), nullable=False),
        sa.Column('gst_rate',   sa.Numeric(5, 2),  nullable=False, server_default='18.00'),
        sa.Column('tax_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('line_total', sa.Numeric(15, 2), nullable=False),
        sa.Column('id',          sa.String(50),    nullable=False),
        sa.Column('uuid',        sa.String(36),    nullable=False, unique=True),
        sa.Column('company_id',  sa.String(50),    sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id',   sa.String(50),    sa.ForeignKey('branches.id',  ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by',  sa.String(100),   nullable=True),
        sa.Column('updated_by',  sa.String(100),   nullable=True),
        sa.Column('is_active',   sa.Boolean(),     server_default='true'),
        sa.Column('is_deleted',  sa.Boolean(),     server_default='false'),
        sa.Column('deleted_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by',  sa.String(100),   nullable=True),
        sa.Column('version',     sa.Integer(),     server_default='1'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── purchase_receipts ─────────────────────────────────────────────────────
    op.create_table(
        'purchase_receipts',
        sa.Column('receipt_no',  sa.String(100),   nullable=False, unique=True),
        sa.Column('supplier_id', sa.String(50),    sa.ForeignKey('suppliers.id',       ondelete='RESTRICT'), nullable=False),
        sa.Column('order_id',    sa.String(50),    sa.ForeignKey('purchase_orders.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status',      sa.String(20),    nullable=False, server_default='PENDING'),
        sa.Column('notes',       sa.Text(),        nullable=True),
        sa.Column('subtotal',    sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('tax_total',   sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('grand_total', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('id',          sa.String(50),    nullable=False),
        sa.Column('uuid',        sa.String(36),    nullable=False, unique=True),
        sa.Column('company_id',  sa.String(50),    sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id',   sa.String(50),    sa.ForeignKey('branches.id',  ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by',  sa.String(100),   nullable=True),
        sa.Column('updated_by',  sa.String(100),   nullable=True),
        sa.Column('is_active',   sa.Boolean(),     server_default='true'),
        sa.Column('is_deleted',  sa.Boolean(),     server_default='false'),
        sa.Column('deleted_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by',  sa.String(100),   nullable=True),
        sa.Column('version',     sa.Integer(),     server_default='1'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── purchase_receipt_items ────────────────────────────────────────────────
    op.create_table(
        'purchase_receipt_items',
        sa.Column('receipt_id',         sa.String(50), sa.ForeignKey('purchase_receipts.id', ondelete='CASCADE'),  nullable=False),
        sa.Column('product_id',         sa.String(50), sa.ForeignKey('products.id',          ondelete='RESTRICT'), nullable=False),
        sa.Column('code',               sa.String(50),     nullable=False),
        sa.Column('name',               sa.String(255),    nullable=False),
        sa.Column('quantity_ordered',   sa.Numeric(10, 2), nullable=True),
        sa.Column('quantity_received',  sa.Numeric(10, 2), nullable=False),
        sa.Column('cost_price',         sa.Numeric(15, 2), nullable=False),
        sa.Column('gst_rate',           sa.Numeric(5, 2),  nullable=False, server_default='18.00'),
        sa.Column('tax_amount',         sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('line_total',         sa.Numeric(15, 2), nullable=False),
        sa.Column('id',          sa.String(50),    nullable=False),
        sa.Column('uuid',        sa.String(36),    nullable=False, unique=True),
        sa.Column('company_id',  sa.String(50),    sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id',   sa.String(50),    sa.ForeignKey('branches.id',  ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by',  sa.String(100),   nullable=True),
        sa.Column('updated_by',  sa.String(100),   nullable=True),
        sa.Column('is_active',   sa.Boolean(),     server_default='true'),
        sa.Column('is_deleted',  sa.Boolean(),     server_default='false'),
        sa.Column('deleted_at',  sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by',  sa.String(100),   nullable=True),
        sa.Column('version',     sa.Integer(),     server_default='1'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('purchase_receipt_items')
    op.drop_table('purchase_receipts')
    op.drop_table('purchase_order_items')
    op.drop_table('purchase_orders')
    op.drop_table('suppliers')
