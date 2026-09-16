"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.30.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Lifecycle & Compliance — POS Resilience, Park & Recall, LSQ, and Return Integrity
"""

"""Create POS Parked Carts, Least Saleable Qty (LSQ), and Customer Switch Audit schema.

Revision ID: v1458_pos_parked_carts_lsq_and_customer_switch_audit
Revises: v1457_canonical_smriti_promotions_engine
Create Date: 2026-09-17
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1458_pos_parked_carts_lsq_and_customer_switch_audit"
down_revision: Union[str, Sequence[str], None] = "v1457_canonical_smriti_promotions_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # -------------------------------------------------------------------------
    # 1. POS Parked Carts (F12 Park & Recall with 4-hour Expiration)
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS pos_parked_carts (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL,
            company_id VARCHAR(50) NOT NULL,
            branch_id VARCHAR(50) NOT NULL,
            session_id VARCHAR(100) NOT NULL,
            cashier_id VARCHAR(50) NOT NULL,
            hold_slip_number VARCHAR(50) NOT NULL UNIQUE,
            customer_id VARCHAR(50),
            customer_name VARCHAR(255),
            customer_phone VARCHAR(50),
            items_count INTEGER NOT NULL DEFAULT 0,
            total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            cart_snapshot JSONB NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PARKED',
            parked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            recalled_at TIMESTAMP WITH TIME ZONE,
            recalled_by VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE INDEX IF NOT EXISTS idx_pos_parked_carts_tenant_comp ON pos_parked_carts (tenant_id, company_id);
        CREATE INDEX IF NOT EXISTS idx_pos_parked_carts_active_lookup ON pos_parked_carts (company_id, branch_id, status, expires_at);
        CREATE INDEX IF NOT EXISTS idx_pos_parked_carts_slip ON pos_parked_carts (company_id, hold_slip_number);
    """))

    # -------------------------------------------------------------------------
    # 2. Mid-Bill Customer Switch Audit Log (Alt+M Re-evaluation Audit)
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS invoice_customer_change_logs (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL,
            company_id VARCHAR(50) NOT NULL,
            session_id VARCHAR(100) NOT NULL,
            draft_invoice_id VARCHAR(100),
            old_customer_id VARCHAR(50),
            old_customer_name VARCHAR(255),
            old_customer_group VARCHAR(100),
            new_customer_id VARCHAR(50) NOT NULL,
            new_customer_name VARCHAR(255) NOT NULL,
            new_customer_group VARCHAR(100),
            line_items_count INTEGER NOT NULL DEFAULT 0,
            cart_subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            promotions_reevaluated BOOLEAN NOT NULL DEFAULT TRUE,
            promo_diff_summary JSONB,
            changed_by VARCHAR(50) NOT NULL,
            changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE INDEX IF NOT EXISTS idx_inv_cust_change_comp_sess ON invoice_customer_change_logs (company_id, session_id);
        CREATE INDEX IF NOT EXISTS idx_inv_cust_change_date ON invoice_customer_change_logs (company_id, changed_at);
    """))

    # -------------------------------------------------------------------------
    # 3. Shift-End Cash Denomination Reconciliation Ledger
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS pos_shift_denomination_counts (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL,
            company_id VARCHAR(50) NOT NULL,
            shift_id VARCHAR(50) NOT NULL,
            denomination_value NUMERIC(10, 2) NOT NULL,
            expected_count INTEGER NOT NULL DEFAULT 0,
            actual_count INTEGER NOT NULL DEFAULT 0,
            expected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            actual_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            variance_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            reconciled_by VARCHAR(50) NOT NULL,
            reconciled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE INDEX IF NOT EXISTS idx_pos_shift_denom_shift ON pos_shift_denomination_counts (company_id, shift_id);
    """))

    # -------------------------------------------------------------------------
    # 4. Least Saleable Quantity (LSQ) Column Additions
    # -------------------------------------------------------------------------
    bind.execute(sa.text("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name = 'least_saleable_qty'
            ) THEN
                ALTER TABLE items ADD COLUMN least_saleable_qty NUMERIC(10, 4) NOT NULL DEFAULT 1.0000;
                CREATE INDEX IF NOT EXISTS idx_items_company_lsq ON items (company_id, least_saleable_qty);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'item_barcodes' AND column_name = 'least_saleable_qty'
            ) THEN
                ALTER TABLE item_barcodes ADD COLUMN least_saleable_qty NUMERIC(10, 4) NULL DEFAULT NULL;
            END IF;
        END $$;
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("""
        ALTER TABLE items DROP COLUMN IF EXISTS least_saleable_qty;
        ALTER TABLE item_barcodes DROP COLUMN IF EXISTS least_saleable_qty;
        DROP TABLE IF EXISTS pos_shift_denomination_counts CASCADE;
        DROP TABLE IF EXISTS invoice_customer_change_logs CASCADE;
        DROP TABLE IF EXISTS pos_parked_carts CASCADE;
    """))
