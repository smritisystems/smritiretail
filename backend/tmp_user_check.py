import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect(user='postgres', password='postgres', database='smriti_retail_db', host='127.0.0.1', port=5432, timeout=5)
    rows = await conn.fetch('SELECT username, role, status, is_active, company_id, branch_id, email FROM users ORDER BY username')
    print('USER_COUNT=', len(rows))
    for r in rows:
        print(dict(r))
    await conn.close()

asyncio.run(main())
