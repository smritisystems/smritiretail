"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- Integration Hub Connector Registry (Blueprint ss45)

Creates smritisys-resident metadata tables that close the named gap identified
in the Blueprint v1.0 verification report (2026-08-24):
  - integration_registry     -- named integrations catalogue
  - connector_registry       -- connector type definitions
  - provider_registry        -- external provider catalogue
  - integration_credentials_reference  -- credentials pointer (no secrets stored)
  - integration_policies     -- per-integration policy definitions
  - integration_versions     -- version lineage for integrations

Blueprint Rule 08: Integration Hub definitions belong in smritisys.
Blueprint Rule 09: No credentials or executable business logic in smritisys.
Actual secrets are referenced by ID only; stored in environment/secret manager.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1369_integration_hub_registry"
down_revision: Union[str, None] = "v1368_ui_experience_engine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. provider_registry
    if "provider_registry" not in tables:
        op.create_table(
            "provider_registry",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("provider_category", sa.String(50), nullable=False),
            sa.Column("provider_type", sa.String(50), nullable=False),
            sa.Column("homepage_url", sa.String(500), nullable=True),
            sa.Column("docs_url", sa.String(500), nullable=True),
            sa.Column("logo_url", sa.String(500), nullable=True),
            sa.Column("supported_auth_types", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("supported_environments", JSONB, server_default=sa.text("'[\"SANDBOX\",\"PRODUCTION\"]'::jsonb"), nullable=False),
            sa.Column("capabilities_required", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("metadata_schema", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_provider_registry_category", "provider_registry", ["provider_category"])
        op.create_index("ix_provider_registry_type", "provider_registry", ["provider_type"])

    # 2. connector_registry
    if "connector_registry" not in tables:
        op.create_table(
            "connector_registry",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("provider_code", sa.String(100), nullable=False),
            sa.Column("connector_type", sa.String(50), nullable=False),
            sa.Column("protocol", sa.String(30), server_default="REST", nullable=False),
            sa.Column("direction", sa.String(20), server_default="OUTBOUND", nullable=False),
            sa.Column("event_triggers", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("config_schema", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("retry_policy", JSONB, server_default=sa.text("'{\"max_attempts\": 3, \"backoff\": \"EXPONENTIAL\"}'::jsonb"), nullable=False),
            sa.Column("timeout_seconds", sa.Integer(), server_default="30", nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_connector_registry_provider", "connector_registry", ["provider_code"])
        op.create_index("ix_connector_registry_type", "connector_registry", ["connector_type"])

    # 3. integration_registry
    if "integration_registry" not in tables:
        op.create_table(
            "integration_registry",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("connector_code", sa.String(100), nullable=False),
            sa.Column("provider_code", sa.String(100), nullable=False),
            sa.Column("integration_category", sa.String(50), nullable=False),
            sa.Column("direction", sa.String(20), server_default="OUTBOUND", nullable=False),
            sa.Column("trigger_mode", sa.String(30), server_default="EVENT", nullable=False),
            sa.Column("outbox_event_types", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("config_defaults", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("uses_outbox", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_integration_registry_connector", "integration_registry", ["connector_code"])
        op.create_index("ix_integration_registry_provider", "integration_registry", ["provider_code"])
        op.create_index("ix_integration_registry_category", "integration_registry", ["integration_category"])

    # 4. integration_credentials_reference
    # Stores ONLY a reference ID (e.g. env var name, secret manager key path).
    # NEVER stores actual credentials. Blueprint Rule 09.
    if "integration_credentials_reference" not in tables:
        op.create_table(
            "integration_credentials_reference",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("integration_code", sa.String(100), nullable=False),
            sa.Column("credential_key", sa.String(200), nullable=False),
            sa.Column("credential_type", sa.String(50), nullable=False),
            sa.Column("env_var_name", sa.String(200), nullable=True),
            sa.Column("secret_manager_path", sa.String(500), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_required", sa.Boolean(), server_default="true", nullable=False),
            sa.UniqueConstraint("integration_code", "credential_key", name="uq_int_cred_key"),
        )
        op.create_index("ix_int_cred_integration", "integration_credentials_reference", ["integration_code"])

    # 5. integration_policies
    if "integration_policies" not in tables:
        op.create_table(
            "integration_policies",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("integration_code", sa.String(100), nullable=True),
            sa.Column("policy_type", sa.String(50), nullable=False),
            sa.Column("policy_definition", JSONB, nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_int_policies_integration", "integration_policies", ["integration_code"])

    # 6. integration_versions
    if "integration_versions" not in tables:
        op.create_table(
            "integration_versions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("integration_code", sa.String(100), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("changelog", sa.Text(), nullable=True),
            sa.Column("is_current", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(30), server_default="DRAFT", nullable=False),
            sa.UniqueConstraint("integration_code", "version", name="uq_int_version"),
        )
        op.create_index("ix_int_versions_code", "integration_versions", ["integration_code"])


def downgrade():
    raise NotImplementedError(
        "v1369_integration_hub_registry is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy."
    )
