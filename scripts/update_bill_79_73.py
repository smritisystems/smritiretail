"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.5
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import psycopg2
from pathlib import Path

# Set stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent

def update_invoice_79():
    print("=== UPDATING BILL 79 FROM BILL 73 MASTER ATTRIBUTES ===")
    
    for dbname in ["smriti001", "smritisys"]:
        try:
            conn = psycopg2.connect(host="localhost", port=5432, user="postgres", password="postgres", dbname=dbname)
            cur = conn.cursor()
            
            # Fetch Bill 73 attributes
            cur.execute("""
                SELECT sis_code, po_reference, customer_name, customer_gstin,
                       billing_address, shipping_address, site_name, pos_state, is_interstate
                FROM sales_invoices
                WHERE invoice_no = 'TT2026-2027/73';
            """)
            row73 = cur.fetchone()
            if not row73:
                print(f"[{dbname}] Invoice TT2026-2027/73 not found, skipping.")
                conn.close()
                continue

            sis_code, po_ref, cust_name, cust_gstin, bill_addr, ship_addr, site_name, pos_state, is_inter = row73

            # Update Bill 79
            cur.execute("""
                UPDATE sales_invoices
                SET 
                    sis_code = %s,
                    po_reference = %s,
                    customer_name = %s,
                    customer_gstin = %s,
                    billing_address = %s,
                    shipping_address = %s,
                    site_name = %s,
                    pos_state = %s,
                    is_interstate = %s
                WHERE invoice_no = 'TT2026-2027/79';
            """, (sis_code, po_ref, cust_name, cust_gstin, bill_addr, ship_addr, site_name, pos_state, is_inter))
            
            conn.commit()
            print(f"[{dbname}] Successfully updated TT2026-2027/79 with attributes from TT2026-2027/73!")
            print(f"  -> SIS Code    : {sis_code}")
            print(f"  -> PO Reference: {po_ref}")
            print(f"  -> Site Name   : {site_name}")
            print(f"  -> Shipping    : {ship_addr.replace(chr(10), ' ')}")

            conn.close()
        except Exception as e:
            print(f"[{dbname}] Error updating database: {e}")

if __name__ == "__main__":
    update_invoice_79()
