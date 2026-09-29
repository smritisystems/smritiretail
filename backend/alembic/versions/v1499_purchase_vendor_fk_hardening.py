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


def upgrade() -> None:
    bind = op.get_bind()

    # -----------------------------------------------------------------------
    # 1. purchase_orders.party_id → parties.id  (VALID — 0 populated, 0 orphans)
    # -----------------------------------------------------------------------
    r1 = bind.execute(sa.text(
        "SELECT COUNT(*) FROM purchase_orders po "
        "LEFT JOIN parties p ON p.id = po.party_id "
        "WHERE p.id IS NULL AND po.party_id IS NOT NULL"
    ))
    if r1.scalar() != 0:
        raise RuntimeError("v1499 aborted: purchase_orders.party_id has orphans.")

    op.create_foreign_key(
        "fk_po_party_id",
        "purchase_orders", "parties",
        ["party_id"], ["id"],
        ondelete="SET NULL",
    )

    # -----------------------------------------------------------------------
    # 2. purchase_order_items.product_id → products.id  (VALID — 0 orphans)
    # -----------------------------------------------------------------------
    r2 = bind.execute(sa.text(
        "SELECT COUNT(*) FROM purchase_order_items poi "
        "LEFT JOIN products pr ON pr.id = poi.product_id "
        "WHERE pr.id IS NULL AND poi.product_id IS NOT NULL"
    ))
    if r2.scalar() != 0:
        raise RuntimeError("v1499 aborted: purchase_order_items.product_id has orphans.")

    op.create_foreign_key(
        "fk_poi_product_id",
        "purchase_order_items", "products",
        ["product_id"], ["id"],
        ondelete="RESTRICT",
    )

    # -----------------------------------------------------------------------
    # 3. purchase_receipt_items.product_id → products.id
    #    NOT VALID — 7 prod-grn-* test-data orphans
    # -----------------------------------------------------------------------
    bind.execute(sa.text(
        "ALTER TABLE purchase_receipt_items "
        "ADD CONSTRAINT fk_pri_product_id "
        "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT "
        "NOT VALID"
    ))


def downgrade() -> None:
    op.drop_constraint("fk_pri_product_id",  "purchase_receipt_items", type_="foreignkey")
    op.drop_constraint("fk_poi_product_id",  "purchase_order_items",   type_="foreignkey")
    op.drop_constraint("fk_po_party_id",     "purchase_orders",        type_="foreignkey")
