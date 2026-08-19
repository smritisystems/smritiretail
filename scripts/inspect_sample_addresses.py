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
        SELECT invoice_no, customer_name, site_name, customer_gstin, billing_address, shipping_address
        FROM sales_invoices
        WHERE invoice_no IN ('TT2026-2027/18', 'TT2026-2027/72', 'TT2026-2027/73', 'TT2026-2027/74', 'TT2026-2027/77', 'TT2026-2027/102')
        ORDER BY invoice_no;
    """)
    for row in cur.fetchall():
        print(f"==================== {row[0]} ====================")
        print("CUSTOMER NAME   :", repr(row[1]))
        print("SITE NAME       :", repr(row[2]))
        print("GSTIN           :", repr(row[3]))
        print("BILLING ADDRESS :\n" + str(row[4]))
        print("SHIPPING ADDRESS:\n" + str(row[5]))

    conn.close()

if __name__ == "__main__":
    main()
