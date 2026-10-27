"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.121.1
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

UMGP-G3 Remediation — v1554
============================
Drops the hardcoded column DEFAULT values that were flagged
by the UMGP governance gate (check_migration_governance.py G3 rule).

architecture_entities.canonical_db
  - Original DDL (v1394): canonical_db VARCHAR(50) NOT NULL DEFAULT '<primary_tenant_db>'
  - Problem: any INSERT that omits canonical_db silently writes the primary tenant
    DB name, creating ghost cross-tenant references in a shared architecture registry.
  - Fix: DROP DEFAULT — callers must supply canonical_db explicitly.
  - Existing rows: 10/11 rows carry the primary tenant DB name as their value
    (correct for that tenant). No data change needed.

psv_stock_events.source_database
  - Audited on 2026-10-27: column_default is already NULL in the primary tenant DB
    (the default was removed by a subsequent migration). No DDL needed.
  - Included here for governance record completeness only.

# @migration_target('tenant')  -- UMGP-G1: applies to tenant databases only
"""
from alembic import op
import sqlalchemy as sa


revision = "v1554"
down_revision = "v1553"
branch_labels = None
depends_on = None


# @migration_target('tenant')  -- UMGP-G1: applies to tenant databases only
def upgrade() -> None:
    conn = op.get_bind()

    # Drop hardcoded DEFAULT 'smriti001' from architecture_entities.canonical_db.
    # IF EXISTS guard on table makes this safe for tenant DBs that do not have
    # the architecture governance module (architecture_entities may not exist).
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'architecture_entities'
            ) THEN
                ALTER TABLE architecture_entities
                    ALTER COLUMN canonical_db DROP DEFAULT;
                RAISE NOTICE 'v1554: dropped DEFAULT on architecture_entities.canonical_db';
            ELSE
                RAISE NOTICE 'v1554: architecture_entities not found -- skipping';
            END IF;
        END;
        $$;
    """))
    # psv_stock_events.source_database: default already absent in DB (audited
    # 2026-10-27, column_default = NULL). No DDL required.


def downgrade() -> None:
    # Restore the original (but problematic) default for rollback completeness.
    # Uses a placeholder — the actual prior default value is documented in v1394.
    conn = op.get_bind()
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'architecture_entities'
            ) THEN
                -- Restores the pre-v1554 column default (see v1394 for original value)
                ALTER TABLE architecture_entities
                    ALTER COLUMN canonical_db SET DEFAULT current_database();
            END IF;
        END;
        $$;
    """))
