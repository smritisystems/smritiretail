"""Add the remaining canonical v1388 platform tables that are missing in live production.

Revision ID: v1391_missing_platform_tables
Revises: v1390_control_plane
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1391_missing_platform_tables"
down_revision = "v1390_control_plane"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    missing = [
        (
            "platform_capabilities",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("name", sa.String(200), nullable=False),
                sa.Column("code", sa.String(50), nullable=False),
                sa.Column("category", sa.String(50), nullable=False),
                sa.Column("description", sa.Text(), nullable=True),
                sa.Column("dependencies", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
                sa.Column("min_version", sa.String(20), nullable=False, server_default="1.0.0"),
                sa.Column("is_core", sa.Boolean(), nullable=False, server_default="false"),
                sa.Column("default_enabled", sa.Boolean(), nullable=False, server_default="false"),
                sa.Column("status", sa.String(30), nullable=False, server_default="ACTIVE"),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("code", name="uq_platform_cap_code"),
            ],
        ),
        (
            "workspace_templates",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("name", sa.String(200), nullable=False),
                sa.Column("code", sa.String(50), nullable=False),
                sa.Column("vertical", sa.String(50), nullable=False),
                sa.Column("included_capabilities", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
                sa.Column("layout_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
                sa.Column("is_system_template", sa.Boolean(), nullable=False, server_default="true"),
                sa.Column("status", sa.String(30), nullable=False, server_default="ACTIVE"),
                sa.Column("description", sa.Text(), nullable=True),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("code", name="uq_workspace_template_code"),
            ],
        ),
        (
            "tenant_capability_bindings",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("capability_code", sa.String(50), nullable=False),
                sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
                sa.Column("plan_tier", sa.String(30), nullable=False, server_default="ENTERPRISE"),
                sa.Column("configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
                sa.Column("status", sa.String(30), nullable=False, server_default="ACTIVE"),
                sa.Column("activated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("capability_code", name="uq_tenant_capability_code"),
            ],
        ),
        (
            "user_workspace_configs",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("user_id", sa.String(50), nullable=False),
                sa.Column("template_code", sa.String(50), nullable=False, server_default="RETAIL_SUPERMARKET"),
                sa.Column("theme_preference", sa.String(30), nullable=False, server_default="DARK_RETRO"),
                sa.Column("pinned_modules", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
                sa.Column("custom_widgets", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("user_id", name="uq_user_workspace_config"),
            ],
        ),
        (
            "pdt_model_registry",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("model_code", sa.String(50), nullable=False),
                sa.Column("model_name", sa.String(255), nullable=False),
                sa.Column("model_type", sa.String(50), nullable=False),
                sa.Column("algorithm", sa.String(100), nullable=False),
                sa.Column("version", sa.String(20), nullable=False, server_default="1.0.0"),
                sa.Column("hyperparameters", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
                sa.Column("trained_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("model_code", name="uq_pdt_model_code"),
            ],
        ),
        (
            "pdt_sku_twin_cache",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("sku", sa.String(100), nullable=False),
                sa.Column("lead_time_days", sa.Integer(), nullable=False, server_default="7"),
                sa.Column("safety_buffer_qty", sa.Numeric(12, 4), nullable=False, server_default="10.0000"),
                sa.Column("daily_velocity", sa.Numeric(12, 4), nullable=False, server_default="0.0000"),
                sa.Column("current_days_of_cover", sa.Numeric(8, 2), nullable=False, server_default="0.00"),
                sa.Column("recommended_safety_stock", sa.Numeric(12, 4), nullable=False, server_default="0.0000"),
                sa.Column("last_evaluated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.PrimaryKeyConstraint("id"),
            ],
        ),
        (
            "pdt_demand_signals",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("signal_code", sa.String(50), nullable=False),
                sa.Column("signal_type", sa.String(50), nullable=False),
                sa.Column("impact_factor", sa.Numeric(5, 2), nullable=False, server_default="1.00"),
                sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
                sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
                sa.Column("affected_categories", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False),
                sa.PrimaryKeyConstraint("id"),
            ],
        ),
        (
            "pdt_distribution_predictions",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("prediction_no", sa.String(50), nullable=False),
                sa.Column("sku", sa.String(100), nullable=False),
                sa.Column("model_code", sa.String(50), nullable=False),
                sa.Column("model_version", sa.String(20), nullable=False),
                sa.Column("forecast_horizon_days", sa.Integer(), nullable=False, server_default="30"),
                sa.Column("forecasted_demand", sa.Numeric(12, 4), nullable=False, server_default="0.0000"),
                sa.Column("recommended_replenishment", sa.Numeric(12, 4), nullable=False, server_default="0.0000"),
                sa.Column("confidence_score", sa.Numeric(5, 4), nullable=False, server_default="0.9500"),
                sa.Column("risk_level", sa.String(30), nullable=False, server_default="LOW"),
                sa.Column("explainability_factors", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
                sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("prediction_no", name="uq_pdt_prediction_no"),
            ],
        ),
        (
            "module_states",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("module_uuid", sa.String(100), nullable=False),
                sa.Column("tenant_id", sa.String(50), nullable=False),
                sa.Column("state", sa.String(30), nullable=False, server_default="ACTIVE"),
                sa.Column("version", sa.String(30), nullable=False, server_default="1.0.0"),
                sa.Column("is_critical", sa.Boolean(), nullable=False, server_default="false"),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.PrimaryKeyConstraint("id"),
            ],
        ),
        (
            "module_audit_logs",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("tenant_id", sa.String(50), nullable=False),
                sa.Column("module_id", sa.String(100), nullable=False),
                sa.Column("action", sa.String(50), nullable=False),
                sa.Column("previous_state", sa.String(30), nullable=True),
                sa.Column("new_state", sa.String(30), nullable=False),
                sa.Column("actor_id", sa.String(50), nullable=True),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.PrimaryKeyConstraint("id"),
            ],
        ),
        (
            "tally_configs",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("config_code", sa.String(50), nullable=False),
                sa.Column("name", sa.String(200), nullable=False),
                sa.Column("tally_server_url", sa.String(255), nullable=True),
                sa.Column("sync_frequency", sa.String(30), nullable=False, server_default="DAILY"),
                sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
                sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
                sa.Column("sync_status", sa.String(30), nullable=False, server_default="PENDING"),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("config_code", name="uq_tally_config_code"),
            ],
        ),
        (
            "report_dispatch_logs",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("report_code", sa.String(50), nullable=False),
                sa.Column("report_name", sa.String(255), nullable=False),
                sa.Column("recipient_email", sa.String(255), nullable=False),
                sa.Column("dispatch_format", sa.String(30), nullable=False, server_default="PDF"),
                sa.Column("dispatch_status", sa.String(30), nullable=False, server_default="GENERATED"),
                sa.Column("delivery_at", sa.DateTime(timezone=True), nullable=True),
                sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
                sa.Column("error_message", sa.Text(), nullable=True),
                sa.PrimaryKeyConstraint("id"),
            ],
        ),
        (
            "cge_unified_policies",
            [
                sa.Column("id", sa.String(50), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("policy_code", sa.String(50), nullable=False),
                sa.Column("policy_name", sa.String(255), nullable=False),
                sa.Column("policy_type", sa.String(50), nullable=False),
                sa.Column("policy_scope", sa.String(50), nullable=False),
                sa.Column("policy_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
                sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
                sa.Column("effective_from", sa.Date(), nullable=True),
                sa.Column("effective_to", sa.Date(), nullable=True),
                sa.PrimaryKeyConstraint("id"),
                sa.UniqueConstraint("policy_code", name="uq_cge_policy_code"),
            ],
        ),
    ]

    for table_name, columns in missing:
        if table_name not in existing_tables:
            op.create_table(table_name, *columns)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table_name in [
        "cge_unified_policies",
        "report_dispatch_logs",
        "tally_configs",
        "module_audit_logs",
        "module_states",
        "pdt_distribution_predictions",
        "pdt_demand_signals",
        "pdt_sku_twin_cache",
        "pdt_model_registry",
        "user_workspace_configs",
        "tenant_capability_bindings",
        "workspace_templates",
        "platform_capabilities",
    ]:
        if table_name in existing_tables:
            op.drop_table(table_name)
