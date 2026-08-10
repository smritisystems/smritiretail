import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_inspection_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"
REAL_COMPANIES = ['Default Company', 'LLP Enterprise Solutions', 'Smriti Retail India Pvt Ltd']

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []

    out.append('--- test companies ---')
    test_companies = await conn.fetch(f"SELECT id, name, gst_number, company_code FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
    for rec in test_companies:
        out.append(f"{rec['id']}\t{rec['name']}\t{rec['gst_number'] or ''}\t{rec['company_code'] or ''}")
    out.append(f'count\t{len(test_companies)}')

    out.append('\n--- real companies check ---')
    for name in REAL_COMPANIES:
        rec = await conn.fetchrow('SELECT id, name, gst_number, company_code FROM companies WHERE name = $1', name)
        if rec:
            out.append(f"{name}\tFOUND\t{rec['id']}\t{rec['gst_number'] or ''}\t{rec['company_code'] or ''}")
        else:
            out.append(f"{name}\tMISSING")

    test_ids = [rec['id'] for rec in test_companies]
    if not test_ids:
        out.append('\nNo matching test companies found; nothing else to inspect.')
        await conn.close()
        OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')
        return

    out.append('\n--- branch ids for test companies ---')
    branch_rows = await conn.fetch('SELECT id, company_id, name, code FROM branches WHERE company_id = ANY($1)', test_ids)
    for row in branch_rows:
        out.append(f"{row['id']}\t{row['company_id']}\t{row['name']}\t{row['code']}")
    branch_ids = [row['id'] for row in branch_rows]
    out.append(f'branch_count\t{len(branch_ids)}')

    out.append('\n--- warehouse ids for test branches ---')
    warehouse_rows = await conn.fetch('SELECT id, branch_id, code, name FROM warehouses WHERE branch_id = ANY($1)', branch_ids)
    for row in warehouse_rows:
        out.append(f"{row['id']}\t{row['branch_id']}\t{row['code']}\t{row['name']}")
    warehouse_ids = [row['id'] for row in warehouse_rows]
    out.append(f'warehouse_count\t{len(warehouse_ids)}')

    async def fk_tables_for(referenced_table, referenced_column):
        q = """
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.key_column_usage ccu
          ON rc.unique_constraint_name = ccu.constraint_name
          AND rc.unique_constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = $1
          AND ccu.column_name = $2
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tc.table_name, kcu.column_name
        """
        rows = await conn.fetch(q, referenced_table, referenced_column)
        return [(r['table_schema'], r['table_name'], r['column_name']) for r in rows]

    out.append('\n--- tables referencing companies.id ---')
    company_tables = await fk_tables_for('companies', 'id')
    for schema, table, col in company_tables:
        out.append(f"{schema}.{table}\t{col}")

    out.append('\n--- row counts in tables referencing companies.id ---')
    for schema, table, col in company_tables:
        count = await conn.fetchval(f'SELECT count(*) FROM {schema}."{table}" WHERE {col} = ANY($1)', test_ids)
        if count:
            out.append(f"{schema}.{table}\t{col}\t{count}")

    out.append('\n--- tables referencing branches.id ---')
    branch_tables = await fk_tables_for('branches', 'id')
    for schema, table, col in branch_tables:
        out.append(f"{schema}.{table}\t{col}")

    out.append('\n--- row counts in tables referencing branches.id ---')
    for schema, table, col in branch_tables:
        count = await conn.fetchval(f'SELECT count(*) FROM {schema}."{table}" WHERE {col} = ANY($1)', branch_ids)
        if count:
            out.append(f"{schema}.{table}\t{col}\t{count}")

    out.append('\n--- tables referencing warehouses.id ---')
    warehouse_tables = await fk_tables_for('warehouses', 'id')
    for schema, table, col in warehouse_tables:
        out.append(f"{schema}.{table}\t{col}")

    out.append('\n--- row counts in tables referencing warehouses.id ---')
    for schema, table, col in warehouse_tables:
        count = await conn.fetchval(f'SELECT count(*) FROM {schema}."{table}" WHERE {col} = ANY($1)', warehouse_ids)
        if count:
            out.append(f"{schema}.{table}\t{col}\t{count}")

    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
