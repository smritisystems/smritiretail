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
import pandas as pd
import psycopg2

target_sis = ['TW07', 'TUK5', 'TYAC']

known_files = [
    r"F:\SMRITRretailNX\TT\RIL FINAL LIST.xlsx",
    r"F:\SMRITRretailNX\TT\RIL_Dispatch_09-08-2026-2.xlsx",
    r"F:\Smriti-Clients Data\Tattly Threads\Invoice\RIL FINAL LIST.xlsx",
    r"F:\Smriti-Clients Data\Tattly Threads\Invoice\RIL_Dispatch_09-08-2026-2.xlsx"
]

print("=== CHECKING KNOWN EXCEL FILES ===")
for kf in known_files:
    if os.path.exists(kf):
        print(f"File exists: {kf}")
        try:
            xl = pd.ExcelFile(kf)
            for sh in xl.sheet_names:
                df = xl.parse(sh, dtype=str)
                for s in target_sis:
                    matches = df[df.apply(lambda row: row.astype(str).str.contains(s, case=False, na=False).any(), axis=1)]
                    if len(matches) > 0:
                        print(f"  [Found {s} in {os.path.basename(kf)} -> {sh}]:")
                        for idx, r in matches.iterrows():
                            print("   ", dict(r.dropna()))
        except Exception as e:
            print(f"  Error reading {kf}: {e}")
    else:
        print(f"File NOT found: {kf}")

print("\n=== CHECKING SMRITI001 DATABASE FOR EXISTING PO AND ADDRESSES ===")
conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor()

# Check all invoices in smriti001
cur.execute("""
    SELECT invoice_no, sis_code, po_reference, customer_name, customer_gstin, pos_state, billing_address, shipping_address, site_name
    FROM sales_invoices
    ORDER BY invoice_no;
""")
all_invs = cur.fetchall()
print(f"Total invoices in smriti001: {len(all_invs)}")

for s in target_sis:
    found = [r for r in all_invs if s in str(r[1]) or s in str(r[7]) or s in str(r[8])]
    print(f"\n--- SIS: {s} ({len(found)} matches in DB) ---")
    if found:
        for r in found:
            print(f"  Invoice No      : {r[0]}")
            print(f"  SIS Code        : {r[1]}")
            print(f"  PO Reference    : {r[2]}")
            print(f"  Customer Name   : {r[3]}")
            print(f"  Customer GSTIN  : {r[4]}")
            print(f"  POS State       : {r[5]}")
            print(f"  Billing Address : {r[6]}")
            print(f"  Shipping Address: {r[7]}")
            print(f"  Site Name       : {r[8]}")
    else:
        print("  NO RECORD FOUND IN DATABASE!")

conn.close()
