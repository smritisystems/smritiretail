import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()
cur.execute("""
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position
""")
print("companies table schema (smritisys):")
for row in cur.fetchall():
    col, dtype, max_len = row
    size = f"({max_len})" if max_len else ""
    print(f'  {col:20} {dtype}{size}')

# Also check company_database_registries if it exists
cur.execute("""
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'company_database_registries' 
ORDER BY ordinal_position
""")
rows = cur.fetchall()
if rows:
    print("\ncompany_database_registries table schema (smritisys):")
    for row in rows:
        col, dtype, max_len = row
        size = f"({max_len})" if max_len else ""
        print(f'  {col:20} {dtype}{size}')
else:
    print("\ncompany_database_registries: NOT FOUND in smritisys")

conn.close()
