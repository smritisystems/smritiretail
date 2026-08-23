"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""multi-currency valuation and fx rates schema

Revision ID: v1345_multicurrency_fx
Revises: v1344_fiscal_period_brs
Create Date: 2026-08-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'v1345_multicurrency_fx'
down_revision = 'v1344_fiscal_period_brs'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Currency Exchange Rates Table
    if "currency_exchange_rates" not in tables:
        op.create_table(
            "currency_exchange_rates",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True, index=True),
            sa.Column("from_currency", sa.String(10), nullable=False, index=True),
            sa.Column("to_currency", sa.String(10), nullable=False, server_default="INR", index=True),
            sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False),
            sa.Column("effective_date", sa.Date(), nullable=False),
            sa.Column("rate_type", sa.String(30), nullable=False, server_default="SPOT"),
            sa.Column("source", sa.String(100), nullable=False, server_default="MANUAL"),
            # BaseEntity audit columns
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.UniqueConstraint("company_id", "from_currency", "to_currency", "effective_date", "rate_type", name="uq_exchange_rate_comp_pair_date_type"),
        )
        op.create_index("idx_exchange_rate_lookup", "currency_exchange_rates", ["company_id", "from_currency", "to_currency", "effective_date"])

    # 2. Add Multi-Currency columns to journal_vouchers
    if "journal_vouchers" in tables:
        jv_cols = {c["name"] for c in inspector.get_columns("journal_vouchers")}
        if "currency" not in jv_cols:
            op.add_column("journal_vouchers", sa.Column("currency", sa.String(10), nullable=False, server_default="INR"))
        if "exchange_rate" not in jv_cols:
            op.add_column("journal_vouchers", sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False, server_default="1.000000"))
        if "total_foreign_debit" not in jv_cols:
            op.add_column("journal_vouchers", sa.Column("total_foreign_debit", sa.Numeric(15, 2), nullable=False, server_default="0.00"))
        if "total_foreign_credit" not in jv_cols:
            op.add_column("journal_vouchers", sa.Column("total_foreign_credit", sa.Numeric(15, 2), nullable=False, server_default="0.00"))

    # 3. Add Multi-Currency columns to general_ledger_entries
    if "general_ledger_entries" in tables:
        gle_cols = {c["name"] for c in inspector.get_columns("general_ledger_entries")}
        if "foreign_currency" not in gle_cols:
            op.add_column("general_ledger_entries", sa.Column("foreign_currency", sa.String(10), nullable=False, server_default="INR"))
        if "exchange_rate" not in gle_cols:
            op.add_column("general_ledger_entries", sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False, server_default="1.000000"))
        if "foreign_debit_amount" not in gle_cols:
            op.add_column("general_ledger_entries", sa.Column("foreign_debit_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"))
        if "foreign_credit_amount" not in gle_cols:
            op.add_column("general_ledger_entries", sa.Column("foreign_credit_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"))


def downgrade():
    op.drop_table("currency_exchange_rates")
