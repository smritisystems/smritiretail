"""Patch place_of_supply_code column to VARCHAR(50) in all databases."""
import psycopg2

dbs = ['smriti_test_phase2c', 'smriti_test_empty', 'smriti001', 'smriti002', 'smritisys']
for db in dbs:
    try:
        conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db}')
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            "SELECT character_maximum_length FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='sales_invoices' "
            "AND column_name='place_of_supply_code'"
        )
        row = cur.fetchone()
        if row:
            if row[0] != 50:
                cur.execute('ALTER TABLE sales_invoices ALTER COLUMN place_of_supply_code TYPE VARCHAR(50)')
                print(f'{db}: ALTERED place_of_supply_code -> VARCHAR(50) (was VARCHAR({row[0]}))')
            else:
                print(f'{db}: OK (already VARCHAR(50))')
        else:
            print(f'{db}: sales_invoices.place_of_supply_code column not found')
        conn.close()
    except Exception as e:
        print(f'{db}: SKIP - {e}')
print('Done.')
