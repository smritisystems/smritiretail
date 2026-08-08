"""v900 multi group category mapping

Revision ID: v900_multi_group_category_mapping
Revises: v900_replenishment_reorder
Create Date: 2026-08-08 16:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v900_multi_group_category_mapping'
down_revision = 'v900_replenishment_reorder'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Drop single category unique constraint
    try:
        op.drop_constraint('category_attribute_group_mappings_category_key', 'category_attribute_group_mappings', type_='unique')
    except Exception:
        pass

    # 2. Add composite unique constraint (category + attribute_group_id)
    op.create_unique_constraint(
        'uq_category_group_mapping',
        'category_attribute_group_mappings',
        ['category', 'attribute_group_id']
    )


def downgrade():
    op.drop_constraint('uq_category_group_mapping', 'category_attribute_group_mappings', type_='unique')
    op.create_unique_constraint(
        'category_attribute_group_mappings_category_key',
        'category_attribute_group_mappings',
        ['category']
    )
