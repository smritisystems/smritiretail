"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import psycopg2

def main():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/postgres")
    cur = conn.cursor()
    cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
    dbs = [row[0] for row in cur.fetchall()]
    conn.close()

    print(f"Available databases: {dbs}")

    for db in dbs:
        try:
            db_conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db}")
            db_cur = db_conn.cursor()
            
            # Check if invoices table exists
            db_cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('invoices', 'sales_invoices', 'tax_invoices');
            """)
            tables = [r[0] for r in db_cur.fetchall()]
            
            for t in tables:
                db_cur.execute(f"SELECT COUNT(*) FROM {t}")
                count = db_cur.fetchone()[0]
                print(f"[{db}] Table '{t}' has {count} records.")
                
                # Check for 73
                db_cur.execute(f"""
                    SELECT invoice_no, customer_name, billing_address, shipping_address, customer_gstin, id
                    FROM {t}
                    WHERE invoice_no ILIKE '%73%' OR invoice_no ILIKE '%TT2026-2027/73%'
                """)
                rows = db_cur.fetchall()
                if rows:
                    print(f"  --> FOUND {len(rows)} matching 73 in {db}.{t}:")
                    for r in rows:
                        print("     ", r)
                        
            db_conn.close()
        except Exception as e:
            print(f"Error checking {db}: {e}")

if __name__ == "__main__":
    main()
