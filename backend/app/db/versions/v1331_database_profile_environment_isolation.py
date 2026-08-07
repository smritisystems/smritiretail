"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.

Migration: Database Profiles & Environment Isolation (PROD-003 & PROD-004)
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1331_database_profile_environment_isolation'
down_revision = 'v1217_adr015_foundation_platform_v3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS database_profiles (
            id               VARCHAR(50)  PRIMARY KEY,
            database_name    VARCHAR(100) NOT NULL,
            environment_type VARCHAR(30)  NOT NULL DEFAULT 'PRODUCTION',
            is_demo          BOOLEAN      NOT NULL DEFAULT FALSE,
            company_count    INTEGER      NOT NULL DEFAULT 1,
            version          VARCHAR(30)  NOT NULL DEFAULT '4.0.0',
            created_by       VARCHAR(100) NOT NULL DEFAULT 'SYSTEM_INSTALLER',
            created_on       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            modified_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    op.execute("""
        INSERT INTO database_profiles (id, database_name, environment_type, is_demo, company_count, version, created_by)
        VALUES ('db-prof-prod', 'smriti_prod', 'PRODUCTION', false, 1, '4.0.0', 'SYSTEM_INSTALLER')
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS database_profiles CASCADE;")
