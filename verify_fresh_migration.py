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
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys_fresh_verify'

conn = psycopg2.connect(host='localhost', port=5432, user='postgres', password='postgres', dbname='postgres')
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname = 'smritisys_fresh_verify'")
if cur.fetchone():
    cur.execute("DROP DATABASE smritisys_fresh_verify")
cur.execute("CREATE DATABASE smritisys_fresh_verify")
print('fresh db ready')
conn.close()

result = subprocess.run(
    [sys.executable, '-m', 'alembic', 'upgrade', 'head'],
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

conn2 = psycopg2.connect(host='localhost', port=5432, user='postgres', password='postgres', dbname='smritisys_fresh_verify')
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
