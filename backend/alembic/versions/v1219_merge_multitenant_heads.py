"""merge multitenant and inventory heads

Revision ID: v1219_merge_multitenant_heads
Revises: v1001_inventory_kernel_phase7, v1218_tenant_multitenant
Create Date: 2026-08-05 11:18:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v1219_merge_multitenant_heads'
down_revision: Union[str, Sequence[str], None] = ('v1001_inventory_kernel_phase7', 'v1218_tenant_multitenant')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
