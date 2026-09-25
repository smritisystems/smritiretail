"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Phase 1 Schema Remediation — Wave 1

Phase 1 Schema Remediation Wave 1 — FK CASCADE to RESTRICT on Financial & Transactional Tables.

This migration changes six ON DELETE CASCADE foreign key constraints to ON DELETE RESTRICT
on critical financial and transactional tables. No data is modified. This is zero-downtime
on PostgreSQL 15 — constraint recreation does not acquire an exclusive table lock.

Audit Source: SMRITI_Phase1_Schema_Audit_v1.0.0.md
Findings: C-001 (CRITICAL), C-002 (HIGH), C-003 (HIGH), C-004 (HIGH), D-001 (CRITICAL), D-003 (HIGH)

Revision ID: v1490_fk_cascade_to_restrict_wave1
Revises: v1489_transaction_integrity_engine
Create Date: 2026-09-25
"""

from collections.abc import Sequence

from alembic import op

revision: str = "v1490_fk_cascade_to_restrict_wave1"
down_revision: str | Sequence[str] | None = "v1489_transaction_integrity_engine"
branch_labels = None
depends_on = None


# ─────────────────────────────────────────────────────────────────────────────
# WAVE 1 FK CHANGES
#
# Pattern for each:
#   1. DROP existing CASCADE constraint (non-blocking — no data change)
#   2. ADD RESTRICT constraint (non-blocking — only validates new DML)
#
# Verification SQL (post-migration):
#   SELECT table_name, constraint_name, delete_rule
#   FROM information_schema.referential_constraints
#   WHERE constraint_name IN (
#     'fk_gle_voucher_id_restrict',
#     'fk_payment_alloc_payment_restrict',
#     'fk_so_invoice_alloc_order_restrict',
#     'fk_so_reservation_order_restrict',
#     'fk_fiscal_period_year_restrict',
#     'fk_purchase_receipt_item_receipt_restrict'
#   );
# ─────────────────────────────────────────────────────────────────────────────

_CHANGES = [
    # (table, old_constraint_name, column, ref_table, ref_col, new_constraint_name)
    (
        "general_ledger_entries",
        "general_ledger_entries_voucher_id_fkey",
        "voucher_id",
        "journal_vouchers",
        "id",
        "fk_gle_voucher_id_restrict",
    ),
    (
        "payment_allocations",
        "payment_allocations_payment_id_fkey",
        "payment_id",
        "payment_transactions",
        "id",
        "fk_payment_alloc_payment_restrict",
    ),
    (
        "sales_order_invoice_allocations",
        "sales_order_invoice_allocations_order_id_fkey",
        "order_id",
        "sales_orders",
        "id",
        "fk_so_invoice_alloc_order_restrict",
    ),
    (
        "sales_order_reservations",
        "sales_order_reservations_order_id_fkey",
        "order_id",
        "sales_orders",
        "id",
        "fk_so_reservation_order_restrict",
    ),
    (
        "fiscal_periods",
        "fiscal_periods_fiscal_year_id_fkey",
        "fiscal_year_id",
        "fiscal_years",
        "id",
        "fk_fiscal_period_year_restrict",
    ),
    (
        "purchase_receipt_items",
        "purchase_receipt_items_receipt_id_fkey",
        "receipt_id",
        "purchase_receipts",
        "id",
        "fk_purchase_receipt_item_receipt_restrict",
    ),
]

# Rollback mapping: old_constraint_name → (table, column, ref_table, ref_col)
_ROLLBACK = {
    (table, old_name, col, ref_table, ref_col, new_name): (
        table, old_name, col, ref_table, ref_col
    )
    for (table, old_name, col, ref_table, ref_col, new_name) in _CHANGES
}


def upgrade() -> None:
    """
    Change 6 ON DELETE CASCADE foreign keys to ON DELETE RESTRICT.
    This prevents hard-deletion of parent financial/transactional records
    from cascading into child audit records.
    Non-blocking on PostgreSQL 15.
    """
    for table, old_fk, column, ref_table, ref_col, new_fk in _CHANGES:
        # Step 1: Drop the old CASCADE constraint
        op.drop_constraint(old_fk, table, type_="foreignkey")

        # Step 2: Re-create with RESTRICT
        op.create_foreign_key(
            new_fk,
            table,
            ref_table,
            [column],
            [ref_col],
            ondelete="RESTRICT",
        )


def downgrade() -> None:
    """
    Restore ON DELETE CASCADE on all six foreign keys.
    No data is affected — constraint recreation only.
    """
    for table, old_fk, column, ref_table, ref_col, new_fk in _CHANGES:
        # Step 1: Drop the RESTRICT constraint
        op.drop_constraint(new_fk, table, type_="foreignkey")

        # Step 2: Re-create with CASCADE (restores original state)
        op.create_foreign_key(
            old_fk,
            table,
            ref_table,
            [column],
            [ref_col],
            ondelete="CASCADE",
        )
