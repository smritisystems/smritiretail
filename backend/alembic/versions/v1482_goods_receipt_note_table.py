"""Add goods_receipt_notes and goods_receipt_lines tables.

This migration creates the canonical GRN persistence layer that was previously
managed only in-memory / embedded inside the purchase_orders record.

Revision ID  : v1482_goods_receipt_note_table
Revises      : v1481_remove_v1480_control_plane_objects
Create Date  : 2026-09-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1482_goods_receipt_note_table"
down_revision = "v1481_remove_v1480_control_plane_objects"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── goods_receipt_notes ────────────────────────────────────────────────
    op.create_table(
        "goods_receipt_notes",
        sa.Column("id",            sa.String(50),  nullable=False),
        sa.Column("uuid",          sa.String(36),  nullable=False),
        sa.Column("grn_number",    sa.String(60),  nullable=False),
        sa.Column("company_id",    sa.String(50),  nullable=False),
        sa.Column("branch_id",     sa.String(50),  nullable=False),
        sa.Column("vendor_id",     sa.String(50),  nullable=False),
        sa.Column("vendor_name",   sa.String(255), nullable=True),
        sa.Column("vendor_gstin",  sa.String(20),  nullable=True),
        sa.Column("primary_po_id", sa.String(50),  nullable=True),
        sa.Column("grn_date",      sa.Date(),      nullable=False),
        sa.Column("received_date", sa.Date(),      nullable=True),
        sa.Column("invoice_date",  sa.Date(),      nullable=True),
        sa.Column("invoice_no",    sa.String(80),  nullable=True),
        sa.Column("status",        sa.String(20),  nullable=False, server_default="DRAFT"),
        sa.Column("total_quantity",sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("total_taxable", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_tax",     sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_landed",  sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("currency_code", sa.String(5),   nullable=False, server_default="INR"),
        sa.Column("vehicle_no",    sa.String(20),  nullable=True),
        sa.Column("lr_no",         sa.String(50),  nullable=True),
        sa.Column("lr_date",       sa.Date(),      nullable=True),
        sa.Column("transporter",   sa.String(255), nullable=True),
        sa.Column("remarks",       sa.Text(),      nullable=True),
        sa.Column("rejection_reason", sa.Text(),   nullable=True),
        sa.Column("match_status",  sa.String(20),  nullable=True),
        sa.Column("match_variance_pct", sa.Numeric(7, 4), nullable=True),
        sa.Column("created_by",    sa.String(80),  nullable=False, server_default="system"),
        sa.Column("modified_by",   sa.String(80),  nullable=True),
        sa.Column("posted_by",     sa.String(80),  nullable=True),
        sa.Column("posted_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by",  sa.String(80),  nullable=True),
        sa.Column("cancelled_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("modified_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.UniqueConstraint("grn_number"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"],  ["branches.id"],  ondelete="RESTRICT"),
    )
    op.create_index("ix_grn_number",             "goods_receipt_notes", ["grn_number"])
    op.create_index("ix_grn_company_id",         "goods_receipt_notes", ["company_id"])
    op.create_index("ix_grn_branch_id",          "goods_receipt_notes", ["branch_id"])
    op.create_index("ix_grn_vendor_id",          "goods_receipt_notes", ["vendor_id"])
    op.create_index("ix_grn_primary_po_id",      "goods_receipt_notes", ["primary_po_id"])
    op.create_index("ix_grn_status",             "goods_receipt_notes", ["status"])
    op.create_index("ix_grn_company_branch_date","goods_receipt_notes", ["company_id", "branch_id", "grn_date"])
    op.create_index("ix_grn_vendor_status",      "goods_receipt_notes", ["vendor_id", "status"])

    # ── goods_receipt_lines ────────────────────────────────────────────────
    op.create_table(
        "goods_receipt_lines",
        sa.Column("id",             sa.String(50), nullable=False),
        sa.Column("grn_id",         sa.String(50), nullable=False),
        sa.Column("po_id",          sa.String(50), nullable=True),
        sa.Column("po_line_id",     sa.String(50), nullable=True),
        sa.Column("product_id",     sa.String(50), nullable=False),
        sa.Column("product_code",   sa.String(80), nullable=True),
        sa.Column("product_name",   sa.String(255),nullable=True),
        sa.Column("variant_id",     sa.String(50), nullable=True),
        sa.Column("barcode",        sa.String(80), nullable=True),
        sa.Column("hsn_code",       sa.String(20), nullable=True),
        sa.Column("batch_no",       sa.String(80), nullable=True),
        sa.Column("lot_no",         sa.String(80), nullable=True),
        sa.Column("serial_no",      sa.String(80), nullable=True),
        sa.Column("expiry_date",    sa.Date(),     nullable=True),
        sa.Column("ordered_qty",    sa.Numeric(14, 3), nullable=True),
        sa.Column("received_qty",   sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("rejected_qty",   sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("accepted_qty",   sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("uom",            sa.String(20), nullable=True, server_default="NOS"),
        sa.Column("unit_cost",      sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("discount_pct",   sa.Numeric(7, 4),  nullable=False, server_default="0"),
        sa.Column("discount_amt",   sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("taxable_value",  sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("gst_rate",       sa.Numeric(7, 4),  nullable=False, server_default="0"),
        sa.Column("cgst_amt",       sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sgst_amt",       sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("igst_amt",       sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_value",    sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("landed_cost",    sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("qc_status",      sa.String(20), nullable=True),
        sa.Column("rejection_reason", sa.Text(),   nullable=True),
        sa.Column("po_unit_cost",   sa.Numeric(14, 4), nullable=True),
        sa.Column("price_variance", sa.Numeric(14, 4), nullable=True),
        sa.Column("qty_variance",   sa.Numeric(14, 3), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("modified_at",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["grn_id"], ["goods_receipt_notes.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_grn_line_grn_id",   "goods_receipt_lines", ["grn_id"])
    op.create_index("ix_grn_line_po_id",    "goods_receipt_lines", ["po_id"])
    op.create_index("ix_grn_line_product",  "goods_receipt_lines", ["grn_id", "product_id"])
    op.create_index("ix_grn_line_barcode",  "goods_receipt_lines", ["barcode"])


def downgrade() -> None:
    op.drop_table("goods_receipt_lines")
    op.drop_table("goods_receipt_notes")
