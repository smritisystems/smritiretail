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

"""fiscal periods and bank reconciliation statement schema

Revision ID: v1344_fiscal_period_brs
Revises: v1343_accounting_gl
Create Date: 2026-08-23 05:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'v1344_fiscal_period_brs'
down_revision = 'v1343_accounting_gl'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Fiscal Years Table
    if "fiscal_years" not in tables:
        op.create_table(
            "fiscal_years",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True, index=True),
            sa.Column("financial_year_code", sa.String(20), nullable=False, index=True),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("closed_by", sa.String(100), nullable=True),
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
            sa.UniqueConstraint("company_id", "financial_year_code", name="uq_fiscal_year_company_code"),
        )
        op.create_index("idx_fiscal_year_dates", "fiscal_years", ["company_id", "start_date", "end_date"])

    # 2. Fiscal Periods Table
    if "fiscal_periods" not in tables:
        op.create_table(
            "fiscal_periods",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True, index=True),
            sa.Column("fiscal_year_id", sa.String(50), sa.ForeignKey("fiscal_years.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("period_name", sa.String(50), nullable=False),
            sa.Column("period_number", sa.Integer(), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("status", sa.String(30), nullable=False, server_default="OPEN"),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("closed_by", sa.String(100), nullable=True),
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
            sa.UniqueConstraint("company_id", "fiscal_year_id", "period_number", name="uq_fiscal_period_comp_fy_num"),
        )
        op.create_index("idx_fiscal_period_dates", "fiscal_periods", ["company_id", "start_date", "end_date"])

    # 3. Bank Statements Table
    if "bank_statements" not in tables:
        op.create_table(
            "bank_statements",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True, index=True),
            sa.Column("bank_account_id", sa.String(50), sa.ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("statement_no", sa.String(100), nullable=False, index=True),
            sa.Column("statement_date", sa.Date(), nullable=False),
            sa.Column("from_date", sa.Date(), nullable=False),
            sa.Column("to_date", sa.Date(), nullable=False),
            sa.Column("opening_balance", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("closing_balance", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("is_reconciled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reconciled_by", sa.String(100), nullable=True),
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
            sa.UniqueConstraint("company_id", "bank_account_id", "statement_no", name="uq_bank_statement_comp_acc_no"),
        )
        op.create_index("idx_bank_statement_dates", "bank_statements", ["company_id", "from_date", "to_date"])

    # 4. Bank Statement Lines Table
    if "bank_statement_lines" not in tables:
        op.create_table(
            "bank_statement_lines",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True, index=True),
            sa.Column("statement_id", sa.String(50), sa.ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("line_number", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("transaction_date", sa.Date(), nullable=False),
            sa.Column("value_date", sa.Date(), nullable=False),
            sa.Column("reference_no", sa.String(100), nullable=True, index=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("deposit_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("withdrawal_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("balance_after_transaction", sa.Numeric(15, 2), nullable=True),
            sa.Column("reconciled_gl_entry_id", sa.String(50), sa.ForeignKey("general_ledger_entries.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("reconciliation_status", sa.String(30), nullable=False, server_default="UNMATCHED"),
            sa.Column("cleared_at", sa.DateTime(timezone=True), nullable=True),
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
        )
        op.create_index("idx_bsl_statement_line", "bank_statement_lines", ["company_id", "statement_id", "line_number"])
        op.create_index("idx_bsl_reconciliation", "bank_statement_lines", ["company_id", "reconciliation_status"])


def downgrade():
    op.drop_table("bank_statement_lines")
    op.drop_table("bank_statements")
    op.drop_table("fiscal_periods")
    op.drop_table("fiscal_years")
