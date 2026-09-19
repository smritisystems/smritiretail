"""Add vendor buying cost default to variant templates."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1442_add_variant_template_base_cost_price"
down_revision: Union[str, Sequence[str], None] = "v1441_add_dedicated_size_group_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("variant_templates")}
    if "base_cost_price" not in columns:
        op.add_column(
            "variant_templates",
            sa.Column("base_cost_price", sa.Numeric(15, 2), nullable=True, server_default="0.00"),
        )


def downgrade() -> None:
    op.drop_column("variant_templates", "base_cost_price")
