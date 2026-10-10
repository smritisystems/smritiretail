"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1462 – billing_csv: add billing_csv_templates and billing_csv_import_logs tables

Revision ID: v1462_billing_csv_templates_and_import_logs
Revises:     v1461_document_series_number_format
Create Date: 2026-09-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1462_billing_csv_templates_and_import_logs"
down_revision = "v1461_document_series_number_format"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # 1. billing_csv_templates
    if "billing_csv_templates" not in existing_tables:
        op.create_table(
            "billing_csv_templates",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("template_code", sa.String(50), nullable=False, unique=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("delimiter", sa.String(5), server_default=",", nullable=False),
            sa.Column("has_header", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("default_tax_inclusive", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("column_mappings", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False),
        )
        op.create_index("ix_billing_csv_templates_code", "billing_csv_templates", ["template_code"])

    # 2. billing_csv_import_logs
    if "billing_csv_import_logs" not in existing_tables:
        op.create_table(
            "billing_csv_import_logs",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("register_id", sa.String(50), nullable=True),
            sa.Column("shift_id", sa.String(50), nullable=True),
            sa.Column("cashier_id", sa.String(50), nullable=True),
            sa.Column("file_name", sa.String(255), nullable=False),
            sa.Column("file_sha256", sa.String(64), nullable=False),
            sa.Column("format_detected", sa.String(50), nullable=False),
            sa.Column("template_id", sa.String(50), sa.ForeignKey("billing_csv_templates.id", ondelete="SET NULL"), nullable=True),
            sa.Column("total_rows", sa.Integer(), nullable=False, default=0),
            sa.Column("valid_rows", sa.Integer(), nullable=False, default=0),
            sa.Column("warning_rows", sa.Integer(), nullable=False, default=0),
            sa.Column("rejected_rows", sa.Integer(), nullable=False, default=0),
            sa.Column("total_gross_amount", sa.Numeric(15, 2), nullable=False, default=0.00),
            sa.Column("total_tax_amount", sa.Numeric(15, 2), nullable=False, default=0.00),
            sa.Column("tax_mode_applied", sa.String(30), nullable=False, default="INCLUSIVE"),
            sa.Column("resulting_invoice_id", sa.String(50), nullable=True),
        )
        op.create_index("ix_billing_csv_import_logs_file_sha256", "billing_csv_import_logs", ["file_sha256"])
        op.create_index("ix_billing_csv_import_logs_resulting_invoice_id", "billing_csv_import_logs", ["resulting_invoice_id"])


def downgrade() -> None:
    op.drop_table("billing_csv_import_logs")
    op.drop_table("billing_csv_templates")
