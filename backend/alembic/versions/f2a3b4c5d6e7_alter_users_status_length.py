"""Alter users.status length

Revision ID: f2a3b4c5d6e7
Revises: 243564cc5324
Create Date: 2026-07-18 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f2a3b4c5d6e7'
down_revision = '243564cc5324'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'users',
        'status',
        existing_type=sa.String(length=20),
        type_=sa.String(length=50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'users',
        'status',
        existing_type=sa.String(length=50),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
