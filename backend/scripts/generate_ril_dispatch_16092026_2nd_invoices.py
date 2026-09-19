"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.26.0
Created      : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Dispatch Invoice Engine (Sheet 16-09-26(2): 5 Reliance Retail Store Invoices - Allof2nd)
"""

import asyncio
import json
import os
import re
import shutil
import sys
from decimal import Decimal
from pathlib import Path
from datetime import date, datetime, timezone, timedelta

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
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

from app.services.invoice_pdf_service import InvoicePdfService, number_to_indian_words
from playwright.async_api import async_playwright

# --------------------------------------------------------------------------
# Paths and Configuration
# --------------------------------------------------------------------------
SOURCE_EXCEL = r"F:\Smriti-Clients Data\16-09-2026\RIL_Dispatch1_16092026_Allof2nd.xlsx"
SOURCE_SHEET = "16-09-26(2)"

BASE_DIR = r"F:\Smriti-Clients Data\16-09-2026"
FINAL_DIR = os.path.join(BASE_DIR, "Final_Invoices")
FINAL_2ND_DIR = os.path.join(BASE_DIR, "Final_Invoices_2nd")
STORE_PO_INV_DIR = os.path.join(BASE_DIR, "Invoices_Store_PO_Invoice")
STORE_PO_INV_2ND_DIR = os.path.join(BASE_DIR, "Invoices_Store_PO_Invoice_2nd")

MIRROR_EWAY_DIR = r"F:\Smriti-Clients Data\Eway\Final_16092026_Batch2"
MIRROR_EWAY_DIR_2 = r"F:\Smriti-Clients Data\Eway\Final_16092026_2nd"

PDF_OUT_DIR = os.path.join(FINAL_DIR, "Tax_Invoice_PDFs")
PDF_OUT_2ND_DIR = os.path.join(FINAL_2ND_DIR, "Tax_Invoice_PDFs")
EWAY_JSON_DIR = os.path.join(FINAL_DIR, "Eway_JSON")
EWAY_JSON_2ND_DIR = os.path.join(FINAL_2ND_DIR, "Eway_JSON")

for d in [
    FINAL_DIR, FINAL_2ND_DIR, STORE_PO_INV_DIR, STORE_PO_INV_2ND_DIR,
    MIRROR_EWAY_DIR, MIRROR_EWAY_DIR_2, PDF_OUT_DIR, PDF_OUT_2ND_DIR,
    EWAY_JSON_DIR, EWAY_JSON_2ND_DIR
]:
    os.makedirs(d, exist_ok=True)

# --------------------------------------------------------------------------
# Store Master Profiles & PO Mappings (5 Stores in sheet 16-09-26(2))
# --------------------------------------------------------------------------
STORES_ORDER = ['TXAJ', 'TW07', 'TW97', 'TXSR', 'TXSU']

STORE_METADATA = {
    "TXAJ": {
        "po_number": "5182778205",
        "po_date": "31.07.2026",
        "site_code": "TXAJ",
        "site_name": "RRL TRENDS FOOTWEAR PALAVAKKAM",
        "state": "TAMIL NADU",
        "state_code": 33,
        "gstin": "33AABCR1718E1ZW",
        "pincode": 600041,
        "city": "Chennai",
        "distance_km": 1340,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TRENDS FOOTWEAR PALAVAKKAM)\n"
            "Block 4 Right Side No 4/222 East Coast Road Palavakkam, Palavakkam, CHENNAI - 600041"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Block 4 Right Side No 4/222 East Coast Road Palavakkam, Palavakkam, CHENNAI - 600041"
        )
    },
    "TW07": {
        "po_number": "5182778158",
        "po_date": "31.07.2026",
        "site_code": "TW07",
        "site_name": "RRL FOOTPRINT Tumkur NDC",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 572101,
        "city": "Tumkur",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FOOTPRINT Tumkur NDC)\n"
            "Survey No 54 1 Nandihalli Village, 55th KM Stone NH 4 Tumkur Road, Oorukere Post Tumkur 572101 KARNATAKA"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka"
        )
    },
    "TW97": {
        "po_number": "5182778204",
        "po_date": "31.07.2026",
        "site_code": "TW97",
        "site_name": "AS RAO NAGAR",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 500062,
        "city": "Hyderabad",
        "distance_km": 720,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (AS RAO NAGAR)\n"
            "Plot No13 & 14 SyNo466 ECIL, Kapra Municipality DrAS Rao Ngr, Medchal-Malkajgiri Dist, HYDERABAD - 500062"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Plot No13 & 14 SyNo466 ECIL, Kapra Municipality DrAS Rao Ngr, Medchal-Malkajgiri Dist, HYDERABAD - 500062"
        )
    },
    "TXSR": {
        "po_number": "5182778206",
        "po_date": "31.07.2026",
        "site_code": "TXSR",
        "site_name": "RRL FIF HYDERABAD SU",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 500030,
        "city": "Hyderabad",
        "distance_km": 720,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF HYDERABAD SU)\n"
            "Plot Nos 59606364 Covered By Survey No 2, Gandipet Mandal, Situate In Gandhamguda Village, HYDERABAD - 500030"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Plot Nos 59606364 Covered By Survey No 2, Gandipet Mandal, Situate In Gandhamguda Village, HYDERABAD - 500030"
        )
    },
    "TXSU": {
        "po_number": "5182778207",
        "po_date": "31.07.2026",
        "site_code": "TXSU",
        "site_name": "RRL FIF BANGALORE KR",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 560036,
        "city": "Bangalore",
        "distance_km": 980,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF BANGALORE KR)\n"
            "Sy No 44/1 Khatha No 1378, Nh48, K R Puram, BANGALORE - 560036"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Sy No 44/1 Khatha No 1378, Nh48, K R Puram, BANGALORE - 560036"
        )
    }
}

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
    print("SMRITI RETAIL OS: GENERATING 5 GST TAX INVOICES FOR RELIANCE RETAIL (16-09-2026 2ND DISPATCH)")
    print(f"Source Sheet: '{SOURCE_SHEET}' in {SOURCE_EXCEL}")
    print("Date: 05-09-2026 (2026-09-05) | Invoices: TT2026-2027/250 through TT2026-2027/254")
    print("=" * 90)

    # 1. Load Excel Sheet '16-09-26(2)'
    wb_source = openpyxl.load_workbook(SOURCE_EXCEL, data_only=True)
    ws_source = wb_source[SOURCE_SHEET]
    
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

    STARTING_INV_NUM = 250

    for idx, store_code in enumerate(STORES_ORDER):
        inv_num = STARTING_INV_NUM + idx
        inv_no = f"TT2026-2027/{inv_num}"
        inv_id = f"inv-dispatch-16092026-2nd-{store_code.lower()}"
        ewb_no = None

        meta = STORE_METADATA[store_code]
        po_num = meta["po_number"]
        po_date = meta["po_date"]
        orig_site_name = meta["site_name"]
        is_interstate = meta["is_interstate"]
        pos_state = meta["state"]
        pos_state_code = meta["state_code"]
        customer_gstin = meta["gstin"]
        pincode = meta["pincode"]
        city = meta["city"]
        distance_km = meta["distance_km"]
        billing_addr = meta["billing_address"]
        shipping_addr = meta["shipping_address"]

        # Clean existing records if re-running
        cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s", (inv_id,))
        cur.execute("DELETE FROM eway_bills WHERE invoice_id = %s OR document_no = %s", (inv_id, inv_no))
        cur.execute("DELETE FROM sales_invoices WHERE id = %s OR invoice_no = %s", (inv_id, inv_no))

        unpivoted_items = []
        tot_qty = 0
        tot_taxable = Decimal("0.00")
        tot_igst = Decimal("0.00")
        tot_cgst = Decimal("0.00")
        tot_sgst = Decimal("0.00")
        tot_mrp = Decimal("0.00")
        row_indices = []

        line_no = 1
        for r in range(2, ws_source.max_row + 1):
            st = str(ws_source.cell(r, col_map['STORE NAME']).value or '').strip()
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
                        if is_interstate:
                            igst = round(taxable * Decimal("0.05"), 2)
                            cgst = Decimal("0.00")
                            sgst = Decimal("0.00")
                            tax_amount = igst
                        else:
                            igst = Decimal("0.00")
                            cgst = round(taxable * Decimal("0.025"), 2)
                            sgst = round(taxable * Decimal("0.025"), 2)
                            tax_amount = cgst + sgst
                        tot_amt = taxable + tax_amount

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
                            "tax_amount": tax_amount,
                            "cgst_amount": cgst,
                            "sgst_amount": sgst,
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
                        tot_cgst += cgst
                        tot_sgst += sgst
                        tot_mrp += Decimal(str(qty)) * mrp
                        line_no += 1

        store_row_indices[store_code] = row_indices
        tot_tax = tot_igst + tot_cgst + tot_sgst
        grand_total = round(tot_taxable + tot_tax, 0)
        round_adj = grand_total - (tot_taxable + tot_tax)
        words = number_to_indian_words(float(grand_total))

        # Build snapshots
        rule_snapshot = {
            "grouping": "STORE_NAME",
            "tax_rate": "5.00",
            "discount_pct": "43.76",
            "po_reference": po_num,
            "po_date": po_date,
            "pricing_formula": "unit_rate = round(mrp * 0.5624, 2)",
            "store_code": store_code,
            "original_store_name": orig_site_name,
            "source_sheet": SOURCE_SHEET,
            "delivery_address_type": "INDIVIDUAL_STORE_DISPATCH"
        }

        delivery_snapshot = {
            "gstin": customer_gstin,
            "sis_code": store_code,
            "store_code": store_code,
            "po_reference": po_num,
            "site_code": meta["site_code"],
            "site_name": orig_site_name,
            "state_name": pos_state,
            "state_code": str(pos_state_code),
            "city": city,
            "pincode": pincode,
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
                eway_bill_no, created_at, modified_at, is_active, is_deleted, version
            ) VALUES (
                %s, gen_random_uuid(), 'COMP-001', 'MAIN', %s, '2026-09-05',
                'cust-rrl-192b561d', 'Reliance Retail Limited', %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, 'STATE BANK OF INDIA',
                '43976711765', 'SBIN0030425', 'CREDIT', 'POSTED', 'HISTORICAL_IMPORT',
                'RIL_DISPATCH_16092026_ALLOF2ND', %s, 'DISPATCH_20260916_ALLOF2ND_STORES', NOW(),
                'VALIDATED', %s, %s,
                %s, %s, %s,
                %s, 'wh-ngp-001',
                %s, %s, %s,
                %s, NOW(), NOW(), True, False, 1
            )
        """, (
            inv_id, inv_no, customer_gstin, customer_gstin,
            billing_addr, shipping_addr, f"{orig_site_name} ({store_code})", pos_state,
            str(pos_state_code), is_interstate, tot_taxable, tot_tax,
            grand_total, round_adj, words,
            SOURCE_EXCEL,
            f"Store {store_code} ({orig_site_name}) dispatched under PO {po_num}",
            store_code, meta["site_code"], store_code, po_num,
            po_num, json.dumps(DISPATCH_FROM_SNAPSHOT), json.dumps(delivery_snapshot), json.dumps(rule_snapshot),
            ewb_no
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

        # Calculate validity based on distance (200 km/day)
        valid_days = max(2, int(distance_km / 200) + 1)
        valid_from = datetime(2026, 9, 5, 10, 0, 0, tzinfo=timezone.utc)
        valid_until = valid_from + timedelta(days=valid_days)

        # Insert canonical EWayBill record in eway_bills
        ewb_id = f"EWB-2609-{store_code}-{inv_num}"

        nic_payload_snap = {
            "version": "1.0.1118",
            "userGstin": "27AAXFT2508H1ZR",
            "supplyType": "O",
            "subSupplyType": 1,
            "subSupplyDesc": "Supply",
            "docType": "INV",
            "docNo": inv_no,
            "docDate": "05/09/2026",
            "transType": 4 if is_interstate else 1,
            "fromGstin": "27AAXFT2508H1ZR",
            "fromTrdName": "TATTLY THREADS",
            "fromStateCode": 27,
            "fromAddr1": "Om Sai Nagar, Kalamana",
            "fromAddr2": "Tattly Threads Nagpur Depot",
            "fromPlace": "Nagpur",
            "fromPincode": 440029,
            "actualFromStateCode": 27,
            "actFromStateCode": 27,
            "toGstin": customer_gstin,
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": clean_addr(shipping_addr[:60]),
            "toAddr2": clean_addr(shipping_addr[60:120]),
            "toPlace": city,
            "toPincode": pincode,
            "toStateCode": pos_state_code,
            "actualToStateCode": pos_state_code,
            "actToStateCode": pos_state_code,
            "totalValue": float(tot_taxable),
            "cgstValue": float(tot_cgst),
            "sgstValue": float(tot_sgst),
            "igstValue": float(tot_igst),
            "cessValue": 0.0,
            "TotNonAdvolVal": 0.0,
            "OthValue": float(round_adj),
            "totInvValue": float(grand_total),
            "transMode": 1,
            "transDistance": distance_km,
            "mainHsnCode": "64041990",
        }
        nic_response_snap = {
            "status": "PENDING_UPLOAD",
            "eway_bill_no": None,
            "status_code": "PENDING"
        }

        cur.execute("""
            INSERT INTO eway_bills (
                id, uuid, company_id, branch_id, eway_bill_no, invoice_id,
                document_type, document_id, document_no, document_date,
                supply_type, sub_supply_type, sub_supply_desc, trans_type,
                gstin_from, trade_name_from, state_code_from,
                dispatch_from_gstin, dispatch_from_trade_name, dispatch_from_place,
                dispatch_from_pincode, dispatch_from_state_code, dispatch_from_addr1, dispatch_from_addr2,
                gstin_to, trade_name_to, state_code_to,
                ship_to_gstin, ship_to_trade_name, ship_to_place, ship_to_pincode,
                ship_to_state_code, ship_to_addr1, ship_to_addr2,
                total_taxable_amount, cgst_amount, sgst_amount, igst_amount, cess_amount,
                other_amount, consignment_value, document_value, main_hsn_code,
                distance_km, transport_mode, vehicle_type, part_b_status,
                ewb_date, valid_from, valid_until, status,
                nic_payload_snapshot, nic_response_snapshot,
                created_at, modified_at, is_active, is_deleted, version
            ) VALUES (
                %s, gen_random_uuid(), 'COMP-001', 'MAIN', %s, %s,
                'INVOICE', %s, %s, '2026-09-05',
                'O', 1, 'Supply', %s,
                '27AAXFT2508H1ZR', 'TATTLY THREADS', 27,
                '27AAXFT2508H1ZR', 'Tattly Threads (Nagpur Depot)', 'Nagpur',
                '440029', 27, 'Om Sai Nagar, Kalamana', 'Tattly Threads Nagpur Depot',
                %s, 'RELIANCE RETAIL LIMITED', %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, 0.00,
                %s, %s, %s, '64041990',
                %s, '1', 'R', 'PENDING',
                %s, %s, %s, 'PENDING_UPLOAD',
                %s, %s,
                NOW(), NOW(), True, False, 1
            )
        """, (
            ewb_id, ewb_no, inv_id,
            inv_id, inv_no,
            4 if is_interstate else 1,
            customer_gstin, pos_state_code,
            customer_gstin, clean_addr(f"Reliance Retail Limited ({orig_site_name})"), city, str(pincode),
            pos_state_code, clean_addr(shipping_addr[:60]), clean_addr(shipping_addr[60:120]),
            tot_taxable, tot_cgst, tot_sgst, tot_igst,
            round_adj, grand_total, grand_total,
            distance_km,
            valid_from, valid_from, valid_until,
            json.dumps(nic_payload_snap), json.dumps(nic_response_snap)
        ))

        conn.commit()

        invoice_records.append({
            "store_code": store_code,
            "original_site_name": orig_site_name,
            "invoice_no": inv_no,
            "invoice_id": inv_id,
            "ewb_no": "",
            "po_number": po_num,
            "po_date": po_date,
            "invoice_date": "05-09-2026",
            "excel_rows": len(row_indices),
            "unpivoted_items_count": len(unpivoted_items),
            "pairs": tot_qty,
            "gross_mrp": float(tot_mrp),
            "taxable_value": float(tot_taxable),
            "igst_amount": float(tot_igst),
            "cgst_amount": float(tot_cgst),
            "sgst_amount": float(tot_sgst),
            "tax_total": float(tot_tax),
            "grand_total": float(grand_total),
            "round_adj": float(round_adj),
            "is_interstate": is_interstate,
            "pos_state": pos_state,
            "pos_state_code": pos_state_code,
            "customer_gstin": customer_gstin,
            "billing_address": billing_addr,
            "shipping_address": shipping_addr,
            "pincode": pincode,
            "city": city,
            "distance_km": distance_km,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "items": unpivoted_items,
            "words": words
        })

        print(f"  [DB CREATED] {inv_no} -> Store: {store_code:5s} ({orig_site_name}) | Pairs: {tot_qty:2d} | MRP: Rs. {tot_mrp:9,.2f} | Net: Rs. {grand_total:9,.2f}")

    conn.close()

    # 2. Render Statutory PDF Invoices via Playwright
    print("\n--- Rendering 5 Statutory GST Tax Invoice PDFs via Playwright ---")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        for rec in invoice_records:
            inv_items_mock = [
                InvoiceItemMock(
                    line_no=it["line_no"],
                    code=it["code"],
                    name=it["name"],
                    qty=it["quantity"],
                    price=it["price"],
                    mrp=it["mrp"],
                    disc_pct=it["disc_pct"],
                    taxable_value=it["taxable_value"],
                    hsn_code=it["hsn_code"],
                    gst_rate=it["gst_rate"],
                    tax_amount=it["tax_amount"],
                    cgst_amount=it["cgst_amount"],
                    sgst_amount=it["sgst_amount"],
                    igst_amount=it["igst_amount"],
                    total_amount=it["total_amount"],
                )
                for it in rec["items"]
            ]

            inv_mock = InvoiceMock(
                id=rec["invoice_id"],
                invoice_no=rec["invoice_no"],
                date=date(2026, 9, 5),
                sis_code=rec["store_code"],
                pos_state=rec["pos_state"],
                po_reference=rec["po_number"],
                eway_bill_no="",
                customer_name="Reliance Retail Limited",
                customer_gstin=rec["customer_gstin"],
                site_name=f"{rec['original_site_name']} ({rec['store_code']})",
                billing_address=rec["billing_address"],
                shipping_address=rec["shipping_address"],
                taxable_value=Decimal(str(rec["taxable_value"])),
                tax_total=Decimal(str(rec["tax_total"])),
                grand_total=Decimal(str(rec["grand_total"])),
                is_interstate=rec["is_interstate"],
                bank_name="STATE BANK OF INDIA",
                account_no="43976711765",
                ifsc_code="SBIN0030425",
                bank_branch="SME BRANCH, NAGPUR",
                items=inv_items_mock,
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
                    "delivery_site_code": rec["store_code"],
                    "po_date": rec["po_date"],
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
            
            dest_paths = [
                os.path.join(PDF_OUT_DIR, pdf_filename),
                os.path.join(PDF_OUT_2ND_DIR, pdf_filename),
                os.path.join(STORE_PO_INV_DIR, pdf_filename),
                os.path.join(STORE_PO_INV_2ND_DIR, pdf_filename)
            ]

            for p_out in dest_paths:
                try:
                    with open(p_out, "wb") as f:
                        f.write(pdf_bytes)
                except PermissionError:
                    p_alt = p_out.replace(".pdf", "_Clean.pdf")
                    with open(p_alt, "wb") as f:
                        f.write(pdf_bytes)
                    print(f"  [PDF LOCKED] Saved clean copy to: {os.path.basename(p_alt)}")

            print(f"  [PDF GENERATED] {pdf_filename} -> {len(pdf_bytes):,} bytes")

        await browser.close()

    # 3. Generate NIC-Compliant E-Way Bill JSON Payloads
    print("\n--- Generating NIC-Compliant E-Way Bill JSON Payloads ---")
    bulk_bills = []
    for rec in invoice_records:
        inv_no = rec["invoice_no"]
        is_interstate = rec["is_interstate"]
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
                "sgstRate": 0.0 if is_interstate else 2.5,
                "cgstRate": 0.0 if is_interstate else 2.5,
                "igstRate": 5.0 if is_interstate else 0.0,
                "cessRate": 0.0,
                "cessNonAdvol": 0.0
            })

        bill = {
            "userGstin": "27AAXFT2508H1ZR",
            "supplyType": "O",
            "subSupplyType": 1,
            "subSupplyDesc": "Supply",
            "docType": "INV",
            "docNo": inv_no,
            "docDate": "05/09/2026",
            "transType": 4 if is_interstate else 1,
            "fromGstin": "27AAXFT2508H1ZR",
            "fromTrdName": "TATTLY THREADS",
            "fromStateCode": 27,
            "fromAddr1": "Om Sai Nagar, Kalamana",
            "fromAddr2": "Tattly Threads Nagpur Depot",
            "fromPlace": "Nagpur",
            "fromPincode": 440029,
            "actualFromStateCode": 27,
            "actFromStateCode": 27,
            "toGstin": rec["customer_gstin"],
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": clean_addr(rec["shipping_address"][:60], 120),
            "toAddr2": clean_addr(rec["shipping_address"][60:120], 120),
            "toPlace": rec["city"],
            "toPincode": rec["pincode"],
            "toStateCode": int(rec["pos_state_code"]),
            "actualToStateCode": int(rec["pos_state_code"]),
            "actToStateCode": int(rec["pos_state_code"]),
            "totalValue": rec['taxable_value'],
            "cgstValue": rec['cgst_amount'],
            "sgstValue": rec['sgst_amount'],
            "igstValue": rec['igst_amount'],
            "cessValue": 0.0,
            "TotNonAdvolVal": 0.0,
            "OthValue": rec['round_adj'],
            "totInvValue": rec['grand_total'],
            "transMode": 1,
            "transDistance": rec["distance_km"],
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
        json_paths = [
            os.path.join(EWAY_JSON_DIR, f"{clean_no}_Eway.json"),
            os.path.join(EWAY_JSON_2ND_DIR, f"{clean_no}_Eway.json"),
            os.path.join(MIRROR_EWAY_DIR, f"{clean_no}_Eway.json"),
            os.path.join(MIRROR_EWAY_DIR_2, f"{clean_no}_Eway.json")
        ]
        payload = {"version": "1.0.1118", "billLists": [bill]}
        for jp in json_paths:
            with open(jp, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        print(f"  [E-WAY JSON] Saved: {json_paths[0]}")

    bulk_json_paths = [
        os.path.join(FINAL_DIR, "EWayBill_Bulk_Upload_16092026_2nd.json"),
        os.path.join(FINAL_2ND_DIR, "EWayBill_Bulk_Upload_16092026_2nd.json"),
        os.path.join(MIRROR_EWAY_DIR, "EWayBill_Bulk_Upload_16092026_2nd.json"),
        os.path.join(MIRROR_EWAY_DIR_2, "EWayBill_Bulk_Upload_16092026_2nd.json")
    ]
    bulk_payload = {"version": "1.0.1118", "billLists": bulk_bills}
    for bjp in bulk_json_paths:
        with open(bjp, "w", encoding="utf-8") as f:
            json.dump(bulk_payload, f, indent=2)
    print(f"SUCCESS: Saved Bulk Upload E-Way JSON: {bulk_json_paths[0]}")

    # 4. Create Detailed Excel Summary Matrix
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
        "Dispatch From", "Destination State", "E-Way Bill No", "Pairs", "Gross MRP (₹)",
        "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Round Adj (₹)", "Grand Total (₹)"
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
    tot_cgst_all = 0.0
    tot_sgst_all = 0.0
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
            rec["pos_state"],
            rec["ewb_no"],
            rec["pairs"],
            rec["gross_mrp"],
            rec["taxable_value"],
            rec["cgst_amount"],
            rec["sgst_amount"],
            rec["igst_amount"],
            rec["round_adj"],
            rec["grand_total"]
        ]
        ws_sum.append(row_data)
        r_num = idx + 1
        for c in range(1, len(row_data) + 1):
            cell = ws_sum.cell(row=r_num, column=c)
            cell.border = thin_border
            if c in [1, 3, 4, 6, 7, 8, 9]:
                cell.alignment = center_align
            elif c in [10, 11, 12, 13, 14, 15, 16, 17]:
                cell.alignment = right_align
                if c > 10:
                    cell.number_format = "#,##0.00"

        tot_pairs_all += rec["pairs"]
        tot_mrp_all += rec["gross_mrp"]
        tot_taxable_all += rec["taxable_value"]
        tot_cgst_all += rec["cgst_amount"]
        tot_sgst_all += rec["sgst_amount"]
        tot_igst_all += rec["igst_amount"]
        tot_grand_all += rec["grand_total"]

    # Summary Row
    sum_row = [
        "", "TOTAL", "", "", "5 STORES", "", "", "", "",
        tot_pairs_all, tot_mrp_all, tot_taxable_all, tot_cgst_all, tot_sgst_all, tot_igst_all, "", tot_grand_all
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
        if c in [10, 11, 12, 13, 14, 15, 17]:
            cell.alignment = right_align
            if c > 10:
                cell.number_format = "#,##0.00"
        else:
            cell.alignment = center_align

    # Sheet 2: All Items Consolidated
    ws_items = summary_wb.create_sheet(title="All_Items_Consolidated")
    ws_items.views.sheetView[0].showGridLines = True
    item_headers = [
        "Invoice No", "Date", "Store Code", "Store Name", "PO Number",
        "Line No", "Item Code", "Article", "Color", "Size", "HSN Code",
        "MRP (₹)", "Disc %", "Unit Rate (₹)", "Quantity (PRS)",
        "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Amount (₹)"
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
                float(it["cgst_amount"]),
                float(it["sgst_amount"]),
                float(it["igst_amount"]),
                float(it["total_amount"])
            ]
            ws_items.append(row_v)
            for c in range(1, len(row_v) + 1):
                cell = ws_items.cell(row=cur_item_r, column=c)
                cell.border = thin_border
                if c in [1, 2, 3, 5, 6, 10, 11]:
                    cell.alignment = center_align
                elif c in [12, 13, 14, 15, 16, 17, 18, 19, 20]:
                    cell.alignment = right_align
                    if c in [12, 14, 16, 17, 18, 19, 20]:
                        cell.number_format = "#,##0.00"
            cur_item_r += 1

    # Auto-adjust column widths
    for ws in [ws_sum, ws_items]:
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    summary_excel_paths = [
        os.path.join(FINAL_DIR, "Tax_Invoice_Summary_16-09-2026_2nd.xlsx"),
        os.path.join(FINAL_2ND_DIR, "Tax_Invoice_Summary_16-09-2026_2nd.xlsx")
    ]
    for sp in summary_excel_paths:
        try:
            summary_wb.save(sp)
            print(f"SUCCESS: Saved Client Summary Excel: {sp}")
        except PermissionError:
            summary_alt = sp.replace(".xlsx", "_Clean.xlsx")
            summary_wb.save(summary_alt)
            print(f"WARNING: File locked. Saved clean copy to: {summary_alt}")

    # 5. Update Source Excel Workbook Columns M, N, O, P in Sheet 16-09-26(2)
    print("\n--- Updating Column M (Invoice details), N (Date), O (PO), P (Dispatch From) ---")
    wb_update = openpyxl.load_workbook(SOURCE_EXCEL)
    
    col_m = 13
    col_n = 14
    col_o = 15
    col_p = 16
    green_fill = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")

    ws_up = wb_update[SOURCE_SHEET]
    ws_up.cell(1, col_m, "Invoice details").font = Font(name="Segoe UI", size=10, bold=True)
    ws_up.cell(1, col_n, "Invoice Date").font = Font(name="Segoe UI", size=10, bold=True)
    ws_up.cell(1, col_o, "PO Number").font = Font(name="Segoe UI", size=10, bold=True)
    ws_up.cell(1, col_p, "Dispatch From").font = Font(name="Segoe UI", size=10, bold=True)

    for rec in invoice_records:
        sc = rec["store_code"]
        inv_no_fmt = f"Tax_Invoice_{rec['invoice_no'].replace('/', '_')}"
        rows = store_row_indices[sc]
        for r in rows:
            c_m = ws_up.cell(r, col_m, inv_no_fmt)
            c_n = ws_up.cell(r, col_n, "05-09-2026")
            c_o = ws_up.cell(r, col_o, rec["po_number"])
            c_p = ws_up.cell(r, col_p, "Tattly Threads Nagpur Depot")

            c_m.fill = green_fill
            c_n.fill = green_fill
            c_o.fill = green_fill
            c_p.fill = green_fill

    try:
        wb_update.save(SOURCE_EXCEL)
        print(f"SUCCESS: Updated source Excel in place: {SOURCE_EXCEL}")
    except PermissionError:
        alt_save = SOURCE_EXCEL.replace(".xlsx", "_Updated.xlsx")
        wb_update.save(alt_save)
        print(f"WARNING: File locked by user. Saved updated file to: {alt_save}")

    # Also save copy to Final_Invoices and Final_Invoices_2nd
    copy_paths = [
        os.path.join(FINAL_DIR, "RIL_Dispatch1_16092026_Allof2nd_Invoiced.xlsx"),
        os.path.join(FINAL_2ND_DIR, "RIL_Dispatch1_16092026_Allof2nd_Invoiced.xlsx")
    ]
    for cp in copy_paths:
        wb_update.save(cp)
        print(f"SUCCESS: Preserved copy saved to: {cp}")

    print("\n" + "=" * 90)
    print("16-09-2026 2ND DISPATCH PIPELINE COMPLETED SUCCESSFULLY!")
    print(f"Total Invoices Generated : 5 ({[r['invoice_no'] for r in invoice_records]})")
    print(f"Total Pairs Dispatched   : {tot_pairs_all}")
    print(f"Total Gross MRP          : Rs. {tot_mrp_all:,.2f}")
    print(f"Total Taxable Value      : Rs. {tot_taxable_all:,.2f}")
    print(f"Total IGST (5% Interstate): Rs. {tot_igst_all:,.2f}")
    print(f"Total Net Invoiced Value : Rs. {tot_grand_all:,.2f}")
    print(f"PDF Output Directory     : {PDF_OUT_DIR}")
    print(f"E-Way JSON Directory     : {EWAY_JSON_DIR}")
    print(f"Summary Excel Matrix     : {summary_excel_paths[0]}")
    print(f"Invoiced Dispatch Excel  : {copy_paths[0]}")
    print("=" * 90)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
