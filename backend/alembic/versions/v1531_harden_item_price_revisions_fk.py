"""SMRITI Retail OS Price Revision Foreign Key Hardening Migration

Revision ID: v1531_harden_item_price_revisions_fk
Revises: v1530_item_price_revisions
Create Date: 2026-10-13

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.73.1
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Hardens foreign keys item_id and variant_id in item_price_revisions from ON DELETE CASCADE to ON DELETE RESTRICT.
2. Prevents accidental or cascading destruction of historical and temporal price revision audit ledgers upon catalog retirement.
3. Preserves all existing data in both tenant and control databases.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1531_harden_item_price_revisions_fk"
down_revision: Union[str, Sequence[str], None] = "v1530_item_price_revisions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Drop existing CASCADE constraints and replace with RESTRICT
    conn.execute(sa.text("ALTER TABLE item_price_revisions DROP CONSTRAINT IF EXISTS item_price_revisions_item_id_fkey;"))
    conn.execute(sa.text("""
        ALTER TABLE item_price_revisions ADD CONSTRAINT item_price_revisions_item_id_fkey 
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
    """))

    conn.execute(sa.text("ALTER TABLE item_price_revisions DROP CONSTRAINT IF EXISTS item_price_revisions_variant_id_fkey;"))
    conn.execute(sa.text("""
        ALTER TABLE item_price_revisions ADD CONSTRAINT item_price_revisions_variant_id_fkey 
            FOREIGN KEY (variant_id) REFERENCES item_variants(id) ON DELETE RESTRICT;
    """))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("ALTER TABLE item_price_revisions DROP CONSTRAINT IF EXISTS item_price_revisions_item_id_fkey;"))
    conn.execute(sa.text("""
        ALTER TABLE item_price_revisions ADD CONSTRAINT item_price_revisions_item_id_fkey 
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
    """))

    conn.execute(sa.text("ALTER TABLE item_price_revisions DROP CONSTRAINT IF EXISTS item_price_revisions_variant_id_fkey;"))
    conn.execute(sa.text("""
        ALTER TABLE item_price_revisions ADD CONSTRAINT item_price_revisions_variant_id_fkey 
            FOREIGN KEY (variant_id) REFERENCES item_variants(id) ON DELETE CASCADE;
    """))
