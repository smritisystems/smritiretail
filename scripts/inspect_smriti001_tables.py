import psycopg2

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
tables = [r[0] for r in cur.fetchall()]
print("=== TABLES WITH ROWS IN smriti001 ===")
for t in tables:
    try:
        cur.execute(f"SELECT count(*) FROM {t};")
        c = cur.fetchone()[0]
        if c > 0:
            print(f"  {t}: {c} rows")
    except Exception:
        pass
conn.close()
