"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Alembic Migration: Add address columns to customers table
Revision: c4d5e6f7g8h9
"""

from typing import Union, Sequence
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# Revision identifiers
revision: str = "c4d5e6f7g8h9"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7g8"
branch_labels = None
depends_on = None

def column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns

def upgrade() -> None:
    # Adding billing columns
    if not column_exists("customers", "billing_address_line1"):
        op.add_column("customers", sa.Column("billing_address_line1", sa.String(255), nullable=True))
    if not column_exists("customers", "billing_address_line2"):
        op.add_column("customers", sa.Column("billing_address_line2", sa.String(255), nullable=True))
    if not column_exists("customers", "billing_city"):
        op.add_column("customers", sa.Column("billing_city", sa.String(100), nullable=True))
    if not column_exists("customers", "billing_state"):
        op.add_column("customers", sa.Column("billing_state", sa.String(100), nullable=True))
    if not column_exists("customers", "billing_country"):
        op.add_column("customers", sa.Column("billing_country", sa.String(100), server_default="India", nullable=True))
    if not column_exists("customers", "billing_pincode"):
        op.add_column("customers", sa.Column("billing_pincode", sa.String(10), nullable=True))
        
    # Same as billing toggle
    if not column_exists("customers", "shipping_same_as_billing"):
        op.add_column("customers", sa.Column("shipping_same_as_billing", sa.Boolean(), server_default=sa.text("true"), nullable=True))
        
    # Adding shipping columns
    if not column_exists("customers", "shipping_address_line1"):
        op.add_column("customers", sa.Column("shipping_address_line1", sa.String(255), nullable=True))
    if not column_exists("customers", "shipping_address_line2"):
        op.add_column("customers", sa.Column("shipping_address_line2", sa.String(255), nullable=True))
    if not column_exists("customers", "shipping_city"):
        op.add_column("customers", sa.Column("shipping_city", sa.String(100), nullable=True))
    if not column_exists("customers", "shipping_state"):
        op.add_column("customers", sa.Column("shipping_state", sa.String(100), nullable=True))
    if not column_exists("customers", "shipping_country"):
        op.add_column("customers", sa.Column("shipping_country", sa.String(100), nullable=True))
    if not column_exists("customers", "shipping_pincode"):
        op.add_column("customers", sa.Column("shipping_pincode", sa.String(10), nullable=True))
        
    # Additional addresses JSONB
    if not column_exists("customers", "additional_addresses"):
        op.add_column("customers", sa.Column("additional_addresses", postgresql.JSONB, server_default=sa.text("'[]'::jsonb"), nullable=True))

def downgrade() -> None:
    # Drop columns if they exist
    if column_exists("customers", "additional_addresses"):
        op.drop_column("customers", "additional_addresses")
    if column_exists("customers", "shipping_pincode"):
        op.drop_column("customers", "shipping_pincode")
    if column_exists("customers", "shipping_country"):
        op.drop_column("customers", "shipping_country")
    if column_exists("customers", "shipping_state"):
        op.drop_column("customers", "shipping_state")
    if column_exists("customers", "shipping_city"):
        op.drop_column("customers", "shipping_city")
    if column_exists("customers", "shipping_address_line2"):
        op.drop_column("customers", "shipping_address_line2")
    if column_exists("customers", "shipping_address_line1"):
        op.drop_column("customers", "shipping_address_line1")
    if column_exists("customers", "shipping_same_as_billing"):
        op.drop_column("customers", "shipping_same_as_billing")
    if column_exists("customers", "billing_pincode"):
        op.drop_column("customers", "billing_pincode")
    if column_exists("customers", "billing_country"):
        op.drop_column("customers", "billing_country")
    if column_exists("customers", "billing_state"):
        op.drop_column("customers", "billing_state")
    if column_exists("customers", "billing_city"):
        op.drop_column("customers", "billing_city")
    if column_exists("customers", "billing_address_line2"):
        op.drop_column("customers", "billing_address_line2")
    if column_exists("customers", "billing_address_line1"):
        op.drop_column("customers", "billing_address_line1")
