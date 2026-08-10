import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_company_search_output.txt')
PATTERN = "%Test%"

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    rows = await conn.fetch("SELECT id, name, gst_number, company_code FROM companies WHERE name ILIKE $1 ORDER BY name", PATTERN)
    out.append(f'count\t{len(rows)}')
    out.extend('\t'.join(str(r[c]) for c in ['id','name','gst_number','company_code']) for r in rows)
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
