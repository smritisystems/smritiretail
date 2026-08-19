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
import sys
import psycopg2

sys.path.insert(0, os.path.abspath("backend"))
from app.services.invoice_pdf_service import InvoicePdfService

def main():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("SELECT * FROM sales_invoices WHERE invoice_no = 'TT2026-2027/73';")
    inv_row = cur.fetchone()
    
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sales_invoices'
        ORDER BY ordinal_position;
    """)
    cols = [r[0] for r in cur.fetchall()]
    inv_dict = dict(zip(cols, inv_row))
    
    cur.execute("SELECT * FROM sales_invoice_items WHERE invoice_id = 'inv-tt-73' ORDER BY id;")
    item_rows = cur.fetchall()
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sales_invoice_items'
        ORDER BY ordinal_position;
    """)
    item_cols = [r[0] for r in cur.fetchall()]
    items = [dict(zip(item_cols, r)) for r in item_rows]
    conn.close()

    class DummyItem:
        def __init__(self, d):
            for k, v in d.items():
                setattr(self, k, v)

    class DummyInvoice:
        def __init__(self, d, items_list):
            for k, v in d.items():
                setattr(self, k, v)
            self.items = [DummyItem(it) for it in items_list]

    # Updated addresses from user request
    billing_addr = "NO 62/2,RIL BUILIDING\nRICHMOND ROAD,\nBANGALORE- 560025 Karnataka, INDIA"
    shipping_addr = "Distribution Center\nSurvey No 54 1 Nandihalli Village\n55th KM Stone NH 4 Tumkur Road\nOordigree Hobli Taluka\nTUMKUR, Karnataka - 572101\nTel :\nGSTN No : 29AABCR1718E1ZL\nEMAIL : Fp_Dc_KA.TUMKUR_S4NN@zmail.ril.com"
    site_name = "Reliance Retail Limited (Distribution Center)"

    inv_dict['billing_address'] = billing_addr
    inv_dict['shipping_address'] = shipping_addr
    inv_dict['site_name'] = site_name
    inv_dict['customer_name'] = "Reliance Retail Limited"
    inv_dict['customer_gstin'] = "29AABCR1718E1ZL"

    inv_obj = DummyInvoice(inv_dict, items)

    html = InvoicePdfService.generate_invoice_html_from_model(inv_obj)
    
    out_html = r"exports\test_73_updated.html"
    os.makedirs("exports", exist_ok=True)
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Generated test HTML: {out_html} ({len(html)} bytes)")

if __name__ == "__main__":
    main()
