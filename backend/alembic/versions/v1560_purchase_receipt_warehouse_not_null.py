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

Migration strategy:
  Step 1 — Backfill: for each company that has NULL warehouse_id GRNs,
            assign the oldest active warehouse for that company.
            If no warehouse exists for a company, preserve its NULLs.
  Step 2 — Add a NOT VALID check so new/updated rows require a warehouse while
            legacy NULL rows remain untouched.

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

If this returns rows, they are preserved for explicit business resolution. The
NOT VALID check protects new and updated rows without rewriting historical receipts.

Legacy NULL receipt rows remain readable, but updating one requires assigning its
warehouse first. Downgrade drops the check and does not restore prior values.
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

    # Existing receipts without a safe company warehouse remain unchanged.
    # PostgreSQL enforces this check for new/updated rows while not scanning
    # legacy rows until an operator validates it after resolving them.
    op.execute(
        "ALTER TABLE purchase_receipts "
        "ADD CONSTRAINT ck_purchase_receipts_warehouse_id_present "
        "CHECK (warehouse_id IS NOT NULL) NOT VALID"
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_purchase_receipts_warehouse_id_present",
        "purchase_receipts",
        type_="check",
    )
