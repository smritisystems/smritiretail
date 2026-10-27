"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.3
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

GC-001 Migration v1552
======================
Add uuid, company_id, branch_id, version, is_active, is_deleted, deleted_at,
deleted_by columns to gift_cards, gift_vouchers, and gift_card_transactions
tables if they do not already exist.

These tables predate the BaseEntity uuid column addition and lack the full
BaseEntity column set. The async SQLAlchemy asyncpg driver prepares statements
at execution time and raises UndefinedColumnError for any column the ORM
model declares but the table does not physically have.

All additions use IF NOT EXISTS to be idempotent across databases.
"""
from alembic import op
import sqlalchemy as sa


revision = "v1552"
down_revision = "v1551"
branch_labels = None
depends_on = None


_TABLES = ["gift_cards", "gift_vouchers", "gift_card_transactions"]

# Columns from BaseEntity that may be missing from pre-BaseEntity tables
_MISSING_COLS = [
    ("uuid",       "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) DEFAULT gen_random_uuid()::varchar"),
    ("version",    "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1"),
    ("is_active",  "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true"),
    ("deleted_at", "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE"),
    ("deleted_by", "ALTER TABLE {t} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50)"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for table in _TABLES:
        for col_name, ddl_template in _MISSING_COLS:
            ddl = ddl_template.format(t=table)
            conn.execute(sa.text(ddl))


def downgrade() -> None:
    # Columns are additive — downgrade is a no-op to preserve data safety.
    pass
