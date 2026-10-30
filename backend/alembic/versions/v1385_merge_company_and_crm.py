"""Merge the company-code and CRM migration branches.

Revision ID: v1385_merge_company_crm
Revises: v1385_configurable_company_code, v1385_crm
"""

from alembic import op

revision = "v1385_merge_company_crm"
down_revision = ("v1385_configurable_company_code", "v1385_crm")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This is a pure branch-merge migration. No schema change required.
    pass


def downgrade() -> None:
    pass
