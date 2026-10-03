"""v1385 -- Allow configurable 3-12 character alphanumeric company codes."""
from alembic import op

revision = "v1385_configurable_company_code"
down_revision = "v1384_company_code_constraint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies DROP CONSTRAINT IF EXISTS chk_company_code_format")
    op.execute("""
        ALTER TABLE companies
        ADD CONSTRAINT chk_company_code_format
        CHECK (
            company_code IS NULL
            OR (
                company_code ~ '^[A-Z0-9]{3,12}$'
                AND company_code NOT IN ('000', 'SYS')
            )
        )
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP CONSTRAINT IF EXISTS chk_company_code_format")
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