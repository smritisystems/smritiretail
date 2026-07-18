"""merge heads for docker startup

Revision ID: 243564cc5324
Revises: 94fdee7fd6ab, j6k7l8m9n0o
Create Date: 2026-07-18 10:55:45.667061

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '243564cc5324'
down_revision: Union[str, Sequence[str], None] = ('94fdee7fd6ab', 'j6k7l8m9n0o')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
