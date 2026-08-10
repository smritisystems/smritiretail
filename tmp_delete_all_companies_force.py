import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_delete_all_companies_force_output.txt')
KEY_COLUMNS = ['company_id', 'branch_id', 'warehouse_id', 'source_branch_id', 'destination_branch_id']

async def main():
    conn = await asyncpg.connect(DB_URL)
    try:
        rows = await conn.fetch(
            "SELECT DISTINCT table_name, column_name "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND column_name = ANY($1)",
            KEY_COLUMNS,
        )
        tables = {}
        for row in rows:
            tables.setdefault(row['table_name'], []).append(row['column_name'])

        print('Found tables:', len(tables))
        for table, cols in sorted(tables.items()):
            print('  ', table, cols)

        async with conn.transaction():
            await conn.execute('SET LOCAL session_replication_role = replica')
            # Delete all dependent rows for tables with company/branch/warehouse-related IDs.
            for table, cols in sorted(tables.items()):
                where_clauses = []
                params = []
                for col in cols:
                    if col in ('company_id', 'branch_id', 'warehouse_id', 'source_branch_id', 'destination_branch_id'):
                        param_index = len(params) + 1
                        where_clauses.append(f'"{col}" IS NOT NULL')
                        params.append(None)
                if not where_clauses:
                    continue
                # Delete all rows where any relevant FK is non-null.
                query = f'DELETE FROM public."{table}" WHERE ' + ' OR '.join(where_clauses)
                deleted = await conn.execute(query)
                print(f'Deleted from {table}:', deleted)
            # Finally delete the parent company/branch/warehouse rows.
            deleted = await conn.execute('DELETE FROM public."warehouses"')
            print('Deleted warehouses:', deleted)
            deleted = await conn.execute('DELETE FROM public."branches"')
            print('Deleted branches:', deleted)
            deleted = await conn.execute('DELETE FROM public."companies"')
            print('Deleted companies:', deleted)
        # Verification
        counts = {}
        counts['companies'] = await conn.fetchval('SELECT count(*) FROM public."companies"')
        counts['branches'] = await conn.fetchval('SELECT count(*) FROM public."branches"')
        counts['warehouses'] = await conn.fetchval('SELECT count(*) FROM public."warehouses"')
        OUTPUT_PATH.write_text('\n'.join(f'{k}\t{v}' for k, v in counts.items()), encoding='utf-8')
        print('Verification counts:', counts)
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
