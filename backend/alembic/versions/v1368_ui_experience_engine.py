"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- UI/Experience Engine Schema (Blueprint §11)

Creates smritisys-resident tables that close the named gap identified in the
Blueprint v1.0 verification report (2026-08-24):
  - screen_definitions
  - field_definitions
  - action_definitions
  - layout_definitions
  - icon_registry

Control Plane Principle (Blueprint Rule 07/08/09):
All UI/Experience configuration definitions belong in smritisys.
Application code renders behavior; Control Plane governs configuration.
No executable business logic is stored in these tables.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1368_ui_experience_engine"
down_revision: Union[str, None] = "v1367_analytics_and_integration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # -----------------------------------------------------------------------
    # 1. screen_definitions
    # Canonical layout and metadata of each named screen/view.
    # Governs SIMPLE / HYBRID / ADVANCED persona contexts.
    # Blueprint §11: "screen_definitions" in Control Plane.
    # -----------------------------------------------------------------------
    if "screen_definitions" not in tables:
        op.create_table(
            "screen_definitions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("code", sa.String(100), nullable=False),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("module_code", sa.String(50), nullable=False),
            sa.Column("workspace_code", sa.String(50), nullable=True),
            sa.Column("screen_type", sa.String(30), server_default="LIST", nullable=False),
            sa.Column("persona_mode", sa.String(20), server_default="HYBRID", nullable=False),
            sa.Column("capability_code", sa.String(50), nullable=True),
            sa.Column("layout_config", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("default_filters", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("default_sort", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("pagination_default", sa.Integer(), server_default="25", nullable=False),
            sa.Column("searchable", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("exportable", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("printable", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("route_path", sa.String(255), nullable=True),
            sa.Column("icon_key", sa.String(100), nullable=True),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
            sa.UniqueConstraint("code", "version", name="uq_screen_code_version"),
        )
        op.create_index("ix_screen_def_module", "screen_definitions", ["module_code"])
        op.create_index("ix_screen_def_workspace", "screen_definitions", ["workspace_code"])
        op.create_index("ix_screen_def_capability", "screen_definitions", ["capability_code"])
        op.create_index("ix_screen_def_status", "screen_definitions", ["status"])

    # -----------------------------------------------------------------------
    # 2. field_definitions
    # Individual field metadata: type, label, validation, visibility rules.
    # Blueprint §11: "field_definitions" in Control Plane.
    # -----------------------------------------------------------------------
    if "field_definitions" not in tables:
        op.create_table(
            "field_definitions",
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
            sa.Column("label_key", sa.String(200), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("field_type", sa.String(50), nullable=False),
            sa.Column("data_type", sa.String(30), server_default="STRING", nullable=False),
            sa.Column("is_required", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("is_readonly", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("is_searchable", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_sortable", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_filterable", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_exportable", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_hidden", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("validation_rules", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("options_source", sa.String(100), nullable=True),
            sa.Column("options_static", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("lookup_endpoint", sa.String(255), nullable=True),
            sa.Column("default_value", sa.Text(), nullable=True),
            sa.Column("placeholder_key", sa.String(200), nullable=True),
            sa.Column("help_text_key", sa.String(200), nullable=True),
            sa.Column("max_length", sa.Integer(), nullable=True),
            sa.Column("min_value", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("max_value", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("format_mask", sa.String(100), nullable=True),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_field_def_type", "field_definitions", ["field_type"])
        op.create_index("ix_field_def_status", "field_definitions", ["status"])

    # -----------------------------------------------------------------------
    # 3. action_definitions
    # Button/link actions available on screens and toolbars.
    # Governs visibility per capability/role. Not executable business logic.
    # Blueprint §11: "action_definitions" in Control Plane.
    # -----------------------------------------------------------------------
    if "action_definitions" not in tables:
        op.create_table(
            "action_definitions",
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
            sa.Column("label_key", sa.String(200), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("action_type", sa.String(50), nullable=False),
            sa.Column("screen_code", sa.String(100), nullable=True),
            sa.Column("placement", sa.String(30), server_default="TOOLBAR", nullable=False),
            sa.Column("icon_key", sa.String(100), nullable=True),
            sa.Column("variant", sa.String(30), server_default="PRIMARY", nullable=False),
            sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
            sa.Column("required_capability", sa.String(50), nullable=True),
            sa.Column("required_roles", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("visibility_condition", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("confirmation_required", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("confirmation_message_key", sa.String(200), nullable=True),
            sa.Column("target_route", sa.String(255), nullable=True),
            sa.Column("api_endpoint", sa.String(255), nullable=True),
            sa.Column("api_method", sa.String(10), server_default="POST", nullable=False),
            sa.Column("workflow_action", sa.String(100), nullable=True),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_action_def_screen", "action_definitions", ["screen_code"])
        op.create_index("ix_action_def_type", "action_definitions", ["action_type"])
        op.create_index("ix_action_def_capability", "action_definitions", ["required_capability"])

    # -----------------------------------------------------------------------
    # 4. layout_definitions
    # Named reusable layout templates referenced by screen_definitions.
    # Blueprint §11: "layout_definitions" in Control Plane.
    # -----------------------------------------------------------------------
    if "layout_definitions" not in tables:
        op.create_table(
            "layout_definitions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("layout_type", sa.String(50), nullable=False),
            sa.Column("is_responsive", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("breakpoints", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("regions", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("css_overrides", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("persona_modes", JSONB, server_default=sa.text("'[\"SIMPLE\",\"HYBRID\",\"ADVANCED\"]'::jsonb"), nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_layout_def_type", "layout_definitions", ["layout_type"])

    # -----------------------------------------------------------------------
    # 5. icon_registry
    # Canonical icon catalogue for the SMRITI platform.
    # Decouples icon references from application source code.
    # Blueprint §11: "icon_registry" in Control Plane.
    # -----------------------------------------------------------------------
    if "icon_registry" not in tables:
        op.create_table(
            "icon_registry",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("key", sa.String(100), nullable=False, unique=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("icon_pack", sa.String(50), nullable=False, server_default="Material Symbols Outlined"),
            sa.Column("icon_identifier", sa.String(200), nullable=False),
            sa.Column("icon_category", sa.String(50), nullable=True),
            sa.Column("module_scope", sa.String(50), nullable=True),
            sa.Column("svg_inline", sa.Text(), nullable=True),
            sa.Column("aliases", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("tags", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),
        )
        op.create_index("ix_icon_registry_pack", "icon_registry", ["icon_pack"])
        op.create_index("ix_icon_registry_category", "icon_registry", ["icon_category"])
        op.create_index("ix_icon_registry_module", "icon_registry", ["module_scope"])


def downgrade():
    raise NotImplementedError(
        "v1368_ui_experience_engine is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy (Blueprint §51 — Version all governed metadata)."
    )
