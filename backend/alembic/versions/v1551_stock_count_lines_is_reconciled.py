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
import sqlalchemy as sa

revision = "v1551"
down_revision = "v1550"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Wrapped in a DO block that catches undefined_table so tenants without
    # the WMS module (no stock_count_lines table yet) skip gracefully.
    # The IF NOT EXISTS guard makes it safe to replay on tables that already
    # have the column (e.g. smriti001 which was upgraded before this fix).
    op.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE stock_count_lines
                ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT false;
            RAISE NOTICE 'v1551: added is_reconciled to stock_count_lines';
        EXCEPTION
            WHEN undefined_table THEN
                RAISE NOTICE 'v1551: stock_count_lines not found -- WMS module not provisioned, skipping';
        END;
        $$;
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE stock_count_lines DROP COLUMN IF EXISTS is_reconciled;
        EXCEPTION
            WHEN undefined_table THEN NULL;
        END;
        $$;
    """))