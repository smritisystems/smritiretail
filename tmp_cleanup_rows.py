import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_rows_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"

async def main():
    conn = await asyncpg.connect(DB_URL)
    companies = await conn.fetch(f"SELECT id, name, gst_number, company_code FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
    if not companies:
        Path(OUTPUT_PATH).write_text('no_test_companies\n', encoding='utf-8')
        await conn.close()
        return
    company_ids = [r['id'] for r in companies]
    comp_text = []
    comp_text.append('companies:')
    comp_text.extend('\t'.join(str(r[c]) for c in ['id','name','gst_number','company_code']) for r in companies)
    branches = await conn.fetch('SELECT id, company_id, name, code FROM branches WHERE company_id = ANY($1)', company_ids)
    branch_ids = [r['id'] for r in branches]
    comp_text.append('\nbranches:')
    comp_text.extend('\t'.join(str(r[c]) for c in ['id','company_id','name','code']) for r in branches)
    for tbl, cols in [('customer_groups', ['id','company_id','branch_id','name']), ('customers', ['id','company_id','branch_id','name']), ('products', ['id','company_id','branch_id','name'])]:
        rows = await conn.fetch(f"SELECT {', '.join(cols)} FROM public.\"{tbl}\" WHERE company_id = ANY($1) OR branch_id = ANY($2)", company_ids, branch_ids)
        comp_text.append(f'\n{tbl}: count={len(rows)}')
        comp_text.extend('\t'.join(str(r[c]) for c in cols) for r in rows)
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(comp_text), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
