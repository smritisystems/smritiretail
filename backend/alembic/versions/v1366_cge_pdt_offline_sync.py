"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- PSV, CGE, PDT & Durable Offline Sync Queue (Sections 9 & 10)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1366_cge_pdt_offline_sync"
down_revision: Union[str, None] = "v1365_distribution_core"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. pos_offline_sync_queue (Durable Tenant-Local Offline Sync Queue)
    if "pos_offline_sync_queue" not in tables:
        op.create_table(
            "pos_offline_sync_queue",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("tenant_id", sa.String(50), nullable=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("batch_id", sa.String(100), nullable=False),
            sa.Column("client_tx_uuid", sa.String(100), nullable=False),
            sa.Column("terminal_id", sa.String(50), nullable=False, server_default="POS-01"),
            sa.Column("txn_type", sa.String(50), nullable=False, server_default="SALES_INVOICE"),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column("sync_status", sa.String(50), nullable=False, server_default="PENDING"),
            sa.Column("synced_transaction_id", sa.String(50), nullable=True),
            sa.Column("document_number", sa.String(100), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
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
        op.create_index("ix_pos_offline_sync_queue_batch_id", "pos_offline_sync_queue", ["batch_id"])
        op.create_index("ix_pos_offline_sync_queue_client_tx_uuid", "pos_offline_sync_queue", ["client_tx_uuid"])
        op.create_index("ix_pos_offline_sync_queue_sync_status", "pos_offline_sync_queue", ["sync_status"])
        op.create_index("ix_pos_offline_sync_queue_company_id", "pos_offline_sync_queue", ["company_id"])

    # 2. Ensure CGE Referral Tables exist
    if "referral_programs" not in tables:
        op.create_table(
            "referral_programs",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("code", sa.String(50), nullable=False),
            sa.Column("referrer_reward_type", sa.String(50), nullable=False, server_default="POINTS"),
            sa.Column("referrer_reward_value", sa.Numeric(15, 2), nullable=False, server_default="50.00"),
            sa.Column("referee_reward_type", sa.String(50), nullable=False, server_default="DISCOUNT"),
            sa.Column("referee_reward_value", sa.Numeric(15, 2), nullable=False, server_default="10.00"),
            sa.Column("min_order_amount", sa.Numeric(15, 2), nullable=False, server_default="500.00"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )

    if "referral_relationships" not in tables:
        op.create_table(
            "referral_relationships",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("program_id", sa.String(50), nullable=False),
            sa.Column("referrer_customer_id", sa.String(50), nullable=False),
            sa.Column("referee_customer_id", sa.String(50), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default="PENDING"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )

    if "referral_rewards" not in tables:
        op.create_table(
            "referral_rewards",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("relationship_id", sa.String(50), nullable=False),
            sa.Column("recipient_customer_id", sa.String(50), nullable=False),
            sa.Column("reward_type", sa.String(50), nullable=False),
            sa.Column("reward_value", sa.Numeric(15, 2), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default="GRANTED"),
            sa.Column("qualifying_invoice_id", sa.String(50), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )

    # 3. Ensure CGE Commission Tables exist
    if "commission_programs" not in tables:
        op.create_table(
            "commission_programs",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("code", sa.String(50), nullable=False),
            sa.Column("target_type", sa.String(50), nullable=False, server_default="SALESMAN"),
            sa.Column("rate_percent", sa.Numeric(5, 2), nullable=False, server_default="2.00"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )

    if "commission_ledgers" not in tables:
        op.create_table(
            "commission_ledgers",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("program_id", sa.String(50), nullable=True),
            sa.Column("salesman_id", sa.String(50), nullable=False),
            sa.Column("reference_invoice_id", sa.String(50), nullable=False),
            sa.Column("sale_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("commission_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default="ACCRUED"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )


def downgrade():
    raise NotImplementedError("FORWARD-ONLY MIGRATION: Downgrades are prohibited under SMRITI Financial Data Governance.")
