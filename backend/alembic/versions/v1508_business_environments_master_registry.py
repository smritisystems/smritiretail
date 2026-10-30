"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Master Registry Seed & Governance

v1508: Add business_environments master registry.
Creates the business_environments lookup table and seeds the three
core supply-chain operating environments used by the master registry.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1508"
down_revision: Union[str, Sequence[str], None] = "v1507"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS business_environments (
            environment_code VARCHAR(50) PRIMARY KEY,
            display_name VARCHAR(150) NOT NULL,
            market_type VARCHAR(50) NOT NULL,
            operational_scale VARCHAR(50) NOT NULL,
            fulfillment_role TEXT NOT NULL
        );
    """))

    bind.execute(sa.text("""
        INSERT INTO business_environments (
            environment_code,
            display_name,
            market_type,
            operational_scale,
            fulfillment_role
        ) VALUES
            (
                'DISTRIBUTOR',
                'Distributor',
                'B2B',
                'Macro Bulk',
                'Manages regional logistics, high-volume factory sourcing, and brand promotion.'
            ),
            (
                'WHOLESALER',
                'Wholesaler',
                'B2B',
                'Micro Bulk',
                'Breaks down bulk shipments into smaller case lots for local business resale.'
            ),
            (
                'RETAILER',
                'Retailer',
                'B2C',
                'Unit Retail',
                'Sells individual units directly to the end consumer via storefronts or e-commerce.'
            )
        ON CONFLICT (environment_code) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            market_type = EXCLUDED.market_type,
            operational_scale = EXCLUDED.operational_scale,
            fulfillment_role = EXCLUDED.fulfillment_role;
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("""
        DROP TABLE IF EXISTS business_environments;
    """))
