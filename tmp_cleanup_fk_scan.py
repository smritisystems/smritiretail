import asyncio
import asyncpg
from pathlib import Path

DB_URL = 'postgresql://postgres:postgres@localhost:5432/smriti_retail_db'
OUTPUT_PATH = Path('tmp_cleanup_fk_scan_output.txt')
TEST_COMPANY_FILTER = "name LIKE 'Cert Test Co%' OR name LIKE 'SLT Co t%' OR name = 'Test Company'"
TARGETS = [
    ('companies', 'id', TEST_COMPANY_FILTER),
    ('branches', 'id', "company_id IN (SELECT id FROM companies WHERE {filter})".format(filter=TEST_COMPANY_FILTER)),
    ('customer_groups', 'id', "company_id IN (SELECT id FROM companies WHERE {filter})".format(filter=TEST_COMPANY_FILTER)),
    ('customers', 'id', "company_id IN (SELECT id FROM companies WHERE {filter})".format(filter=TEST_COMPANY_FILTER)),
    ('products', 'id', "company_id IN (SELECT id FROM companies WHERE {filter})".format(filter=TEST_COMPANY_FILTER)),
]

async def main():
    conn = await asyncpg.connect(DB_URL)
    out = []
    for tbl, col, where in TARGETS:
        out.append(f'-- TARGET {tbl}.{col} --')
        rows = await conn.fetch(f'SELECT {col} FROM public."{tbl}" WHERE {where}')
        ids = [r[col] for r in rows]
        out.append(f'target_count\t{len(ids)}')
        if not ids:
            continue
        fk_rows = await conn.fetch(
            """
            SELECT
                con.oid::regclass AS fk_table,
                att.attname AS fk_column,
                confrelid::regclass AS parent_table,
                pg_get_constraintdef(con.oid) AS constraint_def
            FROM pg_constraint con
            JOIN pg_attribute att ON att.attrelid = con.conrelid
                AND att.attnum = ANY(con.conkey)
            WHERE con.contype = 'f'
                AND confrelid = $1::regclass
            ORDER BY fk_table::text, fk_column
            """,
            tbl,
        )
        for fk in fk_rows:
            out.append(f'FK {fk["fk_table"]}.{fk["fk_column"]} -> {fk["parent_table"]} def={fk["constraint_def"]}')
            cnt = await conn.fetchval(f'SELECT count(*) FROM public."{fk["fk_table"]}" WHERE "{fk["fk_column"]}" = ANY($1)', ids)
            out.append(f'COUNT {fk["fk_table"]}.{fk["fk_column"]} = {cnt}')
            if cnt > 0:
                sample = await conn.fetch(f'SELECT * FROM public."{fk["fk_table"]}" WHERE "{fk["fk_column"]}" = ANY($1) LIMIT 5', ids)
                for r in sample:
                    out.append('\t' + ','.join(f"{k}={r[k]}" for k in r.keys()))
    await conn.close()
    OUTPUT_PATH.write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())
