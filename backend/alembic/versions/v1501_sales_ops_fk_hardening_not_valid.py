"""v1501: Sales + Ops FK hardening - Part 4b of Full System Audit (NOT VALID FKs)

Adds 6 FK constraints with NOT VALID because live orphan data prevents immediate validation.
Enforces referential integrity for ALL NEW rows immediately.
Historical orphan rows are documented and must be cleaned before VALIDATE CONSTRAINT.

NOT VALID FK details and orphan evidence:

  1. sales_invoice_items.product_id -> products.id (RESTRICT)
     954 orphan rows across 26 distinct deleted product_ids.
     These are invoice line items referencing products that were deleted.
     Action: Audit and reassign/archive before VALIDATE.

  2. customer_credit_ledger_entries.customer_id -> customers.id (SET NULL)
     158 orphan rows, all carry cust- prefixed IDs not in customers table.
     These are ledger entries for deleted/migrated customer accounts.
     Action: Audit and archive before VALIDATE.

  3. packing_slip_items.product_id -> products.id (RESTRICT)
     70 orphan rows across 41 distinct deleted product_ids.
     Packing slips reference products no longer in the products table.
     Action: Audit and archive before VALIDATE.

  4. dispatch_items.product_id -> products.id (RESTRICT)
     45 orphan rows. All referencing deleted products.
     Action: Audit and archive before VALIDATE.

  5. po_product_decision_log.product_id -> products.id (RESTRICT)
     25 orphan rows out of 33 populated. Decision log for deleted products.
     Action: Audit and archive before VALIDATE.

  6. product_cost_valuations.product_id -> products.id (RESTRICT)
     7 orphan rows out of 28 populated. Cost valuations for deleted products.
     Action: Audit and archive before VALIDATE.

ARCH-DRIFT-002 (tracked, no FK added - polymorphic references):
  - general_ledger_entries.party_id: 585 populated, 305 -> customers, 22 -> suppliers,
    258 true orphans. Field is a discriminated union (party_id can be a customer or supplier),
    not a canonical parties.id reference. Requires a discriminator column + partial FKs
    or migration to two explicit columns (customer_id, supplier_id).
    Resolution: ARCH-DRIFT-002 — file as separate RFC before addressing.

  - payment_transactions.party_id: 453 populated, 346 -> customers, 107 true orphans.
    Same polymorphic pattern. Resolution: same as above.

ARCH-DRIFT-003 (tracked, no FK added - all orphans, no parent table match):
  - psv_party_scopes.party_id: 29 rows, all 29 are orphans with no match in
    parties, customers, or suppliers. This table is a PSV (platform scope)
    table; party_id may reference a different entity class not yet in schema.
    Resolution: ARCH-DRIFT-003 — needs PSV architecture review.

Run as:
  alembic -x target=tenant -x db=smriti001 upgrade v1501

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-09-29
Modified     : 2026-09-29
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sqlalchemy as sa
from alembic import op

revision = "v1501"
down_revision = "v1500"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    r = bind.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:t"
    ), {"t": table_name})
    return bool((r.scalar() or 0) > 0)


def _fk_exists(bind, constraint_name: str) -> bool:
    r = bind.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.table_constraints "
        "WHERE constraint_name = :c"
    ), {"c": constraint_name})
    return bool((r.scalar() or 0) > 0)


def _is_system_or_control_db(bind) -> bool:
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    return not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1")


def upgrade():
    bind = op.get_bind()
    if _is_system_or_control_db(bind):
        return

    # All 6 constraints added as NOT VALID to protect new rows without
    # blocking on historical orphan data. Use VALIDATE CONSTRAINT after
    # orphan cleanup to fully enforce.

    # 1. sales_invoice_items.product_id -> products.id
    if _table_exists(bind, "sales_invoice_items") and _table_exists(bind, "products"):
        if not _fk_exists(bind, "fk_sii_product_id"):
            bind.execute(sa.text(
                "ALTER TABLE sales_invoice_items "
                "ADD CONSTRAINT fk_sii_product_id FOREIGN KEY (product_id) "
                "REFERENCES products(id) ON DELETE RESTRICT NOT VALID"
            ))

    # 2. customer_credit_ledger_entries.customer_id -> customers.id
    if _table_exists(bind, "customer_credit_ledger_entries") and _table_exists(bind, "customers"):
        if not _fk_exists(bind, "fk_ccle_customer_id"):
            bind.execute(sa.text(
                "ALTER TABLE customer_credit_ledger_entries "
                "ADD CONSTRAINT fk_ccle_customer_id FOREIGN KEY (customer_id) "
                "REFERENCES customers(id) ON DELETE SET NULL NOT VALID"
            ))

    # 3. packing_slip_items.product_id -> products.id
    if _table_exists(bind, "packing_slip_items") and _table_exists(bind, "products"):
        if not _fk_exists(bind, "fk_psi_product_id"):
            bind.execute(sa.text(
                "ALTER TABLE packing_slip_items "
                "ADD CONSTRAINT fk_psi_product_id FOREIGN KEY (product_id) "
                "REFERENCES products(id) ON DELETE RESTRICT NOT VALID"
            ))

    # 4. dispatch_items.product_id -> products.id
    if _table_exists(bind, "dispatch_items") and _table_exists(bind, "products"):
        if not _fk_exists(bind, "fk_di_product_id"):
            bind.execute(sa.text(
                "ALTER TABLE dispatch_items "
                "ADD CONSTRAINT fk_di_product_id FOREIGN KEY (product_id) "
                "REFERENCES products(id) ON DELETE RESTRICT NOT VALID"
            ))

    # 5. po_product_decision_log.product_id -> products.id
    if _table_exists(bind, "po_product_decision_log") and _table_exists(bind, "products"):
        if not _fk_exists(bind, "fk_ppdl_product_id"):
            bind.execute(sa.text(
                "ALTER TABLE po_product_decision_log "
                "ADD CONSTRAINT fk_ppdl_product_id FOREIGN KEY (product_id) "
                "REFERENCES products(id) ON DELETE RESTRICT NOT VALID"
            ))

    # 6. product_cost_valuations.product_id -> products.id
    if _table_exists(bind, "product_cost_valuations") and _table_exists(bind, "products"):
        if not _fk_exists(bind, "fk_pcv_product_id"):
            bind.execute(sa.text(
                "ALTER TABLE product_cost_valuations "
                "ADD CONSTRAINT fk_pcv_product_id FOREIGN KEY (product_id) "
                "REFERENCES products(id) ON DELETE RESTRICT NOT VALID"
            ))


def downgrade():
    bind = op.get_bind()
    if _is_system_or_control_db(bind):
        return
    drops = [
        ("product_cost_valuations", "fk_pcv_product_id"),
        ("po_product_decision_log", "fk_ppdl_product_id"),
        ("dispatch_items", "fk_di_product_id"),
        ("packing_slip_items", "fk_psi_product_id"),
        ("customer_credit_ledger_entries", "fk_ccle_customer_id"),
        ("sales_invoice_items", "fk_sii_product_id"),
    ]
    for table, con in drops:
        if _table_exists(bind, table) and _fk_exists(bind, con):
            op.drop_constraint(con, table, type_="foreignkey")