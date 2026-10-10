"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Menu Registry & Parity Seeding
"""

"""Seed Goods Receipt Note (GRN) Terminal in Canonical Menu Registry.

Revision ID: v1487_seed_goods_receipt_menu
Revises: v1486_loyalty_studio_tables
Create Date: 2026-09-24
"""

import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "v1487_seed_goods_receipt_menu"
down_revision: Union[str, Sequence[str], None] = "v1486_loyalty_studio_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Seed into smriti_menus if table exists (Control Plane)
    has_menus = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'smriti_menus';
    """)).scalar()

    if has_menus:
        existing_menu = bind.execute(sa.text("""
            SELECT 1 FROM smriti_menus WHERE id = 'menu-grn';
        """)).scalar()

        if not existing_menu:
            gen_uuid = str(uuid.uuid4())
            bind.execute(sa.text("""
                INSERT INTO smriti_menus (
                    id, uuid, title, route, icon, module, permission, sequence, parent_id, is_active, is_deleted, version
                ) VALUES (
                    'menu-grn',
                    :uuid,
                    'Goods Receipt Note (GRN)',
                    '/goods-receipt',
                    'fact_check',
                    'Inventory & Purchase',
                    'GRN.WORKSPACE.ACCESS',
                    165,
                    'menu-inventory',
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
            SET smriti_menu_id = 'menu-grn',
                smriti_workspace = 'grn-studio',
                smriti_module = 'Inventory & Purchase',
                smriti_action = 'GOODS_RECEIPT_TERMINAL',
                migration_status = 'MAPPED'
            WHERE sh9_mnu_name ILIKE '%Goods Receipt%'
               OR sh9_mnu_name ILIKE '%Material Inward%';
        """))


def downgrade() -> None:
    bind = op.get_bind()
    has_menus = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'smriti_menus';
    """)).scalar()

    if has_menus:
        bind.execute(sa.text("""
            DELETE FROM smriti_menus WHERE id = 'menu-grn';
        """))
