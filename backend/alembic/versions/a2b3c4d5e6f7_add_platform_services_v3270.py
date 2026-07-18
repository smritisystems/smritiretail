"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Alembic Migration: Add Platform Services (Numbering Engine, Workflow Engine, Integration Log)
Revision: a2b3c4d5e6f7
"""

from typing import Union, Sequence
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# Revision identifiers
revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "pg7f3e2d9c1b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1. document_number_series
    # -----------------------------------------------------------------------
    op.create_table(
        "document_number_series",
        sa.Column("id",           sa.String(50),  primary_key=True),
        sa.Column("uuid",         sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",   sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",    sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",   sa.String(100), nullable=True),
        sa.Column("updated_by",   sa.String(100), nullable=True),
        sa.Column("is_active",    sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",   sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",   sa.String(100), nullable=True),
        sa.Column("version",      sa.Integer,     server_default=sa.text("1")),
        # Domain columns
        sa.Column("prefix",       sa.String(20),  nullable=False),
        sa.Column("fiscal_year",  sa.String(9),   nullable=False),
        sa.Column("branch_code",  sa.String(20),  nullable=True),
        sa.Column("last_seq",     sa.Integer,     nullable=False, server_default=sa.text("0")),
        sa.Column("pad_length",   sa.Integer,     nullable=False, server_default=sa.text("6")),
        sa.Column("format_str",   sa.String(100), nullable=False, server_default=sa.text("'{PREFIX}-{FY}-{SEQ:06d}'")),
        sa.Column("description",  sa.String(200), nullable=True),
        sa.Column("is_locked",    sa.Boolean,     server_default=sa.text("false")),
    )
    op.create_unique_constraint("uq_doc_series", "document_number_series",
                                ["prefix", "fiscal_year", "branch_id"])
    op.create_index("ix_doc_series_prefix_fy", "document_number_series",
                    ["prefix", "fiscal_year"])

    # -----------------------------------------------------------------------
    # 2. document_workflows
    # -----------------------------------------------------------------------
    op.create_table(
        "document_workflows",
        sa.Column("id",              sa.String(50),  primary_key=True),
        sa.Column("uuid",            sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",      sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",       sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",      sa.String(100), nullable=True),
        sa.Column("updated_by",      sa.String(100), nullable=True),
        sa.Column("is_active",       sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",      sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",      sa.String(100), nullable=True),
        sa.Column("version",         sa.Integer,     server_default=sa.text("1")),
        # Domain columns
        sa.Column("document_type",   sa.String(60),  nullable=False),
        sa.Column("document_id",     sa.String(50),  nullable=False),
        sa.Column("document_number", sa.String(80),  nullable=True),
        sa.Column("current_status",  sa.String(30),  nullable=False, server_default=sa.text("'Draft'")),
        sa.Column("status_history",  postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("assigned_to",     sa.String(100), nullable=True),
    )
    op.create_unique_constraint("uq_doc_workflow", "document_workflows",
                                ["document_type", "document_id"])
    op.create_index("ix_doc_workflow_type_status", "document_workflows",
                    ["document_type", "current_status"])

    # -----------------------------------------------------------------------
    # 3. integration_logs
    # -----------------------------------------------------------------------
    op.create_table(
        "integration_logs",
        sa.Column("id",                sa.String(50),  primary_key=True),
        sa.Column("uuid",              sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",        sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",         sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",        sa.String(100), nullable=True),
        sa.Column("updated_by",        sa.String(100), nullable=True),
        sa.Column("is_active",         sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",        sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",        sa.String(100), nullable=True),
        sa.Column("version",           sa.Integer,     server_default=sa.text("1")),
        # Domain columns
        sa.Column("integration_name",  sa.String(60),  nullable=False),
        sa.Column("endpoint",          sa.String(500), nullable=True),
        sa.Column("http_method",       sa.String(10),  nullable=True),
        sa.Column("ref_document_type", sa.String(60),  nullable=True),
        sa.Column("ref_document_id",   sa.String(50),  nullable=True),
        sa.Column("ref_document_no",   sa.String(80),  nullable=True),
        sa.Column("request_payload",   postgresql.JSONB, nullable=True),
        sa.Column("request_headers",   postgresql.JSONB, nullable=True),
        sa.Column("response_status",   sa.Integer,     nullable=True),
        sa.Column("response_payload",  postgresql.JSONB, nullable=True),
        sa.Column("response_time_ms",  sa.Integer,     nullable=True),
        sa.Column("status",            sa.String(20),  nullable=False, server_default=sa.text("'Pending'")),
        sa.Column("error_message",     sa.Text,        nullable=True),
        sa.Column("retry_count",       sa.Integer,     server_default=sa.text("0")),
        sa.Column("next_retry_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("idempotency_key",   sa.String(100), nullable=True),
    )
    op.create_index("ix_integration_log_ref",         "integration_logs", ["ref_document_type", "ref_document_id"])
    op.create_index("ix_integration_log_status",      "integration_logs", ["status", "next_retry_at"])
    op.create_index("ix_integration_log_integration", "integration_logs", ["integration_name", "created_at"])
    op.create_index("ix_integration_log_idempotency", "integration_logs", ["idempotency_key"])


def downgrade() -> None:
    # Drop in reverse order
    op.drop_index("ix_integration_log_idempotency", table_name="integration_logs")
    op.drop_index("ix_integration_log_integration", table_name="integration_logs")
    op.drop_index("ix_integration_log_status",      table_name="integration_logs")
    op.drop_index("ix_integration_log_ref",         table_name="integration_logs")
    op.drop_table("integration_logs")

    op.drop_index("ix_doc_workflow_type_status", table_name="document_workflows")
    op.drop_constraint("uq_doc_workflow", "document_workflows", type_="unique")
    op.drop_table("document_workflows")

    op.drop_index("ix_doc_series_prefix_fy", table_name="document_number_series")
    op.drop_constraint("uq_doc_series", "document_number_series", type_="unique")
    op.drop_table("document_number_series")
