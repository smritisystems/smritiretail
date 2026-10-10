"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.21.0
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Menu Registry & Parity Seeding
"""

"""Seed Sales Promotions Studio in Canonical Menu Registry.

Revision ID: v1453_seed_sales_promotions_menu
Revises: v1452_canonical_eway_bills_2026
Create Date: 2026-09-14
"""

import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "v1453_seed_sales_promotions_menu"
down_revision: Union[str, Sequence[str], None] = "v1452_canonical_eway_bills_2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Seed into smriti_menus if table exists (Control Plane smritisys)
    has_menus = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'smriti_menus';
    """)).scalar()

    if has_menus:
        existing_menu = bind.execute(sa.text("""
            SELECT 1 FROM smriti_menus WHERE id = 'menu-sales-promotions';
        """)).scalar()

        if not existing_menu:
            gen_uuid = str(uuid.uuid4())
            bind.execute(sa.text("""
                INSERT INTO smriti_menus (
                    id, uuid, title, route, icon, module, permission, sequence, parent_id, is_active, is_deleted, version
                ) VALUES (
                    'menu-sales-promotions',
                    :uuid,
                    'Promotions Studio',
                    '/sales-promotions',
                    'campaign',
                    'Sales & POS',
                    'PROMOTIONS.WORKSPACE.ACCESS',
                    35,
                    'menu-pos',
                    true,
                    false,
                    1
                );
            """), {"uuid": gen_uuid})

    # 2. Update smriti_legacy_menu_map if table exists
    has_legacy = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'smriti_legacy_menu_map';
    """)).scalar()

    if has_legacy:
        bind.execute(sa.text("""
            UPDATE smriti_legacy_menu_map
            SET smriti_menu_id = 'menu-sales-promotions',
                smriti_workspace = 'sales-promotions',
                smriti_module = 'Sales & POS',
                smriti_action = 'PROMOTIONS_STUDIO',
                migration_status = 'MAPPED'
            WHERE (sh9_mnu_no = 600 AND sh9_menu_opt = 608)
               OR sh9_mnu_name ILIKE '%Define Sales Promotions%';
        """))


def downgrade() -> None:
    bind = op.get_bind()
    has_menus = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'smriti_menus';
    """)).scalar()

    if has_menus:
        bind.execute(sa.text("""
            DELETE FROM smriti_menus WHERE id = 'menu-sales-promotions';
        """))
