"""Add gift_cards, gift_card_transactions, gift_vouchers, e_invoices, e_invoice_batches tables

Revision ID: v1336_gift_cards_and_einvoice
Revises: v1335_add_user_role_id_and_seed_roles
Create Date: 2026-10-04

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 3.119.0 - 3.120.0
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1336_gift_cards_and_einvoice"
down_revision = "v1335_seed_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── gift_cards ──────────────────────────────────────────────
    op.create_table(
        "gift_cards",
        sa.Column("id",          sa.String(50),  nullable=False, primary_key=True),
        sa.Column("card_no",     sa.String(40),  nullable=False),
        sa.Column("card_type",   sa.String(20),  nullable=False, server_default="PHYSICAL"),
        sa.Column("status",      sa.String(20),  nullable=False, server_default="ACTIVE"),
        sa.Column("face_value",  sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("balance",     sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("currency",    sa.String(5),   nullable=False, server_default="INR"),
        sa.Column("issued_to",   sa.String(100), nullable=True),
        sa.Column("issued_by",   sa.String(50),  nullable=True),
        sa.Column("issued_at",   sa.DateTime,    nullable=True),
        sa.Column("valid_from",  sa.DateTime,    nullable=True),
        sa.Column("valid_to",    sa.DateTime,    nullable=True),
        sa.Column("pin_hash",    sa.String(128), nullable=True),
        sa.Column("notes",       sa.Text,        nullable=True),
        sa.Column("meta",        postgresql.JSONB, server_default="{}"),
        sa.Column("is_deleted",  sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("created_at",  sa.DateTime,    nullable=True),
        sa.Column("updated_at",  sa.DateTime,    nullable=True),
        sa.Column("created_by",  sa.String(50),  nullable=True),
        sa.Column("updated_by",  sa.String(50),  nullable=True),
    )
    op.create_index("ix_gift_cards_card_no",   "gift_cards",  ["card_no"],  unique=True)
    op.create_index("ix_gift_cards_status",    "gift_cards",  ["status"])

    # ── gift_card_transactions ───────────────────────────────────
    op.create_table(
        "gift_card_transactions",
        sa.Column("id",           sa.String(50),  nullable=False, primary_key=True),
        sa.Column("gift_card_id", sa.String(50),  sa.ForeignKey("gift_cards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("txn_type",     sa.String(20),  nullable=False),
        sa.Column("amount",       sa.Numeric(15, 2), nullable=False),
        sa.Column("balance_after",sa.Numeric(15, 2), nullable=True),
        sa.Column("reference_no", sa.String(80),  nullable=True),
        sa.Column("performed_by", sa.String(50),  nullable=True),
        sa.Column("notes",        sa.Text,        nullable=True),
        sa.Column("is_deleted",   sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("created_at",   sa.DateTime,    nullable=True),
        sa.Column("updated_at",   sa.DateTime,    nullable=True),
        sa.Column("created_by",   sa.String(50),  nullable=True),
        sa.Column("updated_by",   sa.String(50),  nullable=True),
    )
    op.create_index("ix_gct_gift_card_id", "gift_card_transactions", ["gift_card_id"])

    # ── gift_vouchers ────────────────────────────────────────────
    op.create_table(
        "gift_vouchers",
        sa.Column("id",              sa.String(50),  nullable=False, primary_key=True),
        sa.Column("voucher_no",      sa.String(40),  nullable=False),
        sa.Column("voucher_type",    sa.String(20),  nullable=False, server_default="FIXED"),
        sa.Column("status",          sa.String(20),  nullable=False, server_default="ACTIVE"),
        sa.Column("face_value",      sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("pct_discount",    sa.Numeric(5, 2),  nullable=True),
        sa.Column("min_order_value", sa.Numeric(15, 2), nullable=True),
        sa.Column("max_discount",    sa.Numeric(15, 2), nullable=True),
        sa.Column("issued_to",       sa.String(100), nullable=True),
        sa.Column("issued_at",       sa.DateTime,    nullable=True),
        sa.Column("used_at",         sa.DateTime,    nullable=True),
        sa.Column("valid_from",      sa.DateTime,    nullable=True),
        sa.Column("valid_to",        sa.DateTime,    nullable=True),
        sa.Column("redeemed_invoice_no", sa.String(80), nullable=True),
        sa.Column("notes",           sa.Text,        nullable=True),
        sa.Column("is_deleted",      sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("created_at",      sa.DateTime,    nullable=True),
        sa.Column("updated_at",      sa.DateTime,    nullable=True),
        sa.Column("created_by",      sa.String(50),  nullable=True),
        sa.Column("updated_by",      sa.String(50),  nullable=True),
    )
    op.create_index("ix_gift_vouchers_voucher_no", "gift_vouchers", ["voucher_no"], unique=True)
    op.create_index("ix_gift_vouchers_status",     "gift_vouchers", ["status"])

    # ── e_invoices ───────────────────────────────────────────────
    op.create_table(
        "e_invoices",
        sa.Column("id",             sa.String(50),  nullable=False, primary_key=True),
        sa.Column("invoice_id",     sa.String(50),  nullable=False),
        sa.Column("invoice_no",     sa.String(80),  nullable=False),
        sa.Column("gstin_supplier", sa.String(20),  nullable=True),
        sa.Column("gstin_buyer",    sa.String(20),  nullable=True),
        sa.Column("invoice_date",   sa.DateTime,    nullable=True),
        sa.Column("invoice_value",  sa.Numeric(18, 2), nullable=True),
        sa.Column("irn",            sa.String(128), nullable=True),
        sa.Column("ack_no",         sa.String(50),  nullable=True),
        sa.Column("ack_date",       sa.DateTime,    nullable=True),
        sa.Column("signed_invoice", sa.Text,        nullable=True),
        sa.Column("signed_qr_code", sa.Text,        nullable=True),
        sa.Column("status",         sa.String(20),  nullable=False, server_default="PENDING"),
        sa.Column("irp_response",   postgresql.JSONB, server_default="{}"),
        sa.Column("cancel_reason",  sa.String(50),  nullable=True),
        sa.Column("cancel_remark",  sa.Text,        nullable=True),
        sa.Column("cancelled_at",   sa.DateTime,    nullable=True),
        sa.Column("retry_count",    sa.Integer,     nullable=False, server_default="0"),
        sa.Column("error_detail",   sa.Text,        nullable=True),
        sa.Column("is_deleted",     sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("created_at",     sa.DateTime,    nullable=True),
        sa.Column("updated_at",     sa.DateTime,    nullable=True),
        sa.Column("created_by",     sa.String(50),  nullable=True),
        sa.Column("updated_by",     sa.String(50),  nullable=True),
    )
    op.create_index("ix_e_invoices_invoice_id", "e_invoices", ["invoice_id"])
    op.create_index("ix_e_invoices_invoice_no", "e_invoices", ["invoice_no"])
    op.create_index("ix_e_invoices_irn",        "e_invoices", ["irn"], unique=True, postgresql_where=sa.text("irn IS NOT NULL"))
    op.create_index("ix_e_invoices_status",     "e_invoices", ["status"])

    # ── e_invoice_batches ────────────────────────────────────────
    op.create_table(
        "e_invoice_batches",
        sa.Column("id",             sa.String(50),  nullable=False, primary_key=True),
        sa.Column("batch_no",       sa.String(40),  nullable=False),
        sa.Column("status",         sa.String(20),  nullable=False, server_default="QUEUED"),
        sa.Column("total_invoices", sa.Integer,     nullable=False, server_default="0"),
        sa.Column("success_count",  sa.Integer,     nullable=False, server_default="0"),
        sa.Column("failed_count",   sa.Integer,     nullable=False, server_default="0"),
        sa.Column("submitted_by",   sa.String(50),  nullable=True),
        sa.Column("completed_at",   sa.DateTime,    nullable=True),
        sa.Column("notes",          sa.Text,        nullable=True),
        sa.Column("is_deleted",     sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("created_at",     sa.DateTime,    nullable=True),
        sa.Column("updated_at",     sa.DateTime,    nullable=True),
        sa.Column("created_by",     sa.String(50),  nullable=True),
        sa.Column("updated_by",     sa.String(50),  nullable=True),
    )
    op.create_index("ix_e_invoice_batches_batch_no", "e_invoice_batches", ["batch_no"], unique=True)


def downgrade() -> None:
    op.drop_table("e_invoice_batches")
    op.drop_table("e_invoices")
    op.drop_table("gift_vouchers")
    op.drop_table("gift_card_transactions")
    op.drop_table("gift_cards")
