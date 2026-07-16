"""add_master_values_soft_delete

Revision ID: 93e07a92812b
Revises: 44adad58fb7c
Create Date: 2026-07-14 08:03:55.545653

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '93e07a92812b'
down_revision: Union[str, Sequence[str], None] = '44adad58fb7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('master_values', sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.add_column('master_values', sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('master_values', sa.Column('deleted_by', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('master_values', 'deleted_by')
    op.drop_column('master_values', 'deleted_at')
    op.drop_column('master_values', 'is_deleted')
