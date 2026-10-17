"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.36.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Transaction Integrity Engine (STIE) Migration
"""

"""Universal Transaction Idempotency Ledger and Stock Movement Immutability Trigger.

Revision ID: v1489_transaction_integrity_engine
Revises: v1488_seed_desktop_billing_menu
Create Date: 2026-09-25
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "v1489_transaction_integrity_engine"
down_revision: Union[str, Sequence[str], None] = "v1488_seed_desktop_billing_menu"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Create transaction_idempotency_records table
    op.create_table(
        "transaction_idempotency_records",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("company_id", sa.String(50), nullable=False, index=True),
        sa.Column("branch_id", sa.String(50), nullable=True, index=True),
        sa.Column("entity_type", sa.String(50), nullable=False, index=True),
        sa.Column("idempotency_key", sa.String(150), nullable=False, index=True),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'IN_FLIGHT'")),
        sa.Column("document_id", sa.String(100), nullable=True, index=True),
        sa.Column("document_no", sa.String(100), nullable=True, index=True),
        sa.Column("response_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_detail", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.UniqueConstraint("company_id", "entity_type", "idempotency_key", name="uq_tx_idemp_tenant_key"),
    )
    op.create_index("ix_tx_idemp_lookup", "transaction_idempotency_records", ["company_id", "entity_type", "idempotency_key"])
    op.create_index("ix_tx_idemp_status", "transaction_idempotency_records", ["company_id", "status"])

    # 2. Append-Only Immutability Trigger on stock_movements
    bind.execute(sa.text("""
        CREATE OR REPLACE FUNCTION prevent_stock_movement_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'SMRITI-LEDGER-001: Deletion of StockMovement records is prohibited by SMRITI Universal Movement Integrity Policy (UTMIH). Use compensating reversal movements instead.';
            ELSIF TG_OP = 'UPDATE' THEN
                IF OLD.quantity <> NEW.quantity 
                   OR OLD.product_id <> NEW.product_id 
                   OR OLD.movement_type <> NEW.movement_type 
                   OR COALESCE(OLD.warehouse_id, '') <> COALESCE(NEW.warehouse_id, '') THEN
                    RAISE EXCEPTION 'SMRITI-LEDGER-002: In-place mutation of StockMovement quantity, product, or warehouse lineage is prohibited by SMRITI Universal Movement Integrity Policy (UTMIH).';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- 3. Eliminate legacy ad-hoc unmanaged triggers causing double-incrementing
        DROP TRIGGER IF EXISTS trg_inventory_state_reconciliation ON stock_movements CASCADE;
        DROP FUNCTION IF EXISTS fn_reconcile_inventory_state() CASCADE;

        DROP TRIGGER IF EXISTS trg_stock_movement_immutable ON stock_movements;
        CREATE TRIGGER trg_stock_movement_immutable
        BEFORE UPDATE OR DELETE ON stock_movements
        FOR EACH ROW EXECUTE FUNCTION prevent_stock_movement_mutation();
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("""
        DROP TRIGGER IF EXISTS trg_stock_movement_immutable ON stock_movements;
        DROP FUNCTION IF EXISTS prevent_stock_movement_mutation();
    """))
    op.drop_index("ix_tx_idemp_status", table_name="transaction_idempotency_records")
    op.drop_index("ix_tx_idemp_lookup", table_name="transaction_idempotency_records")
    op.drop_table("transaction_idempotency_records")
