"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-13
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""Ensure 100% of Attribute Groups have governed Size and Color Group mappings."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1444_backfill_all_attribute_groups_governed_dimensions"
down_revision: Union[str, Sequence[str], None] = "v1443_add_color_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "attribute_groups" not in tables:
        return

    columns = {col["name"] for col in inspector.get_columns("attribute_groups")}
    if "size_group_id" in columns:
        bind.execute(
            sa.text(
                "UPDATE attribute_groups "
                "SET size_group_id = 'FOOTWEAR_EU' "
                "WHERE (lower(name) LIKE '%footwear%' OR lower(name) LIKE '%shoe%') "
                "AND (size_group_id IS NULL OR size_group_id = '')"
            )
        )
        bind.execute(
            sa.text(
                "UPDATE attribute_groups "
                "SET size_group_id = 'APPAREL_ALPHA' "
                "WHERE (size_group_id IS NULL OR size_group_id = '')"
            )
        )

    if "color_group_id" in columns:
        bind.execute(
            sa.text(
                "UPDATE attribute_groups "
                "SET color_group_id = 'COLOR_BASIC' "
                "WHERE (color_group_id IS NULL OR color_group_id = '')"
            )
        )


def downgrade() -> None:
    pass
