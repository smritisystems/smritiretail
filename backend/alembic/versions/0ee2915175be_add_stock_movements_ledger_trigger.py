"""
Project      : SMRITI Retail OS
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.3
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Revision ID: 0ee2915175be
Revises: 6ad7d84a62b2
Create Date: 2026-07-21 00:47:40.801604
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0ee2915175be'
down_revision: Union[str, Sequence[str], None] = '6ad7d84a62b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create stock reconciliation function
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION reconcile_product_stock_trigger()
        RETURNS TRIGGER AS $$
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                UPDATE products
                SET stock = stock + NEW.quantity
                WHERE id = NEW.product_id;
            ELSIF (TG_OP = 'UPDATE') THEN
                UPDATE products
                SET stock = stock - OLD.quantity + NEW.quantity
                WHERE id = NEW.product_id;
            ELSIF (TG_OP = 'DELETE') THEN
                UPDATE products
                SET stock = stock - OLD.quantity
                WHERE id = OLD.product_id;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """))

    # 2. Bind trigger to stock_movements table (Executed as separate statements)
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_reconcile_product_stock ON stock_movements;"))
    op.execute(sa.text("""
        CREATE TRIGGER trg_reconcile_product_stock
        AFTER INSERT OR UPDATE OR DELETE ON stock_movements
        FOR EACH ROW
        EXECUTE FUNCTION reconcile_product_stock_trigger();
    """))


def downgrade() -> None:
    # Remove trigger and function
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_reconcile_product_stock ON stock_movements;"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS reconcile_product_stock_trigger();"))
