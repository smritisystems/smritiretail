import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001')
    async with engine.connect() as conn:
        res = await conn.execute(text('''
            SELECT barcode, code, name, category, brand, style_code, color, size, mrp, price, stock, hsn_code
            FROM products 
            WHERE is_deleted = false 
            ORDER BY category, style_code, color, size, barcode
        '''))
        rows = res.fetchall()
        print(f"TOTAL_COUNT: {len(rows)}")
        current_cat = ""
        for r in rows:
            m = r._mapping
            cat = m['category'] or 'Uncategorized'
            if cat != current_cat:
                current_cat = cat
                print(f"\n### Category: {current_cat}")
                print("| Barcode | SKU / Code | Product Name | Style | Color | Size | MRP | Sale Price | Stock |")
                print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
            print(f"| `{m['barcode']}` | `{m['code']}` | {m['name']} | {m['style_code'] or '-'} | {m['color'] or '-'} | {m['size'] or '-'} | Rs. {m['mrp']} | Rs. {m['price']} | {m['stock']} |")
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
