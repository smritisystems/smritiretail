"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Schema Migration
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "v1394_arch_governance"
down_revision = "v1393_canonical_item_master_migration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. architecture_domains
    op.execute("""
        CREATE TABLE IF NOT EXISTS architecture_domains (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            lead_architect VARCHAR(100) NOT NULL DEFAULT 'Core Architecture',
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # 2. architecture_entities
    op.execute("""
        CREATE TABLE IF NOT EXISTS architecture_entities (
            entity_key VARCHAR(50) PRIMARY KEY,
            domain_id VARCHAR(50) NOT NULL REFERENCES architecture_domains(id) ON DELETE CASCADE,
            canonical_name VARCHAR(100) NOT NULL,
            canonical_db VARCHAR(50) NOT NULL DEFAULT 'smriti001',
            canonical_table VARCHAR(100) NOT NULL,
            canonical_model VARCHAR(100) NOT NULL,
            canonical_service VARCHAR(100) NOT NULL,
            canonical_api VARCHAR(255) NOT NULL,
            canonical_ui VARCHAR(255) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'CANONICAL',
            version INTEGER NOT NULL DEFAULT 1,
            owner VARCHAR(100) NOT NULL DEFAULT 'Core Architecture',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # 3. architecture_capabilities
    op.execute("""
        CREATE TABLE IF NOT EXISTS architecture_capabilities (
            capability_key VARCHAR(100) PRIMARY KEY,
            entity_key VARCHAR(50) NOT NULL REFERENCES architecture_entities(entity_key) ON DELETE CASCADE,
            name VARCHAR(150) NOT NULL,
            business_intent TEXT NOT NULL,
            canonical_component VARCHAR(255) NOT NULL,
            canonical_file VARCHAR(255) NOT NULL,
            canonical_service VARCHAR(100) NOT NULL,
            canonical_api VARCHAR(255) NOT NULL,
            semantic_fingerprint JSONB NOT NULL DEFAULT '{}'::jsonb,
            status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # 4. architecture_files
    op.execute("""
        CREATE TABLE IF NOT EXISTS architecture_files (
            file_path VARCHAR(255) PRIMARY KEY,
            module_key VARCHAR(50) NOT NULL,
            capability_key VARCHAR(100) NOT NULL REFERENCES architecture_capabilities(capability_key) ON DELETE CASCADE,
            purpose TEXT NOT NULL,
            role VARCHAR(30) NOT NULL DEFAULT 'CANONICAL',
            canonical_file VARCHAR(255),
            deprecated_at TIMESTAMPTZ,
            status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # 5. architecture_apis
    op.execute("""
        CREATE TABLE IF NOT EXISTS architecture_apis (
            api_key VARCHAR(100) PRIMARY KEY,
            capability_key VARCHAR(100) NOT NULL REFERENCES architecture_capabilities(capability_key) ON DELETE CASCADE,
            entity_key VARCHAR(50) NOT NULL REFERENCES architecture_entities(entity_key) ON DELETE CASCADE,
            http_method VARCHAR(10) NOT NULL,
            route_path VARCHAR(255) NOT NULL,
            canonical_service VARCHAR(100) NOT NULL,
            request_schema VARCHAR(100),
            response_schema VARCHAR(100),
            version VARCHAR(20) NOT NULL DEFAULT 'v1',
            role VARCHAR(30) NOT NULL DEFAULT 'CANONICAL',
            status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # 6. architecture_decisions
    op.execute("""
        CREATE TABLE IF NOT EXISTS architecture_decisions (
            decision_id VARCHAR(50) PRIMARY KEY,
            subject VARCHAR(200) NOT NULL,
            canonical_owner VARCHAR(255) NOT NULL,
            secondary_owner VARCHAR(255) NOT NULL,
            classification VARCHAR(30) NOT NULL,
            reason TEXT NOT NULL,
            scope TEXT NOT NULL,
            migration_plan TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
            approved_by VARCHAR(100) NOT NULL DEFAULT 'Chief Systems Architect',
            approval_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # 7. Additive columns to screen_definitions
    op.execute("""
        ALTER TABLE screen_definitions
            ADD COLUMN IF NOT EXISTS screen_key VARCHAR(100),
            ADD COLUMN IF NOT EXISTS entity_key VARCHAR(50),
            ADD COLUMN IF NOT EXISTS canonical_route VARCHAR(255),
            ADD COLUMN IF NOT EXISTS canonical_component VARCHAR(255);
    """)

    # 8. Additive columns to field_definitions
    op.execute("""
        ALTER TABLE field_definitions
            ADD COLUMN IF NOT EXISTS entity_key VARCHAR(50),
            ADD COLUMN IF NOT EXISTS canonical_table VARCHAR(100),
            ADD COLUMN IF NOT EXISTS canonical_column VARCHAR(100),
            ADD COLUMN IF NOT EXISTS api_alias VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ui_aliases JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS semantic_definition TEXT;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS architecture_decisions CASCADE;")
    op.execute("DROP TABLE IF EXISTS architecture_apis CASCADE;")
    op.execute("DROP TABLE IF EXISTS architecture_files CASCADE;")
    op.execute("DROP TABLE IF EXISTS architecture_capabilities CASCADE;")
    op.execute("DROP TABLE IF EXISTS architecture_entities CASCADE;")
    op.execute("DROP TABLE IF EXISTS architecture_domains CASCADE;")
