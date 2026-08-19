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

import os
import glob
import pandas as pd
import psycopg2

target_sis = ['TW07', 'TUK5', 'TYAC']

print("=== 1. CHECKING EXCEL FILES ===")
excel_files = glob.glob("**/*.xlsx", recursive=True)
for ef in excel_files:
    try:
        xl = pd.ExcelFile(ef)
        for sheet in xl.sheet_names:
            df = xl.parse(sheet)
            # check if any target_sis is in df string representation
            for s in target_sis:
                matches = df[df.apply(lambda row: row.astype(str).str.contains(s, case=False, na=False).any(), axis=1)]
                if len(matches) > 0:
                    print(f"[{ef} -> Sheet: {sheet}] Found {len(matches)} rows matching {s}:")
                    print(matches.head(2))
    except Exception as e:
        # print(f"Error reading {ef}: {e}")
        pass

print("\n=== 2. CHECKING POSTGRES (smriti001.sales_invoices) ===")
conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor()
for s in target_sis:
    cur.execute("""
        SELECT invoice_no, sis_code, po_reference, customer_name, customer_gstin, pos_state, billing_address, shipping_address, site_name
        FROM sales_invoices
        WHERE sis_code ILIKE %s OR shipping_address ILIKE %s OR site_name ILIKE %s
        ORDER BY invoice_no;
    """, (f'%{s}%', f'%{s}%', f'%{s}%'))
    rows = cur.fetchall()
    print(f"Postgres match for {s}: {len(rows)} invoices found")
    for r in rows:
        print(f"  Invoice: {r[0]}, SIS: {r[1]}, PO: {r[2]}, GSTIN: {r[4]}, State: {r[5]}")
        print(f"  Billing: {r[6][:60]}...")
        print(f"  Shipping: {r[7][:60]}...")
        print(f"  Site: {r[8][:60]}...")

conn.close()
