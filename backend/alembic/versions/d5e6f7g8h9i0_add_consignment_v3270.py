"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Alembic Migration: Add Consignment / Modern Trade tables
Revision: d5e6f7g8h9i0
"""

from typing import Union, Sequence
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# Revision identifiers
revision: str = "d5e6f7g8h9i0"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7g8h9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. consignment_partners
    op.create_table(
        "consignment_partners",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("name",             sa.String(255), nullable=False),
        sa.Column("code",             sa.String(50),  nullable=False, unique=True),
        sa.Column("gst_number",       sa.String(15),  nullable=True),
        sa.Column("status",           sa.String(20),  server_default=sa.text("'Active'")),
        sa.Column("billing_address",  sa.Text,        nullable=True),
        sa.Column("shipping_address", sa.Text,        nullable=True),
    )

    # 2. consignment_transfers
    op.create_table(
        "consignment_transfers",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("partner_id",       sa.String(50),  sa.ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("transfer_no",      sa.String(80),  nullable=False, unique=True),
        sa.Column("transfer_date",    sa.Date(),      nullable=False),
        sa.Column("status",           sa.String(30),  server_default=sa.text("'Draft'")),
        sa.Column("invoice_id",       sa.String(50),  sa.ForeignKey("sales_invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("tax_total",        sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("grand_total",      sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("notes",            sa.Text,        nullable=True),
    )
    op.create_index("ix_consignment_transfers_partner", "consignment_transfers", ["partner_id"])
    op.create_index("ix_consignment_transfers_invoice", "consignment_transfers", ["invoice_id"])

    # 3. consignment_transfer_items
    op.create_table(
        "consignment_transfer_items",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("transfer_id",      sa.String(50),  sa.ForeignKey("consignment_transfers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id",       sa.String(50),  sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("code",             sa.String(50),  nullable=False),
        sa.Column("name",             sa.String(255), nullable=False),
        sa.Column("hsn_code",         sa.String(15),  nullable=True),
        sa.Column("qty_sent",         sa.Numeric(12, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("qty_sold",         sa.Numeric(12, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("qty_returned",     sa.Numeric(12, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("qty_on_hand",      sa.Numeric(12, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("rate",             sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("gst_rate",         sa.Numeric(5, 2),  nullable=False, server_default=sa.text("18.00")),
        sa.Column("tax_amount",       sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("total_amount",     sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
    )
    op.create_index("ix_consignment_transfer_items_transfer", "consignment_transfer_items", ["transfer_id"])
    op.create_index("ix_consignment_transfer_items_product",  "consignment_transfer_items", ["product_id"])

    # 4. consignment_sale_reports
    op.create_table(
        "consignment_sale_reports",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("partner_id",       sa.String(50),  sa.ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("report_no",        sa.String(80),  nullable=False, unique=True),
        sa.Column("report_date",      sa.Date(),      nullable=False),
        sa.Column("status",           sa.String(30),  server_default=sa.text("'Draft'")),
        sa.Column("total_sales_value", sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("total_tax_value",   sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("notes",            sa.Text,        nullable=True),
    )
    op.create_index("ix_consignment_sale_reports_partner", "consignment_sale_reports", ["partner_id"])

    # 5. consignment_sale_report_items
    op.create_table(
        "consignment_sale_report_items",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("report_id",        sa.String(50),  sa.ForeignKey("consignment_sale_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transfer_item_id", sa.String(50),  sa.ForeignKey("consignment_transfer_items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("product_id",       sa.String(50),  sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("qty_sold",         sa.Numeric(12, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("rate",             sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("gst_rate",         sa.Numeric(5, 2),  nullable=False, server_default=sa.text("18.00")),
        sa.Column("tax_amount",       sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("total_amount",     sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
    )
    op.create_index("ix_consignment_sale_report_items_report", "consignment_sale_report_items", ["report_id"])
    op.create_index("ix_consignment_sale_report_items_transfer", "consignment_sale_report_items", ["transfer_item_id"])

    # 6. consignment_settlements
    op.create_table(
        "consignment_settlements",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("partner_id",       sa.String(50),  sa.ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("settlement_no",    sa.String(80),  nullable=False, unique=True),
        sa.Column("settlement_date",  sa.Date(),      nullable=False),
        sa.Column("status",           sa.String(30),  server_default=sa.text("'Draft'")),
        sa.Column("total_amount_due",   sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("total_deductions",   sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("net_amount_payable", sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("paid_amount",        sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("deduction_details",  sa.Text,        nullable=True),
        sa.Column("notes",            sa.Text,        nullable=True),
    )
    op.create_index("ix_consignment_settlements_partner", "consignment_settlements", ["partner_id"])

    # 7. consignment_returns
    op.create_table(
        "consignment_returns",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("partner_id",       sa.String(50),  sa.ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("return_no",        sa.String(80),  nullable=False, unique=True),
        sa.Column("return_date",      sa.Date(),      nullable=False),
        sa.Column("status",           sa.String(30),  server_default=sa.text("'Draft'")),
        sa.Column("total_value",      sa.Numeric(15, 2), server_default=sa.text("0.00")),
        sa.Column("notes",            sa.Text,        nullable=True),
    )
    op.create_index("ix_consignment_returns_partner", "consignment_returns", ["partner_id"])

    # 8. consignment_return_items
    op.create_table(
        "consignment_return_items",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default=sa.text("true")),
        sa.Column("is_deleted",       sa.Boolean,     server_default=sa.text("false")),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default=sa.text("1")),
        sa.Column("workflow_status",  sa.String(30),  nullable=True),
        sa.Column("document_number",  sa.String(80),  nullable=True),
        # Domain columns
        sa.Column("return_id",        sa.String(50),  sa.ForeignKey("consignment_returns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transfer_item_id", sa.String(50),  sa.ForeignKey("consignment_transfer_items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("product_id",       sa.String(50),  sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("qty_returned",     sa.Numeric(12, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("rate",             sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("total_amount",     sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
    )
    op.create_index("ix_consignment_return_items_return", "consignment_return_items", ["return_id"])
    op.create_index("ix_consignment_return_items_transfer", "consignment_return_items", ["transfer_item_id"])


def downgrade() -> None:
    op.drop_index("ix_consignment_return_items_transfer", table_name="consignment_return_items")
    op.drop_index("ix_consignment_return_items_return", table_name="consignment_return_items")
    op.drop_table("consignment_return_items")

    op.drop_index("ix_consignment_returns_partner", table_name="consignment_returns")
    op.drop_table("consignment_returns")

    op.drop_index("ix_consignment_settlements_partner", table_name="consignment_settlements")
    op.drop_table("consignment_settlements")

    op.drop_index("ix_consignment_sale_report_items_transfer", table_name="consignment_sale_report_items")
    op.drop_index("ix_consignment_sale_report_items_report", table_name="consignment_sale_report_items")
    op.drop_table("consignment_sale_report_items")

    op.drop_index("ix_consignment_sale_reports_partner", table_name="consignment_sale_reports")
    op.drop_table("consignment_sale_reports")

    op.drop_index("ix_consignment_transfer_items_product", table_name="consignment_transfer_items")
    op.drop_index("ix_consignment_transfer_items_transfer", table_name="consignment_transfer_items")
    op.drop_table("consignment_transfer_items")

    op.drop_index("ix_consignment_transfers_invoice", table_name="consignment_transfers")
    op.drop_index("ix_consignment_transfers_partner", table_name="consignment_transfers")
    op.drop_table("consignment_transfers")

    op.drop_table("consignment_partners")
