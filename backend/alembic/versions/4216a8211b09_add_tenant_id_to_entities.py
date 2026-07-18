# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

"""add_tenant_id_to_entities

Revision ID: 4216a8211b09
Revises: d5e6f7g8h9i0
Create Date: 2026-07-19 02:18:19.553328

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4216a8211b09'
down_revision: Union[str, Sequence[str], None] = 'd5e6f7g8h9i0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add tenant_id column and index to all business entity tables."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    
    EXCLUDED_TABLES = {"alembic_version", "refresh_token_blacklist"}
    
    for table_name in tables:
        if table_name in EXCLUDED_TABLES:
            continue
        
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "tenant_id" not in columns:
            op.add_column(
                table_name,
                sa.Column("tenant_id", sa.String(length=50), nullable=True)
            )
            op.create_index(
                f"ix_{table_name}_tenant_id",
                table_name,
                ["tenant_id"],
                unique=False
            )
            op.execute(f"UPDATE {table_name} SET tenant_id = 'default' WHERE tenant_id IS NULL")


def downgrade() -> None:
    """Downgrade schema: remove tenant_id column and index from all business entity tables."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    
    EXCLUDED_TABLES = {"alembic_version", "refresh_token_blacklist"}
    
    for table_name in tables:
        if table_name in EXCLUDED_TABLES:
            continue
        
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "tenant_id" in columns:
            try:
                op.drop_index(f"ix_{table_name}_tenant_id", table_name=table_name)
            except Exception:
                pass
            op.drop_column(table_name, "tenant_id")
