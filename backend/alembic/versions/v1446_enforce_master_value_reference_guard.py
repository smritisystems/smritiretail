"""Prevent soft deletion of referenced master lookup values."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1446_enforce_master_value_reference_guard"
down_revision: Union[str, Sequence[str], None] = "v1445_seed_footwear_color_group"
branch_labels = None
depends_on = None


TRIGGER_FUNCTION = "prevent_referenced_master_value_retirement"
TRIGGER_NAME = "trg_master_value_reference_guard"


def upgrade() -> None:
    bind = op.get_bind()
    op.execute(sa.text(f"""
        CREATE OR REPLACE FUNCTION {TRIGGER_FUNCTION}()
        RETURNS trigger AS $$
        DECLARE
            lookup_type TEXT;
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

                IF lookup_type = 'style_article' AND EXISTS (
                    SELECT 1 FROM variant_templates
                    WHERE master_value_id = OLD.id
                      AND is_deleted IS NOT TRUE
                ) THEN
                    RAISE EXCEPTION 'Style/article % is referenced by a live variant template', OLD.code
                        USING ERRCODE = '23514';
                END IF;

                IF lookup_type = 'style_article' AND EXISTS (
                    SELECT 1 FROM products
                    WHERE style_code = OLD.code
                      AND is_deleted IS NOT TRUE
                ) THEN
                    RAISE EXCEPTION 'Style/article % is referenced by a live product', OLD.code
                        USING ERRCODE = '23514';
                END IF;

                IF lookup_type = 'style_article' AND EXISTS (
                    SELECT 1 FROM sales_order_items
                    WHERE (article_no = OLD.code OR vendor_style = OLD.code)
                ) THEN
                    RAISE EXCEPTION 'Style/article % is referenced by sales history', OLD.code
                        USING ERRCODE = '23514';
                END IF;

                IF lookup_type = 'vendor_code' AND EXISTS (
                    SELECT 1 FROM variant_templates
                    WHERE vendor_code = OLD.code
                      AND is_deleted IS NOT TRUE
                ) THEN
                    RAISE EXCEPTION 'Vendor % is referenced by a live variant template', OLD.code
                        USING ERRCODE = '23514';
                END IF;

                IF lookup_type = 'vendor_code' AND EXISTS (
                    SELECT 1 FROM products
                    WHERE vendor_code = OLD.code
                      AND is_deleted IS NOT TRUE
                ) THEN
                    RAISE EXCEPTION 'Vendor % is referenced by a live product', OLD.code
                        USING ERRCODE = '23514';
                END IF;

                IF lookup_type = 'vendor_code' AND EXISTS (
                    SELECT 1 FROM master_values
                    WHERE vendor_code = OLD.code
                      AND is_deleted IS NOT TRUE
                ) THEN
                    RAISE EXCEPTION 'Vendor % owns live style/article values', OLD.code
                        USING ERRCODE = '23514';
                END IF;

                IF lookup_type = 'vendor_code' AND EXISTS (
                    SELECT 1 FROM sales_orders
                    WHERE vendor_code = OLD.code
                ) THEN
                    RAISE EXCEPTION 'Vendor % is referenced by sales history', OLD.code
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))
    op.execute(sa.text(f"DROP TRIGGER IF EXISTS {TRIGGER_NAME} ON master_values"))
    op.execute(sa.text(
        f"CREATE TRIGGER {TRIGGER_NAME} "
        f"BEFORE UPDATE OF is_deleted ON master_values "
        f"FOR EACH ROW EXECUTE FUNCTION {TRIGGER_FUNCTION}()"
    ))


def downgrade() -> None:
    op.execute(sa.text(f"DROP TRIGGER IF EXISTS {TRIGGER_NAME} ON master_values"))
    op.execute(sa.text(f"DROP FUNCTION IF EXISTS {TRIGGER_FUNCTION}()"))
