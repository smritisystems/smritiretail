"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.127.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

v1560 - Enforce NOT NULL on purchase_receipts.warehouse_id (R-003)

Business decision applied: warehouse attribution on a GRN is mandatory.
A goods receipt without a warehouse destination is logistically meaningless
— stock cannot be received without knowing where it is stored.

Migration strategy (safe two-step):
  Step 1 — Backfill: for each company that has NULL warehouse_id GRNs,
            assign the oldest active warehouse for that company.
            If no warehouse exists for a company, that company's NULLs
            remain (they will block the NOT NULL constraint; see note below).
  Step 2 — Alter column to NOT NULL.

BEFORE APPLYING: Run this diagnostic to confirm zero unresolvable NULLs:

  SELECT pr.id, pr.company_id
  FROM purchase_receipts pr
  LEFT JOIN (
    SELECT DISTINCT ON (company_id) id, company_id
    FROM warehouses
    WHERE is_deleted = false AND is_active = true
    ORDER BY company_id, created_at ASC
  ) w ON w.company_id = pr.company_id
  WHERE pr.warehouse_id IS NULL AND w.id IS NULL;

If this returns rows, create a warehouse for those companies first.

Downgrade: reverts the column back to nullable; does NOT restore NULL values.
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "v1560"
down_revision: Union[str, None] = "v1559"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Backfill NULL warehouse_id rows using each company's oldest active warehouse.
    conn.execute(sa.text("""
        UPDATE purchase_receipts pr
        SET warehouse_id = (
            SELECT w.id
            FROM warehouses w
            WHERE w.company_id = pr.company_id
              AND w.is_deleted = false
              AND w.is_active  = true
            ORDER BY
                w.is_default_for_branch DESC,
                w.created_at ASC
            LIMIT 1
        )
        WHERE pr.warehouse_id IS NULL
    """))

    # Step 2: Alter column to NOT NULL.
    # If any NULLs remain after the backfill (companies with no warehouses),
    # this will raise an error — which is intentional. Resolve the warehouse
    # configuration for those companies and re-run.
    op.alter_column(
        "purchase_receipts",
        "warehouse_id",
        nullable=False,
        existing_type=sa.String(50),
    )


def downgrade() -> None:
    op.alter_column(
        "purchase_receipts",
        "warehouse_id",
        nullable=True,
        existing_type=sa.String(50),
    )
