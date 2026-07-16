"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5f6g7h8i9j0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create system_configs table
    op.create_table(
        'system_configs',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index(op.f('ix_system_configs_key'), 'system_configs', ['key'], unique=True)

    # 2. Create print_histories table
    op.create_table(
        'print_histories',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True),
        sa.Column('user', sa.String(length=100), nullable=False),
        sa.Column('item_code', sa.String(length=50), nullable=False),
        sa.Column('item_name', sa.String(length=255), nullable=False),
        sa.Column('barcode', sa.String(length=100), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )

    # Seed default printer connection settings
    op.execute(
        "INSERT INTO system_configs (id, uuid, company_id, branch_id, created_at, modified_at, created_by, updated_by, is_active, is_deleted, version, key, value, category) "
        "VALUES ('cfg-default-printer', 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', null, null, now(), now(), 'SYSADMIN', 'SYSADMIN', true, false, 1, 'printer_connection', '{\"ip\": \"192.168.1.200\", \"port\": 9100}', 'Printing') "
        "ON CONFLICT (key) DO NOTHING"
    )

    # Seed default layout template (50x25mm Single Column Label)
    op.execute(
        "INSERT INTO barcode_layouts (id, uuid, name, width_mm, height_mm, columns, is_default, elements_json, is_active, is_deleted, created_at, modified_at, created_by, updated_by, version) "
        "VALUES ('lay-default-1', 'a0b1c2d3-e4f5-6a7b-8c9d-e0f1a2b3c4d5', 'Standard Product Label (50x25mm)', 50.00, 25.00, 1, true, "
        "'"
        "["
          "{\"type\": \"text\", \"x\": 2, \"y\": 2, \"field\": \"name\", \"label\": \"Product Name\"},"
          "{\"type\": \"barcode\", \"x\": 2, \"y\": 6, \"field\": \"code\", \"label\": \"Barcode\"},"
          "{\"type\": \"text\", \"x\": 2, \"y\": 15, \"field\": \"code\", \"label\": \"SKU Code\"},"
          "{\"type\": \"text\", \"x\": 2, \"y\": 19, \"field\": \"price\", \"label\": \"Price\"},"
          "{\"type\": \"text\", \"x\": 18, \"y\": 19, \"field\": \"mrp\", \"label\": \"MRP\"},"
          "{\"type\": \"text\", \"x\": 34, \"y\": 19, \"field\": \"size\", \"label\": \"Size\"}"
        "]"
        "', "
        "true, false, now(), now(), 'SYSADMIN', 'SYSADMIN', 1) "
        "ON CONFLICT (id) DO NOTHING"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM barcode_layouts WHERE id = 'lay-default-1'")
    op.drop_table('print_histories')
    op.drop_index(op.f('ix_system_configs_key'), table_name='system_configs')
    op.drop_table('system_configs')
