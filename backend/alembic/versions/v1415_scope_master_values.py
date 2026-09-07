"""Scope master lookup values to company and branch."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1415_scope_master_values"
down_revision: Union[str, Sequence[str], None] = "v1414_customer_credit_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("master_values", sa.Column("company_id", sa.String(50), nullable=True))
    op.add_column("master_values", sa.Column("branch_id", sa.String(50), nullable=True))
    op.create_index("ix_master_values_company_id", "master_values", ["company_id"])
    op.create_index("ix_master_values_branch_id", "master_values", ["branch_id"])


def downgrade() -> None:
    op.drop_index("ix_master_values_branch_id", table_name="master_values")
    op.drop_index("ix_master_values_company_id", table_name="master_values")
    op.drop_column("master_values", "branch_id")
    op.drop_column("master_values", "company_id")