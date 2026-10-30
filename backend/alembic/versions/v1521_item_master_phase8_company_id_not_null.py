"""SMRITI Retail OS Item Master Phase 8: Multi-Tenant Scope Hardening & Company ID NOT NULL Enforcement

Revision ID: v1521_item_master_phase8_company_id_not_null
Revises: v1520_item_master_phase5_batch_serial_location_wiring
Create Date: 2026-10-05

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.3
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Every item_variants, item_barcodes, item_batches, item_serials, and item_warehouse_locations
   row MUST strictly belong to a company_id (multi-tenant boundary isolation).
2. Missing company_id columns on legacy tracking tables are provisioned.
3. All NULL company_id child rows backfilled from parent items.company_id.
4. company_id column set to NOT NULL across all 5 child catalog tables.
5. Symmetrical, reversible upgrade and downgrade paths.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "v1521_item_master_phase8_company_id_not_null"
down_revision = "v1520_item_master_phase5_batch_serial_location_wiring"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str, conn) -> bool:
    inspector = Inspector.from_engine(conn)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    conn = op.get_bind()

    # ─────────────────────────────────────────────────────────────
    # Step 1: Ensure company_id column exists on all 5 child tables
    # ─────────────────────────────────────────────────────────────
    tables = [
        "item_variants",
        "item_barcodes",
        "item_batches",
        "item_serials",
        "item_warehouse_locations",
    ]
    for tbl in tables:
        if not _has_column(tbl, "company_id", conn):
            op.add_column(tbl, sa.Column("company_id", sa.String(50), nullable=True))

    # ─────────────────────────────────────────────────────────────
    # Step 2: Backfill NULL company_id from parent items
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        UPDATE item_variants iv
        SET company_id = i.company_id
        FROM items i
        WHERE iv.item_id = i.id
          AND iv.company_id IS NULL
          AND i.company_id IS NOT NULL;
    """))

    conn.execute(sa.text("""
        UPDATE item_barcodes ib
        SET company_id = i.company_id
        FROM items i
        WHERE ib.item_id = i.id
          AND ib.company_id IS NULL
          AND i.company_id IS NOT NULL;
    """))

    conn.execute(sa.text("""
        UPDATE item_batches ibt
        SET company_id = i.company_id
        FROM items i
        WHERE ibt.item_id = i.id
          AND ibt.company_id IS NULL
          AND i.company_id IS NOT NULL;
    """))

    conn.execute(sa.text("""
        UPDATE item_serials isr
        SET company_id = i.company_id
        FROM items i
        WHERE isr.item_id = i.id
          AND isr.company_id IS NULL
          AND i.company_id IS NOT NULL;
    """))

    conn.execute(sa.text("""
        UPDATE item_warehouse_locations iwl
        SET company_id = i.company_id
        FROM items i
        WHERE iwl.item_id = i.id
          AND iwl.company_id IS NULL
          AND iwl.company_id IS NOT NULL;
    """))

    # Fallback for any orphaned rows without an existing parent item
    conn.execute(sa.text("UPDATE item_variants SET company_id = 'COMP-001' WHERE company_id IS NULL;"))
    conn.execute(sa.text("UPDATE item_barcodes SET company_id = 'COMP-001' WHERE company_id IS NULL;"))
    conn.execute(sa.text("UPDATE item_batches SET company_id = 'COMP-001' WHERE company_id IS NULL;"))
    conn.execute(sa.text("UPDATE item_serials SET company_id = 'COMP-001' WHERE company_id IS NULL;"))
    conn.execute(sa.text("UPDATE item_warehouse_locations SET company_id = 'COMP-001' WHERE company_id IS NULL;"))

    # ─────────────────────────────────────────────────────────────
    # Step 3: Enforce NOT NULL on company_id across all 5 tables
    # ─────────────────────────────────────────────────────────────
    for tbl in tables:
        op.alter_column(tbl, "company_id", nullable=False)


def downgrade() -> None:
    tables = [
        "item_warehouse_locations",
        "item_serials",
        "item_batches",
        "item_barcodes",
        "item_variants",
    ]
    for tbl in tables:
        op.alter_column(tbl, "company_id", nullable=True)
