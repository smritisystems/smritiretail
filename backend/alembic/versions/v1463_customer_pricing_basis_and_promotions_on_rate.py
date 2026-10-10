"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1463 – customer_pricing_basis_and_promotions_on_rate: add pricing_basis and allow_promotions_on_rate to customers table

Revision ID: v1463_customer_pricing_basis_and_promotions_on_rate
Revises:     v1462_billing_csv_templates_and_import_logs
Create Date: 2026-09-17
"""

from alembic import op
import sqlalchemy as sa


revision: str = "v1463_customer_pricing_basis_and_promotions_on_rate"
down_revision: str = "v1462_billing_csv_templates_and_import_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add pricing_basis column to customers table (Default: 'MRP')
    op.add_column(
        "customers",
        sa.Column(
            "pricing_basis",
            sa.String(length=20),
            nullable=False,
            server_default="MRP",
        ),
    )

    # 2. Add allow_promotions_on_rate column to customers table (Default: False)
    op.add_column(
        "customers",
        sa.Column(
            "allow_promotions_on_rate",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # 3. Create index on pricing_basis for rapid lookup during POS / billing resolution
    op.create_index(
        "ix_customers_pricing_basis",
        "customers",
        ["pricing_basis"],
    )


def downgrade() -> None:
    op.drop_index("ix_customers_pricing_basis", table_name="customers")
    op.drop_column("customers", "allow_promotions_on_rate")
    op.drop_column("customers", "pricing_basis")
