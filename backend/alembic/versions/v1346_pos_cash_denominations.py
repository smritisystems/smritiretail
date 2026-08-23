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

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic (<= 32 characters).
revision: str = "v1346_pos_cash_denominations"
down_revision: Union[str, None] = "v1345_multicurrency_fx"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Add cash tracking & denominations to shifts table
    if "shifts" in tables:
        shift_cols = {c["name"] for c in inspector.get_columns("shifts")}
        if "cash_drops_total" not in shift_cols:
            op.add_column("shifts", sa.Column("cash_drops_total", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False))
        if "till_expenses_total" not in shift_cols:
            op.add_column("shifts", sa.Column("till_expenses_total", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False))
        if "cash_in_total" not in shift_cols:
            op.add_column("shifts", sa.Column("cash_in_total", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False))
        if "denominations" not in shift_cols:
            op.add_column("shifts", sa.Column("denominations", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # 2. Create shift_cash_transactions table
    if "shift_cash_transactions" not in tables:
        op.create_table(
            "shift_cash_transactions",
            sa.Column("id", sa.String(length=50), primary_key=True),
            sa.Column("uuid", sa.String(length=36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(length=50), nullable=False, index=True),
            sa.Column("branch_id", sa.String(length=50), nullable=True),
            sa.Column("shift_id", sa.String(length=50), sa.ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("transaction_type", sa.String(length=30), nullable=False),  # CASH_DROP | TILL_EXPENSE | CASH_IN
            sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
            sa.Column("account_id", sa.String(length=50), nullable=True),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("performed_by", sa.String(length=50), nullable=False),
            sa.Column("gl_voucher_id", sa.String(length=50), nullable=True),
            sa.Column("gl_voucher_no", sa.String(length=100), nullable=True),
            sa.Column("receipt_ref", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(length=100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        )
        op.create_index("idx_sct_company_shift", "shift_cash_transactions", ["company_id", "shift_id"])
        op.create_index("idx_sct_type_date", "shift_cash_transactions", ["company_id", "transaction_type", "created_at"])


def downgrade():
    op.execute("DROP TABLE IF EXISTS shift_cash_transactions CASCADE;")
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "shifts" in tables:
        shift_cols = {c["name"] for c in inspector.get_columns("shifts")}
        if "denominations" in shift_cols:
            op.drop_column("shifts", "denominations")
        if "cash_in_total" in shift_cols:
            op.drop_column("shifts", "cash_in_total")
        if "till_expenses_total" in shift_cols:
            op.drop_column("shifts", "till_expenses_total")
        if "cash_drops_total" in shift_cols:
            op.drop_column("shifts", "cash_drops_total")
