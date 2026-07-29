"""add_18_section_supplier_fields

Revision ID: 79c2e9571506
Revises: v1217_foundation_platform_v3
Create Date: 2026-07-29 20:06:53.964697

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '79c2e9571506'
down_revision: Union[str, Sequence[str], None] = 'v1217_foundation_platform_v3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Additive Supplier Columns."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [c['name'] for c in inspector.get_columns('suppliers')]

    new_columns = [
        ('legal_name', sa.String(length=255)),
        ('display_name', sa.String(length=255)),
        ('tan_number', sa.String(length=20)),
        ('cin_number', sa.String(length=30)),
        ('place_of_supply', sa.String(length=100)),
        ('gst_type', sa.String(length=50)),
        ('lead_time_days', sa.Integer()),
        ('min_order_qty', sa.Numeric(precision=15, scale=3)),
        ('max_order_qty', sa.Numeric(precision=15, scale=3)),
        ('order_multiple', sa.Numeric(precision=15, scale=3)),
        ('preferred_language', sa.String(length=30)),
        ('transport_name', sa.String(length=150)),
        ('transporter_gstin', sa.String(length=20)),
        ('freight_terms', sa.String(length=100)),
        ('default_label_template', sa.String(length=100)),
        ('default_barcode_type', sa.String(length=50)),
    ]

    for col_name, col_type in new_columns:
        if col_name not in existing_columns:
            op.add_column('suppliers', sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    pass
