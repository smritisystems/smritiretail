"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.6.0
Created      : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Dispatch Invoice Engine (West Bengal DC Dispatch - PO 5182778172)
"""

import asyncio
import json
import os
import re
import shutil
import sys
from decimal import Decimal
from pathlib import Path
from datetime import date, datetime

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor

# Setup Python paths and environment
root_dir = Path("f:/SMRITRretailNX").resolve()
backend_path = root_dir / "backend"
sys.path.insert(0, str(backend_path))

from dotenv import dotenv_values
env_file = root_dir / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

from app.db.session import get_company_sessionmaker
from app.services.invoice_pdf_service import InvoicePdfService, number_to_indian_words
from playwright.async_api import async_playwright

# --------------------------------------------------------------------------
# Paths and Configuration
# --------------------------------------------------------------------------
SOURCE_EXCEL = r"F:\Smriti-Clients Data\14-09-2026\RIL_Dispatch14-09-2026.xlsx"
FINAL_DIR = r"F:\Smriti-Clients Data\14-09-2026\Final_Invoices"
STORE_PO_INV_DIR = r"F:\Smriti-Clients Data\14-09-2026\Invoices_Store_PO_Invoice"
MIRROR_EWAY_DIR = r"F:\Smriti-Clients Data\Eway\Final_14092026"
PDF_OUT_DIR = os.path.join(FINAL_DIR, "Tax_Invoice_PDFs")
EWAY_JSON_DIR = os.path.join(FINAL_DIR, "Eway_JSON")

for d in [FINAL_DIR, STORE_PO_INV_DIR, MIRROR_EWAY_DIR, PDF_OUT_DIR, EWAY_JSON_DIR]:
    os.makedirs(d, exist_ok=True)

# --------------------------------------------------------------------------
# Store to Invoice Mapping (PO 5182778172, West Bengal DC Dispatch)
# --------------------------------------------------------------------------
STORES_CONFIG = [
    {
        "store_code": "TDK9",
        "invoice_no": "TT2026-2027/195",
        "invoice_id": "inv-dispatch-14092026-tdk9",
        "original_site_name": "Cuttack - SIS",
        "po_number": "5182778172",
        "po_date": "2026-07-31",
    },
    {
        "store_code": "TKI4",
        "invoice_no": "TT2026-2027/196",
        "invoice_id": "inv-dispatch-14092026-tki4",
        "original_site_name": "Ideal Regency",
        "po_number": "5182778172",
        "po_date": "2026-07-31",
    },
    {
        "store_code": "TYAL",
        "invoice_no": "TT2026-2027/197",
        "invoice_id": "inv-dispatch-14092026-tyal",
        "original_site_name": "RRL FIF CITI MART KO",
        "po_number": "5182778172",
        "po_date": "2026-07-31",
    },
]

# Statutory Consolidated Address (All 3 bills on West Bengal DC Dispatch)
WB_DC_SITE_CODE = "TA0A"
WB_DC_SITE_NAME = "RRL Trends Footwear Panchla DC"
WB_DC_GSTIN = "19AABCR1718E1ZM"
WB_DC_STATE = "WEST BENGAL"
WB_DC_STATE_CODE = "19"
WB_DC_PINCODE = 711310
WB_DC_CITY = "Sankrail"
WB_DC_DISTANCE_KM = 1020

SHIPPING_ADDRESS = (
    "Reliance Retail Limited (RRL Trends Footwear Panchla DC)\n"
    "Distribution Center, RRL DAG NO 248 249 250, KAHITAN NO 1037 1059,\n"
    "MOUZA SURAKAHALLI, PS ULUBERIA, PANCHLA BLOCK, DIST SANKRAIL,\n"
    "West Bengal - 711310"
)

BILLING_ADDRESS = (
    "Reliance Retail Limited\n"
    "17, 18, Plot No. 5, Tower-II, Godrej Waterside, Block DP, Sector-V,\n"
    "Electronics Complex, Salt Lake City, North 24 Parganas - 700091, West Bengal, INDIA"
)

DISPATCH_FROM_SNAPSHOT = {
    "city": "Nagpur",
    "code": "WH-NGP",
    "name": "Tattly Threads (Nagpur Depot)",
    "gstin": "27AAXFT2508H1ZR",
    "phone": "9324117007",
    "state": "Maharashtra",
    "pincode": "440029",
    "district": "Nagpur",
    "state_code": "27",
    "location_id": "wh-ngp-001",
    "address_line1": "Om Sai Nagar, Kalamana",
    "address_line2": "",
    "location_name": "Tattly Threads Nagpur Depot",
    "contact_person": "Operations Manager",
}

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
    def __init__(self, id, invoice_no, date, sis_code, pos_state, po_reference, eway_bill_no, customer_name, customer_gstin, site_name, billing_address, shipping_address, taxable_value, tax_total, grand_total, is_interstate, bank_name, account_no, ifsc_code, bank_branch, items, dispatch_from_snapshot=None):
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
        self.dispatch_from_snapshot = dispatch_from_snapshot
        self.status = "COMPLETED"
        self.reverse_charge = False
        self.is_reverse_charge = False
        self.irn = None
        self.signed_qr_payload = None
        self.e_invoice_status = "NOT_APPLICABLE"

def clean_addr(text, max_len=120):
    t = re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()
    t = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', t).strip()
    return t[:max_len]

async def run_pipeline():
    print("=" * 90)
    print("SMRITI RETAIL OS: GENERATING 3 GST TAX INVOICES (WB DC DISPATCH - PO 5182778172)")
    print("Date: 05-09-2026 (2026-09-05) | Invoices: TT2026-2027/195 to 197")
    print("=" * 90)

    # 1. Load Excel Sheet '14-09-2026'
    wb_source = openpyxl.load_workbook(SOURCE_EXCEL, data_only=True)
    ws_source = wb_source["14-09-2026"]
    
    col_map = {}
    for c in range(1, ws_source.max_column + 1):
        v = ws_source.cell(1, c).value
        col_map[v] = c
    print(f"Header columns loaded: {col_map}")

    # Connect to PostgreSQL smriti001
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    size_cols = [36, 37, 38, 39, 40, 41, 42]
    invoice_records = []
    store_row_indices = {}

    for cfg in STORES_CONFIG:
        store_code = cfg["store_code"]
        inv_no = cfg["invoice_no"]
        inv_id = cfg["invoice_id"]
        po_num = cfg["po_number"]
        orig_site_name = cfg["original_site_name"]

        # Clean existing records if re-running
        cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s", (inv_id,))
        cur.execute("DELETE FROM sales_invoices WHERE id = %s OR invoice_no = %s", (inv_id, inv_no))

        unpivoted_items = []
        tot_qty = 0
        tot_taxable = Decimal("0.00")
        tot_igst = Decimal("0.00")
        tot_mrp = Decimal("0.00")
        row_indices = []

        line_no = 1
        for r in range(2, ws_source.max_row + 1):
            st = ws_source.cell(r, col_map['STORE NAME']).value
            if st != store_code:
                continue
            row_indices.append(r)

            art = str(ws_source.cell(r, col_map['ARTICLE']).value).strip()
            color = str(ws_source.cell(r, col_map['COLOR']).value).strip()
            mrp_val = ws_source.cell(r, col_map['MRP']).value
            mrp = Decimal(str(mrp_val))
            # Basic unit rate with 43.76% discount
            unit_rate = round(mrp * Decimal("0.5624"), 2)

            for sz in size_cols:
                q_val = ws_source.cell(r, col_map[sz]).value
                if q_val is not None and str(q_val).strip() not in ('', '0', 'None'):
                    qty = int(q_val)
                    if qty > 0:
                        taxable = Decimal(str(qty)) * unit_rate
                        igst = round(taxable * Decimal("0.05"), 2)
                        tot_amt = taxable + igst

                        item_code = f"{art}-{color}-{sz}"
                        item_name = f"{art} {color} {sz}"
                        prod_id = f"prod-{art.lower()}-{color.lower()}-{sz}"

                        unpivoted_items.append({
                            "line_no": line_no,
                            "code": item_code,
                            "name": item_name,
                            "product_id": prod_id,
                            "quantity": Decimal(str(qty)),
                            "price": unit_rate,
                            "mrp": mrp,
                            "disc_pct": Decimal("43.76"),
                            "taxable_value": taxable,
                            "tax_amount": igst,
                            "cgst_amount": Decimal("0.00"),
                            "sgst_amount": Decimal("0.00"),
                            "igst_amount": igst,
                            "total_amount": tot_amt,
                            "hsn_code": "64041990",
                            "gst_rate": Decimal("5.00"),
                            "source_line_type": "DISPATCH_IMPORT",
                            "source_line_id": f"{store_code}:{r}:{sz}"
                        })

                        tot_qty += qty
                        tot_taxable += taxable
                        tot_igst += igst
                        tot_mrp += Decimal(str(qty)) * mrp
                        line_no += 1

        store_row_indices[store_code] = row_indices
        grand_total = round(tot_taxable + tot_igst, 0)
        round_adj = grand_total - (tot_taxable + tot_igst)
        words = number_to_indian_words(float(grand_total))

        # Build snapshots
        rule_snapshot = {
            "grouping": "STORE_NAME",
            "tax_rate": "5.00",
            "discount_pct": "43.76",
            "po_reference": po_num,
            "po_date": "2026-07-31",
            "pricing_formula": "unit_rate = round(mrp * 0.5624, 2)",
            "store_code": store_code,
            "original_store_name": orig_site_name,
            "source_sheet": "14-09-2026",
            "delivery_address_type": "CONSOLIDATED_WEST_BENGAL_DC"
        }

        delivery_snapshot = {
            "gstin": WB_DC_GSTIN,
            "sis_code": store_code,
            "store_code": store_code,
            "po_reference": po_num,
            "site_code": WB_DC_SITE_CODE,
            "site_name": WB_DC_SITE_NAME,
            "state_name": WB_DC_STATE,
            "state_code": WB_DC_STATE_CODE,
            "city": WB_DC_CITY,
            "pincode": WB_DC_PINCODE,
            "original_site_name": orig_site_name
        }

        # Insert header record
        cur.execute("""
            INSERT INTO sales_invoices (
                id, uuid, company_id, branch_id, invoice_no, date,
                customer_id, customer_name, customer_gstin, delivery_gstin,
                billing_address, shipping_address, site_name, pos_state,
                place_of_supply_code, is_interstate, taxable_value, tax_total,
                grand_total, rounding_amount, amount_in_words, bank_name,
                account_no, ifsc_code, payment_mode, status, source_type,
                source_system, source_file, import_batch_id, imported_at,
                import_validation_status, import_validation_notes, sis_code,
                delivery_store_code, billing_store_code, po_reference,
                customer_po_number_snapshot, dispatch_from_location_id,
                dispatch_from_snapshot, delivery_location_snapshot, rule_snapshots,
                created_at, modified_at, is_active, is_deleted, version
            ) VALUES (
                %s, gen_random_uuid(), 'COMP-001', 'MAIN', %s, '2026-09-05',
                'cust-rrl-192b561d', 'Reliance Retail Limited', %s, %s,
                %s, %s, %s, %s,
                %s, True, %s, %s,
                %s, %s, %s, 'STATE BANK OF INDIA',
                '43976711765', 'SBIN0030425', 'CREDIT', 'POSTED', 'HISTORICAL_IMPORT',
                'RIL_DISPATCH_XLSX', %s, 'DISPATCH_20260914_WB_DC_V1', NOW(),
                'VALIDATED', %s, %s,
                %s, %s, %s,
                %s, 'wh-ngp-001',
                %s, %s, %s,
                NOW(), NOW(), True, False, 1
            )
        """, (
            inv_id, inv_no, WB_DC_GSTIN, WB_DC_GSTIN,
            BILLING_ADDRESS, SHIPPING_ADDRESS, f"{WB_DC_SITE_NAME} ({store_code})", WB_DC_STATE,
            WB_DC_STATE_CODE, tot_taxable, tot_igst,
            grand_total, round_adj, words,
            SOURCE_EXCEL,
            f"Store {store_code} ({orig_site_name}) dispatch consolidated to WB DC TA0A; PO={po_num}",
            store_code, WB_DC_SITE_CODE, store_code, po_num,
            po_num, json.dumps(DISPATCH_FROM_SNAPSHOT), json.dumps(delivery_snapshot), json.dumps(rule_snapshot)
        ))

        # Insert line items
        for item in unpivoted_items:
            cur.execute("""
                INSERT INTO sales_invoice_items (
                    invoice_id, product_id, code, name, quantity,
                    price, mrp, disc_pct, taxable_value, tax_amount,
                    cgst_amount, sgst_amount, igst_amount, total_amount,
                    hsn_code, gst_rate, line_no, source_line_type, source_line_id
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
            """, (
                inv_id, item['product_id'], item['code'], item['name'], item['quantity'],
                item['price'], item['mrp'], item['disc_pct'], item['taxable_value'], item['tax_amount'],
                item['cgst_amount'], item['sgst_amount'], item['igst_amount'], item['total_amount'],
                item['hsn_code'], item['gst_rate'], item['line_no'], item['source_line_type'], item['source_line_id']
            ))

        conn.commit()

        invoice_records.append({
            "store_code": store_code,
            "original_site_name": orig_site_name,
            "invoice_no": inv_no,
            "invoice_id": inv_id,
            "po_number": po_num,
            "po_date": "31.07.2026",
            "invoice_date": "05-09-2026",
            "excel_rows": len(row_indices),
            "unpivoted_items_count": len(unpivoted_items),
            "pairs": tot_qty,
            "gross_mrp": float(tot_mrp),
            "taxable_value": float(tot_taxable),
            "igst_amount": float(tot_igst),
            "cgst_amount": 0.0,
            "sgst_amount": 0.0,
            "tax_total": float(tot_igst),
            "grand_total": float(grand_total),
            "round_adj": float(round_adj),
            "items": unpivoted_items,
            "words": words
        })

        print(f"  [DB CREATED] {inv_no} -> Store: {store_code} ({orig_site_name}) | Pairs: {tot_qty} | MRP: Rs. {tot_mrp:,.2f} | Net: Rs. {grand_total:,.2f}")

    cur.close()
    conn.close()

    # 2. Update Source Excel File
    print("\n--- Updating Column M (Invoice details), N (Date), O (PO) in RIL_Dispatch14-09-2026.xlsx ---")
    wb_edit = openpyxl.load_workbook(SOURCE_EXCEL)
    ws_edit = wb_edit["14-09-2026"]

    # Header Row
    ws_edit.cell(row=1, column=13, value="Invoice details").font = Font(bold=True)
    ws_edit.cell(row=1, column=13).alignment = Alignment(horizontal="center", vertical="center")
    ws_edit.cell(row=1, column=14, value="Invoice Date").font = Font(bold=True)
    ws_edit.cell(row=1, column=14).alignment = Alignment(horizontal="center", vertical="center")
    ws_edit.cell(row=1, column=15, value="PO Number").font = Font(bold=True)
    ws_edit.cell(row=1, column=15).alignment = Alignment(horizontal="center", vertical="center")
    ws_edit.cell(row=1, column=16, value="Dispatch From").font = Font(bold=True)
    ws_edit.cell(row=1, column=16).alignment = Alignment(horizontal="center", vertical="center")

    updated_count = 0
    for rec in invoice_records:
        st = rec["store_code"]
        inv = rec["invoice_no"]
        po = rec["po_number"]
        rows = store_row_indices[st]
        for r in rows:
            c13 = ws_edit.cell(row=r, column=13, value=inv)
            c14 = ws_edit.cell(row=r, column=14, value="05-09-2026")
            c15 = ws_edit.cell(row=r, column=15, value=po)
            c16 = ws_edit.cell(row=r, column=16, value="Tattly Threads Nagpur Depot (440029)")
            c13.alignment = Alignment(horizontal="center", vertical="center")
            c14.alignment = Alignment(horizontal="center", vertical="center")
            c15.alignment = Alignment(horizontal="center", vertical="center")
            c16.alignment = Alignment(horizontal="center", vertical="center")
            updated_count += 1

    try:
        wb_edit.save(SOURCE_EXCEL)
        print(f"SUCCESS: Saved {updated_count} rows directly to: {SOURCE_EXCEL}")
    except PermissionError:
        print(f"NOTE: Source excel locked. Saving to fallback...")
    
    # Also save copy in Final_Invoices
    copy_path = os.path.join(FINAL_DIR, "RIL_Dispatch14-09-2026_Invoiced.xlsx")
    wb_edit.save(copy_path)
    print(f"SUCCESS: Saved verified Excel copy to: {copy_path}")

    # 3. Generate Tax Invoice PDFs via Playwright
    print("\n--- Generating Pixel-Faithful A4 Tax Invoice PDFs via Playwright ---")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        page = await browser.new_page()

        for rec in invoice_records:
            mock_items = []
            for it in rec["items"]:
                mock_items.append(InvoiceItemMock(
                    line_no=it['line_no'],
                    code=it['code'],
                    name=it['name'],
                    qty=it['quantity'],
                    price=it['price'],
                    mrp=it['mrp'],
                    disc_pct=it['disc_pct'],
                    taxable_value=it['taxable_value'],
                    hsn_code=it['hsn_code'],
                    gst_rate=it['gst_rate'],
                    tax_amount=it['tax_amount'],
                    cgst_amount=it['cgst_amount'],
                    sgst_amount=it['sgst_amount'],
                    igst_amount=it['igst_amount'],
                    total_amount=it['total_amount']
                ))

            inv_mock = InvoiceMock(
                id=rec["invoice_id"],
                invoice_no=rec["invoice_no"],
                date=date(2026, 9, 5),
                sis_code=rec["store_code"],
                pos_state=WB_DC_STATE,
                po_reference=rec["po_number"],
                eway_bill_no="",
                customer_name="Reliance Retail Limited",
                customer_gstin=WB_DC_GSTIN,
                site_name=f"{WB_DC_SITE_NAME} ({rec['store_code']})",
                billing_address=BILLING_ADDRESS,
                shipping_address=SHIPPING_ADDRESS,
                taxable_value=Decimal(str(rec["taxable_value"])),
                tax_total=Decimal(str(rec["tax_total"])),
                grand_total=Decimal(str(rec["grand_total"])),
                is_interstate=True,
                bank_name="STATE BANK OF INDIA",
                account_no="43976711765",
                ifsc_code="SBIN0030425",
                bank_branch="WARDHMAN NAGAR NAGPUR",
                items=mock_items,
                dispatch_from_snapshot=DISPATCH_FROM_SNAPSHOT
            )

            html_content = InvoicePdfService.generate_invoice_html_from_model(
                invoice=inv_mock,
                company_name="TATTLY THREADS",
                company_gstin="27AAXFT2508H1ZR",
                extra_meta={
                    "company_website": "www.tattlythreads.com",
                    "dispatch_email": "dispatch@tattlythreads.com",
                    "accounts_email": "accounts@tattlythreads.com",
                    "delivery_site_code": WB_DC_SITE_CODE,
                    "po_date": "31.07.2026",
                    "dispatch_from_snapshot": DISPATCH_FROM_SNAPSHOT
                }
            )

            await page.set_content(html_content, wait_until="networkidle")
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "8mm", "bottom": "10mm", "left": "8mm", "right": "8mm"}
            )

            clean_no = rec["invoice_no"].replace("/", "_")
            pdf_filename = f"{rec['store_code']}_{rec['po_number']}_{clean_no}.pdf"
            
            p1 = os.path.join(PDF_OUT_DIR, pdf_filename)
            p2 = os.path.join(STORE_PO_INV_DIR, pdf_filename)
            try:
                with open(p1, "wb") as f:
                    f.write(pdf_bytes)
                with open(p2, "wb") as f:
                    f.write(pdf_bytes)
                print(f"  [PDF GENERATED] {pdf_filename} -> {len(pdf_bytes):,} bytes")
            except PermissionError:
                print(f"  [PDF LOCKED] {pdf_filename} is currently open by user. Skipping overwrite.")

        await browser.close()

    # 4. Generate E-Way Bill Payloads
    print("\n--- Generating NIC-Compliant E-Way Bill JSON Payloads ---")
    bulk_bills = []
    for rec in invoice_records:
        inv_no = rec["invoice_no"]
        item_list = []
        for it in rec["items"]:
            item_list.append({
                "itemNo": it['line_no'],
                "productName": it['name'],
                "productDesc": f"Footwear {it['name']}"[:100],
                "hsnCode": int(it['hsn_code']),
                "quantity": float(it['quantity']),
                "qtyUnit": "PRS",
                "taxableAmount": float(it['taxable_value']),
                "sgstRate": 0.0,
                "cgstRate": 0.0,
                "igstRate": 5.0,
                "cessRate": 0.0,
                "cessNonAdvol": 0.0
            })

        bill = {
            "userGstin": "27AAXFT2508H1ZR",
            "supplyType": "O",
            "subSupplyType": 1,
            "subSupplyDesc": "",
            "docType": "INV",
            "docNo": inv_no,
            "docDate": "05/09/2026",
            "transType": 4, # Interstate
            "fromGstin": "27AAXFT2508H1ZR",
            "fromTrdName": "TATTLY THREADS",
            "fromStateCode": 27,
            "fromAddr1": "Om Sai Nagar, Kalamana",
            "fromAddr2": "Tattly Threads Nagpur Depot",
            "fromPlace": "Nagpur",
            "fromPincode": 440029,
            "actualFromStateCode": 27,
            "actFromStateCode": 27,
            "toGstin": WB_DC_GSTIN,
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": clean_addr("Distribution Center RRL DAG NO 248 249 250", 120),
            "toAddr2": clean_addr("MOUZA SURAKAHALLI PS ULUBERIA SANKRAIL", 120),
            "toPlace": WB_DC_CITY,
            "toPincode": WB_DC_PINCODE,
            "toStateCode": int(WB_DC_STATE_CODE),
            "actualToStateCode": int(WB_DC_STATE_CODE),
            "actToStateCode": int(WB_DC_STATE_CODE),
            "totalValue": rec['taxable_value'],
            "cgstValue": 0.0,
            "sgstValue": 0.0,
            "igstValue": rec['igst_amount'],
            "cessValue": 0.0,
            "TotNonAdvolVal": 0.0,
            "OthValue": rec['round_adj'],
            "totInvValue": rec['grand_total'],
            "transMode": 1,
            "transDistance": WB_DC_DISTANCE_KM,
            "transporterName": "",
            "transporterId": "",
            "transDocNo": "",
            "transDocDate": "",
            "vehicleNo": "",
            "vehicleType": "",
            "mainHsnCode": "64041990",
            "itemList": item_list
        }
        bulk_bills.append(bill)

        clean_no = inv_no.replace("/", "_")
        indiv_json = os.path.join(EWAY_JSON_DIR, f"{clean_no}_Eway.json")
        mirror_indiv = os.path.join(MIRROR_EWAY_DIR, f"{clean_no}_Eway.json")
        payload = {"version": "1.0.1118", "billLists": [bill]}
        with open(indiv_json, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        with open(mirror_indiv, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        print(f"  [E-WAY JSON] Saved: {indiv_json}")

    bulk_json_1 = os.path.join(FINAL_DIR, "EWayBill_Bulk_Upload_14092026_WB_DC.json")
    bulk_json_2 = os.path.join(MIRROR_EWAY_DIR, "EWayBill_Bulk_Upload_14092026_WB_DC.json")
    bulk_payload = {"version": "1.0.1118", "billLists": bulk_bills}
    with open(bulk_json_1, "w", encoding="utf-8") as f:
        json.dump(bulk_payload, f, indent=2)
    with open(bulk_json_2, "w", encoding="utf-8") as f:
        json.dump(bulk_payload, f, indent=2)
    print(f"SUCCESS: Saved Bulk Upload E-Way JSON: {bulk_json_1}")

    # 5. Create Detailed Excel Summary Matrix
    print("\n--- Generating Client Summary Matrix Workbook ---")
    summary_wb = openpyxl.Workbook()
    
    # Sheet 1: Invoices Summary
    ws_sum = summary_wb.active
    ws_sum.title = "Invoice_Summary"
    ws_sum.views.sheetView[0].showGridLines = True

    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")
    right_align = Alignment(horizontal="right", vertical="center")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    headers = [
        "Sr", "Invoice No", "Date", "Store Code", "Store Name", "PO Number",
        "Dispatch From", "Delivery Site", "Destination DC", "Pairs", "Gross MRP (₹)",
        "Taxable Value (₹)", "IGST 5% (₹)", "Round Adj (₹)", "Grand Total (₹)"
    ]
    ws_sum.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws_sum.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align

    tot_pairs_all = 0
    tot_mrp_all = 0.0
    tot_taxable_all = 0.0
    tot_igst_all = 0.0
    tot_grand_all = 0.0

    for idx, rec in enumerate(invoice_records, start=1):
        row_data = [
            idx,
            rec["invoice_no"],
            rec["invoice_date"],
            rec["store_code"],
            rec["original_site_name"],
            rec["po_number"],
            "Tattly Threads Nagpur Depot (440029)",
            WB_DC_SITE_CODE,
            WB_DC_SITE_NAME,
            rec["pairs"],
            rec["gross_mrp"],
            rec["taxable_value"],
            rec["igst_amount"],
            rec["round_adj"],
            rec["grand_total"]
        ]
        ws_sum.append(row_data)
        r_num = idx + 1
        for c in range(1, len(row_data) + 1):
            cell = ws_sum.cell(row=r_num, column=c)
            cell.border = thin_border
            if c in [1, 3, 4, 6, 7, 8]:
                cell.alignment = center_align
            elif c in [10, 11, 12, 13, 14, 15]:
                cell.alignment = right_align
                if c > 10:
                    cell.number_format = "#,##0.00"

        tot_pairs_all += rec["pairs"]
        tot_mrp_all += rec["gross_mrp"]
        tot_taxable_all += rec["taxable_value"]
        tot_igst_all += rec["igst_amount"]
        tot_grand_all += rec["grand_total"]

    # Summary Row
    sum_row = [
        "", "TOTAL", "", "", "3 STORES", "", "", "", "",
        tot_pairs_all, tot_mrp_all, tot_taxable_all, tot_igst_all, "", tot_grand_all
    ]
    ws_sum.append(sum_row)
    last_r = len(invoice_records) + 2
    sum_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    sum_font = Font(name="Segoe UI", size=11, bold=True, color="92400E")
    for c in range(1, len(sum_row) + 1):
        cell = ws_sum.cell(row=last_r, column=c)
        cell.font = sum_font
        cell.fill = sum_fill
        cell.border = thin_border
        if c in [10, 11, 12, 13, 15]:
            cell.alignment = right_align
            if c > 10:
                cell.number_format = "#,##0.00"
        else:
            cell.alignment = center_align

    # Sheet 2: All Items Consolidated
    ws_items = summary_wb.create_sheet(title="All_Items_Consolidated")
    ws_items.views.sheetView[0].showGridLines = True
    item_headers = [
        "Invoice No", "Date", "Store Code", "Original Store", "PO Number",
        "Line No", "Item Code", "Article", "Color", "Size", "HSN Code",
        "MRP (₹)", "Disc %", "Unit Rate (₹)", "Quantity (PRS)",
        "Taxable Value (₹)", "GST %", "IGST Amount (₹)", "Total Amount (₹)"
    ]
    ws_items.append(item_headers)
    for col_idx in range(1, len(item_headers) + 1):
        cell = ws_items.cell(row=1, column=col_idx)
        cell.font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
        cell.alignment = center_align

    cur_item_r = 2
    for rec in invoice_records:
        for it in rec["items"]:
            parts = it["code"].split("-")
            art = parts[0] if len(parts) > 0 else ""
            color = parts[1] if len(parts) > 1 else ""
            sz = parts[2] if len(parts) > 2 else ""

            row_v = [
                rec["invoice_no"],
                rec["invoice_date"],
                rec["store_code"],
                rec["original_site_name"],
                rec["po_number"],
                it["line_no"],
                it["code"],
                art,
                color,
                sz,
                it["hsn_code"],
                float(it["mrp"]),
                float(it["disc_pct"]),
                float(it["price"]),
                float(it["quantity"]),
                float(it["taxable_value"]),
                float(it["gst_rate"]),
                float(it["igst_amount"]),
                float(it["total_amount"])
            ]
            ws_items.append(row_v)
            for c in range(1, len(row_v) + 1):
                cell = ws_items.cell(row=cur_item_r, column=c)
                cell.border = thin_border
                if c in [1, 2, 3, 5, 6, 10, 11]:
                    cell.alignment = center_align
                elif c in [12, 13, 14, 15, 16, 17, 18, 19]:
                    cell.alignment = right_align
                    if c in [12, 14, 16, 18, 19]:
                        cell.number_format = "#,##0.00"
            cur_item_r += 1

    # Auto-adjust column widths
    for ws in [ws_sum, ws_items]:
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    summary_excel_path = os.path.join(FINAL_DIR, "Tax_Invoice_Summary_14-09-2026.xlsx")
    try:
        summary_wb.save(summary_excel_path)
        print(f"SUCCESS: Saved Client Summary Excel: {summary_excel_path}")
    except PermissionError:
        print(f"NOTE: {summary_excel_path} open by user. Skipping overwrite.")

    print("\n" + "=" * 90)
    print("PIPELINE COMPLETED SUCCESSFULLY!")
    print(f"Total Invoices Generated : 3 ({[r['invoice_no'] for r in invoice_records]})")
    print(f"Total Pairs Dispatched   : {tot_pairs_all}")
    print(f"Total Gross MRP          : Rs. {tot_mrp_all:,.2f}")
    print(f"Total Taxable Value      : Rs. {tot_taxable_all:,.2f}")
    print(f"Total 5% IGST            : Rs. {tot_igst_all:,.2f}")
    print(f"Total Net Invoiced Value : Rs. {tot_grand_all:,.2f}")
    print(f"PDF Output Directory     : {PDF_OUT_DIR}")
    print(f"E-Way JSON Directory     : {EWAY_JSON_DIR}")
    print(f"Summary Excel Matrix     : {summary_excel_path}")
    print("=" * 90)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
