"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Migration — PSV Stock Tables Fresh-DB Lineage Prerequisite
"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "v1492b_create_psv_stock_tables"
down_revision: str | None = "v1492_promotions_company_id_unification_wave3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Company DB routing guard — NEVER execute on smritisys Control Plane or system DBs
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    # -------------------------------------------------------------------------
    # 2. psv_stock_balances — Create table if missing (fresh test database lineage)
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS psv_stock_balances (
            id VARCHAR(50) PRIMARY KEY,
            company_code VARCHAR(50) NOT NULL,
            psv_party_id VARCHAR(50) NOT NULL,
            psv_store_id VARCHAR(50),
            sku VARCHAR(100) NOT NULL,
            billed_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            received_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            sold_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            returned_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            transferred_qty NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            current_balance NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            last_event_id VARCHAR(50),
            last_updated_at TIMESTAMPTZ,
            delivery_location_id VARCHAR(50),
            store_code_snapshot VARCHAR(50),
            last_reported_at TIMESTAMPTZ,
            reconciliation_status VARCHAR(30) NOT NULL DEFAULT 'AUTO_MATCHED'
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_stock_balances_sku ON psv_stock_balances (sku);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_stock_balances_company_code ON psv_stock_balances (company_code);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_stock_balances_psv_party_id ON psv_stock_balances (psv_party_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_balances_store_code ON psv_stock_balances (company_code, store_code_snapshot);")

    # -------------------------------------------------------------------------
    # 3. psv_stock_events — Create table if missing (fresh test database lineage)
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS psv_stock_events (
            event_id VARCHAR(50) PRIMARY KEY,
            source_event_id VARCHAR(100) NOT NULL UNIQUE,
            correlation_id VARCHAR(100) NOT NULL,
            causation_id VARCHAR(100),
            event_schema_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
            company_code VARCHAR(50) NOT NULL,
            source_database VARCHAR(100) NOT NULL DEFAULT 'smriti001',
            source_document_type VARCHAR(50) NOT NULL,
            source_document_id VARCHAR(50) NOT NULL,
            source_document_line_id VARCHAR(50),
            psv_party_id VARCHAR(50) NOT NULL,
            destination_type VARCHAR(30),
            destination_id VARCHAR(50),
            psv_store_id VARCHAR(50),
            sku VARCHAR(100) NOT NULL,
            movement_type VARCHAR(30) NOT NULL,
            quantity NUMERIC(12, 4) NOT NULL,
            source_event_created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            event_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            host_customer_id VARCHAR(50),
            delivery_location_id VARCHAR(50),
            store_code_snapshot VARCHAR(50),
            invoice_id VARCHAR(50),
            invoice_line_id VARCHAR(50),
            staff_placement_id VARCHAR(50),
            approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
            reported_by VARCHAR(50),
            approval_reason TEXT
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_stock_events_company_code ON psv_stock_events (company_code);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_stock_events_sku ON psv_stock_events (sku);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_psv_events_party_sku ON psv_stock_events (company_code, psv_party_id, sku);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_stock_events_correlation_id ON psv_stock_events (correlation_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_stock_events_sync_status ON psv_stock_events (sync_status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_events_store_code ON psv_stock_events (company_code, store_code_snapshot);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_psv_events_invoice_line ON psv_stock_events (invoice_id, invoice_line_id);")

    # -------------------------------------------------------------------------
    # 4. Line items parity for product identity & variant tracking
    # (Ensures fresh test DBs match smriti001 canonical schema prior to v1494 indexing)
    # -------------------------------------------------------------------------
    op.execute(
        """
        ALTER TABLE IF EXISTS purchase_order_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        ALTER TABLE IF EXISTS purchase_order_items ADD COLUMN IF NOT EXISTS item_id VARCHAR(50);
        ALTER TABLE IF EXISTS purchase_receipt_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        ALTER TABLE IF EXISTS purchase_receipt_items ADD COLUMN IF NOT EXISTS item_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_invoice_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_invoice_items ADD COLUMN IF NOT EXISTS item_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS item_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_return_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_return_items ADD COLUMN IF NOT EXISTS item_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_quotation_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        ALTER TABLE IF EXISTS sales_quotation_items ADD COLUMN IF NOT EXISTS item_id VARCHAR(50);
        ALTER TABLE IF EXISTS stock_movements ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        ALTER TABLE IF EXISTS stock_movements ADD COLUMN IF NOT EXISTS item_id VARCHAR(50);
        ALTER TABLE IF EXISTS product_batch_stocks ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);
        """
    )


def downgrade() -> None:
    # Downgrade preserves tables if data is present
    pass
