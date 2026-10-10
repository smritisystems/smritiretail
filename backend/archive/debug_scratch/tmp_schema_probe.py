import psycopg2

HOST='localhost'
PORT=5432
USER='postgres'
PASSWORD='postgres'
DB='smritisys'

conn = psycopg2.connect(dbname=DB, user=USER, password=PASSWORD, host=HOST, port=PORT)
cur = conn.cursor()

checks = [
    ('alembic_head', "SELECT version_num FROM alembic_version"),
    ('companies', "SELECT to_regclass('public.companies') IS NOT NULL"),
    ('company_database_registries', "SELECT to_regclass('public.company_database_registries') IS NOT NULL"),
    ('control_psv_configs', "SELECT to_regclass('public.control_psv_configs') IS NOT NULL"),
    ('products', "SELECT to_regclass('public.products') IS NOT NULL"),
    ('sales_invoice_items', "SELECT to_regclass('public.sales_invoice_items') IS NOT NULL"),
    ('sales_returns', "SELECT to_regclass('public.sales_returns') IS NOT NULL"),
    ('products.buying_price', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='buying_price')"),
    ('products.cost_price', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price')"),
    ('sales_invoice_items.mrp', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='mrp')"),
    ('sales_invoice_items.disc_pct', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='disc_pct')"),
    ('sales_invoice_items.taxable_value', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='taxable_value')"),
    ('sales_invoice_items.igst_amount', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='igst_amount')"),
    ('sales_invoice_items.cgst_amount', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='cgst_amount')"),
    ('sales_invoice_items.sgst_amount', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='sgst_amount')"),
    ('sales_invoice_items.line_no', "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='line_no')"),
]

for name, sql in checks:
    cur.execute(sql)
    print(f'{name}={cur.fetchone()[0]}')

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_invoice_items' ORDER BY ordinal_position")
print('sales_invoice_items.columns=' + ','.join(row[0] for row in cur.fetchall()[:20]))

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position")
print('products.columns=' + ','.join(row[0] for row in cur.fetchall()[:20]))

cur.execute("SELECT company_id FROM control_psv_configs LIMIT 1")
print('control_psv_configs.company_id_sample=' + str(cur.fetchone()))

cur.close(); conn.close()
