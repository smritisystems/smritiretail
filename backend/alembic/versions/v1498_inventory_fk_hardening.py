"""v1498: Pricing + Inventory FK hardening — Part 2 of Full System Audit

Changes:
  1. product_batch_stocks.product_id  — ADD FK RESTRICT (0 orphan clean rows + NOT VALID for 61 test-orphans)
  2. product_batch_stocks.company_id  — ADD FK CASCADE to companies (0 orphans)
  3. product_batch_stocks.branch_id   — ADD FK SET NULL to branches (0 orphans, nullable)
  4. stock_transfer_items.company_id  — ADD FK CASCADE to companies (0 orphans)
  5. stock_transfer_items.branch_id   — ADD FK SET NULL to branches (0 orphans, nullable)
  6. stock_movements.product_id       — ADD FK NOT VALID (325 test-data orphans blocked by UTMIH trigger)
  7. product_batch_stocks.product_id  — ADD FK NOT VALID (61 test-data orphans blocked by UTMIH trigger)

NOT VALID strategy for stock_movements / product_batch_stocks:
  Orphan rows are exclusively prod-test-* IDs from test fixture teardown failures
  caused by the UTMIH trigger (trg_stock_movement_immutable) blocking DELETE.
  NOT VALID adds the FK for new rows immediately; existing orphans can be cleared
  and VALIDATE CONSTRAINT run once the UTMIH test-fixture is fixed.

Gate evidence:
  - stock_movements: 9736 rows, 325 prod-test-* orphans (test data only), 0 prod-* real orphans
  - product_batch_stocks: 497 rows, 61 prod-test-* orphans (test data only), 0 prod-* real orphans
  - stock_transfer_items: 52 rows, 0 company/branch orphans
  - product_batch_stocks company/branch: 497 rows, 0 orphans

Run as:
  alembic -x target=tenant -x db=smriti001 upgrade v1498

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

revision = "v1498"
down_revision = "v1497a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # -----------------------------------------------------------------------
    # 1. product_batch_stocks — company_id FK (0 orphans, safe to add VALID)
    # -----------------------------------------------------------------------
    r = bind.execute(sa.text(
        "SELECT COUNT(*) FROM product_batch_stocks pbs "
        "LEFT JOIN companies c ON c.id = pbs.company_id "
        "WHERE c.id IS NULL AND pbs.company_id IS NOT NULL"
    ))
    if r.scalar() != 0:
        raise RuntimeError("v1498 aborted: product_batch_stocks has company_id orphans.")

    op.create_foreign_key(
        "fk_pbs_company_id",
        "product_batch_stocks", "companies",
        ["company_id"], ["id"],
        ondelete="CASCADE",
    )

    # -----------------------------------------------------------------------
    # 2. product_batch_stocks — branch_id FK (nullable, 0 orphans)
    # -----------------------------------------------------------------------
    r2 = bind.execute(sa.text(
        "SELECT COUNT(*) FROM product_batch_stocks pbs "
        "LEFT JOIN branches b ON b.id = pbs.branch_id "
        "WHERE b.id IS NULL AND pbs.branch_id IS NOT NULL"
    ))
    if r2.scalar() != 0:
        raise RuntimeError("v1498 aborted: product_batch_stocks has branch_id orphans.")

    op.create_foreign_key(
        "fk_pbs_branch_id",
        "product_batch_stocks", "branches",
        ["branch_id"], ["id"],
        ondelete="SET NULL",
    )

    # -----------------------------------------------------------------------
    # 3. product_batch_stocks — product_id FK NOT VALID (61 test-data orphans)
    # -----------------------------------------------------------------------
    bind.execute(sa.text(
        "ALTER TABLE product_batch_stocks "
        "ADD CONSTRAINT fk_pbs_product_id "
        "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT "
        "NOT VALID"
    ))

    # -----------------------------------------------------------------------
    # 4. stock_transfer_items — company_id FK (0 orphans)
    # -----------------------------------------------------------------------
    r3 = bind.execute(sa.text(
        "SELECT COUNT(*) FROM stock_transfer_items sti "
        "LEFT JOIN companies c ON c.id = sti.company_id "
        "WHERE c.id IS NULL AND sti.company_id IS NOT NULL"
    ))
    if r3.scalar() != 0:
        raise RuntimeError("v1498 aborted: stock_transfer_items has company_id orphans.")

    op.create_foreign_key(
        "fk_sti_company_id",
        "stock_transfer_items", "companies",
        ["company_id"], ["id"],
        ondelete="CASCADE",
    )

    # -----------------------------------------------------------------------
    # 5. stock_transfer_items — branch_id FK (nullable, 0 orphans)
    # -----------------------------------------------------------------------
    r4 = bind.execute(sa.text(
        "SELECT COUNT(*) FROM stock_transfer_items sti "
        "LEFT JOIN branches b ON b.id = sti.branch_id "
        "WHERE b.id IS NULL AND sti.branch_id IS NOT NULL"
    ))
    if r4.scalar() != 0:
        raise RuntimeError("v1498 aborted: stock_transfer_items has branch_id orphans.")

    op.create_foreign_key(
        "fk_sti_branch_id",
        "stock_transfer_items", "branches",
        ["branch_id"], ["id"],
        ondelete="SET NULL",
    )

    # -----------------------------------------------------------------------
    # 6. stock_movements — product_id FK NOT VALID (325 test-data orphans)
    #    Cannot add as VALID — UTMIH trigger blocks DELETE of orphan rows.
    #    Run VALIDATE CONSTRAINT after UTMIH test-fixture fix.
    # -----------------------------------------------------------------------
    bind.execute(sa.text(
        "ALTER TABLE stock_movements "
        "ADD CONSTRAINT fk_stock_movements_product_id "
        "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT "
        "NOT VALID"
    ))


def downgrade() -> None:
    op.drop_constraint("fk_stock_movements_product_id", "stock_movements", type_="foreignkey")
    op.drop_constraint("fk_sti_branch_id", "stock_transfer_items", type_="foreignkey")
    op.drop_constraint("fk_sti_company_id", "stock_transfer_items", type_="foreignkey")
    op.drop_constraint("fk_pbs_product_id", "product_batch_stocks", type_="foreignkey")
    op.drop_constraint("fk_pbs_branch_id", "product_batch_stocks", type_="foreignkey")
    op.drop_constraint("fk_pbs_company_id", "product_batch_stocks", type_="foreignkey")
