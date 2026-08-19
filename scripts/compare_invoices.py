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
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT invoice_no, sis_code, customer_name, customer_gstin, billing_address, shipping_address, site_name
        FROM sales_invoices
        WHERE invoice_no IN ('TT2026-2027/71', 'TT2026-2027/72', 'TT2026-2027/73', 'TT2026-2027/74', 'TT2026-2027/75')
        ORDER BY invoice_no;
    """)
    for row in cur.fetchall():
        print(f"=== {row[0]} (SIS: {row[1]}) ===")
        print("Customer Name   :", row[2])
        print("Customer GSTIN  :", row[3])
        print("Billing Address :\n", row[4])
        print("Shipping Address:\n", row[5])
        print("Site Name       :\n", row[6])
        print("-" * 50)

    conn.close()

if __name__ == "__main__":
    main()
