"""v1389 -- Parked experimental architecture documentation.

Revision ID: v1389_parked_experimental_architecture
Revises: v1388_platform_analytics
Create Date: 2026-08-30 00:00:04.000000

Project      : SMRITI Retail OS
Author       : Migration Integrity Protocol
Description  : Document parked experimental architecture per ARCHITECTURE_DECISIONS.md. These tables belong to origin/feat/physically-isolated-company-dbs and are NOT part of v3.25.0 canonical schema.

Parked Tables (DO NOT MIGRATE):
- control_companies
- control_company_databases
- control_users
- psv_stock_balances
- psv_stock_events

These tables are explicitly excluded from v3.25.0 mainline and remain on experimental feature branch.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v1389_park'
down_revision = 'v1388_plat'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This migration documents parked experimental architecture.
    # No DDL operations are performed.
    # See ARCHITECTURE_DECISIONS.md for details on physically-isolated-company-dbs feature branch.
    pass


def downgrade() -> None:
    # No DDL operations to reverse.
    pass
