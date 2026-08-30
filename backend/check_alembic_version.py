import psycopg2

conn = psycopg2.connect(host='localhost', user='postgres', password='postgres', dbname='smritisys')
cur = conn.cursor()
cur.execute("SELECT version FROM alembic_version;")
result = cur.fetchone()
print('Current Alembic Version:', result[0] if result else 'NONE')
cur.close()
conn.close()
