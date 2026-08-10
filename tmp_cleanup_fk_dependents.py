import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_fk_dependents_output.txt')

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    targets = [
        ('companies', 'id', "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"),
        ('branches', 'id', "company_id IN (SELECT id FROM companies WHERE name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company')"),
        ('customer_groups', 'id', "company_id IN (SELECT id FROM companies WHERE name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company')"),
        ('customers', 'id', "company_id IN (SELECT id FROM companies WHERE name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company')"),
        ('products', 'id', "company_id IN (SELECT id FROM companies WHERE name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company')"),
    ]
    for tbl, col, where in targets:
        out.append(f'-- target {tbl}.{col} --')
        rows = await conn.fetch("SELECT id FROM public.\"companies\" WHERE name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'") if tbl == 'companies' else await conn.fetch(f"SELECT id FROM public.\"{tbl}\" WHERE {where}")
        out.append(f'target_count\t{len(rows)}')
        values = [r['id'] for r in rows]
        if not values:
            continue
        fk_rows = await conn.fetch("SELECT con.oid::regclass AS table_name, att.attname AS column_name, confrelid::regclass AS referenced_table, pg_get_constraintdef(con.oid) AS def FROM pg_constraint con JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey) WHERE con.contype='f' AND confrelid = $1::regclass ORDER BY con.conrelid::regclass::text", tbl)
        for fk in fk_rows:
            out.append(f"fk_table={fk['table_name']} fk_column={fk['column_name']} def={fk['def']}")
            cnt = await conn.fetchval(f'SELECT count(*) FROM public."{fk[