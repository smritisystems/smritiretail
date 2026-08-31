"""Check companies table schema"""
import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name='companies' ORDER BY ordinal_position
""")
for col_name, col_type in cur.fetchall():
    print(f"{col_name:30s}: {col_type}")
cur.close()
conn.close()
