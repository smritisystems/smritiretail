"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.69.0
Created      : 2026-08-25
Modified     : 2026-10-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse
import psycopg2

backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
_PG_PORT = urlparse(str(settings.DATABASE_URL)).port or int(os.getenv("POSTGRES_PORT", 2781))

conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:{_PG_PORT}/postgres")
cur = conn.cursor()
cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
dbs = [r[0] for r in cur.fetchall()]
print(f"PostgreSQL Databases (Port {_PG_PORT}):", dbs)

for d in dbs:
    try:
        c = psycopg2.connect(f"postgresql://postgres:postgres@localhost:{_PG_PORT}/{d}")
        cu = c.cursor()
        cu.execute("SELECT version_num FROM alembic_version;")
        row = cu.fetchone()
        ver = row[0] if row else "EMPTY"
        print(f"  DB {d:25} -> Alembic version: {ver}")

        # Check SCT constraints if table exists
        cu.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_cash_transactions';")
        if cu.fetchone():
            cu.execute("""
                SELECT tc.constraint_name
                FROM information_schema.table_constraints AS tc
                WHERE tc.table_name = 'shift_cash_transactions' AND tc.constraint_type = 'FOREIGN KEY';
            """)
            fks = [r[0] for r in cu.fetchall()]
            print(f"       shift_cash_transactions FKs: {fks}")
        c.close()
    except Exception as e:
        print(f"  DB {d:25} -> {e}")

conn.close()
