"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 1.0.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Description  : G2 Remediation — Historical Transaction Immutability Sprint.
               Makes StockMovement.unit_cost NOT NULL with DEFAULT 0.00.

               NULL unit_cost means the cost was unresolved at movement time —
               the movement has no auditable cost basis (Rule 2 violation).

               Steps:
               1. Baseline: count NULLs (audit log only, no abort).
               2. Backfill NULLs to 0.00 (COALESCE safe — preserves all non-NULL values).
               3. Set NOT NULL DEFAULT 0.00 constraint.
               4. Backfill cost_source on NULL rows to 'UNRESOLVED_ZERO_COST' to
                  make the audit trail explicit: 0.00 means unknown, not free.

               Zero-destructive: never changes any existing non-NULL value.
"""

import sqlalchemy as sa
from alembic import op

revision = "v1549"
down_revision = "v1548"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Audit baseline
    null_count = conn.execute(sa.text(
        "SELECT COUNT(*) FROM stock_movements WHERE unit_cost IS NULL"
    )).scalar() or 0
    total = conn.execute(sa.text(
        "SELECT COUNT(*) FROM stock_movements"
    )).scalar() or 0
    print(f"  v1549: stock_movements total={total}, unit_cost NULL={null_count}")

    # Step 2: Backfill NULLs to 0.00
    if null_count > 0:
        conn.execute(sa.text(
            "UPDATE stock_movements SET unit_cost = 0.00 WHERE unit_cost IS NULL"
        ))
        print(f"  v1549: backfilled {null_count} NULL unit_cost rows to 0.00")

    # Step 3: Add NOT NULL DEFAULT 0.00
    op.alter_column(
        "stock_movements",
        "unit_cost",
        nullable=False,
        server_default="0.00",
        existing_type=sa.Numeric(15, 2),
    )

    # Step 4: Stamp audit trail on rows with zero cost and no cost_source
    stamped = conn.execute(sa.text("""
        UPDATE stock_movements
        SET cost_source = 'UNRESOLVED_ZERO_COST'
        WHERE unit_cost = 0.00
          AND (cost_source IS NULL OR cost_source = '')
    """)).rowcount
    if stamped:
        print(f"  v1549: stamped {stamped} zero-cost movements as UNRESOLVED_ZERO_COST")


def downgrade() -> None:
    op.alter_column(
        "stock_movements",
        "unit_cost",
        nullable=True,
        server_default=None,
        existing_type=sa.Numeric(15, 2),
    )
