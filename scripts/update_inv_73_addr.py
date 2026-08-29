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
import io
import asyncio
import psycopg2
from playwright.async_api import async_playwright
from pypdf import PdfReader

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.abspath("backend"))
from app.services.invoice_pdf_service import InvoicePdfService

BILLING_ADDRESS = (
    "NO 62/2,RIL BUILIDING\n"
    "RICHMOND ROAD,\n"
    "BANGALORE- 560025 Karnataka, INDIA"
)

SHIPPING_ADDRESS = (
    "Distribution Center\n"
    "Survey No 54 1 Nandihalli Village\n"
    "55th KM Stone NH 4 Tumkur Road\n"
    "Oordigree Hobli Taluka\n"
    "TUMKUR, Karnataka - 572101\n"
    "Tel :\n"
    "GSTN No : 29AABCR1718E1ZL\n"
    "EMAIL : Fp_Dc_KA.TUMKUR_S4NN@zmail.ril.com"
)

CUSTOMER_NAME = "Reliance Retail Limited"
SITE_NAME = "Reliance Retail Limited (Distribution Center)"
CUSTOMER_GSTIN = "29AABCR1718E1ZL"

def update_database():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE sales_invoices
        SET customer_name = %s,
            billing_address = %s,
            shipping_address = %s,
            site_name = %s,
            customer_gstin = %s,
            modified_at = NOW()
        WHERE invoice_no = 'TT2026-2027/73'
        RETURNING id, invoice_no, customer_name, billing_address, shipping_address, site_name, customer_gstin;
    """, (CUSTOMER_NAME, BILLING_ADDRESS, SHIPPING_ADDRESS, SITE_NAME, CUSTOMER_GSTIN))
    
    row = cur.fetchone()
    conn.commit()
    conn.close()
    
    print("Updated Database Record in smriti001.sales_invoices:")
    print("ID              :", row[0])
    print("Invoice No      :", row[1])
    print("Customer Name   :", row[2])
    print("Billing Address :\n" + row[3])
    print("Shipping Address:\n" + row[4])
    print("Site Name       :", row[5])
    print("Customer GSTIN  :", row[6])
    return row

async def generate_and_update_pdfs():
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
    
    cur.execute("SELECT * FROM sales_invoice_items WHERE invoice_id = %s ORDER BY id;", (inv_dict['id'],))
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

    inv_obj = DummyInvoice(inv_dict, items)
    html = InvoicePdfService.generate_invoice_html_from_model(inv_obj)

    # List of PDF paths to update
    pdf_paths = [
        r"exports\Final_TaxInvoice\8319_TT2026-2027_73.pdf",
        r"exports\Final_TaxInvoice\S4NN_8319_TT2026-2027_73.pdf",
        r"exports\all_54_pdf_invoices\8319_TT2026-2027_73.pdf",
        r"TT\Pending\updated\8319_TT2026-2027_73.pdf",
        r"TT\Pending\SIS_8319_TaxInvoice_TT2026-2027_73.pdf",
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        page = await browser.new_page()
        await page.set_content(html, wait_until="networkidle")

        for pdf_path in pdf_paths:
            os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
            await page.pdf(
                path=pdf_path,
                format="A4",
                print_background=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )
            print(f"Generated & Updated PDF: {pdf_path} (Size: {os.path.getsize(pdf_path)} bytes)")

        await browser.close()

    # Verify first page of one generated PDF
    reader = PdfReader(pdf_paths[1])
    text = reader.pages[0].extract_text()
    assert "BANGALORE- 560025" in text or "BANGALORE-" in text, "Billing address missing in PDF"
    assert "TUMKUR, Karnataka - 572101" in text or "572101" in text, "Shipping address missing in PDF"
    assert "Fp_Dc_KA.TUMKUR_S4NN@zmail.ril.com" in text, "Email missing in PDF"
    print("\n[SUCCESS] PDF Verification Passed: Billing and Shipping addresses successfully validated in rendered PDF.")

def main():
    update_database()
    asyncio.run(generate_and_update_pdfs())

if __name__ == "__main__":
    main()
