import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'smriti001';")
cur.execute("DROP DATABASE IF EXISTS smriti001;")
print("smriti001 dropped cleanly.")
conn.close()
