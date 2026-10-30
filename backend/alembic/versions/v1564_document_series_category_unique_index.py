"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.50.0
Created      : 2026-10-30
Modified     : 2026-10-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Evolution & Document Numbering Governance

v1564: Fix Document Series Category Unique Index.
Replaces uq_document_series_company_type_terminal_active with
uq_document_series_company_type_terminal_cat_active to include COALESCE(category, '').
Permits coexistence of multiple active Article series partitioned by category.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1564"
down_revision: Union[str, Sequence[str], None] = "v1563"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop the overly restrictive index introduced in v1546 that lacked category partitioning
    op.execute(sa.text("""
        DROP INDEX IF EXISTS uq_document_series_company_type_terminal_active;
    """))

    # 2. Re-create the partial unique index including COALESCE(category, '')
    # This ensures that within the same company and terminal, different categories
    # (e.g. SANDAL vs SHOES vs NULL fallback) can each have their own active series.
    op.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS
            uq_document_series_company_type_terminal_cat_active
        ON document_series (company_id, document_type, COALESCE(terminal_id, 'COMMON'), COALESCE(category, ''))
        WHERE is_deleted = false AND is_active = true AND company_id IS NOT NULL;
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        DROP INDEX IF EXISTS uq_document_series_company_type_terminal_cat_active;
    """))
    op.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS
            uq_document_series_company_type_terminal_active
        ON document_series (company_id, document_type, COALESCE(terminal_id, 'COMMON'))
        WHERE is_deleted = false AND is_active = true AND company_id IS NOT NULL;
    """))

