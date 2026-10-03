"""Add auditable customer credit ledger entries."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1414_customer_credit_ledger"
down_revision: Union[str, Sequence[str], None] = "v1413_customer_price_tier_assignment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "customer_credit_ledger_entries" not in existing_tables:
        op.create_table(
            "customer_credit_ledger_entries",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(length=50), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(50), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(50), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("customer_id", sa.String(50), nullable=False),
            sa.Column("entry_date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("entry_type", sa.String(20), nullable=False),
            sa.Column("amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("balance_after", sa.Numeric(15, 2), nullable=False),
            sa.Column("reference_type", sa.String(50), nullable=False),
            sa.Column("reference_id", sa.String(100), nullable=False),
            sa.Column("due_date", sa.Date(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
            sa.UniqueConstraint("reference_type", "reference_id", name="uq_customer_credit_ledger_reference"),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("customer_credit_ledger_entries")}
    if "ix_customer_credit_ledger_customer_date" not in existing_indexes:
        op.create_index("ix_customer_credit_ledger_customer_date", "customer_credit_ledger_entries", ["customer_id", "entry_date"])
    if "ix_customer_credit_ledger_entries_customer_id" not in existing_indexes:
        op.create_index("ix_customer_credit_ledger_entries_customer_id", "customer_credit_ledger_entries", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_credit_ledger_entries_customer_id", table_name="customer_credit_ledger_entries")
    op.drop_index("ix_customer_credit_ledger_customer_date", table_name="customer_credit_ledger_entries")
    op.drop_table("customer_credit_ledger_entries")