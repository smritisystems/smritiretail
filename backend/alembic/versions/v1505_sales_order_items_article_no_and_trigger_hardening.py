"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.47.4
Created      : 2026-09-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Hardening & Head Merge

v1505: Merge multiple Alembic heads (v1504 tenant branch + v1497b control branch),
harden sales_order_items columns (article_no, vendor_style, etc.), and harden
the prevent_referenced_master_value_retirement trigger function with dynamic execution.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1505"
down_revision: Union[str, Sequence[str], None] = ("v1504", "v1497b")
branch_labels = None
depends_on = None

TRIGGER_FUNCTION = "prevent_referenced_master_value_retirement"
TRIGGER_NAME = "trg_master_value_reference_guard"


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Ensure sales_order_items has article_no and other extended columns across all databases
    bind.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_order_items') THEN
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS article_no VARCHAR(50);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS vendor_style VARCHAR(100);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS ean VARCHAR(50);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS color VARCHAR(50);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS size VARCHAR(50);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS uom VARCHAR(20) DEFAULT 'EA';
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS sr_no INTEGER;
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(15, 2);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS base_cost NUMERIC(15, 2);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(15, 2);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT 0.00;
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT 0.00;
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT 0.00;
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2);
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS delivery_date DATE;
                ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS site_code VARCHAR(50);
            END IF;
        END $$;
    """))

    # 2. Recreate prevent_referenced_master_value_retirement trigger function with dynamic queries
    # to guarantee it never fails static SQL compilation on non-article master deletions (e.g. Department).
    bind.execute(sa.text(f"""
        CREATE OR REPLACE FUNCTION {TRIGGER_FUNCTION}()
        RETURNS trigger AS $$
        DECLARE
            lookup_type TEXT;
            has_ref BOOLEAN := FALSE;
        BEGIN
            IF NEW.is_deleted IS TRUE AND OLD.is_deleted IS NOT TRUE THEN
                SELECT code INTO lookup_type
                FROM master_types
                WHERE id = NEW.master_type_id;

                IF EXISTS (
                    SELECT 1 FROM master_values
                    WHERE parent_value_id = OLD.id
                      AND is_deleted IS NOT TRUE
                ) THEN
                    RAISE EXCEPTION 'Master value % is referenced by live child lookup values', OLD.code
                        USING ERRCODE = '23514';
                END IF;

                IF lookup_type = 'style_article' THEN
                    IF EXISTS (
                        SELECT 1 FROM variant_templates
                        WHERE master_value_id = OLD.id
                          AND is_deleted IS NOT TRUE
                    ) THEN
                        RAISE EXCEPTION 'Style/article % is referenced by a live variant template', OLD.code
                            USING ERRCODE = '23514';
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM products
                        WHERE style_code = OLD.code
                          AND is_deleted IS NOT TRUE
                    ) THEN
                        RAISE EXCEPTION 'Style/article % is referenced by a live product', OLD.code
                            USING ERRCODE = '23514';
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_order_items'
                    ) AND EXISTS (
                        SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_order_items' AND column_name = 'article_no'
                    ) THEN
                        EXECUTE 'SELECT EXISTS (SELECT 1 FROM sales_order_items WHERE (article_no = $1 OR vendor_style = $1))'
                        INTO has_ref
                        USING OLD.code;
                        IF has_ref THEN
                            RAISE EXCEPTION 'Style/article % is referenced by sales history', OLD.code
                                USING ERRCODE = '23514';
                        END IF;
                    END IF;
                END IF;

                IF lookup_type = 'vendor_code' THEN
                    IF EXISTS (
                        SELECT 1 FROM variant_templates
                        WHERE vendor_code = OLD.code
                          AND is_deleted IS NOT TRUE
                    ) THEN
                        RAISE EXCEPTION 'Vendor % is referenced by a live variant template', OLD.code
                            USING ERRCODE = '23514';
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM products
                        WHERE vendor_code = OLD.code
                          AND is_deleted IS NOT TRUE
                    ) THEN
                        RAISE EXCEPTION 'Vendor % is referenced by a live product', OLD.code
                            USING ERRCODE = '23514';
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM master_values
                        WHERE vendor_code = OLD.code
                          AND is_deleted IS NOT TRUE
                    ) THEN
                        RAISE EXCEPTION 'Vendor % owns live style/article values', OLD.code
                            USING ERRCODE = '23514';
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_orders'
                    ) THEN
                        EXECUTE 'SELECT EXISTS (SELECT 1 FROM sales_orders WHERE vendor_code = $1)'
                        INTO has_ref
                        USING OLD.code;
                        IF has_ref THEN
                            RAISE EXCEPTION 'Vendor % is referenced by sales history', OLD.code
                                USING ERRCODE = '23514';
                        END IF;
                    END IF;
                END IF;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))

    # 3. Ensure trigger is attached if master_values table is present
    bind.execute(sa.text(f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_values') THEN
                DROP TRIGGER IF EXISTS {TRIGGER_NAME} ON master_values;
                CREATE TRIGGER {TRIGGER_NAME}
                BEFORE UPDATE OF is_deleted ON master_values
                FOR EACH ROW EXECUTE FUNCTION {TRIGGER_FUNCTION}();
            END IF;
        END $$;
    """))


def downgrade() -> None:
    pass
