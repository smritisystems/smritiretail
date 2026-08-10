import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_detail_inspection_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"

def fmt(row):
    return '\t'.join(str(row[col]) if row[col] is not None else '' for col in row.keys())

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    test_companies = await conn.fetch(f"SELECT id, name, gst_number, company_code FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
    out.append('test_company_count\t' + str(len(test_companies)))
    test_ids = [r['id'] for r in test_companies]
    if not test_ids:
        out.append('no_test_companies')
        OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')
        await conn.close()
        return
    out.append('\n-- companies --')
    out.extend(fmt(r) for r in test_companies)
    branch_rows = await conn.fetch('SELECT id, company_id, name, code FROM branches WHERE company_id = ANY($1)', test_ids)
    branch_ids = [r['id'] for r in branch_rows]
    out.append('\n-- branches --')
    out.extend(fmt(r) for r in branch_rows)
    out.append('branch_count\t' + str(len(branch_ids)))
    customer_groups = await conn.fetch('SELECT id, company_id, branch_id, name FROM customer_groups WHERE company_id = ANY($1)', test_ids)
    out.append('\n-- customer_groups --')
    out.extend(fmt(r) for r in customer_groups)
    customers = await conn.fetch('SELECT id, company_id, branch_id, name FROM customers WHERE company_id = ANY($1)', test_ids)
    out.append('\n-- customers --')
    out.extend(fmt(r) for r in customers)
    products = await conn.fetch('SELECT id, company_id, branch_id, name FROM products WHERE company_id = ANY($1)', test_ids)
    out.append('\n-- products --')
    out.extend(fmt(r) for r in products)
    warehouses = await conn.fetch('SELECT id, branch_id, code, name FROM warehouses WHERE branch_id = ANY($1)', branch_ids)
    out.append('\n-- warehouses --')
    out.extend(fmt(r) for r in warehouses)
    out.append('warehouse_count\t' + str(len(warehouses)))
    if products:
        product_ids = [r['id'] for r in products]
        out.append('\n-- product_barcodes --')
        pb = await conn.fetch('SELECT id, product_id, barcode FROM product_barcodes WHERE product_id = ANY($1)', product_ids)
        out.extend(fmt(r) for r in pb)
        out.append('\n-- product_identities --')
        pi = await conn.fetch('SELECT id, product_id, identity FROM product_identities WHERE product_id = ANY($1)')
        out.extend(fmt(r) for r in pi)
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
