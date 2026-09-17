"""DB schema verification for migration v1461 — run from backend/ directory."""
import os, re, sys

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
db_url = ""
with open(env_path, encoding="utf-8", errors="replace") as f:
    for line in f:
        line = line.strip()
        if line.startswith("DATABASE_URL"):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

# Strip asyncpg driver identifier for psycopg2
db_url = db_url.replace("+asyncpg", "").replace("postgresql+asyncpg", "postgresql")
m = re.match(r"postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)", db_url)
if not m:
    print("ERROR: Cannot parse DATABASE_URL:", db_url)
    sys.exit(1)

user, pw, host, port, db = m.group(1), m.group(2), m.group(3), m.group(4) or "5432", m.group(5)
print(f"Connecting to {host}:{port}/{db} as {user}")

import psycopg2
conn = psycopg2.connect(host=host, port=port, dbname=db, user=user, password=pw)
cur = conn.cursor()

print("\n--- Column definition ---------------------------------")
cur.execute("""
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM   information_schema.columns
    WHERE  table_name = 'document_series'
      AND  column_name = 'number_format'
""")
row = cur.fetchone()
if row:
    print(f"  column_name              : {row[0]}")
    print(f"  data_type                : {row[1]}")
    print(f"  character_maximum_length : {row[2]}")
    print(f"  is_nullable              : {row[3]}")
    print(f"  column_default           : {row[4]}")
else:
    print("  NOT FOUND - migration may not have applied")

print("\n--- CHECK constraint ---------------------------------")
cur.execute("""
    SELECT constraint_name, check_clause
    FROM   information_schema.check_constraints
    WHERE  constraint_name = 'chk_document_series_number_format'
""")
chk = cur.fetchone()
if chk:
    print(f"  constraint_name : {chk[0]}")
    print(f"  check_clause    : {chk[1]}")
else:
    print("  NOT FOUND")

print("\n--- Row distribution by number_format (active rows) --")
cur.execute("""
    SELECT COALESCE(number_format, 'NULL') AS fmt, COUNT(*) AS cnt
    FROM   document_series
    WHERE  is_deleted = false
    GROUP  BY number_format
    ORDER  BY number_format
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  {r[0]:<25} : {r[1]} rows")
else:
    print("  (no active rows)")

conn.close()
print("\nVERIFICATION COMPLETE")
