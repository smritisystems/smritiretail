"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

Websites: aitdl.com | erpnbook.com | smritibooks.com

Revision ID: v1563
Revises: v1562
Create Date: 2026-10-28
Classification: Synchronize Vendor Codes to Master Values
"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1563"
down_revision: Union[str, None] = "v1562"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    current_db = (conn.execute(sa.text("SELECT current_database();")).scalar() or "").strip().lower()
    if current_db in ("postgres", "template0", "template1"):
        return

    # 1. Ensure 'vendor_code' master_type exists across all databases
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_types') THEN
                IF NOT EXISTS (SELECT 1 FROM master_types WHERE code = 'vendor_code') THEN
                    INSERT INTO master_types (
                        id, code, label, field_schema, ui_schema, used_in_modules, version, evidence_level, created_by, created_at
                    ) VALUES (
                        gen_random_uuid(),
                        'vendor_code',
                        'Vendor Code',
                        '{"type": "object", "properties": {"description": {"type": "string"}}}'::jsonb,
                        '{"type": "object", "valueFields": ["code", "name", "description"]}'::jsonb,
                        ARRAY['item_master', 'master_registry', 'procurement'],
                        1,
                        'D',
                        'system',
                        NOW()
                    );
                END IF;
            END IF;
        END $$;
    """))

    # 2. Backfill vendor codes from parties (with SUPPLIER role) and suppliers into master_values
    conn.execute(sa.text("""
        DO $$
        DECLARE
            v_type_id uuid;
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_types') AND
               EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_values') THEN

                SELECT id INTO v_type_id FROM master_types WHERE code = 'vendor_code';

                IF v_type_id IS NOT NULL THEN
                    -- Sync from parties with SUPPLIER role
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parties') AND
                       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'party_roles') THEN
                        INSERT INTO master_values (
                            id, master_type_id, company_id, branch_id, code, name, data, active, sort_order, updated_at, is_deleted
                        )
                        SELECT 
                            gen_random_uuid(),
                            v_type_id,
                            p.company_id,
                            p.branch_id,
                            UPPER(p.party_code),
                            COALESCE(NULLIF(p.trade_name, ''), NULLIF(p.legal_name, ''), p.party_code),
                            '{"allocation": "SYNCED", "source": "PARTIES"}'::jsonb,
                            COALESCE(p.is_active, true),
                            0,
                            NOW(),
                            false
                        FROM parties p
                        JOIN party_roles pr ON pr.party_id = p.id AND pr.role_type = 'SUPPLIER'
                        WHERE (p.is_deleted IS FALSE OR p.is_deleted IS NULL)
                          AND UPPER(p.party_code) NOT IN (
                              SELECT UPPER(mv.code) 
                              FROM master_values mv 
                              WHERE mv.master_type_id = v_type_id 
                                AND (mv.is_deleted IS FALSE OR mv.is_deleted IS NULL)
                          );
                    END IF;

                    -- Sync from suppliers table
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
                        INSERT INTO master_values (
                            id, master_type_id, company_id, branch_id, code, name, data, active, sort_order, updated_at, is_deleted
                        )
                        SELECT 
                            gen_random_uuid(),
                            v_type_id,
                            s.company_id,
                            s.branch_id,
                            UPPER(s.code),
                            COALESCE(NULLIF(s.name, ''), s.code),
                            '{"allocation": "SYNCED", "source": "SUPPLIERS"}'::jsonb,
                            COALESCE(s.is_active, true),
                            0,
                            NOW(),
                            false
                        FROM suppliers s
                        WHERE (s.is_deleted IS FALSE OR s.is_deleted IS NULL)
                          AND UPPER(s.code) NOT IN (
                              SELECT UPPER(mv.code) 
                              FROM master_values mv 
                              WHERE mv.master_type_id = v_type_id 
                                AND (mv.is_deleted IS FALSE OR mv.is_deleted IS NULL)
                          );
                    END IF;
                END IF;
            END IF;
        END $$;
    """))


def downgrade() -> None:
    pass

