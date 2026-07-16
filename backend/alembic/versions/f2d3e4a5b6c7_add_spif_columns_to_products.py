"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""add spif columns to products

Revision ID: f2d3e4a5b6c7
Revises: 514c894ed938
Create Date: 2026-07-13 16:22:15.123456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f2d3e4a5b6c7'
down_revision: Union[str, Sequence[str], None] = '514c894ed938'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('products', sa.Column('primary_image_url', sa.String(length=512), nullable=True))
    op.add_column('products', sa.Column('gallery_images', postgresql.ARRAY(sa.String()), server_default='{}', nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('products', 'primary_image_url')
    op.drop_column('products', 'gallery_images')
