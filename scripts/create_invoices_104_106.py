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
import uuid
import datetime
import asyncio
from decimal import Decimal
import psycopg2
from playwright.async_api import async_playwright
from pypdf import PdfReader

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.abspath("backend"))

from app.services.invoice_pdf_service import InvoicePdfService, number_to_indian_words

# Raw dispatch matrix from user
RAW_DATA = """
TW07	CH-24-G	BLACK	1899	1	1	2	2	1	1	0	8
TW07	CH-24-G	CREAM	1899	1	1	2	2	1	1	0	8
TW07	CH-04-A	BLACK	1899	1	1	2	2	1	1	0	8
TW07	CH-12-C	BRONZE	2399	1	1	2	2	1	1	0	8
TW07	CH-01-A	CREAM	1899	1	1	2	2	1	1	0	8
TW07	CH-01-A	PEACH	1899	1	1	2	2	1	1	0	8
TW07	SND-06-G	BROWN	1899	0	1	2	2	1	1	1	8
TUK5	CH-19-E	CREAM	1599	1	1	2	2	1	1	0	8
TW07	CH-19-E	CREAM	1599	1	1	2	2	1	1	0	8
TYAC	CH-19-E	CREAM	1599	1	1	2	2	1	1	0	8
TUK5	CH-19-E	TAN	1599	1	1	2	2	1	1	0	8
TW07	CH-19-E	TAN	1599	1	1	2	2	1	1	0	8
TYAC	CH-19-E	TAN	1599	1	1	2	2	1	1	0	8
TUK5	SND-05-G	R-GOLD	1899	1	1	2	2	1	1	0	8
TW07	SND-05-G	R-GOLD	1899	1	1	2	2	1	1	0	8
TYAC	SND-05-G	R-GOLD	1899	1	1	2	2	1	1	0	8
TUK5	CH-18-E	BLACK	2099	0	1	2	2	1	1	1	8
TUK5	CH-18-E	BROWN	2099	0	1	2	2	1	1	1	8
TW07	CH-18-E	BLACK	2099	0	1	2	2	1	1	1	8
TW07	CH-18-E	BROWN	2099	0	1	2	2	1	1	1	8
TYAC	CH-18-E	BLACK	2099	0	1	2	2	1	1	1	8
TYAC	CH-18-E	BROWN	2099	0	1	2	2	1	1	1	8
TUK5	CH-12-C	PINK	2399	1	1	2	2	1	1	0	8
TW07	CH-12-C	PINK	2399	1	1	2	2	1	1	0	8
TYAC	CH-12-C	PINK	2399	1	1	2	2	1	1	0	8
TW07	CH-04-A	CREAM	1899	1	1	2	2	1	1	0	8
TYAC	CH-04-A	CREAM	1899	0	1	2	2	1	1	1	8
"""

STANDARD_BILLING_ADDRESS = (
    "NO 62/2,RIL BUILIDING\n"
    "RICHMOND ROAD,\n"
    "BANGALORE- 560025 Karnataka, INDIA"
)

SIS_CONFIG = {
    "TUK5": {
        "sequence": 104,
        "po_number": "5182778198",
        "site_name": "Reliance Retail Limited (RRL TF CMR MALL)",
        "state": "ANDHRA PRADESH",
        "gstin": "37AABCR1718E1ZO",
        "shipping_address": (
            "First Floor China Gantyada Vlg & Mandal Nh 5 Road Gajuwaka "
            "Greater Vishakhpatnam Municipal Corporation Area VIZAG, Andhra Pradesh - 530020"
        ),
        "billing_address": STANDARD_BILLING_ADDRESS,
        "is_interstate": True
    },
    "TYAC": {
        "sequence": 105,
        "po_number": "5182778209",
        "site_name": "Reliance Retail Limited (RRL TF MB HABITAT MALL)",
        "state": "KARNATAKA",
        "gstin": "29AABCR1718E1ZL",
        "shipping_address": (
            "B M Habitat Mall Shop No F 6 F 7And F7A No22/B Vinoba Road "
            "Jayalakshmipuram Mysore MYSORE, Karnataka - 570012"
        ),
        "billing_address": STANDARD_BILLING_ADDRESS,
        "is_interstate": True
    },
    "TW07": {
        "sequence": 106,
        "po_number": "PO-PENDING",
        "site_name": "Reliance Retail Limited (PRESTIGE- COMMERCIAL STREET)",
        "state": "KARNATAKA",
        "gstin": "29AABCR1718E1ZL",
        "shipping_address": (
            "PRESTIGE- COMMERCIAL STREET, Commercial Street, BANGALORE, Karnataka - 560001"
        ),
        "billing_address": STANDARD_BILLING_ADDRESS,
        "is_interstate": True
    }
}

def parse_items():
    lines = [l.strip() for l in RAW_DATA.strip().split("\n") if l.strip()]
    grouped = {"TUK5": [], "TYAC": [], "TW07": []}
    
    for l in lines:
        parts = l.split("\t")
        sis, art, color, mrp, s36, s37, s38, s39, s40, s41, s42, tot = parts[:12]
        mrp_dec = Decimal(mrp)
        sizes = [
            (36, int(s36)), (37, int(s37)), (38, int(s38)),
            (39, int(s39)), (40, int(s40)), (41, int(s41)), (42, int(s42))
        ]
        unit_rate = (mrp_dec * Decimal("0.5624")).quantize(Decimal("0.01"))
        
        for sz, q in sizes:
            if q > 0:
                tx = (Decimal(q) * unit_rate).quantize(Decimal("0.01"))
                ig = (tx * Decimal("0.05")).quantize(Decimal("0.01"))
                tot_amt = tx + ig
                sku = f"{art}-{color}-{sz}".upper().replace(" ", "")
                name = f"{art} {color} {sz}".upper()
                grouped[sis].append({
                    "sku": sku,
                    "name": name,
                    "article": art,
                    "color": color,
                    "size": sz,
                    "qty": q,
                    "mrp": mrp_dec,
                    "disc_pct": Decimal("43.7600"),
                    "rate": unit_rate,
                    "taxable_value": tx,
                    "gst_rate": Decimal("5.00"),
                    "igst_amount": ig,
                    "total_amount": tot_amt,
                    "hsn_code": "64041990"
                })
    return grouped

def create_and_persist_invoices():
    grouped_items = parse_items()
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    
    # 1. Clean existing records if any
    inv_nos = [f"TT2026-2027/{cfg['sequence']}" for cfg in SIS_CONFIG.values()]
    cur.execute("""
        DELETE FROM sales_invoice_items 
        WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE invoice_no = ANY(%s));
    """, (inv_nos,))
    cur.execute("DELETE FROM sales_invoices WHERE invoice_no = ANY(%s);", (inv_nos,))
    cur.execute("SELECT setval(pg_get_serial_sequence('sales_invoice_items', 'id'), COALESCE((SELECT MAX(id) FROM sales_invoice_items), 0) + 1, false);")
    conn.commit()
    print(f"Cleaned any existing records for {inv_nos} and synchronized sales_invoice_items sequence.")

    created_invoices = []

    for sis in ["TUK5", "TYAC", "TW07"]:
        cfg = SIS_CONFIG[sis]
        items = grouped_items[sis]
        inv_no = f"TT2026-2027/{cfg['sequence']}"
        inv_id = f"inv-tt-{cfg['sequence']}"
        inv_uuid = str(uuid.uuid4())
        
        tot_qty = sum(it["qty"] for it in items)
        tot_taxable = sum(it["taxable_value"] for it in items)
        tot_igst = (tot_taxable * Decimal("0.05")).quantize(Decimal("0.01"))
        pre_round = tot_taxable + tot_igst
        grand_total = Decimal(round(pre_round))
        round_adj = (grand_total - pre_round).quantize(Decimal("0.0001"))
        amount_words = number_to_indian_words(float(grand_total))
        inv_date = datetime.date(2026, 8, 14)

        # Ensure products exist
        for it in items:
            prod_id = f"prod-{it['sku'].lower()}"
            cur.execute("""
                INSERT INTO products (
                    id, uuid, code, barcode, name, sku, category, color, size, mrp, price, cost_price, stock, reserved_stock,
                    hsn_code, gst_percentage, is_active, is_deleted, company_id, branch_id, created_at, modified_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, 'Footwear', %s, %s, %s, %s, %s, 1000, 0,
                    '64041990', 5.00, true, false, 'COMP-001', 'MAIN', NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET 
                    mrp = EXCLUDED.mrp,
                    price = EXCLUDED.price,
                    is_active = true,
                    is_deleted = false;
            """, (
                prod_id, str(uuid.uuid4()), it['sku'], f"BAR-{it['sku']}", it['name'], it['sku'],
                it['color'], str(it['size']), it['mrp'], it['rate'], it['rate']
            ))

        # Insert sales_invoices
        cur.execute("""
            INSERT INTO sales_invoices (
                id, uuid, company_id, branch_id, invoice_no, date, customer_id,
                tax_total, grand_total, is_interstate, eway_bill_no, payment_mode,
                status, is_active, is_deleted, created_at, modified_at, version,
                source_type, sis_code, pos_state, reverse_charge, is_reverse_charge,
                po_reference, customer_name, customer_gstin, billing_address,
                shipping_address, site_name, taxable_value, rounding_amount,
                amount_in_words, bank_name, account_no, ifsc_code, e_invoice_status
            )
            VALUES (
                %s, %s, 'COMP-001', 'MAIN', %s, %s, 'cust-rrl-192b561d',
                %s, %s, %s, NULL, 'BANK_TRANSFER',
                'COMPLETED', true, false, NOW(), NOW(), 1,
                'LIVE', %s, %s, false, false,
                %s, 'Reliance Retail Limited', %s, %s,
                %s, %s, %s, %s,
                %s, 'STATE BANK OF INDIA', '43976711765', 'SBIN0030425', 'NOT_APPLICABLE'
            );
        """, (
            inv_id, inv_uuid, inv_no, inv_date,
            tot_igst, grand_total, cfg["is_interstate"],
            sis, cfg["state"],
            cfg["po_number"], cfg["gstin"], cfg["billing_address"],
            cfg["shipping_address"], cfg["site_name"], tot_taxable, round_adj,
            amount_words
        ))

        # Insert sales_invoice_items
        for idx, it in enumerate(items, start=1):
            prod_id = f"prod-{it['sku'].lower()}"
            cur.execute("""
                INSERT INTO sales_invoice_items (
                    invoice_id, product_id, code, name, quantity, price,
                    hsn_code, gst_rate, tax_amount, total_amount, mrp, disc_pct, taxable_value
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, 5.00, %s, %s, %s, %s, %s
                );
            """, (
                inv_id, prod_id, it['sku'], it['name'], it['qty'], it['rate'],
                it['hsn_code'], it['igst_amount'], it['total_amount'],
                it['mrp'], it['disc_pct'], it['taxable_value']
            ))

        conn.commit()
        print(f"✓ Inserted invoice {inv_no} (SIS: {sis}, Lines: {len(items)}, Pairs: {tot_qty}, Total: Rs. {grand_total:,.2f})")
        created_invoices.append({
            "id": inv_id,
            "invoice_no": inv_no,
            "sis": sis,
            "pairs": tot_qty,
            "grand_total": grand_total
        })

    conn.close()
    return created_invoices

async def render_pdfs():
    out_dir = r"exports\tt_batch_104_106"
    final_dir = r"exports\Final_TaxInvoice"
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(final_dir, exist_ok=True)

    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sales_invoices'
        ORDER BY ordinal_position;
    """)
    cols = [r[0] for r in cur.fetchall()]

    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sales_invoice_items'
        ORDER BY ordinal_position;
    """)
    item_cols = [r[0] for r in cur.fetchall()]

    class DummyItem:
        def __init__(self, d):
            for k, v in d.items():
                setattr(self, k, v)

    class DummyInvoice:
        def __init__(self, d, items_list):
            for k, v in d.items():
                setattr(self, k, v)
            self.items = [DummyItem(it) for it in items_list]

    inv_records = []
    for seq in [104, 105, 106]:
        inv_no = f"TT2026-2027/{seq}"
        cur.execute("SELECT * FROM sales_invoices WHERE invoice_no = %s;", (inv_no,))
        inv_row = cur.fetchone()
        inv_dict = dict(zip(cols, inv_row))
        
        cur.execute("SELECT * FROM sales_invoice_items WHERE invoice_id = %s ORDER BY id;", (inv_dict['id'],))
        item_rows = cur.fetchall()
        items = [dict(zip(item_cols, r)) for r in item_rows]
        inv_records.append((inv_dict, items))

    conn.close()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        for inv_dict, items in inv_records:
            inv_obj = DummyInvoice(inv_dict, items)
            html = InvoicePdfService.generate_invoice_html_from_model(inv_obj)
            await page.set_content(html, wait_until="networkidle")

            sis = inv_dict['sis_code']
            seq = inv_dict['invoice_no'].split("/")[-1]
            
            p1 = os.path.join(out_dir, f"SIS_{sis}_TaxInvoice_TT2026-2027_{seq}.pdf")
            p2 = os.path.join(final_dir, f"{sis}_TT2026-2027_{seq}.pdf")

            for pdf_path in [p1, p2]:
                await page.pdf(
                    path=pdf_path,
                    format="A4",
                    print_background=True,
                    margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
                )
                print(f"Generated PDF: {pdf_path} (Size: {os.path.getsize(pdf_path)} bytes)")

            # Verify with PdfReader
            reader = PdfReader(p1)
            text_p1 = reader.pages[0].extract_text()
            print(f"  --> {inv_dict['invoice_no']}: Total Pages = {len(reader.pages)}")
            assert inv_dict['invoice_no'] in text_p1, f"Invoice number {inv_dict['invoice_no']} not found in PDF"
            assert "64041990" in text_p1, "HSN code not found in PDF"

        await browser.close()

def main():
    create_and_persist_invoices()
    asyncio.run(render_pdfs())
    print("\n[SUCCESS] Invoices 104, 105, 106 created, persisted, and verified in smriti001 database and PDF exports.")

if __name__ == "__main__":
    main()
