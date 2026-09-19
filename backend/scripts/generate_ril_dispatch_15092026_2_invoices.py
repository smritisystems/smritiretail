"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.24.0
Created      : 2026-09-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Dispatch Invoice Engine (Sheet 15-09-2026-1: 16 Reliance Retail Store Invoices)
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
SOURCE_EXCEL = r"F:\Smriti-Clients Data\15-09-2026\RIL_Dispatch15092026-2.xlsx"
INV2_DIR = r"F:\Smriti-Clients Data\15-09-2026\inv2"
FINAL_DIR = os.path.join(INV2_DIR, "Final_Invoices")
STORE_PO_INV_DIR = os.path.join(INV2_DIR, "Invoices_Store_PO_Invoice")
MIRROR_EWAY_DIR = r"F:\Smriti-Clients Data\Eway\Final_15092026_Batch2"
PDF_OUT_DIR = os.path.join(FINAL_DIR, "Tax_Invoice_PDFs")
EWAY_JSON_DIR = os.path.join(FINAL_DIR, "Eway_JSON")

for d in [INV2_DIR, FINAL_DIR, STORE_PO_INV_DIR, MIRROR_EWAY_DIR, PDF_OUT_DIR, EWAY_JSON_DIR]:
    os.makedirs(d, exist_ok=True)

# --------------------------------------------------------------------------
# Store Master Profiles & PO Mappings (16 Stores in Sheet 15-09-2026-1)
# --------------------------------------------------------------------------
STORES_ORDER = [
    'T25I', 'T38X', 'T40K', 'T51H', 'T91M', 'T97D', 'T9SQ', 'TC64',
    'TDL9', 'TDM4', 'TGX1', 'TGX9', 'TKF4', 'TKG3', 'TKU6', 'TVP2'
]

STORE_METADATA = {
    "T25I": {
        "po_number": "5182778161",
        "po_date": "31.07.2026",
        "site_code": "T25I",
        "site_name": "RRL FIF Chennai Express Avenue",
        "state": "TAMIL NADU",
        "state_code": 33,
        "gstin": "33AABCR1718E1ZW",
        "pincode": 600014,
        "city": "Chennai",
        "distance_km": 1100,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF Chennai Express Avenue)\n"
            "Express Avenue Mall, Shop No S-202, 2nd Floor, Whites Road, Royapettah, Chennai, Tamil Nadu - 600014"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "No. 1, Haddows Road, 1st Street, Nungambakkam, Chennai, Tamil Nadu - 600006"
        )
    },
    "T38X": {
        "po_number": "5182778162",
        "po_date": "31.07.2026",
        "site_code": "T38X",
        "site_name": "RRL FIF Sarjapur Road Bangalor",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 560035,
        "city": "Bangalore",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF Sarjapur Road Bangalor)\n"
            "Sarjapur Road, Kaikondrahalli, Varthur Hobli, Bangalore, Karnataka - 560035"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "T40K": {
        "po_number": "5182778163",
        "po_date": "31.07.2026",
        "site_code": "T40K",
        "site_name": "RRL FIF Hessargatta Bangalore",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 560073,
        "city": "Bangalore",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF Hessargatta Bangalore)\n"
            "Hessargatta Main Road, T. Dasarahalli, Bangalore, Karnataka - 560073"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "T51H": {
        "po_number": "5182778165",
        "po_date": "31.07.2026",
        "site_code": "T51H",
        "site_name": "RRL TFW Bangalore KR Puram",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 560016,
        "city": "Bangalore",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TFW Bangalore KR Puram)\n"
            "GF Unit No C2/3, Sy No 12, Tambu Chetty Palya Main Road, Anandapur, KR Puram, Bangalore, Karnataka - 560016"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "T91M": {
        "po_number": "5182778170",
        "po_date": "31.07.2026",
        "site_code": "T91M",
        "site_name": "RRL SIS BENGALURU KORAMANGALA",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 560085,
        "city": "Bangalore",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL SIS BENGALURU KORAMANGALA)\n"
            "Zed One Bearing No 6/A, Next Sapna Book House, Koramangala 7th Block, Bangalore, Karnataka - 560085"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "T97D": {
        "po_number": "5182778169",
        "po_date": "31.07.2026",
        "site_code": "T97D",
        "site_name": "RRL SIS Ramagundam",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 505209,
        "city": "Peddapalli",
        "distance_km": 400,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL SIS Ramagundam)\n"
            "H No 5-6-114/115/116/117, Sy No 259/A & 261, Krishna Nagar, Rajeev High Way, Ramagundam Town, Peddapalli, Telangana - 505209"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Reliance Retail Limited, 3rd Floor, Court Compound, Near SBH,\n"
            "Station Road, Nalgonda, Telangana - 508001"
        )
    },
    "T9SQ": {
        "po_number": "5182778171",
        "po_date": "31.07.2026",
        "site_code": "T9SQ",
        "site_name": "RRL SIS Hyderabad",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 500090,
        "city": "Hyderabad",
        "distance_km": 500,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL SIS Hyderabad)\n"
            "Plot No 1 & 2, Sy Nos 7, 8, 11, 13/A, Part of Bachupalli & Mandal Medchal, Malkajgiri, Hyderabad, Telangana - 500090"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Reliance Retail Limited, 3rd Floor, Court Compound, Near SBH,\n"
            "Station Road, Nalgonda, Telangana - 508001"
        )
    },
    "TC64": {
        "po_number": "5182778176",
        "po_date": "31.07.2026",
        "site_code": "TC64",
        "site_name": "RRL Footprint Bearys CCM Shimoga",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 577201,
        "city": "Shivamogga",
        "distance_km": 1050,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL Footprint Bearys CCM Shimoga)\n"
            "Bearys City Center Mall, 1st Floor, Shop No F-03 & F-02-B, Shivamogga, Karnataka - 577201"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "TDL9": {
        "po_number": "5182778180",
        "po_date": "31.07.2026",
        "site_code": "TDL9",
        "site_name": "RRL FP FIF Kukatpally Telangana",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 500072,
        "city": "Hyderabad",
        "distance_km": 500,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FP FIF Kukatpally Telangana)\n"
            "DAR Estates, Plot No 14, Sy No 166, Beside South India Shopping Mall, Kukatpally, Hyderabad, Telangana - 500072"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Reliance Retail Limited, 3rd Floor, Court Compound, Near SBH,\n"
            "Station Road, Nalgonda, Telangana - 508001"
        )
    },
    "TDM4": {
        "po_number": "5182778181",
        "po_date": "31.07.2026",
        "site_code": "TDM4",
        "site_name": "RRL FP FIF Saroornagar Village",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 500035,
        "city": "Hyderabad",
        "distance_km": 500,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FP FIF Saroornagar Village)\n"
            "Municipal No 11-9-133, Opp Bharat Petroleum, Saroornagar Village, LB Nagar, Hyderabad, Telangana - 500035"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Reliance Retail Limited, 3rd Floor, Court Compound, Near SBH,\n"
            "Station Road, Nalgonda, Telangana - 508001"
        )
    },
    "TGX1": {
        "po_number": "5182778183",
        "po_date": "31.07.2026",
        "site_code": "TGX1",
        "site_name": "RRL FIF Sangareddy",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 502032,
        "city": "Sangareddy",
        "distance_km": 500,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF Sangareddy)\n"
            "Asian Vaishnavi Mall, Survey No 106, Ramachandrapuram Village & Mandal, Medak Dist, Sangareddy, Telangana - 502032"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Reliance Retail Limited, 3rd Floor, Court Compound, Near SBH,\n"
            "Station Road, Nalgonda, Telangana - 508001"
        )
    },
    "TGX9": {
        "po_number": "5182778184",
        "po_date": "31.07.2026",
        "site_code": "TGX9",
        "site_name": "RRL FIF Miyapur Hyderabad",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 500049,
        "city": "Hyderabad",
        "distance_km": 500,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF Miyapur Hyderabad)\n"
            "Sy No 44/1, Miyapur Village, Serilingampally, Rangareddy Dist, Hyderabad, Telangana - 500049"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Reliance Retail Limited, 3rd Floor, Court Compound, Near SBH,\n"
            "Station Road, Nalgonda, Telangana - 508001"
        )
    },
    "TKF4": {
        "po_number": "5182778186",
        "po_date": "31.07.2026",
        "site_code": "TKF4",
        "site_name": "RRL FIF BLR Orion OMR",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 560049,
        "city": "Bangalore",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF BLR Orion OMR)\n"
            "Orion OMR, Brigade Golden Triangle, No 55, Huskur Village, Bidarahalli Hobli, Bangalore East, Karnataka - 560049"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "TKG3": {
        "po_number": "5182778187",
        "po_date": "31.07.2026",
        "site_code": "TKG3",
        "site_name": "RRL FIF Banashankari Bangal",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 560085,
        "city": "Bangalore",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF Banashankari Bangal)\n"
            "Building No 92/10, Next to Big Bazaar, Katriguppe Main Road, Banashankari, Bangalore, Karnataka - 560085"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "TKU6": {
        "po_number": "5182778191",
        "po_date": "31.07.2026",
        "site_code": "TKU6",
        "site_name": "RRL FIF Guduvancherry Chenn",
        "state": "TAMIL NADU",
        "state_code": 33,
        "gstin": "33AABCR1718E1ZW",
        "pincode": 603202,
        "city": "Chennai",
        "distance_km": 1100,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF Guduvancherry Chenn)\n"
            "GST Road, Guduvancherry, Chennai, Tamil Nadu - 603202"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "No. 1, Haddows Road, 1st Street, Nungambakkam, Chennai, Tamil Nadu - 600006"
        )
    },
    "TVP2": {
        "po_number": "5182778201",
        "po_date": "31.07.2026",
        "site_code": "TVP2",
        "site_name": "RRL TF Hassan",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 573201,
        "city": "Hassan",
        "distance_km": 1050,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TF Hassan)\n"
            "Ground Floor, Salagame Road, Next To Sai Mandir, Hassan, Karnataka - 573201"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
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
    print("SMRITI RETAIL OS: GENERATING 16 GST TAX INVOICES FOR RELIANCE RETAIL (BATCH 2)")
    print("Source Sheet: '15-09-2026-1' in RIL_Dispatch15092026-2.xlsx")
    print("Date: 05-09-2026 (2026-09-05) | Invoices: TT2026-2027/215 through TT2026-2027/230")
    print("=" * 90)

    # 1. Load Excel Sheet '15-09-2026-1'
    wb_source = openpyxl.load_workbook(SOURCE_EXCEL, data_only=True)
    ws_source = wb_source["15-09-2026-1"]
    
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

    STARTING_INV_NUM = 215

    for idx, store_code in enumerate(STORES_ORDER):
        inv_num = STARTING_INV_NUM + idx
        inv_no = f"TT2026-2027/{inv_num}"
        inv_id = f"inv-dispatch-15092026-2-{store_code.lower()}"
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
            "source_sheet": "15-09-2026-1",
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
                'RIL_DISPATCH_XLSX_2', %s, 'DISPATCH_20260915_STORES_V2', NOW(),
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

        print(f"  [DB CREATED] {inv_no} -> Store: {store_code} ({orig_site_name}) | Pairs: {tot_qty} | MRP: Rs. {tot_mrp:,.2f} | Net: Rs. {grand_total:,.2f} | EWB: {ewb_no}")

    conn.close()

    # 2. Render Statutory PDF Invoices via Playwright
    print("\n--- Rendering 16 Statutory GST Tax Invoice PDFs via Playwright ---")
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
            
            p1 = os.path.join(PDF_OUT_DIR, pdf_filename)
            try:
                with open(p1, "wb") as f:
                    f.write(pdf_bytes)
            except PermissionError:
                p1_alt = p1.replace(".pdf", "_Clean.pdf")
                with open(p1_alt, "wb") as f:
                    f.write(pdf_bytes)
                print(f"  [PDF LOCKED] {pdf_filename} locked. Saved clean copy to: {os.path.basename(p1_alt)}")

            p2 = os.path.join(STORE_PO_INV_DIR, pdf_filename)
            try:
                with open(p2, "wb") as f:
                    f.write(pdf_bytes)
            except PermissionError:
                p2_alt = p2.replace(".pdf", "_Clean.pdf")
                with open(p2_alt, "wb") as f:
                    f.write(pdf_bytes)
                print(f"  [PDF LOCKED] Mirror {pdf_filename} locked. Saved clean copy to: {os.path.basename(p2_alt)}")

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
        indiv_json = os.path.join(EWAY_JSON_DIR, f"{clean_no}_Eway.json")
        mirror_indiv = os.path.join(MIRROR_EWAY_DIR, f"{clean_no}_Eway.json")
        payload = {"version": "1.0.1118", "billLists": [bill]}
        with open(indiv_json, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        with open(mirror_indiv, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        print(f"  [E-WAY JSON] Saved: {indiv_json}")

    bulk_json_1 = os.path.join(FINAL_DIR, "EWayBill_Bulk_Upload_15092026_Batch2.json")
    bulk_json_2 = os.path.join(MIRROR_EWAY_DIR, "EWayBill_Bulk_Upload_15092026_Batch2.json")
    bulk_payload = {"version": "1.0.1118", "billLists": bulk_bills}
    with open(bulk_json_1, "w", encoding="utf-8") as f:
        json.dump(bulk_payload, f, indent=2)
    with open(bulk_json_2, "w", encoding="utf-8") as f:
        json.dump(bulk_payload, f, indent=2)
    print(f"SUCCESS: Saved Bulk Upload E-Way JSON: {bulk_json_1}")

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
        "", "TOTAL", "", "", "16 STORES", "", "", "", "",
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

    summary_excel_path = os.path.join(FINAL_DIR, "Tax_Invoice_Summary_15-09-2026_Batch2.xlsx")
    try:
        summary_wb.save(summary_excel_path)
        print(f"SUCCESS: Saved Client Summary Excel: {summary_excel_path}")
    except PermissionError:
        summary_alt = os.path.join(FINAL_DIR, "Tax_Invoice_Summary_15-09-2026_Batch2_Clean.xlsx")
        summary_wb.save(summary_alt)
        print(f"WARNING: File locked. Saved clean copy to: {summary_alt}")

    # 5. Update Source Excel Workbook Columns M, N, O, P in RIL_Dispatch15092026-2.xlsx
    print("\n--- Updating Column M (Invoice details), N (Date), O (PO), P (Dispatch From) in RIL_Dispatch15092026-2.xlsx ---")
    wb_update = openpyxl.load_workbook(SOURCE_EXCEL)
    
    col_m = 13
    col_n = 14
    col_o = 15
    col_p = 16
    green_fill = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")

    # A) Update sheet '15-09-2026-1' with Batch 2 Invoices (TT2026-2027/215 to 230)
    ws_up2 = wb_update["15-09-2026-1"]
    ws_up2.cell(1, col_m, "Invoice details").font = Font(name="Segoe UI", size=10, bold=True)
    ws_up2.cell(1, col_n, "Invoice Date").font = Font(name="Segoe UI", size=10, bold=True)
    ws_up2.cell(1, col_o, "PO Number").font = Font(name="Segoe UI", size=10, bold=True)
    ws_up2.cell(1, col_p, "Dispatch From").font = Font(name="Segoe UI", size=10, bold=True)

    for rec in invoice_records:
        sc = rec["store_code"]
        inv_no_fmt = f"Tax_Invoice_{rec['invoice_no'].replace('/', '_')}"
        rows = store_row_indices[sc]
        for r in rows:
            c_m = ws_up2.cell(r, col_m, inv_no_fmt)
            c_n = ws_up2.cell(r, col_n, "05-09-2026")
            c_o = ws_up2.cell(r, col_o, rec["po_number"])
            c_p = ws_up2.cell(r, col_p, "Tattly Threads Nagpur Depot")

            c_m.fill = green_fill
            c_n.fill = green_fill
            c_o.fill = green_fill
            c_p.fill = green_fill

    # B) Also update sheet '15-09-2026' with Batch 1 Invoices (TT2026-2027/198 to 214) if not already populated
    if "15-09-2026" in wb_update.sheetnames:
        ws_up1 = wb_update["15-09-2026"]
        if ws_up1.cell(1, col_m).value is None or str(ws_up1.cell(1, col_m).value).strip() == '':
            ws_up1.cell(1, col_m, "Invoice details").font = Font(name="Segoe UI", size=10, bold=True)
            ws_up1.cell(1, col_n, "Invoice Date").font = Font(name="Segoe UI", size=10, bold=True)
            ws_up1.cell(1, col_o, "PO Number").font = Font(name="Segoe UI", size=10, bold=True)
            ws_up1.cell(1, col_p, "Dispatch From").font = Font(name="Segoe UI", size=10, bold=True)

            batch1_stores_order = [
                '1977', '8319', '8361', 'T1BJ', 'T72W', 'T7FN', 'TAGH', 'TDL2', 
                'TDL3', 'TFW4', 'TJI4', 'TKI6', 'TKU5', 'TMN2', 'TUA7', 'TVT0', 'TY06'
            ]
            batch1_pos = {
                '1977': '5182778153', '8319': '5182778158', '8361': '5182778156', 'T1BJ': '5182778160',
                'T72W': '5182778166', 'T7FN': '5182778167', 'TAGH': '5182778174', 'TDL2': '5182778177',
                'TDL3': '5182778178', 'TFW4': '5182778182', 'TJI4': '5182778185', 'TKI6': '5182778188',
                'TKU5': '5182778190', 'TMN2': '5182778192', 'TUA7': '5182778196', 'TVT0': '5182778202',
                'TY06': '5182778208'
            }
            store_col_idx = 1
            for r in range(2, ws_up1.max_row + 1):
                st_val = str(ws_up1.cell(r, store_col_idx).value or '').strip()
                if st_val in batch1_stores_order:
                    b1_idx = batch1_stores_order.index(st_val)
                    b1_inv_num = 198 + b1_idx
                    b1_inv_str = f"Tax_Invoice_TT2026-2027_{b1_inv_num}"
                    b1_po = batch1_pos.get(st_val, "")
                    
                    c_m = ws_up1.cell(r, col_m, b1_inv_str)
                    c_n = ws_up1.cell(r, col_n, "05-09-2026")
                    c_o = ws_up1.cell(r, col_o, b1_po)
                    c_p = ws_up1.cell(r, col_p, "Tattly Threads Nagpur Depot")

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

    # Also save copy to Final_Invoices
    copy_path = os.path.join(FINAL_DIR, "RIL_Dispatch15092026-2_Invoiced.xlsx")
    wb_update.save(copy_path)
    print(f"SUCCESS: Preserved copy saved to: {copy_path}")

    print("\n" + "=" * 90)
    print("BATCH 2 PIPELINE COMPLETED SUCCESSFULLY!")
    print(f"Total Invoices Generated : 16 ({[r['invoice_no'] for r in invoice_records]})")
    print(f"Total Pairs Dispatched   : {tot_pairs_all}")
    print(f"Total Gross MRP          : Rs. {tot_mrp_all:,.2f}")
    print(f"Total Taxable Value      : Rs. {tot_taxable_all:,.2f}")
    print(f"Total IGST (5% Interstate): Rs. {tot_igst_all:,.2f}")
    print(f"Total Net Invoiced Value : Rs. {tot_grand_all:,.2f}")
    print(f"PDF Output Directory     : {PDF_OUT_DIR}")
    print(f"E-Way JSON Directory     : {EWAY_JSON_DIR}")
    print(f"Summary Excel Matrix     : {summary_excel_path}")
    print(f"Invoiced Dispatch Excel  : {copy_path}")
    print("=" * 90)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
