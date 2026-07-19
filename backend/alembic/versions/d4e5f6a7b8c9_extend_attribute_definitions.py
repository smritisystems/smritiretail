"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = '6bc445ac1554'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('attribute_definitions', sa.Column('is_searchable', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('attribute_definitions', sa.Column('is_filterable', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('attribute_definitions', sa.Column('is_printable', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('attribute_definitions', sa.Column('is_barcode_enabled', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('attribute_definitions', sa.Column('display_order', sa.Integer(), server_default='0', nullable=True))
    op.add_column('attribute_definitions', sa.Column('default_value', sa.String(length=200), nullable=True))
    op.add_column('attribute_definitions', sa.Column('tooltip', sa.String(length=500), nullable=True))
    op.add_column('attribute_definitions', sa.Column('validation_rules', sa.Text(), nullable=True))
    op.add_column('attribute_definitions', sa.Column('is_enabled', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('attribute_definitions', sa.Column('multi_lang_labels', JSONB(astext_type=sa.Text()), server_default='{}', nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('attribute_definitions', 'multi_lang_labels')
    op.drop_column('attribute_definitions', 'is_enabled')
    op.drop_column('attribute_definitions', 'validation_rules')
    op.drop_column('attribute_definitions', 'tooltip')
    op.drop_column('attribute_definitions', 'default_value')
    op.drop_column('attribute_definitions', 'display_order')
    op.drop_column('attribute_definitions', 'is_barcode_enabled')
    op.drop_column('attribute_definitions', 'is_printable')
    op.drop_column('attribute_definitions', 'is_filterable')
    op.drop_column('attribute_definitions', 'is_searchable')
