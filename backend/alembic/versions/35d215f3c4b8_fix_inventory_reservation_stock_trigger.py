"""
Fix inventory stock trigger semantics for reservation ledger entries.

Revision ID: 35d215f3c4b8
Revises: 89221f5f1969
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "35d215f3c4b8"
down_revision: Union[str, Sequence[str], None] = "89221f5f1969"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION reconcile_product_stock_trigger()
        RETURNS TRIGGER AS $$
        DECLARE
            delta numeric := 0;
            movement_type text;
            physical_types text[] := ARRAY[
                'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT',
                'PRODUCTION', 'PURCHASE', 'SALES', 'RETURN'
            ];
        BEGIN
            IF TG_OP = 'INSERT' THEN
                movement_type := COALESCE(UPPER(NEW.movement_type), '');
                IF movement_type = ANY(physical_types) THEN
                    IF movement_type = 'IN' THEN
                        delta := NEW.quantity;
                    ELSIF movement_type = 'OUT' THEN
                        delta := -ABS(NEW.quantity);
                    ELSIF movement_type = 'ADJUSTMENT' THEN
                        delta := NEW.quantity;
                    ELSIF movement_type = 'TRANSFER' THEN
                        delta := -ABS(NEW.quantity);
                    ELSIF movement_type = 'PRODUCTION' THEN
                        delta := NEW.quantity;
                    ELSIF movement_type = 'PURCHASE' THEN
                        delta := NEW.quantity;
                    ELSIF movement_type = 'SALES' THEN
                        delta := -ABS(NEW.quantity);
                    ELSIF movement_type = 'RETURN' THEN
                        delta := NEW.quantity;
                    END IF;
                END IF;

            ELSIF TG_OP = 'UPDATE' THEN
                movement_type := COALESCE(UPPER(NEW.movement_type), '');
                IF movement_type = ANY(physical_types) THEN
                    IF movement_type = 'IN' THEN
                        delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'OUT' THEN
                        delta := ABS(OLD.quantity) - ABS(NEW.quantity);
                    ELSIF movement_type = 'ADJUSTMENT' THEN
                        delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'TRANSFER' THEN
                        delta := ABS(OLD.quantity) - ABS(NEW.quantity);
                    ELSIF movement_type = 'PRODUCTION' THEN
                        delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'PURCHASE' THEN
                        delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'SALES' THEN
                        delta := ABS(OLD.quantity) - ABS(NEW.quantity);
                    ELSIF movement_type = 'RETURN' THEN
                        delta := NEW.quantity - OLD.quantity;
                    END IF;
                END IF;

            ELSIF TG_OP = 'DELETE' THEN
                movement_type := COALESCE(UPPER(OLD.movement_type), '');
                IF movement_type = ANY(physical_types) THEN
                    IF movement_type = 'IN' THEN
                        delta := -OLD.quantity;
                    ELSIF movement_type = 'OUT' THEN
                        delta := ABS(OLD.quantity);
                    ELSIF movement_type = 'ADJUSTMENT' THEN
                        delta := -OLD.quantity;
                    ELSIF movement_type = 'TRANSFER' THEN
                        delta := ABS(OLD.quantity);
                    ELSIF movement_type = 'PRODUCTION' THEN
                        delta := -OLD.quantity;
                    ELSIF movement_type = 'PURCHASE' THEN
                        delta := -OLD.quantity;
                    ELSIF movement_type = 'SALES' THEN
                        delta := ABS(OLD.quantity);
                    ELSIF movement_type = 'RETURN' THEN
                        delta := -OLD.quantity;
                    END IF;
                END IF;
            END IF;

            IF delta <> 0 THEN
                UPDATE products
                SET stock = stock + delta
                WHERE id = COALESCE(NEW.product_id, OLD.product_id);
            END IF;

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """))


def downgrade() -> None:
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
