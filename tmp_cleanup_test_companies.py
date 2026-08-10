import asyncio
import asyncpg

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'

TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"

async def run():
    conn = await asyncpg.connect(DB_URL)
    print('--- test companies ---')
    test_companies = await conn.fetch(f"SELECT id, name, gst_number, company_code FROM companies WHERE {TEST_COMPANY_FILTER} ORDER BY name")
    for rec in test_companies:
        print(rec['id'], rec['name'], rec['gst_number'], rec['company_code'], sep='\t')
    print('count', len(test_companies))

    print('\n--- real companies check ---')
    real_names = ['Default Company', 'LLP Enterprise Solutions', 'Smriti Retail India Pvt Ltd']
    for name in real_names:
        rec = await conn.fetchrow('SELECT id, name, gst_number, company_code FROM companies WHERE name = $1', name)
        print(name, '->', rec['id'] if rec else 'MISSING', rec['gst_number'] if rec else '', rec['company_code'] if rec else '')

    ids = [rec['id'] for rec in test_companies]
    if not ids:
        print('\nNo matching test companies found; exiting introspection.')
        await conn.close()
        return

    print('\n--- branch ids for test companies ---')
    branch_rows = await conn.fetch('SELECT id, company_id, name, code FROM branches WHERE company_id = ANY($1)', ids)
    for row in branch_rows:
        print(row['id'], row['company_id'], row['name'], row['code'], sep='\t')
    branch_ids = [row['id'] for row in branch_rows]
    print('branch count', len(branch_ids))

    print('\n--- tables referencing company_id ---')
    company_fk_tables = await conn.fetch("""
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.key_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
            AND rc.unique_constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'companies'
          AND ccu.column_name = 'id'
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tc.table_name, kcu.column_name
    """)
    company_tables = set((r['table_schema'], r['table_name'], r['column_name']) for r in company_fk_tables)
    for schema, table, col in sorted(company_tables):
        print(schema, table, col)

    print('\n--- row counts for company_id reference tables ---')
    for schema, table, col in sorted(company_tables):
        count = await conn.fetchval(f'SELECT count(*) FROM {schema}."{table}" WHERE {col} = ANY($1)', ids)
        if count > 0:
            print(table, col, count)

    print('\n--- tables referencing branch_id ---')
    branch_fk_tables = await conn.fetch("""
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.key_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
            AND rc.unique_constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'branches'
          AND ccu.column_name = 'id'
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tc.table_name, kcu.column_name
    """)
    branch_tables = set((r['table_schema'], r['table_name'], r['column_name']) for r in branch_fk_tables)
    for schema, table, col in sorted(branch_tables):
        print(schema, table, col)
    print('\n--- row counts for branch_id reference tables ---')
    for schema, table, col in sorted(branch_tables):
        count = await conn.fetchval(f'SELECT count(*) FROM {schema}."{table}" WHERE {col} = ANY($1)', branch_ids)
        if count > 0:
            print(table, col, count)

    print('\n--- tables referencing warehouses.id ---')
    warehouse_fk_tables = await conn.fetch("""
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.key_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
            AND rc.unique_constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'warehouses'
          AND ccu.column_name = 'id'
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tc.table_name, kcu.column_name
    """)
    warehouse_tables = set((r['table_schema'], r['table_name'], r['column_name']) for r in warehouse_fk_tables)
    for schema, table, col in sorted(warehouse_tables):
        print(schema, table, col)

    # find warehouses belonging to test branches
    wh_rows = await conn.fetch('SELECT id, branch_id, code, name FROM warehouses WHERE branch_id = ANY($1)', branch_ids)
    wh_ids = [row['id'] for row in wh_rows]
    print('\n--- warehouses for test branches ---')
    for row in wh_rows:
        print(row['id'], row['branch_id'], row['code'], row['name'], sep='\t')
    print('warehouse count', len(wh_ids))
    print('\n--- row counts for warehouse_id reference tables ---')
    for schema, table, col in sorted(warehouse_tables):
        count = await conn.fetchval(f'SELECT count(*) FROM {schema}."{table}" WHERE {col} = ANY($1)', wh_ids)
        if count > 0:
            print(table, col, count)

    await conn.close()

if __name__ == '__main__':
    asyncio.run(run())
