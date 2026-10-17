"""Link Variant Templates to canonical Master Registry Article / Style values."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "v1437_link_variant_templates_to_master_articles"
down_revision: Union[str, Sequence[str], None] = "v1436_add_master_article_vendor_ownership"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("variant_templates")}
    indexes = {index["name"] for index in inspector.get_indexes("variant_templates")}
    if "master_value_id" not in columns:
        op.add_column("variant_templates", sa.Column("master_value_id", postgresql.UUID(as_uuid=True), nullable=True))
    if "ix_variant_templates_master_value_id" not in indexes:
        op.create_index("ix_variant_templates_master_value_id", "variant_templates", ["master_value_id"])
    foreign_keys = {fk.get("name") for fk in inspector.get_foreign_keys("variant_templates")}
    if "fk_variant_templates_master_value_id" not in foreign_keys:
        op.create_foreign_key(
            "fk_variant_templates_master_value_id",
            "variant_templates",
            "master_values",
            ["master_value_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    foreign_keys = {fk.get("name") for fk in inspector.get_foreign_keys("variant_templates")}
    indexes = {index["name"] for index in inspector.get_indexes("variant_templates")}
    columns = {column["name"] for column in inspector.get_columns("variant_templates")}
    if "fk_variant_templates_master_value_id" in foreign_keys:
        op.drop_constraint("fk_variant_templates_master_value_id", "variant_templates", type_="foreignkey")
    if "ix_variant_templates_master_value_id" in indexes:
        op.drop_index("ix_variant_templates_master_value_id", table_name="variant_templates")
    if "master_value_id" in columns:
        op.drop_column("variant_templates", "master_value_id")