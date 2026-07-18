# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

"""add_dispatch_tables

Revision ID: 05e3e3355649
Revises: ac1c5d73e490
Create Date: 2026-07-19 02:27:17.372868

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '05e3e3355649'
down_revision: Union[str, Sequence[str], None] = 'ac1c5d73e490'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. stock_dispatches
    op.create_table(
        "stock_dispatches",
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
        
        sa.Column("dispatch_no",      sa.String(80),  nullable=False, unique=True),
        sa.Column("dispatch_type",    sa.String(30),  nullable=False),
        sa.Column("partner_id",       sa.String(50),  sa.ForeignKey("consignment_partners.id", ondelete="RESTRICT"), nullable=True, index=True),
        sa.Column("dispatch_date",    sa.Date,        nullable=False),
        sa.Column("status",           sa.String(30),  nullable=False, default="Draft"),
        sa.Column("invoice_id",       sa.String(50),  sa.ForeignKey("sales_invoices.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("tax_total",        sa.Numeric(15, 2), default=0.00),
        sa.Column("grand_total",      sa.Numeric(15, 2), default=0.00),
        sa.Column("notes",            sa.Text,        nullable=True)
    )

    # 2. stock_dispatch_lines
    op.create_table(
        "stock_dispatch_lines",
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

        sa.Column("dispatch_id",      sa.String(50),  sa.ForeignKey("stock_dispatches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id",       sa.String(50),  sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("sku",              sa.String(50),  nullable=False),
        sa.Column("name",             sa.String(255), nullable=False),
        sa.Column("qty_sent",         sa.Numeric(12, 4), nullable=False, default=0.00),
        sa.Column("qty_invoiced",     sa.Numeric(12, 4), nullable=False, default=0.00),
        sa.Column("qty_returned",     sa.Numeric(12, 4), nullable=False, default=0.00),
        sa.Column("qty_on_hand",      sa.Numeric(12, 4), nullable=False, default=0.00),
        sa.Column("rate",             sa.Numeric(15, 2), nullable=False, default=0.00),
        sa.Column("gst_rate",         sa.Numeric(5, 2),  nullable=False, default=18.00),
        sa.Column("tax_amount",       sa.Numeric(15, 2), nullable=False, default=0.00),
        sa.Column("total_amount",     sa.Numeric(15, 2), nullable=False, default=0.00)
    )

    # 3. dispatch_approval_events
    op.create_table(
        "dispatch_approval_events",
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

        sa.Column("dispatch_id",      sa.String(50),  sa.ForeignKey("stock_dispatches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("action",           sa.String(50),  nullable=False),
        sa.Column("qty",              sa.Numeric(12, 4), nullable=False, default=0.00),
        sa.Column("user_id",          sa.String(50),  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ip_address",       sa.String(45),  nullable=True),
        sa.Column("reason",           sa.Text,        nullable=True)
    )


def downgrade() -> None:
    op.drop_table("dispatch_approval_events")
    op.drop_table("stock_dispatch_lines")
    op.drop_table("stock_dispatches")
