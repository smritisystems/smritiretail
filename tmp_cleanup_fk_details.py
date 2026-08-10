import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_fk_details_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    companies = await conn.fetch(f"SELECT id, name FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
    out.append(f'company_count\t{len(companies)}')
    if not companies:
        out.append('no_test_companies')
        OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')
        await conn.close()
        return
    ids = [r['id'] for r in companies]
    out.append('\n-- companies --')
    out.extend('\t'.join(str(r[c]) for c in ['id','name']) for r in companies)
    branches = await conn.fetch('SELECT id, company_id, name FROM branches WHERE company_id = ANY($1)', ids)
    bids = [r['id'] for r in branches]
    out.append(f'branch_count\t{len(bids)}')
    out.append('\n-- branches --')
    out.extend('\t'.join(str(r[c]) for c in ['id','company_id','name']) for r in branches)
    rows = await conn.fetch("SELECT con.oid::regclass AS table_name, att.attname AS column_name, confrelid::regclass AS referenced_table, confkey, pg_get_constraintdef(con.oid) AS constraint_def FROM pg_constraint con JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey) WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace ORDER BY con.conrelid::regclass::text, att.attname")
    out.append('\n-- foreign_keys --')
    for r in rows:
        out.append(f"{r['table_name']}\t{r['column_name']}\t{r['referenced_table']}\t{r['constraint_def']}")
    keytables = {'company_id': ids, 'branch_id': bids}
    for col, vals in keytables.items():
        if not vals:
            continue
        out.append(f'\n-- row_counts_for_{col} --')
        tables = [r['table_name'] for r in rows if r['column_name'] == col]
        for tbl in sorted(set(tables)):
            cnt = await conn.fetchval(f'SELECT count(*) FROM public."{tbl}" WHERE "{col}" = ANY($1)', vals)
            if cnt:
                out.append(f'{tbl}\t{cnt}')
                sample = await conn.fetch(f'SELECT * FROM public."{tbl}" WHERE "{col}" = ANY($1) LIMIT 5', vals)
                for s in sample:
                    out.append('\t' + ','.join(f"{k}={s[k]}" for k in s.keys()))
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
