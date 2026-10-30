"""
Inspect the single unmapped row in sales_order_items.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def check():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001')
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT p.id, p.company_id, lim.disposition FROM legacy_id_mappings lim JOIN products p ON lim.legacy_id = p.id WHERE lim.disposition = 'REQUIRES_REVIEW' LIMIT 5"))
        for r in res.fetchall():
            print(dict(r._mapping))
            
            m = await conn.execute(text("SELECT * FROM legacy_id_mappings WHERE legacy_table = 'products' AND legacy_id = :pid"), {'pid': pid})
            map_row = m.fetchone()
            print("LEGACY ID MAPPING ROW:")
            print(dict(map_row._mapping) if map_row else None)
            
        print("\n" + "=" * 85)
        print("INSPECTING sales_invoice_lines (3 rows):")
        print("=" * 85)
        res_sil = await conn.execute(text("SELECT id, invoice_id, product_id, sku, quantity, taxable_value FROM sales_invoice_lines"))
        for r in res_sil.fetchall():
            pid = str(r._mapping['product_id'])
            m = await conn.execute(text("SELECT * FROM legacy_id_mappings WHERE legacy_table = 'products' AND legacy_id = :pid"), {'pid': pid})
            map_row = m.fetchone()
            disp = map_row._mapping.get('disposition') if map_row else 'NOT_MAPPED'
            var_id = map_row._mapping.get('canonical_id') if map_row else None
            print(f"Invoice Line: {r.id} | Product ID: {pid} | SKU: {r.sku} | Mapping Disp: {disp} | Var ID: {var_id}")

        print("\n" + "=" * 85)
        print("INSPECTING product_batch_stocks (16 rows):")
        print("=" * 85)
        res_pbs = await conn.execute(text("SELECT id, product_id, warehouse_id, batch_no, quantity FROM product_batch_stocks"))
        for r in res_pbs.fetchall():
            pid = str(r._mapping['product_id'])
            m = await conn.execute(text("SELECT * FROM legacy_id_mappings WHERE legacy_table = 'products' AND legacy_id = :pid"), {'pid': pid})
            map_row = m.fetchone()
            disp = map_row._mapping.get('disposition') if map_row else 'NOT_MAPPED'
            var_id = map_row._mapping.get('canonical_id') if map_row else None
            print(f"Batch Stock: {r.id} | Product ID: {pid} | Batch: {r.batch_no} | Mapping Disp: {disp} | Var ID: {var_id}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
