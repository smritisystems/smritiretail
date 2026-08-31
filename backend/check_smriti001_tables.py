import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
tables = [row[0] for row in cur.fetchall()]
print(f'Total tables in smriti001: {len(tables)}')
platform_related = [t for t in tables if 'platform' in t or 'capability' in t or 'workspace' in t or 'pdt_' in t]
print(f'\nPlatform-related tables found:')
for t in sorted(platform_related):
    print(f'  {t}')
conn.close()
