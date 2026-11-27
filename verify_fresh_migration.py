import os
import subprocess
import sys
import psycopg2

root = r'F:\SMRITRretailNX'
backend = os.path.join(root, 'backend')

os.environ['PYTHONPATH'] = os.path.join(root, 'backend')
os.environ['JWT_SECRET_KEY'] = 'dev-test-secret'
os.environ['INTERNAL_SERVICE_KEY'] = 'dev-internal-key'
os.environ['SGIP_VAULT_MASTER_KEY'] = 'dev-vault-master-key-1234567890'
os.environ['POSTGRES_USER'] = 'postgres'
os.environ['POSTGRES_PASSWORD'] = 'postgres'
os.environ['POSTGRES_HOST'] = 'localhost'
os.environ['POSTGRES_PORT'] = '5432'
test_db = 'smriti_test_fresh_verify'
os.environ['DATABASE_URL'] = f'postgresql+asyncpg://postgres:postgres@localhost:5432/{test_db}'

conn = psycopg2.connect(host='localhost', port=5432, user='postgres', password='postgres', dbname='postgres')
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (test_db,))
if cur.fetchone():
    cur.execute(f'DROP DATABASE "{test_db}"')
cur.execute(f'CREATE DATABASE "{test_db}"')
print('fresh db ready')
conn.close()

result = subprocess.run(
    [
        sys.executable,
        '-m',
        'alembic',
        '-x',
        'target=tenant',
        '-x',
        f'db={test_db}',
        'upgrade',
        'tenant@head',
    ],
    cwd=backend,
    env=os.environ.copy(),
    text=True,
    capture_output=True,
)
print('ALEMBIC_EXIT=', result.returncode)
if result.stdout:
    print(result.stdout)
if result.stderr:
    print(result.stderr)
if result.returncode != 0:
    raise SystemExit(result.returncode)

conn2 = psycopg2.connect(host='localhost', port=5432, user='postgres', password='postgres', dbname=test_db)
cur2 = conn2.cursor()
cur2.execute('SELECT version_num FROM alembic_version')
print('alembic_version=', cur2.fetchone())
for tbl in ['crm_leads', 'crm_opportunities', 'distribution_routes', 'ecom_channels', 'platform_capabilities']:
    cur2.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = %s AND table_schema = 'public' ORDER BY ordinal_position",
        (tbl,),
    )
    cols = [r[0] for r in cur2.fetchall()]
    print(f'{tbl}: {cols[:20]}')
conn2.close()
