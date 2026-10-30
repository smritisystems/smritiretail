"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.121.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

EI-001 Migration v1553
======================
Add uuid, company_id, branch_id, modified_at, is_active, deleted_at,
deleted_by, and version columns to e_invoices and e_invoice_batches
tables if they do not already exist.

These tables were created before the full BaseEntity column set was
standardised. The async SQLAlchemy asyncpg driver prepares statements
strictly at execution time and raises UndefinedColumnError for any
column the ORM model declares that the table does not physically have.

The primary tenant database received a manual backfill (2026-10-27)
as part of the TC-EI-001..012 integration test suite work (commit
d60fba76). This migration makes the same change idempotent and repeatable
for all current and future tenant databases.

Note: e_invoices already has is_deleted and created_at from its original
DDL. e_invoices.updated_at was the pre-BaseEntity column name; modified_at
is the canonical BaseEntity column - both will coexist. company_id and
branch_id carry no FK constraint here (applying via IF NOT EXISTS so the
guard is idempotent on already-backfilled tenant databases).

All additions use IF NOT EXISTS to be safe across every tenant database.
"""
from alembic import op
import sqlalchemy as sa


revision = "v1553"
down_revision = "v1552"
branch_labels = None
depends_on = None


_TABLES = ["e_invoices", "e_invoice_batches"]

# Columns from BaseEntity missing from both tables (confirmed by column audit
# run against the primary tenant DB on 2026-10-27; updated_at already present as legacy).
_MISSING_COLS = [
    ("uuid",        "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) DEFAULT gen_random_uuid()::varchar"),
    ("company_id",  "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS company_id VARCHAR(50)"),
    ("branch_id",   "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50)"),
    ("modified_at", "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ DEFAULT NOW()"),
    ("is_active",   "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true"),
    ("deleted_at",  "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"),
    ("deleted_by",  "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50)"),
    ("version",     "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1"),
]


# @migration_target('tenant')  -- UMGP-G1: applies to tenant databases only
def upgrade() -> None:
    conn = op.get_bind()
    for table in _TABLES:
        for col_name, ddl_template in _MISSING_COLS:
            ddl = ddl_template.format(t=table)
            conn.execute(sa.text(ddl))


def downgrade() -> None:
    # Columns are additive -- downgrade is a no-op to preserve data safety.
    pass
