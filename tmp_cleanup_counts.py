import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_counts_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    companies = await conn.fetch(f"SELECT id, name, gst_number, company_code FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
    ids = [r['id'] for r in companies]
    out.append(f'company_count\t{len(ids)}')
    if not ids:
        out.append('no_test_companies')
        OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')
        await conn.close()
        return
    out.append('\n-- companies --')
    out.extend('\t'.join(str(r[col]) for col in ['id','name','gst_number','company_code']) for r in companies)
    branches = await conn.fetch('SELECT id, company_id, name, code FROM branches WHERE company_id = ANY($1)', ids)
    bid = [r['id'] for r in branches]
    out.append(f'branch_count\t{len(bid)}')
    out.append('\n-- branches --')
    out.extend('\t'.join(str(r[col]) for col in ['id','company_id','name','code']) for r in branches)
    warehouses = await conn.fetch('SELECT id, branch_id, code, name FROM warehouses WHERE branch_id = ANY($1)', bid)
    wid = [r['id'] for r in warehouses]
    out.append(f'warehouse_count\t{len(wid)}')
    out.append('\n-- warehouses --')
    out.extend('\t'.join(str(r[col]) for col in ['id','branch_id','code','name']) for r in warehouses)
    rows = await conn.fetch("SELECT table_schema, table_name, column_name FROM information_schema.key_column_usage WHERE column_name IN ('company_id','branch_id','warehouse_id') AND table_schema='public' ORDER BY table_schema, table_name")
    company_tables = [r['table_name'] for r in rows if r['column_name'] == 'company_id']
    branch_tables = [r['table_name'] for r in rows if r['column_name'] == 'branch_id']
    warehouse_tables = [r['table_name'] for r in rows if r['column_name'] == 'warehouse_id']
    out.append('\n-- tables_with_company_id --')
    out.extend(sorted(set(company_tables)))
    out.append('\n-- tables_with_branch_id --')
    out.extend(sorted(set(branch_tables)))
    out.append('\n-- tables_with_warehouse_id --')
    out.extend(sorted(set(warehouse_tables)))
    for tbl in sorted(set(company_tables)):
        cnt = await conn.fetchval(f'SELECT count(*) FROM public."{tbl}" WHERE company_id = ANY($1)', ids)
        if cnt:
            out.append(f'{tbl}\tcompany_id\t{cnt}')
    for tbl in sorted(set(branch_tables)):
        cnt = await conn.fetchval(f'SELECT count(*) FROM public."{tbl}" WHERE branch_id = ANY($1)', bid)
        if cnt:
            out.append(f'{tbl}\tbranch_id\t{cnt}')
    for tbl in sorted(set(warehouse_tables)):
        cnt = await conn.fetchval(f'SELECT count(*) FROM public."{tbl}" WHERE warehouse_id = ANY($1)', wid)
        if cnt:
            out.append(f'{tbl}\twarehouse_id\t{cnt}')
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
