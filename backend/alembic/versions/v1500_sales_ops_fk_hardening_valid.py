"""v1500: Sales + Ops FK hardening - Part 4a of Full System Audit (VALID FKs only)

Hardens 9 FK columns across sales and operational tables where orphan checks
returned 0 - all constraints added as fully VALID.

Tables and columns:
  1.  sales_order_items.product_id        -> products.id    RESTRICT  (18050 rows, 0 orphans)
  2.  sales_orders.customer_id            -> customers.id   SET NULL  (74 rows,   0 orphans)
  3.  sales_return_items.product_id       -> products.id    RESTRICT  (10 rows,   0 orphans)
  4.  sales_returns.customer_id           -> customers.id   SET NULL  (10 rows,   0 orphans)
  5.  inward_cost_allocations.product_id  -> products.id    RESTRICT  (58 rows,   0 orphans)
  6.  loading_sheet_items.item_id         -> items.id       RESTRICT  (60 rows,   0 orphans)
  7.  distribution_claims.party_id        -> parties.id     SET NULL  (20 rows,   0 orphans)
  8.  distribution_route_stops.party_id   -> parties.id     SET NULL  (60 rows,   0 orphans)
  9.  purchase_reorder_configs.product_id -> products.id    CASCADE   (populated, 0 orphans)

Deferred to v1501 (NOT VALID, orphans exist):
  - sales_invoice_items.product_id          -- 954 orphans (26 distinct deleted products)
  - customer_credit_ledger_entries.customer_id -- 158 orphans (cust- prefix, deleted customers)
  - packing_slip_items.product_id           -- 70 orphans (41 distinct)
  - dispatch_items.product_id               -- 45 orphans
  - po_product_decision_log.product_id      -- 25 orphans
  - product_cost_valuations.product_id      -- 7 orphans

ARCH-DRIFT-002 (documented, no FK added):
  - general_ledger_entries.party_id  -- polymorphic ref: 305 -> customers, 22 -> suppliers, 258 true orphans
  - payment_transactions.party_id    -- polymorphic ref: 346 -> customers, 107 true orphans

ARCH-DRIFT-003 (documented, no FK added):
  - psv_party_scopes.party_id        -- 29 rows, all true orphans; no match in parties/customers/suppliers

Group A (0 populated / 0 rows - FK deferred until module activation):
  goods_receipt_notes.vendor_id, goods_receipt_lines.product_id,
  crm_opportunities.customer_id, promotion_redemptions.customer_id,
  sales_invoices.party_id, pos_parked_carts.customer_id,
  product_identities.product_id, crm_customer_activities.customer_id

Run as:
  alembic -x target=tenant -x db=smriti001 upgrade v1500

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

revision = "v1500"
down_revision = "v1499"
branch_labels = None
depends_on = None


def _check_orphans(bind, table, col, ref_table, ref_col="id"):
    r = bind.execute(sa.text(
        f"SELECT COUNT(*) FROM {table} t "
        f"LEFT JOIN {ref_table} r ON r.{ref_col} = t.{col} "
        f"WHERE r.{ref_col} IS NULL AND t.{col} IS NOT NULL"
    ))
    return r.scalar()


def upgrade():
    bind = op.get_bind()

    # 1. sales_order_items.product_id -> products.id
    orphans = _check_orphans(bind, "sales_order_items", "product_id", "products")
    assert orphans == 0, f"sales_order_items: {orphans} product_id orphans -- aborting"
    op.create_foreign_key(
        "fk_soi_product_id", "sales_order_items", "products",
        ["product_id"], ["id"], ondelete="RESTRICT"
    )

    # 2. sales_orders.customer_id -> customers.id
    orphans = _check_orphans(bind, "sales_orders", "customer_id", "customers")
    assert orphans == 0, f"sales_orders: {orphans} customer_id orphans -- aborting"
    op.create_foreign_key(
        "fk_so_customer_id", "sales_orders", "customers",
        ["customer_id"], ["id"], ondelete="SET NULL"
    )

    # 3. sales_return_items.product_id -> products.id
    orphans = _check_orphans(bind, "sales_return_items", "product_id", "products")
    assert orphans == 0, f"sales_return_items: {orphans} product_id orphans -- aborting"
    op.create_foreign_key(
        "fk_sri_product_id", "sales_return_items", "products",
        ["product_id"], ["id"], ondelete="RESTRICT"
    )

    # 4. sales_returns.customer_id -> customers.id
    orphans = _check_orphans(bind, "sales_returns", "customer_id", "customers")
    assert orphans == 0, f"sales_returns: {orphans} customer_id orphans -- aborting"
    op.create_foreign_key(
        "fk_sr_customer_id", "sales_returns", "customers",
        ["customer_id"], ["id"], ondelete="SET NULL"
    )

    # 5. inward_cost_allocations.product_id -> products.id
    orphans = _check_orphans(bind, "inward_cost_allocations", "product_id", "products")
    assert orphans == 0, f"inward_cost_allocations: {orphans} product_id orphans -- aborting"
    op.create_foreign_key(
        "fk_ica_product_id", "inward_cost_allocations", "products",
        ["product_id"], ["id"], ondelete="RESTRICT"
    )

    # 6. loading_sheet_items.item_id -> items.id
    orphans = _check_orphans(bind, "loading_sheet_items", "item_id", "items")
    assert orphans == 0, f"loading_sheet_items: {orphans} item_id orphans -- aborting"
    op.create_foreign_key(
        "fk_lsi_item_id", "loading_sheet_items", "items",
        ["item_id"], ["id"], ondelete="RESTRICT"
    )

    # 7. distribution_claims.party_id -> parties.id
    orphans = _check_orphans(bind, "distribution_claims", "party_id", "parties")
    assert orphans == 0, f"distribution_claims: {orphans} party_id orphans -- aborting"
    op.create_foreign_key(
        "fk_dc_party_id", "distribution_claims", "parties",
        ["party_id"], ["id"], ondelete="SET NULL"
    )

    # 8. distribution_route_stops.party_id -> parties.id
    orphans = _check_orphans(bind, "distribution_route_stops", "party_id", "parties")
    assert orphans == 0, f"distribution_route_stops: {orphans} party_id orphans -- aborting"
    op.create_foreign_key(
        "fk_drs_party_id", "distribution_route_stops", "parties",
        ["party_id"], ["id"], ondelete="SET NULL"
    )

    # 9. purchase_reorder_configs.product_id -> products.id
    orphans = _check_orphans(bind, "purchase_reorder_configs", "product_id", "products")
    assert orphans == 0, f"purchase_reorder_configs: {orphans} product_id orphans -- aborting"
    op.create_foreign_key(
        "fk_prc_product_id", "purchase_reorder_configs", "products",
        ["product_id"], ["id"], ondelete="CASCADE"
    )


def downgrade():
    op.drop_constraint("fk_prc_product_id", "purchase_reorder_configs", type_="foreignkey")
    op.drop_constraint("fk_drs_party_id", "distribution_route_stops", type_="foreignkey")
    op.drop_constraint("fk_dc_party_id", "distribution_claims", type_="foreignkey")
    op.drop_constraint("fk_lsi_item_id", "loading_sheet_items", type_="foreignkey")
    op.drop_constraint("fk_ica_product_id", "inward_cost_allocations", type_="foreignkey")
    op.drop_constraint("fk_sr_customer_id", "sales_returns", type_="foreignkey")
    op.drop_constraint("fk_sri_product_id", "sales_return_items", type_="foreignkey")
    op.drop_constraint("fk_so_customer_id", "sales_orders", type_="foreignkey")
    op.drop_constraint("fk_soi_product_id", "sales_order_items", type_="foreignkey")