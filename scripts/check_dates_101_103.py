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

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor()
cur.execute("SELECT invoice_no, date, sis_code, grand_total FROM sales_invoices WHERE invoice_no IN ('TT2026-2027/101', 'TT2026-2027/102', 'TT2026-2027/103');")
for r in cur.fetchall():
    print(r)
conn.close()
