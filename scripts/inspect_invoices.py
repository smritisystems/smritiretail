"""
Inspect all invoice locations across PostgreSQL databases and JSON stores.
"""
import asyncio
import json
import os
import psycopg2
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smritisys")

def check_postgres_databases():
    print("=== CHECKING POSTGRESQL DATABASES ===")
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT datname FROM pg_database WHERE datname LIKE 'smriti%';")
    dbs = [row[0] for row in cur.fetchall()]
    print("Found Databases:", dbs)
    
    for db_name in dbs:
        print(f"\n--- Database: {db_name} ---")
        db_conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
        db_cur = db_conn.cursor()
        
        # Check for sales_invoices table
        db_cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%invoice%' OR table_name LIKE '%sales%';")
        tables = [r[0] for r in db_cur.fetchall()]
        print(f"Sales/Invoice Tables in {db_name}:", tables)
        
        for t in ["sales_invoices", "sales_orders", "invoices"]:
            if t in tables:
                try:
                    db_cur.execute(f"SELECT count(*) FROM {t};")
                    c = db_cur.fetchone()[0]
                    print(f"  -> Table '{t}': {c} records")
                    if c > 0:
                        db_cur.execute(f"SELECT * FROM {t} LIMIT 3;")
                        colnames = [desc[0] for desc in db_cur.description]
                        print(f"     Columns: {colnames[:6]}...")
                        for row in db_cur.fetchall():
                            print(f"     Row: {row[:5]}")
                except Exception as e:
                    print(f"  -> Error querying {t}: {e}")
        db_conn.close()
    conn.close()

def check_db_store_json():
    print("\n=== CHECKING db_store.json (LEGACY EXPRESS STORE) ===")
    for path in ["db_store.json", "src/db_store.json", "backend/db_store.json"]:
        if os.path.exists(path):
            print(f"Found {path}")
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for k, v in data.items():
                    if isinstance(v, list) and ("invoice" in k.lower() or "sale" in k.lower() or "bill" in k.lower()):
                        print(f"  -> Key '{k}': {len(v)} records")
                        if len(v) > 0:
                            print(f"     Sample: {v[0]}")
            except Exception as e:
                print(f"  Error reading {path}: {e}")

if __name__ == "__main__":
    check_postgres_databases()
    check_db_store_json()
