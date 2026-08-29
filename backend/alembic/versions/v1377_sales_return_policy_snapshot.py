"""Persist the effective Sales Return policy reference and snapshot."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1377_sales_return_policy"
down_revision = "v1376_sales_return_idempotency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_returns", sa.Column("policy_id", sa.String(length=100), nullable=True))
    op.add_column("sales_returns", sa.Column("policy_version", sa.Integer(), nullable=True))
    op.add_column("sales_returns", sa.Column("policy_scope", sa.String(length=100), nullable=True))
    op.add_column(
        "sales_returns",
        sa.Column(
            "policy_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("sales_returns", "policy_snapshot")
    op.drop_column("sales_returns", "policy_scope")
    op.drop_column("sales_returns", "policy_version")
    op.drop_column("sales_returns", "policy_id")
