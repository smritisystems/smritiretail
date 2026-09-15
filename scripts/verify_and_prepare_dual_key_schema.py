"""
Verify and ensure dual-key variant_id columns exist across transaction tables.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def check():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001')
    tables = [
        'sales_invoice_items', 'sales_order_items', 'sales_return_items', 'sales_quotation_items',
        'purchase_order_items', 'purchase_receipt_items', 'stock_movements', 'product_batch_stocks'
    ]
    async with engine.begin() as conn:
        for t in tables:
            await conn.execute(text(f'ALTER TABLE {t} ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50)'))
            res = await conn.execute(text(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
                f"WHERE table_name = '{t}' AND column_name = 'variant_id'"
            ))
            row = res.fetchone()
            print(f"{t:<28}: variant_id column present -> {dict(row._mapping) if row else 'MISSING'}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
