"""Link matrix Attribute Groups to canonical Master Registry Size Groups."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1440_link_attribute_groups_to_size_groups"
down_revision: Union[str, Sequence[str], None] = "v1439_seed_electronics_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("attribute_groups")}
    indexes = {index["name"] for index in inspector.get_indexes("attribute_groups")}
    if "size_group_id" not in columns:
        op.add_column("attribute_groups", sa.Column("size_group_id", sa.String(length=100), nullable=True))
    if "ix_attribute_groups_size_group_id" not in indexes:
        op.create_index("ix_attribute_groups_size_group_id", "attribute_groups", ["size_group_id"])

    bind.execute(
        sa.text(
            "UPDATE attribute_groups SET size_group_id = 'FOOTWEAR_EU' "
            "WHERE (lower(name) LIKE '%footwear%' OR lower(name) LIKE '%shoe%') AND (size_group_id IS NULL OR size_group_id = '')"
        )
    )
    bind.execute(
        sa.text(
            "UPDATE attribute_groups SET size_group_id = 'APPAREL_ALPHA' "
            "WHERE (size_group_id IS NULL OR size_group_id = '')"
        )
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {index["name"] for index in inspector.get_indexes("attribute_groups")}
    columns = {column["name"] for column in inspector.get_columns("attribute_groups")}
    if "ix_attribute_groups_size_group_id" in indexes:
        op.drop_index("ix_attribute_groups_size_group_id", table_name="attribute_groups")
    if "size_group_id" in columns:
        op.drop_column("attribute_groups", "size_group_id")