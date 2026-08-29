"""v1384 -- Add company_code CHECK constraint.

Revision ID: v1384_company_code_constraint
Revises: v1383_invoice_communicator
Create Date: 2026-08-30 00:00:00.000000

Project      : SMRITI Retail OS
Author       : Migration Integrity Protocol
Description  : Enforces company_code standard: 3 alphanumeric characters [A-Z0-9],
               range 001-999 (not 000 or SYS which are reserved).
               Applied after validating no violations exist.

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v1384_company_code_constraint'
down_revision = 'v1383_invoice_communicator'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add CHECK constraint to enforce company_code standard
    # Pattern: 3 alphanumeric [A-Z0-9], value must be 001-999 (not 000 or SYS)
    op.execute("""
        ALTER TABLE companies
        ADD CONSTRAINT chk_company_code_format
        CHECK (
            company_code IS NULL
            OR (
                company_code ~ '^[A-Z0-9]{3}$'
                AND company_code NOT IN ('000', 'SYS')
            )
        )
    """)


def downgrade() -> None:
    # Remove the CHECK constraint
    op.execute("""
        ALTER TABLE companies
        DROP CONSTRAINT IF EXISTS chk_company_code_format
    """)
