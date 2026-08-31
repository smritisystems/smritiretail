"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- Analytics & Intelligence Plane + Compliance Audit (Sections 11 & 12)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1367_analytics_and_integration"
down_revision: Union[str, None] = "v1366_cge_pdt_offline_sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. analytics_daily_sales_facts
    if "analytics_daily_sales_facts" not in tables:
        op.create_table(
            "analytics_daily_sales_facts",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("tenant_id", sa.String(50), nullable=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("fact_date", sa.Date(), nullable=False),
            sa.Column("total_revenue", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("invoice_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("total_tax_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("total_discount_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("cash_revenue", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("digital_revenue", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("credit_revenue", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("estimated_cost_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("gross_margin_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("gross_margin_percent", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
            sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("workflow_status", sa.String(50), nullable=True),
        )
        op.create_index("ix_analytics_daily_sales_facts_date", "analytics_daily_sales_facts", ["fact_date"])
        op.create_index("ix_analytics_daily_sales_facts_company", "analytics_daily_sales_facts", ["company_id"])

    # 2. compliance_immutable_audit_logs
    if "compliance_immutable_audit_logs" not in tables:
        op.create_table(
            "compliance_immutable_audit_logs",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("tenant_id", sa.String(50), nullable=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("event_type", sa.String(100), nullable=False),
            sa.Column("entity_name", sa.String(100), nullable=False),
            sa.Column("entity_id", sa.String(100), nullable=False),
            sa.Column("actor_user_id", sa.String(100), nullable=True),
            sa.Column("actor_role", sa.String(50), nullable=True),
            sa.Column("ip_address", sa.String(50), nullable=True),
            sa.Column("before_state_json", sa.Text(), nullable=True),
            sa.Column("after_state_json", sa.Text(), nullable=True),
            sa.Column("action_summary", sa.Text(), nullable=False),
            sa.Column("payload_hash", sa.String(64), nullable=False),
            sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("workflow_status", sa.String(50), nullable=True),
        )
        op.create_index("ix_compliance_audit_entity", "compliance_immutable_audit_logs", ["entity_name", "entity_id"])
        op.create_index("ix_compliance_audit_event_type", "compliance_immutable_audit_logs", ["event_type"])
        op.create_index("ix_compliance_audit_timestamp", "compliance_immutable_audit_logs", ["timestamp"])
        op.create_index("ix_compliance_audit_hash", "compliance_immutable_audit_logs", ["payload_hash"])


def downgrade():
    raise NotImplementedError("FORWARD-ONLY MIGRATION: Downgrades are prohibited under SMRITI Financial Data Governance.")
