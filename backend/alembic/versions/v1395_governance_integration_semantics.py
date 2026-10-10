"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.31.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Schema Migration — Governance Control Plane

Purpose:
    Extends the architecture governance model to represent integration
    semantics accurately. Adds three discriminator columns to
    architecture_capabilities and relaxes NOT NULL constraints that
    previously prevented registering domain-aggregate entities (HR, WMS
    sub-domains) which have no single canonical table or API today.

Changes:
    1. architecture_domains: INSERT 'hr' domain
    2. architecture_entities: Relax 6 NOT NULL constraints
    3. architecture_capabilities: Relax canonical_service + canonical_api NOT NULL
    4. architecture_capabilities: ADD integration_type VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
    5. architecture_capabilities: ADD backend_api_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
    6. architecture_capabilities: ADD backend_api_relation VARCHAR(30) NOT NULL DEFAULT 'NOT_APPLICABLE'
    7. architecture_capabilities: ADD CHECK constraints for enum vocabularies

Reviewed against: Phase 2 Governance Pre-Migration Architecture Review (2026-09-03)
"""

from alembic import op
import sqlalchemy as sa

revision = "v1395_gov_integration"
down_revision = "v1394_arch_governance"
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── 1. Insert 'hr' domain ──────────────────────────────────────────────
    op.execute("""
        INSERT INTO architecture_domains (id, name, description, lead_architect, status)
        VALUES (
            'hr',
            'Human Resources & Workforce Management',
            'Governs employee master, attendance, shift management, commission programs, and HR policies.',
            'Core Architecture',
            'ACTIVE'
        )
        ON CONFLICT (id) DO NOTHING;
    """)

    # ── 2. Relax NOT NULL constraints on architecture_entities ─────────────
    # These columns cannot be meaningfully populated for domain-aggregate
    # entities (hr, pick_wave) that span multiple tables or have no live API.
    # domain_id FK NOT NULL constraint is intentionally retained.
    op.execute("""
        ALTER TABLE architecture_entities
            ALTER COLUMN canonical_db      DROP NOT NULL,
            ALTER COLUMN canonical_table   DROP NOT NULL,
            ALTER COLUMN canonical_model   DROP NOT NULL,
            ALTER COLUMN canonical_service DROP NOT NULL,
            ALTER COLUMN canonical_api     DROP NOT NULL,
            ALTER COLUMN canonical_ui      DROP NOT NULL;
    """)

    # ── 3. Relax NOT NULL on architecture_capabilities ─────────────────────
    # LOCAL_ENGINE and LOCAL_EXECUTION capabilities have no canonical_service
    # (no engine) or canonical_api (no backend endpoint).
    # canonical_component and canonical_file NOT NULL are retained as the
    # governance audit anchor.
    op.execute("""
        ALTER TABLE architecture_capabilities
            ALTER COLUMN canonical_service DROP NOT NULL,
            ALTER COLUMN canonical_api     DROP NOT NULL;
    """)

    # ── 4. Add three integration-semantics columns ─────────────────────────
    op.execute("""
        ALTER TABLE architecture_capabilities
            ADD COLUMN IF NOT EXISTS integration_type
                VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
            ADD COLUMN IF NOT EXISTS backend_api_status
                VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
            ADD COLUMN IF NOT EXISTS backend_api_relation
                VARCHAR(30) NOT NULL DEFAULT 'NOT_APPLICABLE';
    """)

    # ── 5. Add CHECK constraints to enforce enum vocabularies ──────────────
    # These prevent invalid values from entering the SSOT.
    op.execute("""
        ALTER TABLE architecture_capabilities
            ADD CONSTRAINT chk_cap_integration_type CHECK (
                integration_type IN (
                    'BACKEND_API',
                    'LOCAL_ENGINE',
                    'LOCAL_EXECUTION',
                    'BACKEND_BLOCKED',
                    'HYBRID',
                    'UNKNOWN'
                )
            ),
            ADD CONSTRAINT chk_cap_backend_api_status CHECK (
                backend_api_status IN (
                    'IMPLEMENTED',
                    'UNIMPLEMENTED',
                    'DEFERRED',
                    'NONE',
                    'UNKNOWN'
                )
            ),
            ADD CONSTRAINT chk_cap_backend_api_relation CHECK (
                backend_api_relation IN (
                    'CONSUMED',
                    'AVAILABLE_NOT_USED',
                    'NOT_APPLICABLE'
                )
            );
    """)


def downgrade() -> None:
    # Remove check constraints
    op.execute("""
        ALTER TABLE architecture_capabilities
            DROP CONSTRAINT IF EXISTS chk_cap_integration_type,
            DROP CONSTRAINT IF EXISTS chk_cap_backend_api_status,
            DROP CONSTRAINT IF EXISTS chk_cap_backend_api_relation;
    """)

    # Drop added columns
    op.execute("""
        ALTER TABLE architecture_capabilities
            DROP COLUMN IF EXISTS integration_type,
            DROP COLUMN IF EXISTS backend_api_status,
            DROP COLUMN IF EXISTS backend_api_relation;
    """)

    # Restore NOT NULL on capabilities (data loss risk — only safe on empty table)
    op.execute("""
        ALTER TABLE architecture_capabilities
            ALTER COLUMN canonical_service SET NOT NULL,
            ALTER COLUMN canonical_api     SET NOT NULL;
    """)

    # Restore NOT NULL on entities (data loss risk — only safe on empty table)
    op.execute("""
        ALTER TABLE architecture_entities
            ALTER COLUMN canonical_db      SET NOT NULL,
            ALTER COLUMN canonical_table   SET NOT NULL,
            ALTER COLUMN canonical_model   SET NOT NULL,
            ALTER COLUMN canonical_service SET NOT NULL,
            ALTER COLUMN canonical_api     SET NOT NULL,
            ALTER COLUMN canonical_ui      SET NOT NULL;
    """)

    # Remove hr domain
    op.execute("DELETE FROM architecture_domains WHERE id = 'hr';")
