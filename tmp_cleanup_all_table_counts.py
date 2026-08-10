import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_all_table_counts_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"
COLUMN_NAMES = ['company_id', 'branch_id', 'warehouse_id', 'source_branch_id', 'destination_branch_id']

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    companies = await conn.fetch(f"SELECT id, name FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
    company_ids = [r['id'] for r in companies]
    out.append(f'company_count\t{len(company_ids)}')
    if not company_ids:
        out.append('no_test_companies')
        OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')
        await conn.close()
        return
    out.append('\n-- companies --')
    out.extend('\t'.join(str(r[c]) for c in ['id','name']) for r in companies)

    branches = await conn.fetch('SELECT id, company_id, name FROM branches WHERE company_id = ANY($1)', company_ids)
    branch_ids = [r['id'] for r in branches]
    out.append(f'branch_count\t{len(branch_ids)}')
    out.append('\n-- branches --')
    out.extend('\t'.join(str(r[c]) for c in ['id','company_id','name']) for r in branches)

    out.append('\n-- relevant_tables --')
    cols = ','.join("'%s'" % c for c in COLUMN_NAMES)
    table_rows = await conn.fetch(f"SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ({cols}) ORDER BY table_name, column_name")
    tables = {}
    for row in table_rows:
        tables.setdefault(row['table_name'], []).append(row['column_name'])
    for t, cs in tables.items():
        out.append(f'{t}\t{','.join(cs)}')

    for t, cs in tables.items():
        for c in cs:
            vals = company_ids if c == 'company_id' else branch_ids if c in ('branch_id', 'source_branch_id', 'destination_branch_id') else None
            if c == 'warehouse_id':
                wid_rows = await conn.fetch('SELECT id FROM warehouses WHERE branch_id = ANY($1)', branch_ids)
                vals = [r['id'] for r in wid_rows]
            if not vals:
                out.append(f'{t}\t{c}\tvals_empty')
                continue
            cnt = await conn.fetchval(f'SELECT count(*) FROM public."{t}" WHERE "{c}" = ANY($1)', vals)
            if cnt:
                out.append(f'{t}\t{c}\t{cnt}')
                sample = await conn.fetch(f'SELECT * FROM public."{t}" WHERE "{c}" = ANY($1) LIMIT 5', vals)
                for s in sample:
                    out.append('\t' + ','.join(f"{k}={s[k]}" for k in s.keys()))
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
