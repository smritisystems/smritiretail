"""
SMRITI smriti001 backup via pg_dump equivalent (Python psycopg2 COPY).
Takes a SQL-script-style backup of all tables by dumping schema + COPY data.
Writes to F:/SMRITRretailNX/backups/smriti001_pre_seed_<timestamp>.sql

This backup can be restored via:
  psql -U postgres smriti001 < <file>
"""
import os, datetime, psycopg2
from psycopg2 import sql

BACKUP_DIR = r"F:\SMRITRretailNX\backups"
DB = "smriti001"
ts  = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
OUT = os.path.join(BACKUP_DIR, f"{DB}_pre_seed_{ts}.sql")

os.makedirs(BACKUP_DIR, exist_ok=True)

conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{DB}")
conn.autocommit = True
cur  = conn.cursor()

# Get all user tables in public schema
cur.execute("""
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
""")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables in {DB}: {len(tables)}")

with open(OUT, "w", encoding="utf-8") as f:
    f.write(f"-- SMRITI backup: {DB} @ {ts}\n")
    f.write("-- Restore: psql -U postgres {DB} < <this_file>\n\n")
    f.write("BEGIN;\n\n")

    for tbl in tables:
        # Get row count first
        cur.execute(f"SELECT COUNT(*) FROM {tbl};")
        cnt = cur.fetchone()[0]
        f.write(f"-- TABLE: {tbl}  ({cnt} rows)\n")

        if cnt == 0:
            f.write(f"-- (empty)\n\n")
            continue

        # Dump via COPY TO STDOUT (text format)
        f.write(f"COPY {tbl} FROM stdin;\n")
        import io
        buf = io.StringIO()
        cur.copy_to(buf, tbl)
        buf.seek(0)
        f.write(buf.read())
        f.write("\\.\n\n")
        print(f"  {tbl}: {cnt} rows")

    f.write("\nCOMMIT;\n")

conn.close()

size = os.path.getsize(OUT)
print(f"\nBackup written: {OUT}")
print(f"Size: {size:,} bytes ({size/1024:.1f} KB)")
print("EXIT=0")
