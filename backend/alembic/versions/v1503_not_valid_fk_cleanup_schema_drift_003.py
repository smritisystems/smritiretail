"""v1503: NOT VALID FK cleanup — Part 4c of Full System Audit

Actions taken after orphan classification pass:

Validated (0 orphans after cleanup):
  product_cost_valuations.product_id -> products.id
    7 prod-grn-* test fixture rows purged (same GRN test prefix as cleaned in v1497a).
    VALIDATE CONSTRAINT fk_pcv_product_id -- now fully enforced.

Test data purged (no FK change, historical rows remain):
  packing_slip_items.product_id:  30 prod_test rows purged. 40 historical remain (NOT VALID stays).
  dispatch_items.product_id:      27 prod_test rows purged. 18 historical remain (NOT VALID stays).

SCHEMA-DRIFT-003 filed — po_product_decision_log.product_id:
  The column contains 3 different value types:
    - items.id references (10 confirmed via items table match)
    - SMK-ALLOW-*, SMK-BLOK-*, SMK-UNASN-* decision codes (not a FK target)
    - Remaining 8 (true orphans not in items)
  The FK fk_ppdl_product_id (-> products.id) was WRONG — dropped in this migration.
  A correct FK cannot be added to a polymorphic column.
  Formally tracked as SCHEMA-DRIFT-003: po_product_decision_log.product_id is
  polymorphic (items ref + decision codes). Requires architectural split into:
    item_id      VARCHAR(50) -> items.id
    decision_code VARCHAR(20) -- allowed values: ALLOW, BLOCK, UNASSIGN etc.
  This is a schema design issue, not patchable with a single FK constraint.

Remaining NOT VALID FKs (real historical orphan data — cannot VALIDATE without business decision):
  fk_sii_product_id     — sales_invoice_items.product_id     — 954 orphans (26 distinct deleted products)
                          140 additional NULL product_id rows (service charges) — NULL passes FK check.
  fk_ccle_customer_id   — customer_credit_ledger_entries.customer_id — 158 orphans (158 distinct)
                          All cust-corp-* format deleted corporate customers.
  fk_psi_product_id     — packing_slip_items.product_id       — 40 historical orphans (deleted products)
  fk_di_product_id      — dispatch_items.product_id           — 18 historical orphans (deleted products)
  Business decision required: archive to shadow tables or accept as permanent historical gaps.

Gate evidence (5-gate, all gates passed before any change):
  product_cost_valuations: 7 orphans, all prod-grn-* test prefix -> DELETE safe
  packing_slip_items:      30 of 70 orphans = prod_test literal -> DELETE safe
  dispatch_items:          27 of 45 orphans = prod_test literal -> DELETE safe
  po_product_decision_log: product_id matches items (10) + decision codes (15) -> NOT a products FK

Run as:
  alembic -x target=tenant -x db=smriti001 upgrade v1503

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

revision = "v1503"
down_revision = "v1502"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # 1. Purge test-data orphans from product_cost_valuations (prod-grn-*)
    r1 = bind.execute(sa.text(
        "DELETE FROM product_cost_valuations "
        "WHERE product_id LIKE 'prod-grn-%' "
        "  AND NOT EXISTS (SELECT 1 FROM products WHERE products.id = product_cost_valuations.product_id)"
    ))

    # 2. Validate product_cost_valuations FK (0 orphans after purge) if constraint exists
    has_fk = bind.execute(sa.text(
        "SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid "
        "WHERE t.relname = 'product_cost_valuations' AND c.conname = 'fk_pcv_product_id'"
    )).scalar()
    if has_fk:
        orphans = bind.execute(sa.text(
            "SELECT COUNT(*) FROM product_cost_valuations pcv "
            "LEFT JOIN products p ON p.id = pcv.product_id "
            "WHERE p.id IS NULL AND pcv.product_id IS NOT NULL"
        )).scalar()
        if orphans != 0:
            raise RuntimeError(f"v1503: {orphans} orphans remain in product_cost_valuations — cannot validate")
        bind.execute(sa.text(
            "ALTER TABLE product_cost_valuations VALIDATE CONSTRAINT fk_pcv_product_id"
        ))

    # 3. Purge prod_test rows from packing_slip_items
    bind.execute(sa.text(
        "DELETE FROM packing_slip_items WHERE product_id = 'prod_test'"
    ))

    # 4. Purge prod_test rows from dispatch_items
    bind.execute(sa.text(
        "DELETE FROM dispatch_items WHERE product_id = 'prod_test'"
    ))

    # 5. Drop wrong FK on po_product_decision_log (was pointing to products, should not exist)
    # Column is polymorphic: items refs + decision codes. No single FK is correct.
    # Safe to drop only if it exists (may already be dropped in live apply).
    bind.execute(sa.text(
        "ALTER TABLE po_product_decision_log "
        "DROP CONSTRAINT IF EXISTS fk_ppdl_product_id"
    ))

    # 6. Remaining NOT VALID FKs: fk_sii_product_id, fk_ccle_customer_id,
    #    fk_psi_product_id, fk_di_product_id
    #    These have real historical orphan data. No automated action here.
    #    Business decision required before VALIDATE CONSTRAINT can succeed.
    #    Tracked in ARCH-DRIFT register as deferred cleanup tasks.


def downgrade():
    # Re-add wrong FK (for rollback symmetry only — do not use in production)
    bind = op.get_bind()
    bind.execute(sa.text(
        "ALTER TABLE po_product_decision_log "
        "ADD CONSTRAINT fk_ppdl_product_id FOREIGN KEY (product_id) "
        "REFERENCES products(id) ON DELETE RESTRICT NOT VALID"
    ))
    # Note: purged test rows cannot be restored; product_cost_valuations validation
    # cannot be reversed without re-introducing orphan data.