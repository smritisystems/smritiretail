"""SMRITI Retail OS Item Master Phase R-11: Footwear Master Values and Supplier Seed Migration

Revision ID: v1525_seed_footwear_master_values
Revises: v1524_item_batch_serial_base_entity_alignment
Create Date: 2026-10-09

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.50
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Seeds missing footwear dimension master values (CHIKKU, R-GOLD, SULTAN, SHOES, MUEL, WEDGES, MATERIAL, PRS, PAIR).
2. Seeds vendor codes A through J in suppliers table across control plane and tenant databases.
3. Safe idempotent DO blocks checking for existence before insertion.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1525_seed_footwear_master_values"
down_revision = "v1524_item_batch_serial_base_entity_alignment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Master Values Seeding
    conn.execute(sa.text("""
        DO $$
        DECLARE
            v_val_record RECORD;
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_types') AND
               EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_values') THEN

                FOR v_val_record IN 
                    SELECT 'color' AS type_code, 'CHIKKU' AS code, 'CHIKKU' AS name UNION ALL
                    SELECT 'color', 'R-GOLD', 'R-GOLD' UNION ALL
                    SELECT 'color', 'SULTAN', 'SULTAN' UNION ALL
                    SELECT 'product_type', 'SHOES', 'SHOES' UNION ALL
                    SELECT 'subcategory', 'MUEL', 'MUEL' UNION ALL
                    SELECT 'heel_type', 'WEDGES', 'WEDGES' UNION ALL
                    SELECT 'upper_material', 'MATERIAL', 'MATERIAL' UNION ALL
                    SELECT 'uom', 'PRS', 'PRS' UNION ALL
                    SELECT 'uom', 'PAIRS', 'Pairs' UNION ALL
                    SELECT 'uom', 'PAIR', 'Pair'
                LOOP
                    EXECUTE '
                        INSERT INTO master_values (
                            id, master_type_id, code, name, data, active, is_deleted, updated_at
                        )
                        SELECT 
                            md5(random()::text || clock_timestamp()::text)::uuid,
                            mt.id,
                            ' || quote_literal(v_val_record.code) || ',
                            ' || quote_literal(v_val_record.name) || ',
                            ' || quote_literal('{}') || '::jsonb,
                            true,
                            false,
                            NOW()
                        FROM master_types mt
                        WHERE mt.code = ' || quote_literal(v_val_record.type_code) || '
                          AND NOT EXISTS (
                              SELECT 1 FROM master_values mv
                              WHERE mv.master_type_id = mt.id
                                AND (UPPER(mv.code) = UPPER(' || quote_literal(v_val_record.code) || ') OR UPPER(mv.name) = UPPER(' || quote_literal(v_val_record.name) || '))
                                AND mv.is_deleted = false
                          )
                        LIMIT 1;
                    ';
                END LOOP;

            END IF;
        END $$;
    """))

    # 2. Suppliers Seeding
    conn.execute(sa.text("""
        DO $$
        DECLARE
            v_comp_id VARCHAR(50);
            v_sup_record RECORD;
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
                
                -- Detect company_id if companies table exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
                    SELECT id INTO v_comp_id FROM companies LIMIT 1;
                END IF;
                IF v_comp_id IS NULL THEN
                    v_comp_id := 'COMP-001';
                END IF;

                FOR v_sup_record IN
                    SELECT 'A' AS code, 'Vendor A Footwear' AS name UNION ALL
                    SELECT 'B', 'Vendor B Footwear' UNION ALL
                    SELECT 'C', 'Vendor C Footwear' UNION ALL
                    SELECT 'D', 'Vendor D Footwear' UNION ALL
                    SELECT 'E', 'Vendor E Footwear' UNION ALL
                    SELECT 'F', 'Vendor F Footwear' UNION ALL
                    SELECT 'G', 'Vendor G Footwear' UNION ALL
                    SELECT 'H', 'Vendor H Footwear' UNION ALL
                    SELECT 'I', 'Vendor I Footwear' UNION ALL
                    SELECT 'J', 'Vendor J Footwear'
                LOOP
                    IF NOT EXISTS (
                        SELECT 1 FROM suppliers 
                        WHERE UPPER(code) = UPPER(v_sup_record.code) AND is_deleted = false
                    ) THEN
                        INSERT INTO suppliers (
                            id, uuid, code, name, company_id, outstanding, is_active, is_deleted, created_at, modified_at, version
                        ) VALUES (
                            md5(random()::text || clock_timestamp()::text)::uuid::text,
                            md5(random()::text || clock_timestamp()::text)::uuid::text,
                            v_sup_record.code,
                            v_sup_record.name,
                            v_comp_id,
                            0.0,
                            true,
                            false,
                            NOW(),
                            NOW(),
                            1
                        );
                    END IF;
                END LOOP;

            END IF;
        END $$;
    """))


def downgrade() -> None:
    pass
