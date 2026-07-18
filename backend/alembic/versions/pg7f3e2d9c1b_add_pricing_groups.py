"""add_pricing_groups_table_and_customer_pricing_group_fk

Revision ID: a1b2c3d4e5f6
Revises: 9d5410572bdf
Create Date: 2026-07-18

Migration Summary
-----------------
Adds the `pricing_groups` table (PricingGroup entity) and a nullable
`pricing_group_id` FK column on the `customers` table.

Design rationale
----------------
CustomerGroup  — business classification ("What TYPE of customer is this?")
PricingGroup   — commercial pricing strategy ("Which price list applies?")

Keeping them separate allows a single customer category (e.g. 'Retailer') to
have multiple pricing strategies (Retail Price, VIP Price, Promotional,
Corporate Contract) without changing the customer's business classification.
This is consistent with the user's explicit architecture requirement.

FK constraints
--------------
customers.pricing_group_id  ON DELETE SET NULL
    → When a PricingGroup is deleted, affected customers fall back to system
      default pricing (no cascading delete of customer records).

Rollback
--------
down_revision removes the FK column and drops the pricing_groups table.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# ---------------------------------------------------------------------------
# Revision identifiers
# ---------------------------------------------------------------------------
revision: str = 'pg7f3e2d9c1b'
down_revision: Union[str, Sequence[str], None] = '9d5410572bdf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create pricing_groups table
    # ------------------------------------------------------------------
    op.create_table(
        'pricing_groups',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        # --- Pricing strategy fields ---
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('base_price_field', sa.String(30), nullable=False, server_default='price'),
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('price_adjustment', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('rounding_rule', sa.String(30), nullable=False, server_default='Nearest1'),
        sa.Column('max_additional_discount_percent', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('tax_inclusive', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('scheme_eligible', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('quantity_break_eligible', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('min_order_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        # --- Tenant scope ---
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        # --- Audit fields (BaseEntity) ---
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        # --- Constraints ---
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_pricing_groups_name'),
    )
    op.create_index('ix_pricing_groups_company_branch', 'pricing_groups',
                    ['company_id', 'branch_id'])

    # ------------------------------------------------------------------
    # 2. Add pricing_group_id FK column to customers
    # ------------------------------------------------------------------
    op.add_column(
        'customers',
        sa.Column('pricing_group_id', sa.String(50), nullable=True),
    )
    op.create_foreign_key(
        'fk_customers_pricing_group_id',
        'customers', 'pricing_groups',
        ['pricing_group_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_customers_pricing_group_id', 'customers', ['pricing_group_id'])

    # ------------------------------------------------------------------
    # 3. Add description column to customer_groups (additive, nullable)
    # ------------------------------------------------------------------
    op.add_column(
        'customer_groups',
        sa.Column('description', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    # Reverse in opposite order
    op.drop_column('customer_groups', 'description')

    op.drop_index('ix_customers_pricing_group_id', table_name='customers')
    op.drop_constraint('fk_customers_pricing_group_id', 'customers', type_='foreignkey')
    op.drop_column('customers', 'pricing_group_id')

    op.drop_index('ix_pricing_groups_company_branch', table_name='pricing_groups')
    op.drop_table('pricing_groups')
