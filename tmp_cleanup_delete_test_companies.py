import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"
OUTPUT_PATH = Path('tmp_cleanup_delete_test_companies_output.txt')

async def main():
    conn = await asyncpg.connect(DB_URL)
    try:
        companies = await conn.fetch(f"SELECT id, name FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
        if not companies:
            print('No test companies found; nothing to delete.')
            return
        company_ids = [r['id'] for r in companies]
        print('Found companies:')
        for r in companies:
            print('  ', r['id'], r['name'])
        branch_rows = await conn.fetch('SELECT id, company_id, name FROM branches WHERE company_id = ANY($1)', company_ids)
        branch_ids = [r['id'] for r in branch_rows]
        print('Found branches:', len(branch_ids))
        for r in branch_rows:
            print('  ', r['id'], r['name'])
        product_rows = await conn.fetch('SELECT id, company_id, branch_id, name FROM products WHERE company_id = ANY($1)', company_ids)
        product_ids = [r['id'] for r in product_rows]
        print('Found products:', len(product_ids))
        for r in product_rows:
            print('  ', r['id'], r['name'])
        async def delete_by_column(table, column, ids):
            if not ids:
                return 'DELETE 0'
            deleted = await conn.execute(f'DELETE FROM public."{table}" WHERE "{column}" = ANY($1)', ids)
            print(f'Deleted {table} by {column}:', deleted)
            return deleted

        async with conn.transaction():
            # Delete in dependency order: customers -> customer_groups -> products -> branches -> companies
            await delete_by_column('customers', 'company_id', company_ids)
            await delete_by_column('customers', 'branch_id', branch_ids)
            await delete_by_column('customer_groups', 'company_id', company_ids)
            await delete_by_column('customer_groups', 'branch_id', branch_ids)
            if product_ids:
                await delete_by_column('product_barcodes', 'product_id', product_ids)
                await delete_by_column('product_identities', 'product_id', product_ids)
            await delete_by_column('products', 'company_id', company_ids)
            await delete_by_column('products', 'branch_id', branch_ids)
            await delete_by_column('branches', 'company_id', company_ids)
            await delete_by_column('companies', 'id', company_ids)
        counts = {}
        counts['companies'] = await conn.fetchval(f'SELECT count(*) FROM public."companies" WHERE {TEST_COMPANY_FILTER}')
        counts['branches'] = await conn.fetchval('SELECT count(*) FROM public."branches" WHERE company_id = ANY($1)', company_ids)
        counts['customer_groups'] = await conn.fetchval('SELECT count(*) FROM public."customer_groups" WHERE company_id = ANY($1) OR branch_id = ANY($2)', company_ids, branch_ids)
        counts['customers'] = await conn.fetchval('SELECT count(*) FROM public."customers" WHERE company_id = ANY($1) OR branch_id = ANY($2)', company_ids, branch_ids)
        counts['products'] = await conn.fetchval('SELECT count(*) FROM public."products" WHERE company_id = ANY($1) OR branch_id = ANY($2)', company_ids, branch_ids)
        counts['product_barcodes'] = await conn.fetchval('SELECT count(*) FROM public."product_barcodes" WHERE product_id = ANY($1)', product_ids) if product_ids else 0
        counts['product_identities'] = await conn.fetchval('SELECT count(*) FROM public."product_identities" WHERE product_id = ANY($1)', product_ids) if product_ids else 0
        print('Post-delete counts:')
        for k, v in counts.items():
            print(f'  {k}: {v}')
        OUTPUT_PATH.write_text('\n'.join(f'{k}\t{v}' for k, v in counts.items()), encoding='utf-8')
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
