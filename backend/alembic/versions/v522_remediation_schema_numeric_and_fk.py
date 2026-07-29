"""SMRITI Retail OS v5.2.2 Remediation Schema Migration

Revision ID: v522_remediation_schema
Revises: add_hybrid_master_values
Create Date: 2026-07-21 17:55:00.000000

Design Rationale:
-----------------
Upgrades variant_templates and products tables to support v5.2.2 Architecture Specification:
1. Alters variant_templates base_price, base_mrp, and gst_percentage columns from Integer to Numeric.
2. Adds foreign key constraint fk_products_variant_template_id on products.variant_template_id referencing variant_templates(id).
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v522_remediation_schema'
down_revision: Union[str, Sequence[str], None] = 'add_hybrid_master_values'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Upgrade variant_templates numeric pricing columns
    op.alter_column(
        'variant_templates', 'base_price',
        type_=sa.Numeric(precision=15, scale=2),
        existing_type=sa.Integer(),
        existing_nullable=True
    )
    op.alter_column(
        'variant_templates', 'base_mrp',
        type_=sa.Numeric(precision=15, scale=2),
        existing_type=sa.Integer(),
        existing_nullable=True
    )
    op.alter_column(
        'variant_templates', 'gst_percentage',
        type_=sa.Numeric(precision=5, scale=2),
        existing_type=sa.Integer(),
        existing_nullable=True
    )

    # 2. Add foreign key constraint on products.variant_template_id
    op.create_foreign_key(
        'fk_products_variant_template_id',
        'products', 'variant_templates',
        ['variant_template_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_products_variant_template_id', 'products', type_='foreignkey')
    op.alter_column('variant_templates', 'gst_percentage', type_=sa.Integer(), existing_type=sa.Numeric(precision=5, scale=2))
    op.alter_column('variant_templates', 'base_mrp', type_=sa.Integer(), existing_type=sa.Numeric(precision=15, scale=2))
    op.alter_column('variant_templates', 'base_price', type_=sa.Integer(), existing_type=sa.Numeric(precision=15, scale=2))
