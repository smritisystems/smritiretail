import asyncio
import asyncpg
from collections import defaultdict, deque
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_delete_all_companies_output.txt')
KEY_COLUMNS = {'company_id', 'branch_id', 'warehouse_id', 'source_branch_id', 'destination_branch_id'}

async def fetch_relevant_ids(conn, company_ids):
    branch_ids = [r['id'] for r in await conn.fetch('SELECT id FROM public."branches" WHERE company_id = ANY($1)', company_ids)]
    warehouse_ids = [r['id'] for r in await conn.fetch('SELECT id FROM public."warehouses" WHERE branch_id = ANY($1)', branch_ids)]
    return branch_ids, warehouse_ids

async def build_table_column_map(conn):
    rows = await conn.fetch(
        "SELECT table_name, column_name FROM information_schema.columns "
        "WHERE table_schema = 'public' AND column_name = ANY($1) "
        "AND table_name NOT IN ('companies','branches','warehouses') "
        "ORDER BY table_name, column_name",
        list(KEY_COLUMNS),
    )
    table_cols = defaultdict(list)
    for r in rows:
        table_cols[r['table_name']].append(r['column_name'])
    return table_cols

async def build_dependency_graph(conn, tables):
    rows = await conn.fetch(
        "SELECT con.conrelid::regclass::text AS child_table, "
        "att.attname AS child_column, confrelid::regclass::text AS parent_table "
        "FROM pg_constraint con "
        "JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey) "
        "WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace",
    )
    deps = defaultdict(set)
    for r in rows:
        child = r['child_table']
        parent = r['parent_table']
        if child in tables and parent in tables:
            deps[parent].add(child)
    return deps

def topological_sort(tables, deps):
    indegree = {t: 0 for t in tables}
    for parent, children in deps.items():
        for child in children:
            indegree[child] += 1
    q = deque(sorted([t for t, d in indegree.items() if d == 0]))
    order = []
    while q:
        cur = q.popleft()
        order.append(cur)
        for child in sorted(deps.get(cur, [])):
            indegree[child] -= 1
            if indegree[child] == 0:
                q.append(child)
    if len(order) != len(tables):
        unresolved = set(tables) - set(order)
        raise RuntimeError(f'Unable to topologically sort tables: {sorted(unresolved)}')
    return order

async def main():
    conn = await asyncpg.connect(DB_URL)
    try:
        company_ids = [r['id'] for r in await conn.fetch('SELECT id FROM public."companies"')]
        if not company_ids:
            print('No companies found.')
            return
        print('Deleting all companies:', len(company_ids), 'rows')
        branch_ids, warehouse_ids = await fetch_relevant_ids(conn, company_ids)
        print('Detected branches:', len(branch_ids), 'warehouses:', len(warehouse_ids))

        table_cols = await build_table_column_map(conn)
        all_tables = set(table_cols.keys()) | {'branches', 'warehouses', 'companies'}
        deps = await build_dependency_graph(conn, all_tables)

        # Ensure companies, branches, warehouses delete last in correct order.
        final_order = ['warehouses', 'branches', 'companies']
        non_final = [t for t in all_tables if t not in final_order]

        sorted_tables = topological_sort(all_tables, deps)
        sorted_tables = [t for t in sorted_tables if t not in final_order] + final_order

        print('Delete order:')
        for table in sorted_tables:
            print('  ', table)

        async with conn.transaction():
            for table in sorted_tables:
                if table == 'companies':
                    deleted = await conn.execute('DELETE FROM public."companies" WHERE id = ANY($1)', company_ids)
                    print('Deleted companies:', deleted)
                    continue
                if table == 'branches':
                    deleted = await conn.execute('DELETE FROM public."branches" WHERE company_id = ANY($1)', company_ids)
                    print('Deleted branches:', deleted)
                    continue
                if table == 'warehouses':
                    deleted = await conn.execute('DELETE FROM public."warehouses" WHERE branch_id = ANY($1) OR company_id = ANY($2)', branch_ids, company_ids)
                    print('Deleted warehouses:', deleted)
                    continue
                cols = table_cols.get(table, [])
                if not cols:
                    continue
                conditions = []
                params = []
                if 'company_id' in cols:
                    conditions.append('"company_id" = ANY($%d)' % (len(params) + 1))
                    params.append(company_ids)
                if 'branch_id' in cols:
                    conditions.append('"branch_id" = ANY($%d)' % (len(params) + 1))
                    params.append(branch_ids)
                if 'source_branch_id' in cols:
                    conditions.append('"source_branch_id" = ANY($%d)' % (len(params) + 1))
                    params.append(branch_ids)
                if 'destination_branch_id' in cols:
                    conditions.append('"destination_branch_id" = ANY($%d)' % (len(params) + 1))
                    params.append(branch_ids)
                if 'warehouse_id' in cols:
                    conditions.append('"warehouse_id" = ANY($%d)' % (len(params) + 1))
                    params.append(warehouse_ids)
                if not conditions:
                    continue
                where = ' OR '.join(conditions)
                query = f'DELETE FROM public."{table}" WHERE {where}'
                deleted = await conn.execute(query, *params)
                print(f'Deleted {table}:', deleted)
        print('All companies and their dependent data deleted successfully.')
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
