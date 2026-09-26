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
Classification: SMRITI Phase 1 Schema Remediation — Wave 2

Phase 1 Schema Remediation Wave 2 — Additive CHECK Constraints & Compound Uniqueness.

This migration adds database-level invariants on price, quantity, discount/tax bounds,
and ledger balancing to prevent invalid or corrupt transactional records.
Constraints are added using the PostgreSQL online pattern (NOT VALID followed by VALIDATE),
ensuring zero downtime.

Audit Source: SMRITI_Phase1_Schema_Audit_v1.0.0.md
Findings: H-001 (HIGH), I-001 (HIGH), I-002 (MEDIUM)

Revision ID: v1491_additive_check_constraints_wave2
Revises: v1490_fk_cascade_to_restrict_wave1
Create Date: 2026-09-25
"""

from collections.abc import Sequence

from alembic import op

revision: str = "v1491_additive_check_constraints_wave2"
down_revision: str | Sequence[str] | None = "v1490_fk_cascade_to_restrict_wave1"
branch_labels = None
depends_on = None

# List of CHECK constraints to create: (table, constraint_name, check_expression)
_CHECK_CONSTRAINTS = [
    # 1. Sales Invoice Items: quantity > 0, price >= 0, gst_rate between 0 and 100
    ("sales_invoice_items", "chk_sii_quantity_positive", "quantity > 0"),
    ("sales_invoice_items", "chk_sii_price_non_negative", "price >= 0"),
    ("sales_invoice_items", "chk_sii_gst_rate_bounds", "gst_rate >= 0 AND gst_rate <= 100"),
    # 2. Purchase Order Items: quantity > 0, cost_price >= 0, gst_rate between 0 and 100
    ("purchase_order_items", "chk_poi_quantity_positive", "quantity > 0"),
    ("purchase_order_items", "chk_poi_cost_price_non_negative", "cost_price >= 0"),
    ("purchase_order_items", "chk_poi_gst_rate_bounds", "gst_rate >= 0 AND gst_rate <= 100"),
    # 3. Stock Movements: quantity != 0 (accommodates signed ledger entries)
    ("stock_movements", "chk_stock_movement_qty_nonzero", "quantity != 0"),
    # 4. General Ledger: non-negative debit and credit amounts
    (
        "general_ledger_entries",
        "chk_gle_amounts_non_negative",
        "debit_amount >= 0 AND credit_amount >= 0",
    ),
    # 5. Journal Vouchers: total_debit == total_credit (balanced double-entry invariant)
    ("journal_vouchers", "chk_jv_balanced", "total_debit = total_credit"),
]


def upgrade() -> None:
    """
    Apply additive CHECK constraints using NOT VALID + VALIDATE pattern,
    and add compound unique constraint (company_id, invoice_no) on sales_invoices.
    """
    # Step 1: Add each CHECK constraint with NOT VALID, then validate
    for table, constraint_name, expr in _CHECK_CONSTRAINTS:
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT {constraint_name} CHECK ({expr}) NOT VALID;"
        )
        op.execute(
            f"ALTER TABLE {table} VALIDATE CONSTRAINT {constraint_name};"
        )

    # Step 2: Add compound unique constraint on sales_invoices (company_id, invoice_no)
    op.create_unique_constraint(
        "uq_sales_invoices_company_invoice_no",
        "sales_invoices",
        ["company_id", "invoice_no"],
    )


def downgrade() -> None:
    """
    Drop compound unique constraint and all CHECK constraints added in Wave 2.
    """
    # Step 1: Drop compound unique constraint
    op.drop_constraint(
        "uq_sales_invoices_company_invoice_no",
        "sales_invoices",
        type_="unique",
    )

    # Step 2: Drop all CHECK constraints
    for table, constraint_name, _ in reversed(_CHECK_CONSTRAINTS):
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint_name};")
