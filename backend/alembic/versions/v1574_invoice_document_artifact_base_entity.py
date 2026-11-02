# -----------------------------------------------------------------------------
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.17.0
# Created      : 2026-11-02
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal
# -----------------------------------------------------------------------------
"""Align invoice document artifacts with BaseEntity.

Revision ID: v1574
Revises: v1573
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1574"
down_revision: Union[str, Sequence[str], None] = "v1573"
branch_labels = None
depends_on = None


_TABLE = "invoice_document_artifacts"


def upgrade() -> None:
    statements = (
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) "
        "NOT NULL DEFAULT gen_random_uuid()::varchar",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS company_id VARCHAR(50)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE "
        "DEFAULT CURRENT_TIMESTAMP",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",
        f"CREATE UNIQUE INDEX IF NOT EXISTS ix_{_TABLE}_uuid ON {_TABLE} (uuid)",
        f"""
        UPDATE {_TABLE}
        SET company_id = (SELECT id FROM companies ORDER BY id ASC LIMIT 1)
        WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
        """,
        f"""
        UPDATE {_TABLE}
        SET branch_id = (SELECT id FROM branches WHERE company_id = {_TABLE}.company_id ORDER BY id ASC LIMIT 1)
        WHERE branch_id IS NOT NULL AND branch_id NOT IN (SELECT id FROM branches);
        """,
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_{_TABLE}_company_id_companies'
                  AND conrelid = '{_TABLE}'::regclass
            ) THEN
                ALTER TABLE {_TABLE}
                ADD CONSTRAINT fk_{_TABLE}_company_id_companies
                FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_{_TABLE}_branch_id_branches'
                  AND conrelid = '{_TABLE}'::regclass
            ) THEN
                ALTER TABLE {_TABLE}
                ADD CONSTRAINT fk_{_TABLE}_branch_id_branches
                FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT;
            END IF;
        END
        $$;
        """,
    )
    bind = op.get_bind()
    for statement in statements:
        bind.execute(sa.text(statement))


def downgrade() -> None:
    # Keep added audit metadata to avoid discarding artifact identity on downgrade.
    pass
