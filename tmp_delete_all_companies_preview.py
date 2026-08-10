import asyncio
import asyncpg

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'

async def main():
    conn = await asyncpg.connect(DB_URL)
    count = await conn.fetchval('SELECT count(*) FROM companies')
    print('COMPANY_COUNT', count)
    rows = await conn.fetch('SELECT id, name, gst_number, company_code FROM companies ORDER BY name LIMIT 50')
    for r in rows:
        print(r['id'], r['name'], r['gst_number'], r['company_code'])
    if count > 50:
        print('...more rows exist...')
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
