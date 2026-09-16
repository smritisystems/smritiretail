import psycopg2

conn = psycopg2.connect(dbname='postgres', user='postgres', password='postgres', host='localhost', port=5432)
cur = conn.cursor()
cur.execute("SELECT datname, pg_database_size(datname) FROM pg_database WHERE datistemplate = false ORDER BY datname")
rows = cur.fetchall()
print('DATABASES')
for row in rows:
    print(row)
cur.close()
conn.close()
