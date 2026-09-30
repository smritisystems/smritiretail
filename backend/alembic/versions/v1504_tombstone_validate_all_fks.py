"""v1504: Ghost tombstone insertion + VALIDATE CONSTRAINT for all 4 remaining NOT VALID FKs

Strategy: tombstone/ghost row insertion (NOT orphan deletion or archival).
Child records (real business data: invoices, credit ledger, packing slips, dispatches)
remain intact in place. Ghost rows inserted in parent tables (products, customers)
to satisfy FK constraints, clearly marked with is_deleted=TRUE / name='[DELETED]...'.

This preserves all historical operational records and makes FKs fully enforced.

Ghost rows inserted:
  products table: 66 tombstone rows (26 from sales_invoice_items + 40 from packing_slip_items
                  + dispatch_items; UNION deduped)
    Fields: id=orphan_id, name='[DELETED] <id>', code='TOMBSTONE-<id>',
            category='TOMBSTONE', barcode='TOMB-<id>', price=0, stock=0,
            reserved_stock=0, is_deleted=TRUE, uuid=gen_random_uuid()

  customers table: 158 tombstone rows (from customer_credit_ledger_entries)
    Fields: id=orphan_id, name='[DELETED CUSTOMER] <id>', uuid=gen_random_uuid()

Pre-validate orphan checks (all passed at 0):
  sales_invoice_items.product_id:          0 orphans after 66 ghost products inserted
  customer_credit_ledger_entries.customer_id: 0 orphans after 158 ghost customers inserted
  packing_slip_items.product_id:            0 orphans
  dispatch_items.product_id:                0 orphans

VALIDATE CONSTRAINT results (all 4 succeeded):
  ALTER TABLE sales_invoice_items              VALIDATE CONSTRAINT fk_sii_product_id;
  ALTER TABLE customer_credit_ledger_entries   VALIDATE CONSTRAINT fk_ccle_customer_id;
  ALTER TABLE packing_slip_items               VALIDATE CONSTRAINT fk_psi_product_id;
  ALTER TABLE dispatch_items                   VALIDATE CONSTRAINT fk_di_product_id;

Final FK audit state (smriti001):
  17/17 audit constraints validated = TRUE (convalidated = t)

Note on ghost rows:
  Ghost products are identifiable by: category = 'TOMBSTONE' AND is_deleted = TRUE
  Ghost customers are identifiable by: name LIKE '[DELETED CUSTOMER]%'
  These should be excluded from all business-facing queries via existing is_deleted filters.
  A future cleanup pass can DELETE ghost rows only after all child references are archived
  or migrated.

Run as:
  alembic -x target=tenant -x db=smriti001 upgrade v1504

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-09-29
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sqlalchemy as sa
from alembic import op

revision = "v1504"
down_revision = "v1503"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # 1. Insert ghost tombstone rows in products for all orphaned product_id values
    bind.execute(sa.text("""
        INSERT INTO products (id, uuid, code, name, price, stock, category, barcode, reserved_stock, is_deleted)
        SELECT orphan_id, gen_random_uuid()::text,
               'TOMBSTONE-' || orphan_id, '[DELETED] ' || orphan_id,
               0, 0, 'TOMBSTONE', 'TOMB-' || orphan_id, 0, TRUE
        FROM (
            SELECT DISTINCT sii.product_id AS orphan_id
            FROM sales_invoice_items sii LEFT JOIN products p ON p.id = sii.product_id
            WHERE p.id IS NULL AND sii.product_id IS NOT NULL AND sii.product_id != ''
            UNION
            SELECT DISTINCT ps.product_id
            FROM packing_slip_items ps LEFT JOIN products p ON p.id = ps.product_id
            WHERE p.id IS NULL AND ps.product_id IS NOT NULL
            UNION
            SELECT DISTINCT di.product_id
            FROM dispatch_items di LEFT JOIN products p ON p.id = di.product_id
            WHERE p.id IS NULL AND di.product_id IS NOT NULL
        ) orphans
        ON CONFLICT (id) DO NOTHING
    """))

    # 2. Insert ghost tombstone rows in customers for all orphaned customer_id values
    bind.execute(sa.text("""
        INSERT INTO customers (id, uuid, name)
        SELECT orphan_id, gen_random_uuid()::text, '[DELETED CUSTOMER] ' || orphan_id
        FROM (
            SELECT DISTINCT c.customer_id AS orphan_id
            FROM customer_credit_ledger_entries c
            LEFT JOIN customers cu ON cu.id = c.customer_id
            WHERE cu.id IS NULL AND c.customer_id IS NOT NULL
        ) orphans
        ON CONFLICT (id) DO NOTHING
    """))

    def _constraint_exists(tbl: str, con: str) -> bool:
        return bool(bind.execute(sa.text(
            "SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid "
            "WHERE t.relname = :tbl AND c.conname = :con"
        ), {"tbl": tbl, "con": con}).scalar())

    # 3. Verify and VALIDATE constraints that exist in this database
    for table, col, ref_table, ref_col, constraint_name in [
        ("sales_invoice_items",             "product_id",  "products",  "id", "fk_sii_product_id"),
        ("customer_credit_ledger_entries",  "customer_id", "customers", "id", "fk_ccle_customer_id"),
        ("packing_slip_items",              "product_id",  "products",  "id", "fk_psi_product_id"),
        ("dispatch_items",                  "product_id",  "products",  "id", "fk_di_product_id"),
    ]:
        if not _constraint_exists(table, constraint_name):
            continue
        extra = " AND t.product_id != ''" if col == "product_id" else ""
        orphans = bind.execute(sa.text(
            f"SELECT COUNT(*) FROM {table} t "
            f"LEFT JOIN {ref_table} r ON r.{ref_col} = t.{col} "
            f"WHERE r.{ref_col} IS NULL AND t.{col} IS NOT NULL{extra}"
        )).scalar()
        if orphans != 0:
            raise RuntimeError(
                f"v1504: {orphans} orphans remain in {table}.{col} after ghost insertion — aborting"
            )
        bind.execute(sa.text(
            f"ALTER TABLE {table} VALIDATE CONSTRAINT {constraint_name}"
        ))


def downgrade():
    # Reverse VALIDATE (mark NOT VALID again) -- DDL only, does not remove ghost rows
    bind = op.get_bind()
    # PostgreSQL has no direct "un-validate" DDL; constraints remain validated after downgrade.
    # Ghost rows must be removed manually if a full rollback is needed.
    # Document: this downgrade is a no-op for the constraint state.
    pass