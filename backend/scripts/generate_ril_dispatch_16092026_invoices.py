"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.25.0
Created      : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Dispatch Invoice Engine (Sheet 16-09-2026: 19 Reliance Retail Store Invoices)
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
SOURCE_EXCEL = r"F:\Smriti-Clients Data\16-09-2026\RIL_Dispatch1_16092026_All.xlsx"
BASE_DIR = r"F:\Smriti-Clients Data\16-09-2026"
FINAL_DIR = os.path.join(BASE_DIR, "Final_Invoices")
STORE_PO_INV_DIR = os.path.join(BASE_DIR, "Invoices_Store_PO_Invoice")
MIRROR_EWAY_DIR = r"F:\Smriti-Clients Data\Eway\Final_16092026"
PDF_OUT_DIR = os.path.join(FINAL_DIR, "Tax_Invoice_PDFs")
EWAY_JSON_DIR = os.path.join(FINAL_DIR, "Eway_JSON")

for d in [FINAL_DIR, STORE_PO_INV_DIR, MIRROR_EWAY_DIR, PDF_OUT_DIR, EWAY_JSON_DIR]:
    os.makedirs(d, exist_ok=True)

# --------------------------------------------------------------------------
# Store Master Profiles & PO Mappings (19 Stores in RIL_Dispatch1_16092026_All.xlsx)
# --------------------------------------------------------------------------
STORES_ORDER = [
    '1888', '1969', '9556', 'T40R', 'T8IY', 'TAGG', 'TKL0', 'TPV2',
    'TUB7', 'TV81', 'TVU1', 'TUK5', '8155', '8313', 'T0N6', 'TMV9',
    'TV78', 'TVB6', 'TYAC'
]

STORE_METADATA = {
    "1888": {
        "po_number": "5182778151",
        "po_date": "31.07.2026",
        "site_code": "1888",
        "site_name": "RRL FOOTPRINT RKB PATH DIBRUGARH AS",
        "state": "ASSAM",
        "state_code": 18,
        "gstin": "18AABCR1718E1ZO",
        "pincode": 786001,
        "city": "Dibrugarh",
        "distance_km": 1800,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FOOTPRINT RKB PATH DIBRUGARH AS)\n"
            "RRL Footprint RKB Path Dibrugarh Assam Bagra Sadan Near Sadan Thana RKB Path Dibrugarh 786001 DIBRUGARH - ASSAM"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "RRL Footprint RKB Path Dibrugarh Assam Bagra Sadan Near Sadan Thana RKB Path Dibrugarh 786001 DIBRUGARH - ASSAM"
        )
    },
    "1969": {
        "po_number": "5182778152",
        "po_date": "31.07.2026",
        "site_code": "1969",
        "site_name": "RRL FOOTPRINT FORTUNE CENTRAL GUWAH",
        "state": "ASSAM",
        "state_code": 18,
        "gstin": "18AABCR1718E1ZO",
        "pincode": 781007,
        "city": "Guwahati",
        "distance_km": 1700,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FOOTPRINT FORTUNE CENTRAL GUWAH)\n"
            "RRL Footprint Fortune Central Guwaha Reliance Retail Limited GF Unit A Fortune Central Beltola Main Road Near passport office Guwahati, Assam - 781007"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "RRL Footprint Fortune Central Guwaha Reliance Retail Limited GF Unit A Fortune Central Beltola Main Road Near passport office Guwahati, Assam - 781007"
        )
    },
    "9556": {
        "po_number": "5182778157",
        "po_date": "31.07.2026",
        "site_code": "9556",
        "site_name": "RRL FT CITY CENTRE AGARTALA",
        "state": "TRIPURA",
        "state_code": 16,
        "gstin": "16AABCR1718E1ZS",
        "pincode": 799001,
        "city": "Agartala",
        "distance_km": 2000,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FT CITY CENTRE AGARTALA)\n"
            "RRL FT City Centre Agartala Reliance Retail Limited 1000 H.G.B. Road City Centre Ground Floor Agartala - 799001, TRIPURA"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "RRL FT City Centre Agartala Reliance Retail Limited 1000 H.G.B. Road City Centre Ground Floor Agartala - 799001, TRIPURA"
        )
    },
    "T40R": {
        "po_number": "5182778164",
        "po_date": "31.07.2026",
        "site_code": "T40R",
        "site_name": "TILKAMANJI",
        "state": "BIHAR",
        "state_code": 10,
        "gstin": "10AABCR1718E1Z4",
        "pincode": 812001,
        "city": "Bhagalpur",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (TILKAMANJI)\n"
            "Commercial Complex Beside Atithi Tower, Holding No 285 286 Tilakmanjhi Chowk, Khata No 358 428 Khesra No17 18 Kakhaga, BHAGALPUR - 812001, Bihar"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Commercial Complex Beside Atithi Tower, Holding No 285 286 Tilakmanjhi Chowk, Khata No 358 428 Khesra No17 18 Kakhaga, BHAGALPUR - 812001, Bihar"
        )
    },
    "T8IY": {
        "po_number": "5182778168",
        "po_date": "31.07.2026",
        "site_code": "T8IY",
        "site_name": "RIDDHI SIDDHI COMPLEX",
        "state": "JHARKHAND",
        "state_code": 20,
        "gstin": "20AABCR1718E1Z3",
        "pincode": 834001,
        "city": "Ranchi",
        "distance_km": 750,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RIDDHI SIDDHI COMPLEX)\n"
            "Ridhi Sidhi Tower, Un on GF,FF,SF, Mauja 9, Pl 17, & 1715 A,B, Wd 22, Kutchary Road, Chadari, Thana No 199, Thana Kotwali, RANCHI - 834001, Jharkhand"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Ridhi Sidhi Tower, Un on GF,FF,SF, Mauja 9, Pl 17, & 1715 A,B, Wd 22, Kutchary Road, Chadari, Thana No 199, Thana Kotwali, RANCHI - 834001, Jharkhand"
        )
    },
    "TAGG": {
        "po_number": "5182778173",
        "po_date": "31.07.2026",
        "site_code": "TAGG",
        "site_name": "RRL TRENDS FOOTWEAR IMPERIAL HEIGHTS",
        "state": "TRIPURA",
        "state_code": 16,
        "gstin": "16AABCR1718E1ZS",
        "pincode": 799001,
        "city": "Agartala",
        "distance_km": 2000,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TRENDS FOOTWEAR IMPERIAL HEIGHTS)\n"
            "Imperial Heights Nagerjala Bus Stand, Agartala West, West Tripura, AGARTALA - 799001, TRIPURA"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Imperial Heights Nagerjala Bus Stand, Agartala West, West Tripura, AGARTALA - 799001, TRIPURA"
        )
    },
    "TKL0": {
        "po_number": "5182778189",
        "po_date": "31.07.2026",
        "site_code": "TKL0",
        "site_name": "BARRACKPORE",
        "state": "WEST BENGAL",
        "state_code": 19,
        "gstin": "19AABCR1718E1ZM",
        "pincode": 700120,
        "city": "Kolkata",
        "distance_km": 1100,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (BARRACKPORE)\n"
            "18 / 16 Ghoshpara Road, North 24 Parganas, Po Barrackpore, P S Titagarh Barrackpore, KOLKATA - 700120, West Bengal"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "18 / 16 Ghoshpara Road, North 24 Parganas, Po Barrackpore, P S Titagarh Barrackpore, KOLKATA - 700120, West Bengal"
        )
    },
    "TPV2": {
        "po_number": "5182778195",
        "po_date": "31.07.2026",
        "site_code": "TPV2",
        "site_name": "RRL TF SEVOKE ROAD S",
        "state": "WEST BENGAL",
        "state_code": 19,
        "gstin": "19AABCR1718E1ZM",
        "pincode": 734001,
        "city": "Siliguri",
        "distance_km": 1300,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TF SEVOKE ROAD S)\n"
            "MLA House, 2nd Mile Sevoke Road, SILIGURI - 734001, West Bengal"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "MLA House, 2nd Mile Sevoke Road, SILIGURI - 734001, West Bengal"
        )
    },
    "TUB7": {
        "po_number": "5182778197",
        "po_date": "31.07.2026",
        "site_code": "TUB7",
        "site_name": "RRL TF BHATTA BAZAAR",
        "state": "BIHAR",
        "state_code": 10,
        "gstin": "10AABCR1718E1Z4",
        "pincode": 854301,
        "city": "Purnia",
        "distance_km": 1100,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TF BHATTA BAZAAR)\n"
            "Gf&Ff Commercial Complex Mauza Madhubani Ward No 27 Mohalla Bhatta Bazaar Lakhan Chowk, PURNIA - 854301, Bihar"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Gf&Ff Commercial Complex Mauza Madhubani Ward No 27 Mohalla Bhatta Bazaar Lakhan Chowk, PURNIA - 854301, Bihar"
        )
    },
    "TV81": {
        "po_number": "5182778199",
        "po_date": "31.07.2026",
        "site_code": "TV81",
        "site_name": "STAR CITY MALL GUWA",
        "state": "ASSAM",
        "state_code": 18,
        "gstin": "18AABCR1718E1ZO",
        "pincode": 781007,
        "city": "Guwahati",
        "distance_km": 1700,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (STAR CITY MALL GUWA)\n"
            "Star City Mall, Lachit Nagar, G S Rd, GUWAHATI - 781007, Assam"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Star City Mall, Lachit Nagar, G S Rd, GUWAHATI - 781007, Assam"
        )
    },
    "TVU1": {
        "po_number": "5182778203",
        "po_date": "31.07.2026",
        "site_code": "TVU1",
        "site_name": "RRL FIF HAJIPUR",
        "state": "BIHAR",
        "state_code": 10,
        "gstin": "10AABCR1718E1Z4",
        "pincode": 844101,
        "city": "Hajipur",
        "distance_km": 1000,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF HAJIPUR)\n"
            "Cine Krishna Mall Srs Mall, Mohalla Cinema Road Hajipur, Khata No 15 Thana No 165 Khesra No 243, HAJIPUR - 844101, Bihar"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Cine Krishna Mall Srs Mall, Mohalla Cinema Road Hajipur, Khata No 15 Thana No 165 Khesra No 243, HAJIPUR - 844101, Bihar"
        )
    },
    "TUK5": {
        "po_number": "5182778198",
        "po_date": "31.07.2026",
        "site_code": "TUK5",
        "site_name": "RRL TF CMR MALL",
        "state": "ANDHRA PRADESH",
        "state_code": 37,
        "gstin": "37AABCR1718E1ZO",
        "pincode": 530020,
        "city": "Visakhapatnam",
        "distance_km": 850,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TF CMR MALL)\n"
            "Frist floor chinna gantyada Vig & Mandal Nh5 road Gajuwaka Greater Vishakapatnam Municipal Corp, VISAKHAPATNAM - 530020, Andhra Pradesh"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Frist floor chinna gantyada Vig & Mandal Nh5 road Gajuwaka Greater Vishakapatnam Municipal Corp, VISAKHAPATNAM - 530020, Andhra Pradesh"
        )
    },
    "8155": {
        "po_number": "5182778154",
        "po_date": "31.07.2026",
        "site_code": "8155",
        "site_name": "RRL FOOTPRINT  RAMA TALKIES RO",
        "state": "ANDHRA PRADESH",
        "state_code": 37,
        "gstin": "37AABCR1718E1ZO",
        "pincode": 530017,
        "city": "Visakhapatnam",
        "distance_km": 850,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FOOTPRINT  RAMA TALKIES RO)\n"
            "# 48-14-111, OPP KARNATAKA BANK LTD, RAMATALKIES ROAD, VISAKHAPATNAM - 530017, ANDHRA PRADESH"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "# 48-14-111, OPP KARNATAKA BANK LTD, RAMATALKIES ROAD, VISAKHAPATNAM - 530017, ANDHRA PRADESH"
        )
    },
    "8313": {
        "po_number": "5182778155",
        "po_date": "31.07.2026",
        "site_code": "8313",
        "site_name": "RRL FOOTPRINT  B H  ROAD TUMKU",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 572101,
        "city": "Tumkur",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FOOTPRINT  B H  ROAD TUMKU)\n"
            "Deviprasad Central # 17/2/2/13 BH Road, Tumkur - 572101, Karnataka"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "T0N6": {
        "po_number": "5182778159",
        "po_date": "31.07.2026",
        "site_code": "T0N6",
        "site_name": "RRL TFW GUNTUR PHOENIX MALL",
        "state": "ANDHRA PRADESH",
        "state_code": 37,
        "gstin": "37AABCR1718E1ZO",
        "pincode": 522001,
        "city": "Guntur",
        "distance_km": 750,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TFW GUNTUR PHOENIX MALL)\n"
            "FF, D No 25-11-5, Ward No 20, Block No Phoenix Mall, Vanilla Stores No 14,15, TS No 506, Nagarampalem Ward, GT Road, GUNTUR - 522001, Andhra Pradesh"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "FF, D No 25-11-5, Ward No 20, Block No Phoenix Mall, Vanilla Stores No 14,15, TS No 506, Nagarampalem Ward, GT Road, GUNTUR - 522001, Andhra Pradesh"
        )
    },
    "TMV9": {
        "po_number": "5182778193",
        "po_date": "31.07.2026",
        "site_code": "TMV9",
        "site_name": "RRL FIF AMEERPET",
        "state": "TELANGANA",
        "state_code": 36,
        "gstin": "36AABCR1718E1ZQ",
        "pincode": 500036,
        "city": "Hyderabad",
        "distance_km": 500,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL FIF AMEERPET)\n"
            "Reliance Retail Limited, MPM Grand Ameerpet, Hyderabad, Telangana - 500036"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Reliance Retail Limited, 3rd Floor, Court Compound, Near SBH, Station Road, Nalgonda, Telangana - 508001"
        )
    },
    "TV78": {
        "po_number": "5182778210",
        "po_date": "31.07.2026",
        "site_code": "TV78",
        "site_name": "Distribution Center (Tumkur)",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 572101,
        "city": "Tumkur",
        "distance_km": 950,
        "is_interstate": True,
        "shipping_address": (
            "Distribution Center\n"
            "Survey No 54 1 Nandihalli Village, 55th KM Stone NH 4 Tumkur Road, Oordigree Hobli Taluka, TUMKUR, Karnataka - 572101"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "NO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka, INDIA"
        )
    },
    "TVB6": {
        "po_number": "5182778200",
        "po_date": "31.07.2026",
        "site_code": "TVB6",
        "site_name": "RRL TRENDS FOOTWEAR SS MALL & MULTIPLEX",
        "state": "ANDHRA PRADESH",
        "state_code": 37,
        "gstin": "37AABCR1718E1ZO",
        "pincode": 516360,
        "city": "Proddatur",
        "distance_km": 900,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TRENDS FOOTWEAR SS MALL & MULTIPLEX)\n"
            "Shop No 37 38 39 48 49 50 Proddatur Town And Mandal, Ysr Kaddappa District, PRODDATUR - 516360, Andhra Pradesh"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Shop No 37 38 39 48 49 50 Proddatur Town And Mandal, Ysr Kaddappa District, PRODDATUR - 516360, Andhra Pradesh"
        )
    },
    "TYAC": {
        "po_number": "5182778209",
        "po_date": "31.07.2026",
        "site_code": "TYAC",
        "site_name": "RRL TF MB HABITAT MALL",
        "state": "KARNATAKA",
        "state_code": 29,
        "gstin": "29AABCR1718E1ZL",
        "pincode": 570012,
        "city": "Mysore",
        "distance_km": 1050,
        "is_interstate": True,
        "shipping_address": (
            "Reliance Retail Limited (RRL TF MB HABITAT MALL)\n"
            "B M Habitat Mall Shop No F 6 F 7 And F7A No 22/B, Vinoba Road Jayalakshmipuram, MYSORE - 570012, Karnataka"
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
    print("SMRITI RETAIL OS: GENERATING 19 GST TAX INVOICES FOR RELIANCE RETAIL (16-09-2026 DISPATCH)")
    print(f"Source Sheet: 'Sheet1' in {SOURCE_EXCEL}")
    print("Date: 05-09-2026 (2026-09-05) | Invoices: TT2026-2027/231 through TT2026-2027/249")
    print("=" * 90)

    # 1. Load Excel Sheet 'Sheet1'
    wb_source = openpyxl.load_workbook(SOURCE_EXCEL, data_only=True)
    ws_source = wb_source["Sheet1"]
    
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

    STARTING_INV_NUM = 231

    for idx, store_code in enumerate(STORES_ORDER):
        inv_num = STARTING_INV_NUM + idx
        inv_no = f"TT2026-2027/{inv_num}"
        inv_id = f"inv-dispatch-16092026-{store_code.lower()}"
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
            "source_sheet": "Sheet1",
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
                'RIL_DISPATCH_16092026_ALL', %s, 'DISPATCH_20260916_ALL_STORES', NOW(),
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

        print(f"  [DB CREATED] {inv_no} -> Store: {store_code:5s} ({orig_site_name}) | Pairs: {tot_qty:2d} | MRP: Rs. {tot_mrp:9,.2f} | Net: Rs. {grand_total:9,.2f} | EWB: {ewb_no}")

    conn.close()

    # 2. Render Statutory PDF Invoices via Playwright
    print("\n--- Rendering 19 Statutory GST Tax Invoice PDFs via Playwright ---")
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

    bulk_json_1 = os.path.join(FINAL_DIR, "EWayBill_Bulk_Upload_16092026.json")
    bulk_json_2 = os.path.join(MIRROR_EWAY_DIR, "EWayBill_Bulk_Upload_16092026.json")
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
        "", "TOTAL", "", "", "19 STORES", "", "", "", "",
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

    summary_excel_path = os.path.join(FINAL_DIR, "Tax_Invoice_Summary_16-09-2026.xlsx")
    try:
        summary_wb.save(summary_excel_path)
        print(f"SUCCESS: Saved Client Summary Excel: {summary_excel_path}")
    except PermissionError:
        summary_alt = os.path.join(FINAL_DIR, "Tax_Invoice_Summary_16-09-2026_Clean.xlsx")
        summary_wb.save(summary_alt)
        print(f"WARNING: File locked. Saved clean copy to: {summary_alt}")

    # 5. Update Source Excel Workbook Columns M, N, O, P in RIL_Dispatch1_16092026_All.xlsx
    print("\n--- Updating Column M (Invoice details), N (Date), O (PO), P (Dispatch From) ---")
    wb_update = openpyxl.load_workbook(SOURCE_EXCEL)
    
    col_m = 13
    col_n = 14
    col_o = 15
    col_p = 16
    green_fill = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")

    ws_up = wb_update["Sheet1"]
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

    # Also save copy to Final_Invoices
    copy_path = os.path.join(FINAL_DIR, "RIL_Dispatch1_16092026_All_Invoiced.xlsx")
    wb_update.save(copy_path)
    print(f"SUCCESS: Preserved copy saved to: {copy_path}")

    print("\n" + "=" * 90)
    print("16-09-2026 DISPATCH PIPELINE COMPLETED SUCCESSFULLY!")
    print(f"Total Invoices Generated : 19 ({[r['invoice_no'] for r in invoice_records]})")
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
