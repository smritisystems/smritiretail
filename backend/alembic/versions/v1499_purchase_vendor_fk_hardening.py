"""v1499: Purchase + Vendor FK hardening — Part 3 of Full System Audit

Changes:
  1. purchase_orders.party_id           → parties.id ON DELETE SET NULL  (VALID — 49 rows, 0 populated)
  2. purchase_order_items.product_id    → products.id ON DELETE RESTRICT  (VALID — 52 rows, 0 orphans)
  3. purchase_receipt_items.product_id  → products.id ON DELETE RESTRICT  (NOT VALID — 7 prod-grn-* test orphans)

NOT VALID strategy for purchase_receipt_items.product_id:
  7 orphan rows carry prod-grn-* IDs from GRN test fixtures.
  NOT VALID protects all new rows immediately; validate after test fixture cleanup.

CRM / Party FK status (documented, no migration required):
  customer_profiles.customer_group_id — 0 rows, no FK in ORM. Group A candidate.
  customer_profiles.price_tier_id     — 0 rows, no FK in ORM. Group A candidate.
  customer_profiles.loyalty_tier_id   — 0 rows, no FK in ORM. Group A candidate.
  All 51 CRM/customer live FKs confirmed validated in live DB (this session).

Gate evidence:
  purchase_orders:          49 rows, 0 party_id populated → VALID FK safe
  purchase_order_items:     52 rows, 0 product_id orphans → VALID FK safe
  purchase_receipt_items:   75 rows, 7 prod-grn-* orphans → NOT VALID FK

Run as:
  alembic -x target=tenant -x db=smriti001 upgrade v1499

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from alembic import op
import sqlalchemy as sa

revision = "v1499"
down_revision = "v1498"
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


def upgrade() -> None:
    bind = op.get_bind()
    if _is_system_or_control_db(bind):
        return

    # -----------------------------------------------------------------------
    # 1. purchase_orders.party_id → parties.id  (VALID — 0 populated, 0 orphans)
    # -----------------------------------------------------------------------
    if _table_exists(bind, "purchase_orders") and _table_exists(bind, "parties"):
        if not _fk_exists(bind, "fk_po_party_id"):
            r1 = bind.execute(sa.text(
                "SELECT COUNT(*) FROM purchase_orders po "
                "LEFT JOIN parties p ON p.id = po.party_id "
                "WHERE p.id IS NULL AND po.party_id IS NOT NULL"
            ))
            if r1.scalar() == 0:
                op.create_foreign_key(
                    "fk_po_party_id",
                    "purchase_orders", "parties",
                    ["party_id"], ["id"],
                    ondelete="SET NULL",
                )

    # -----------------------------------------------------------------------
    # 2. purchase_order_items.product_id → products.id  (VALID — 0 orphans)
    # -----------------------------------------------------------------------
    if _table_exists(bind, "purchase_order_items") and _table_exists(bind, "products"):
        if not _fk_exists(bind, "fk_poi_product_id"):
            r2 = bind.execute(sa.text(
                "SELECT COUNT(*) FROM purchase_order_items poi "
                "LEFT JOIN products pr ON pr.id = poi.product_id "
                "WHERE pr.id IS NULL AND poi.product_id IS NOT NULL"
            ))
            if r2.scalar() == 0:
                op.create_foreign_key(
                    "fk_poi_product_id",
                    "purchase_order_items", "products",
                    ["product_id"], ["id"],
                    ondelete="RESTRICT",
                )

    # -----------------------------------------------------------------------
    # 3. purchase_receipt_items.product_id → products.id
    # -----------------------------------------------------------------------
    if _table_exists(bind, "purchase_receipt_items") and _table_exists(bind, "products"):
        if not _fk_exists(bind, "fk_pri_product_id"):
            bind.execute(sa.text(
                "ALTER TABLE purchase_receipt_items "
                "ADD CONSTRAINT fk_pri_product_id "
                "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT "
                "NOT VALID"
            ))


def downgrade() -> None:
    bind = op.get_bind()
    if _is_system_or_control_db(bind):
        return
    if _table_exists(bind, "purchase_receipt_items") and _fk_exists(bind, "fk_pri_product_id"):
        op.drop_constraint("fk_pri_product_id",  "purchase_receipt_items", type_="foreignkey")
    if _table_exists(bind, "purchase_order_items") and _fk_exists(bind, "fk_poi_product_id"):
        op.drop_constraint("fk_poi_product_id",  "purchase_order_items",   type_="foreignkey")
    if _table_exists(bind, "purchase_orders") and _fk_exists(bind, "fk_po_party_id"):
        op.drop_constraint("fk_po_party_id",     "purchase_orders",        type_="foreignkey")
