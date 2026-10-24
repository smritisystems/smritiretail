"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Revision ID: v1535_psv_parties_store_uniqueness
Revises: v1534_procurement_pr_rfq_quotations
Create Date: 2026-10-16
Classification: Sales & Modern Trade — PSV Parties Store Uniqueness Constraints
"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "v1535_psv_parties_store_uniqueness"
down_revision: str | Sequence[str] | None = "v1534_procurement_pr_rfq_quotations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Partial Unique Index: company_id + delivery_location_id
    # Guarantees exactly one PSV party account per canonical store delivery location in a company tenant.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_psv_parties_company_deliv_loc
        ON psv_parties (company_id, delivery_location_id)
        WHERE (delivery_location_id IS NOT NULL);
        """
    )

    # 2. Partial Unique Index: company_id + host_customer_id + store_code
    # Guarantees exactly one PSV party account per customer store code in a company tenant.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_psv_parties_company_cust_store
        ON psv_parties (company_id, host_customer_id, store_code)
        WHERE (host_customer_id IS NOT NULL AND store_code IS NOT NULL);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_psv_parties_company_cust_store;")
    op.execute("DROP INDEX IF EXISTS uq_psv_parties_company_deliv_loc;")
