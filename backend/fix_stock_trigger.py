import asyncio
import asyncpg

DSN = "postgresql://postgres:postgres@localhost:5432/smriti_retail_db"

# Local debugging helper only. The Alembic migration is the canonical source of truth.
TRIGGER_SQL = """
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
"""

async def main() -> None:
    conn = await asyncpg.connect(DSN)
    await conn.execute(TRIGGER_SQL)
    await conn.execute("DROP TRIGGER IF EXISTS trg_reconcile_product_stock ON stock_movements;")
    await conn.execute("""
        CREATE TRIGGER trg_reconcile_product_stock
        AFTER INSERT OR UPDATE OF quantity, movement_type OR DELETE ON stock_movements
        FOR EACH ROW
        EXECUTE FUNCTION reconcile_product_stock_trigger();
    """)
    await conn.close()

asyncio.run(main())
