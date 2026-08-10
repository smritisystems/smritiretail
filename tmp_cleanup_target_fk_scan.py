import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_target_fk_scan_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    companies = await conn.fetch(f"SELECT id FROM companies WHERE {TEST_COMPANY_FILTER}")
    company_ids = [r['id'] for r in companies]
    out.append(f'company_ids={company_ids}')
    branches = await conn.fetch('SELECT id FROM branches WHERE company_id = ANY($1)', company_ids)
    branch_ids = [r['id'] for r in branches]
    out.append(f'branch_ids={branch_ids}')
    products = await conn.fetch('SELECT id FROM products WHERE company_id = ANY($1)', company_ids)
    product_ids = [r['id'] for r in products]
    out.append(f'product_ids={product_ids}')
    customer_groups = await conn.fetch('SELECT id FROM customer_groups WHERE company_id = ANY($1)', company_ids)
    customer_group_ids = [r['id'] for r in customer_groups]
    out.append(f'customer_group_ids={customer_group_ids}')
    customers = await conn.fetch('SELECT id FROM customers WHERE company_id = ANY($1)', company_ids)
    customer_ids = [r['id'] for r in customers]
    out.append(f'customer_ids={customer_ids}')
    if not company_ids:
        out.append('no test company ids')
        OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')
        await conn.close()
        return
    cols = ['product_id', 'customer_id', 'customer_group_id', 'branch_id', 'company_id', 'warehouse_id']
    rows = await conn.fetch(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name = ANY($1) ORDER BY table_name, column_name",
        cols,
    )
    table_cols = {}
    for r in rows:
        table_cols.setdefault(r['table_name'], []).append(r['column_name'])
    for table, columns in table_cols.items():
        for col in columns:
            ids = {
                'company_id': company_ids,
                'branch_id': branch_ids,
                'product_id': product_ids,
                'customer_id': customer_ids,
                'customer_group_id': customer_group_ids,
                'warehouse_id': [],
            }.get(col, [])
            if not ids:
                continue
            cnt = await conn.fetchval(f'SELECT count(*) FROM public."{table}" WHERE "{col}" = ANY($1)', ids)
            if cnt:
                out.append(f'{table}.{col} count={cnt}')
                sample = await conn.fetch(f'SELECT * FROM public."{table}" WHERE "{col}" = ANY($1) LIMIT 5', ids)
                for r in sample:
                    out.append('\t' + ','.join(f"{k}={r[k]}" for k in r.keys()))
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
