"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.1
 * Created      : 2026-07-14
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
"""

"""extend_customers_table

Revision ID: 44adad58fb7c
Revises: 3432279dcfb9
Create Date: 2026-07-14 02:20:20.036987

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '44adad58fb7c'
down_revision: Union[str, Sequence[str], None] = '3432279dcfb9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create Sequence
    op.execute("CREATE SEQUENCE customer_code_seq START WITH 1 INCREMENT BY 1")

    # 2. Add Columns
    op.add_column('customers', sa.Column('pan', sa.String(length=10), nullable=True))
    op.add_column('customers', sa.Column('alternate_mobile', sa.String(length=15), nullable=True))
    op.add_column('customers', sa.Column('customer_type', sa.String(length=20), nullable=True))
    op.add_column('customers', sa.Column('aadhaar', sa.String(length=20), nullable=True))
    op.add_column('customers', sa.Column('billing_address_line1', sa.String(length=255), nullable=True))
    op.add_column('customers', sa.Column('billing_address_line2', sa.String(length=255), nullable=True))
    op.add_column('customers', sa.Column('billing_city', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('billing_state', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('billing_country', sa.String(length=100), server_default='India', nullable=True))
    op.add_column('customers', sa.Column('billing_pincode', sa.String(length=10), nullable=True))
    op.add_column('customers', sa.Column('shipping_same_as_billing', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('customers', sa.Column('shipping_address_line1', sa.String(length=255), nullable=True))
    op.add_column('customers', sa.Column('shipping_address_line2', sa.String(length=255), nullable=True))
    op.add_column('customers', sa.Column('shipping_city', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('shipping_state', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('shipping_country', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('shipping_pincode', sa.String(length=10), nullable=True))
    op.add_column('customers', sa.Column('price_list_id', sa.String(length=50), nullable=True))
    op.add_column('customers', sa.Column('salesperson', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('territory', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('route', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('credit_limit_override', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('customers', sa.Column('credit_days_override', sa.Integer(), nullable=True))
    op.add_column('customers', sa.Column('opening_balance', sa.Numeric(precision=12, scale=2), server_default='0', nullable=True))
    op.add_column('customers', sa.Column('opening_balance_type', sa.String(length=2), nullable=True))
    op.add_column('customers', sa.Column('blacklisted', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('customers', sa.Column('photo_url', sa.String(length=500), nullable=True))
    op.add_column('customers', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('customers', sa.Column('anniversary_date', sa.Date(), nullable=True))
    op.add_column('customers', sa.Column('gender', sa.String(length=20), nullable=True))
    op.add_column('customers', sa.Column('occupation', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('preferred_language', sa.String(length=20), nullable=True))
    op.add_column('customers', sa.Column('loyalty_member', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('customers', sa.Column('lead_source', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Drop Columns
    op.drop_column('customers', 'notes')
    op.drop_column('customers', 'lead_source')
    op.drop_column('customers', 'loyalty_member')
    op.drop_column('customers', 'preferred_language')
    op.drop_column('customers', 'occupation')
    op.drop_column('customers', 'gender')
    op.drop_column('customers', 'anniversary_date')
    op.drop_column('customers', 'date_of_birth')
    op.drop_column('customers', 'photo_url')
    op.drop_column('customers', 'blacklisted')
    op.drop_column('customers', 'opening_balance_type')
    op.drop_column('customers', 'opening_balance')
    op.drop_column('customers', 'credit_days_override')
    op.drop_column('customers', 'credit_limit_override')
    op.drop_column('customers', 'route')
    op.drop_column('customers', 'territory')
    op.drop_column('customers', 'salesperson')
    op.drop_column('customers', 'price_list_id')
    op.drop_column('customers', 'shipping_pincode')
    op.drop_column('customers', 'shipping_country')
    op.drop_column('customers', 'shipping_state')
    op.drop_column('customers', 'shipping_city')
    op.drop_column('customers', 'shipping_address_line2')
    op.drop_column('customers', 'shipping_address_line1')
    op.drop_column('customers', 'shipping_same_as_billing')
    op.drop_column('customers', 'billing_pincode')
    op.drop_column('customers', 'billing_country')
    op.drop_column('customers', 'billing_state')
    op.drop_column('customers', 'billing_city')
    op.drop_column('customers', 'billing_address_line2')
    op.drop_column('customers', 'billing_address_line1')
    op.drop_column('customers', 'aadhaar')
    op.drop_column('customers', 'customer_type')
    op.drop_column('customers', 'alternate_mobile')
    op.drop_column('customers', 'pan')

    # 2. Drop Sequence
    op.execute("DROP SEQUENCE customer_code_seq")
