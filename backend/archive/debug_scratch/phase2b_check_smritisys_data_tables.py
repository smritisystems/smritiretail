"""Check if data-bearing tables exist in smritisys"""
import psycopg2

data_tables = ['communicator_logs', 'communicator_templates', 'invoice_document_artifacts', 
               'sales_order_invoice_allocations', 'tax_invoice_template_versions', 'tax_invoice_templates']

print("[PHASE 2B] Checking if data-bearing tables exist in smritisys...")
print("="*70)

conn = psycopg2.connect(
    host='localhost', port=5432, user='postgres', password='postgres', database='smritisys'
)
cur = conn.cursor()

for table in data_tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        print(f"{table:40s}: {count:4d} rows")
    except Exception as e:
        print(f"{table:40s}: TABLE NOT FOUND")

cur.close()
conn.close()
