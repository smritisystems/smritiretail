"""v1542: Add idempotency_key, payload_hash, and cost_source to stock_movements for Single-Door Stock Ledger

Revision ID: v1542
Revises: v1541
Create Date: 2026-10-21

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Migration
"""
from alembic import op
import sqlalchemy as sa

revision = "v1542"
down_revision = "v1541"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add nullable columns to stock_movements
    op.execute(sa.text("""
        ALTER TABLE stock_movements
        ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS cost_source VARCHAR(50) NULL;
    """))

    # 2. Add partial unique index on (company_id, idempotency_key) where idempotency_key is not null
    op.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_company_idempotency_key
        ON stock_movements (company_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        DROP INDEX IF EXISTS uq_sm_company_idempotency_key;
        ALTER TABLE stock_movements
        DROP COLUMN IF EXISTS cost_source,
        DROP COLUMN IF EXISTS payload_hash,
        DROP COLUMN IF EXISTS idempotency_key;
    """))
