"""Add dispatch_batches and dispatch_batch_invoices tables.

Replaces the in-memory _AUDIT_CACHE and _BATCH_CACHE dicts in
dispatch_invoicing.py with PostgreSQL-backed persistent tables.
Server restarts no longer lose dispatch batch state.

Revision ID  : v1483_dispatch_batch_tables
Revises      : v1482_goods_receipt_note_table
Create Date  : 2026-09-23
"""

from alembic import op
import sqlalchemy as sa

revision = "v1483_dispatch_batch_tables"
down_revision = "v1482_goods_receipt_note_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── dispatch_batches ───────────────────────────────────────────────────
    op.create_table(
        "dispatch_batches",
        sa.Column("id",               sa.String(50),  nullable=False),
        sa.Column("batch_ref",        sa.String(80),  nullable=False),
        sa.Column("company_id",       sa.String(50),  nullable=False),
        sa.Column("branch_id",        sa.String(50),  nullable=True),
        sa.Column("source_filename",  sa.String(255), nullable=True),
        sa.Column("sheet_name",       sa.String(80),  nullable=True),
        sa.Column("detected_sizes",   sa.JSON(),      nullable=True),
        sa.Column("available_sheets", sa.JSON(),      nullable=True),
        sa.Column("matrix_date",      sa.Date(),      nullable=True),
        sa.Column("preflight_status", sa.String(20),  nullable=False, server_default="PENDING"),
        sa.Column("total_stores",     sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("ready_stores",     sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("warning_stores",   sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("error_stores",     sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("preflight_log",    sa.JSON(),      nullable=True),
        sa.Column("batch_status",     sa.String(20),  nullable=False, server_default="PENDING"),
        sa.Column("generated_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("package_path",     sa.String(500), nullable=True),
        sa.Column("created_by",       sa.String(80),  nullable=False, server_default="system"),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("batch_ref"),
    )
    op.create_index("ix_dispatch_batch_ref",     "dispatch_batches", ["batch_ref"])
    op.create_index("ix_dispatch_batch_company", "dispatch_batches", ["company_id", "preflight_status"])

    # ── dispatch_batch_invoices ────────────────────────────────────────────
    op.create_table(
        "dispatch_batch_invoices",
        sa.Column("id",                  sa.String(50),  nullable=False),
        sa.Column("batch_id",            sa.String(50),  nullable=False),
        sa.Column("store_code",          sa.String(30),  nullable=False),
        sa.Column("store_name",          sa.String(255), nullable=True),
        sa.Column("gstin",               sa.String(20),  nullable=True),
        sa.Column("state_code",          sa.Integer(),   nullable=True),
        sa.Column("state_name",          sa.String(80),  nullable=True),
        sa.Column("pincode",             sa.Integer(),   nullable=True),
        sa.Column("is_interstate",       sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("invoice_number",      sa.String(80),  nullable=True),
        sa.Column("invoice_date",        sa.Date(),      nullable=True),
        sa.Column("po_number",           sa.String(80),  nullable=True),
        sa.Column("taxable_value",       sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("cgst_amount",         sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sgst_amount",         sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("igst_amount",         sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount",          sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("rounding_amount",     sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("grand_total",         sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("pairs_count",         sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("irn",                 sa.String(100), nullable=True),
        sa.Column("ack_no",              sa.String(50),  nullable=True),
        sa.Column("ack_dt",              sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_qr",           sa.Text(),      nullable=True),
        sa.Column("ewb_number",          sa.String(50),  nullable=True),
        sa.Column("ewb_valid_till",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("pdf_path",            sa.String(500), nullable=True),
        sa.Column("json_path",           sa.String(500), nullable=True),
        sa.Column("status",              sa.String(20),  nullable=False, server_default="READY"),
        sa.Column("validation_errors",   sa.JSON(),      nullable=True),
        sa.Column("validation_warnings", sa.JSON(),      nullable=True),
        sa.Column("created_at",          sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at",         sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dispatch_inv_batch_id",   "dispatch_batch_invoices", ["batch_id"])
    op.create_index("ix_dispatch_inv_invoice_no", "dispatch_batch_invoices", ["invoice_number"])
    op.create_index("ix_dispatch_inv_batch_store","dispatch_batch_invoices", ["batch_id", "store_code"])


def downgrade() -> None:
    op.drop_table("dispatch_batch_invoices")
    op.drop_table("dispatch_batches")
