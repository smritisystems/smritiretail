# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

"""add_sre_tables

Revision ID: ac1c5d73e490
Revises: 4216a8211b09
Create Date: 2026-07-19 02:23:58.453998

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ac1c5d73e490'
down_revision: Union[str, Sequence[str], None] = '4216a8211b09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. corporate_gstin_registry
    op.create_table(
        "corporate_gstin_registry",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("tenant_id",        sa.String(50),  nullable=True,  index=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     default=True),
        sa.Column("is_deleted",       sa.Boolean,     default=False),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     default=1),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        
        sa.Column("gstin",            sa.String(15),  nullable=False, unique=True),
        sa.Column("state_code",       sa.String(2),   nullable=False),
        sa.Column("warehouse_name",   sa.String(100), nullable=False)
    )

    # 2. sre_rule_engine
    op.create_table(
        "sre_rule_engine",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("tenant_id",        sa.String(50),  nullable=True,  index=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     default=True),
        sa.Column("is_deleted",       sa.Boolean,     default=False),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     default=1),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),

        sa.Column("dispatch_type",          sa.String(50), nullable=False, unique=True),
        sa.Column("tax_timing",             sa.String(20), nullable=False),
        sa.Column("max_deferral_days",      sa.Integer,    default=0),
        sa.Column("warning_buffer_days",    sa.Integer,    default=15),
        sa.Column("required_document_type", sa.String(30), nullable=False)
    )

    # 3. sre_statutory_ledger
    op.create_table(
        "sre_statutory_ledger",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("tenant_id",        sa.String(50),  nullable=True,  index=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     default=True),
        sa.Column("is_deleted",       sa.Boolean,     default=False),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     default=1),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),

        sa.Column("sku",               sa.String(50),  nullable=False),
        sa.Column("batch_no",          sa.String(50),  nullable=False),
        sa.Column("dispatch_id",       sa.String(50),  nullable=False, index=True),
        sa.Column("origin_gstin_id",   sa.String(50),  sa.ForeignKey("corporate_gstin_registry.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("destination_gstin", sa.String(15),  nullable=False),
        sa.Column("total_qty",         sa.Numeric(12, 4), nullable=False),
        sa.Column("approved_qty",      sa.Numeric(12, 4), default=0.00),
        sa.Column("returned_qty",      sa.Numeric(12, 4), default=0.00),
        sa.Column("unit_cost",         sa.Numeric(15, 2), nullable=False),
        sa.Column("gst_rate",          sa.Numeric(5, 2),  nullable=False),
        sa.Column("tax_type_applied",  sa.String(15),  nullable=False),
        sa.Column("statutory_state",   sa.String(30),  nullable=False, default="TAX_DEFERRED"),
        sa.Column("dispatch_date",     sa.Date,        nullable=False),
        sa.Column("expiry_date",       sa.Date,        nullable=False),
        sa.Column("is_asset_on_balance_sheet", sa.Boolean, default=True)
    )

    # 4. sre_compliance_decisions
    op.create_table(
        "sre_compliance_decisions",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("tenant_id",        sa.String(50),  nullable=True,  index=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     default=True),
        sa.Column("is_deleted",       sa.Boolean,     default=False),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     default=1),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),

        sa.Column("dispatch_id",      sa.String(50),  nullable=False, index=True),
        sa.Column("evaluated_rule",   sa.String(255), nullable=False),
        sa.Column("decision",         sa.String(255), nullable=False),
        sa.Column("reason",           sa.Text,        nullable=True),
        sa.Column("evaluated_at",     sa.DateTime,    nullable=False),
        sa.Column("engine_version",   sa.String(20),  nullable=False)
    )


def downgrade() -> None:
    op.drop_table("sre_compliance_decisions")
    op.drop_table("sre_statutory_ledger")
    op.drop_table("sre_rule_engine")
    op.drop_table("corporate_gstin_registry")
