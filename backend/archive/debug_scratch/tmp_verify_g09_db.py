import os
import subprocess
import sys
import psycopg2

HOST = 'localhost'
PORT = 5432
USER = 'postgres'
PASSWORD = 'postgres'
TARGET_DB = 'smritisys'

print('host=' + HOST)
print('port=' + str(PORT))
print('database=' + TARGET_DB)
print('environment=disposable/local test')

conn = psycopg2.connect(dbname='postgres', user=USER, password=PASSWORD, host=HOST, port=PORT)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT datname FROM pg_database WHERE datname = %s", (TARGET_DB,))
print('target_exists=' + str(cur.fetchone() is not None))
cur.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid();", (TARGET_DB,))
cur.execute(f"DROP DATABASE IF EXISTS \"{TARGET_DB}\" WITH (FORCE);")
cur.execute(f"CREATE DATABASE \"{TARGET_DB}\";")
cur.close()
conn.close()

backend_dir = r'F:\SMRITRretailNX\backend'
cmd = [sys.executable, '-m', 'alembic', 'upgrade', 'head']
env = os.environ.copy()
env['PYTHONPATH'] = r'F:\SMRITRretailNX'
print('--- ALEMBIC UPGRADE ---')
res = subprocess.run(cmd, cwd=backend_dir, env=env, capture_output=True, text=True)
print(res.stdout)
print(res.stderr)
print('alembic_exit=' + str(res.returncode))
if res.returncode != 0:
    sys.exit(res.returncode)

conn = psycopg2.connect(dbname=TARGET_DB, user=USER, password=PASSWORD, host=HOST, port=PORT)
cur = conn.cursor()
checks = [
    'companies',
    'company_database_registries',
    'control_psv_configs',
    'products',
    'sales_invoice_items',
    'sales_returns',
]
for table in checks:
    cur.execute("SELECT to_regclass(%s)", ('public.' + table,))
    print(f'{table}=' + str(cur.fetchone()[0]))

required_products = ['buying_price', 'cost_price']
for col in required_products:
    cur.execute("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = %s)", (col,))
    print(f'products.{col}=' + str(cur.fetchone()[0]))

required_invoice_cols = ['mrp', 'disc_pct', 'taxable_value', 'igst_amount', 'cgst_amount', 'sgst_amount', 'line_no']
for col in required_invoice_cols:
    cur.execute("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_invoice_items' AND column_name = %s)", (col,))
    print(f'sales_invoice_items.{col}=' + str(cur.fetchone()[0]))

required_return_cols = ['idempotency_key', 'policy_id', 'policy_version', 'policy_scope', 'policy_snapshot', 'credit_note_number']
for col in required_return_cols:
    cur.execute("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_returns' AND column_name = %s)", (col,))
    print(f'sales_returns.{col}=' + str(cur.fetchone()[0]))

cur.execute("SELECT version_num FROM alembic_version")
print('alembic_version=' + str(cur.fetchone()[0]))
cur.close(); conn.close()
