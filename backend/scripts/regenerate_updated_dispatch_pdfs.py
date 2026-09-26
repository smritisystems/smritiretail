"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.4.0
Created      : 2026-09-09
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import datetime
import psycopg2
import asyncio
from decimal import Decimal
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, r"f:\SMRITRretailNX\backend")
from app.services.invoice_pdf_service import InvoicePdfService

DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
OUTPUT_DIRS = [
    r"F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194",
    r"F:\Smriti-Clients Data\08-09-2026\Invoices_Store_PO_Invoice"
]

UPDATE_STORES = [
    "1888", "1969", "1977", "8155", "8313", "8319", "8361", "T0N6", "T1BJ", "T25I",
    "T38X", "T40K", "T51H", "T72W", "T7FN", "T91M", "T97D", "TDL3", "TDM4", "TFW4",
    "TKU6", "TMV9", "TV78", "TVB6", "TYAC"
]

for d in OUTPUT_DIRS:
    os.makedirs(d, exist_ok=True)

class InvoiceItemMock:
    def __init__(self, line_no, code, name, qty, price, mrp, disc_pct, taxable_value, hsn_code, gst_rate, tax_amount, cgst_amount, sgst_amount, igst_amount, total_amount):
        self.line_no = line_no
        self.code = code
        self.name = name
        self.quantity = qty
        self.price = price
        self.mrp = mrp
        self.disc_pct = disc_pct
        self.taxable_value = taxable_value
        self.hsn_code = hsn_code
        self.gst_rate = gst_rate
        self.tax_amount = tax_amount
        self.cgst_amount = cgst_amount
        self.sgst_amount = sgst_amount
        self.igst_amount = igst_amount
        self.total_amount = total_amount

class InvoiceMock:
    def __init__(self, id, invoice_no, date, sis_code, pos_state, po_reference, eway_bill_no, customer_name, customer_gstin, site_name, billing_address, shipping_address, taxable_value, tax_total, grand_total, is_interstate, bank_name, account_no, ifsc_code, bank_branch, items):
        self.id = id
        self.invoice_no = invoice_no
        self.date = date
        self.sis_code = sis_code
        self.pos_state = pos_state
        self.po_reference = po_reference
        self.eway_bill_no = eway_bill_no
        self.customer_name = customer_name
        self.customer_gstin = customer_gstin
        self.site_name = site_name
        self.billing_address = billing_address
        self.shipping_address = shipping_address
        self.taxable_value = taxable_value
        self.tax_total = tax_total
        self.grand_total = grand_total
        self.is_interstate = is_interstate
        self.bank_name = bank_name
        self.account_no = account_no
        self.ifsc_code = ifsc_code
        self.bank_branch = bank_branch
        self.items = items
        self.status = "COMPLETED"
        self.reverse_charge = False
        self.is_reverse_charge = False
        self.irn = None
        self.signed_qr_payload = None
        self.e_invoice_status = "NOT_APPLICABLE"

async def main():
    print("=" * 90)
    print("RE-GENERATING PIXEL-FAITHFUL TAX INVOICE PDFS FOR 25 UPDATED INVOICES")
    for d in OUTPUT_DIRS:
        print(f"Destination: {d}")
    print("=" * 90)

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, invoice_no, date, customer_name, customer_gstin,
               billing_address, shipping_address, site_name, delivery_store_code, pos_state,
               po_reference, taxable_value, tax_total, grand_total, rounding_amount,
               amount_in_words, is_interstate
        FROM sales_invoices
        WHERE delivery_store_code = ANY(%s)
          AND import_batch_id = 'DISPATCH_20260902_STORE_GROUPED_V2'
        ORDER BY CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER)
    """, (UPDATE_STORES,))
    invoices = cur.fetchall()
    print(f"Loaded {len(invoices)} updated invoices from smriti001.")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        page = await browser.new_page()

        for idx, inv in enumerate(invoices, start=1):
            inv_id, inv_no, inv_date, cust_name, cust_gstin, \
            bill_addr, ship_addr, site_name, sis_code, pos_state, \
            po_ref, tax_val, tax_tot, grand_tot, round_adj, \
            words, is_interstate = inv

            cur.execute("""
                SELECT line_no, code, name, quantity, price, mrp, disc_pct,
                       taxable_value, tax_amount, total_amount, igst_amount, cgst_amount, sgst_amount
                FROM sales_invoice_items
                WHERE invoice_id = %s
                ORDER BY line_no, id
            """, (inv_id,))
            item_rows = cur.fetchall()

            items = []
            for it in item_rows:
                l_no, code, name, qty, price, mrp, disc_p, line_tx, line_tax, line_tot, igst_a, cgst_a, sgst_a = it
                items.append(InvoiceItemMock(
                    line_no=l_no,
                    code=code,
                    name=name,
                    qty=qty,
                    price=price,
                    mrp=mrp,
                    disc_pct=disc_p,
                    taxable_value=line_tx,
                    hsn_code="64041990",
                    gst_rate=Decimal("5.00"),
                    tax_amount=line_tax,
                    cgst_amount=cgst_a,
                    sgst_amount=sgst_a,
                    igst_amount=igst_a,
                    total_amount=line_tot
                ))

            inv_mock = InvoiceMock(
                id=inv_id,
                invoice_no=inv_no,
                date=inv_date,
                sis_code=sis_code,
                pos_state=pos_state,
                po_reference=po_ref,
                eway_bill_no="",
                customer_name=cust_name,
                customer_gstin=cust_gstin,
                site_name=site_name,
                billing_address=bill_addr,
                shipping_address=ship_addr,
                taxable_value=tax_val,
                tax_total=tax_tot,
                grand_total=grand_tot,
                is_interstate=is_interstate,
                bank_name="STATE BANK OF INDIA",
                account_no="43976711765",
                ifsc_code="SBIN0030425",
                bank_branch="WARDHMAN NAGAR NAGPUR",
                items=items
            )

            html_content = InvoicePdfService.generate_invoice_html_from_model(
                invoice=inv_mock,
                company_name="TATTLY THREADS",
                company_gstin="27AAXFT2508H1ZR",
                extra_meta={
                    "company_website": "www.tattlythreads.com",
                    "dispatch_email": "dispatch@tattlythreads.com",
                    "accounts_email": "accounts@tattlythreads.com"
                }
            )

            await page.set_content(html_content, wait_until="networkidle")
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "8mm", "bottom": "10mm", "left": "8mm", "right": "8mm"}
            )

            clean_no = inv_no.replace("/", "_")
            pref_name = f"{sis_code}_{po_ref}_{clean_no}.pdf"
            std_name = f"Tax_Invoice_{clean_no}.pdf"

            for d in OUTPUT_DIRS:
                p_std = os.path.join(d, std_name)
                p_pref = os.path.join(d, pref_name)
                try:
                    with open(p_std, "wb") as f:
                        f.write(pdf_bytes)
                except PermissionError:
                    print(f"    Notice: {p_std} is locked by viewer. Writing {p_std}.updated.pdf")
                    with open(p_std + ".updated.pdf", "wb") as f:
                        f.write(pdf_bytes)

                try:
                    with open(p_pref, "wb") as f:
                        f.write(pdf_bytes)
                except PermissionError:
                    print(f"    Notice: {p_pref} is locked by viewer. Writing {p_pref}.updated.pdf")
                    with open(p_pref + ".updated.pdf", "wb") as f:
                        f.write(pdf_bytes)

            print(f"  [{idx:02d}/25] Generated {pref_name} ({len(pdf_bytes):,} bytes) | Store {sis_code} | Total: ₹{grand_tot:,.2f}")

        await browser.close()

    conn.close()
    print("=" * 90)
    print("ALL 25 UPDATED INVOICE PDFS GENERATED SUCCESSFULLY!")
    print("=" * 90)

if __name__ == "__main__":
    asyncio.run(main())
