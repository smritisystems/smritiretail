"""
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * Pushpa Devi Jawahar Mallah -- Founder & Chairperson
 * Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
 * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * Version      : 1.0.0
 * Created      : 2026-10-27
 * Copyright    : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Description  : WMS Physical Stock Approval -- Movement Commitment Sprint (v3.17.3).
 *                Adds is_reconciled to stock_count_lines.
 *
 *                When approve_stock_take (PHY-005) commits StockMovement records
 *                for non-zero variance lines it marks each processed line as
 *                is_reconciled = true.  This flag:
 *
 *                  1. Acts as the idempotency gate -- the WHERE clause on the
 *                     approval query filters to is_reconciled = false so a second
 *                     approval call skips already-committed lines.
 *
 *                  2. Enables per-line audit: which lines were committed vs which
 *                     were zero-variance and therefore untouched.
 *
 *                Zero-destructive: all existing rows default to false.
 *                Idempotent: uses ADD COLUMN IF NOT EXISTS.
"""

from alembic import op

revision = "v1551"
down_revision = "v1550"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent DDL -- safe to replay against a DB that already has the column.
    op.execute(
        "ALTER TABLE stock_count_lines "
        "ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT false"
    )
    print("  v1551: added is_reconciled to stock_count_lines (idempotent)")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE stock_count_lines "
        "DROP COLUMN IF EXISTS is_reconciled"
    )