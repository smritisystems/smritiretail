"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.31.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Alembic Migration: Add missing BaseEntity columns (workflow_status, document_number)
Revision: 5922562b72ad
"""

from typing import Sequence, Union
import sys
import os

# Append parent directory to sys.path so we can import app modules inside the migration environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import reflection

# revision identifiers, used by Alembic.
revision: str = '5922562b72ad'
down_revision: Union[str, Sequence[str], None] = '05e3e3355649'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def get_all_base_entity_tablenames() -> list:
    from app.db.base import BaseEntity
    # Trigger model imports so subclasses are populated
    from app.main import app
    return [m.__tablename__ for m in BaseEntity.__subclasses__() if hasattr(m, '__tablename__')]


from alembic import context


def upgrade() -> None:
    """Upgrade schema by adding missing BaseEntity columns."""
    if context.is_offline_mode():
        return
    try:
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        existing_tables = inspector.get_table_names()
    except Exception:
        return

    
    tables_to_migrate = get_all_base_entity_tablenames()
    
    for table_name in tables_to_migrate:
        if table_name not in existing_tables:
            continue
            
        columns = [c["name"] for c in inspector.get_columns(table_name)]
        
        if "workflow_status" not in columns:
            op.add_column(table_name, sa.Column("workflow_status", sa.String(30), nullable=True))
            
        if "document_number" not in columns:
            op.add_column(table_name, sa.Column("document_number", sa.String(80), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = reflection.Inspector.from_engine(bind)
    existing_tables = inspector.get_table_names()
    
    tables_to_migrate = get_all_base_entity_tablenames()
    
    for table_name in tables_to_migrate:
        if table_name not in existing_tables:
            continue
            
        columns = [c["name"] for c in inspector.get_columns(table_name)]
        
        if "document_number" in columns:
            # Avoid dropping columns originally defined in specific tables (e.g. document_workflows)
            if table_name != "document_workflows":
                op.drop_column(table_name, "document_number")
                
        if "workflow_status" in columns:
            op.drop_column(table_name, "workflow_status")
