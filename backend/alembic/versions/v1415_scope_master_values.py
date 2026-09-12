"""Scope master lookup values to company and branch."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1415_scope_master_values"
down_revision: Union[str, Sequence[str], None] = "v1414_customer_credit_ledger"
branch_labels = None
depends_on = None


def _existing_columns(table_name: str):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {col["name"] for col in inspector.get_columns(table_name)}


def _existing_indexes(table_name: str):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {idx["name"] for idx in inspector.get_indexes(table_name)}


def upgrade() -> None:
    columns = _existing_columns("master_values")
    if "company_id" not in columns:
        op.add_column("master_values", sa.Column("company_id", sa.String(50), nullable=True))
    if "branch_id" not in columns:
        op.add_column("master_values", sa.Column("branch_id", sa.String(50), nullable=True))

    indexes = _existing_indexes("master_values")
    if "ix_master_values_company_id" not in indexes:
        op.create_index("ix_master_values_company_id", "master_values", ["company_id"])
    if "ix_master_values_branch_id" not in indexes:
        op.create_index("ix_master_values_branch_id", "master_values", ["branch_id"])


def downgrade() -> None:
    indexes = _existing_indexes("master_values")
    if "ix_master_values_branch_id" in indexes:
        op.drop_index("ix_master_values_branch_id", table_name="master_values")
    if "ix_master_values_company_id" in indexes:
        op.drop_index("ix_master_values_company_id", table_name="master_values")

    columns = _existing_columns("master_values")
    if "branch_id" in columns:
        op.drop_column("master_values", "branch_id")
    if "company_id" in columns:
        op.drop_column("master_values", "company_id")