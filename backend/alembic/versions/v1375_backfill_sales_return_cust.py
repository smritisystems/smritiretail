"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Alembic v1375 -- SalesReturn.customer_id Back-fill
===================================================
Sprint 21 data migration.

Context:
  Alembic v1374 (Sprint 18) added the customer_id column to sales_returns
  (nullable=True) as a denorm from the original sales invoice.
  Rows created BEFORE v1374 have customer_id = NULL.

This migration back-fills customer_id on all existing sales_return rows
by joining to sales_invoices via original_invoice_id.

SQL (upgrade):
  UPDATE sales_returns sr
  SET customer_id = si.customer_id
  FROM sales_invoices si
  WHERE sr.original_invoice_id = si.id
    AND sr.customer_id IS NULL
    AND si.customer_id IS NOT NULL;

SQL (downgrade):
  -- Back-fill is safe to leave; column existed before this migration.
  -- No-op downgrade (column stays, data stays).
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "v1375_backfill_sales_return_cust"
down_revision = "v1374_sales_return_cust"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Back-fill sales_returns.customer_id from original sales_invoices."""
    op.execute(
        """
        UPDATE sales_returns sr
        SET    customer_id = si.customer_id
        FROM   sales_invoices si
        WHERE  sr.original_invoice_id = si.id
          AND  sr.customer_id IS NULL
          AND  si.customer_id IS NOT NULL
        """
    )


def downgrade() -> None:
    """
    No-op downgrade.
    The customer_id column itself was created in v1374; we do not drop
    back-filled data on downgrade as it is non-destructive metadata.
    To fully revert, downgrade to v1374 which will handle the column removal.
    """
    pass
