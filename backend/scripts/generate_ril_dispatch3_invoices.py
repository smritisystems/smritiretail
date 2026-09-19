"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.0
  Created      : 2026-09-09
  Classification: Canonical Dispatch 3 Invoice Generation & Export Engine
"""

import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
from decimal import Decimal
from pathlib import Path
from datetime import date, datetime, timezone

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
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models.sales import SalesInvoice

DISPATCH3_EXCEL = r"F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch3.xlsx"
PO_DETAILS_EXCEL = r"F:\Smriti-Clients Data\08-09-2026\RIL_Extracted_All_PO_Details.xlsx"
OUTPUT_BASE_DIR = r"F:\Smriti-Clients Data\08-09-2026\Final_RIL3"
MIRROR_BASE_DIR = r"F:\Smriti-Clients Data\Eway\Final_RIL3"

STORE_INV_MAP = [
    ('TGX1', 'TT2026-2027/195', '5182778183'),
    ('TGX9', 'TT2026-2027/196', '5182778184'),
    ('TKF4', 'TT2026-2027/197', '5182778186'),
    ('TKG3', 'TT2026-2027/198', '5182778187'),
    ('TJI4', 'TT2026-2027/199', '5182778185'),
    ('TKU5', 'TT2026-2027/200', '5182778190'),
    ('TMN2', 'TT2026-2027/201', '5182778192'),
    ('TUA7', 'TT2026-2027/202', '5182778196'),
]

STORE_METADATA = {
    'TGX1': {
        'site_name': 'RRL FIF Sangareddy',
        'city': 'Sangareddy',
        'pincode': 502032,
        'state': 'TELANGANA',
        'state_code': '36',
        'gstin': '36AABCR1718E1ZQ',
        'is_interstate': True,
        'distance_km': 720,
        'shipping_address': 'Reliance Retail Limited (VAISHNAVI ASIAN MALL)\nAsian Vaishnavi Mall Survey No 106,Ramachandrapuram Village & Mandal Medak,Under S R O Sangareddy,HYDERABAD502032',
        'billing_address': 'Reliance Retail Limited\nAsian Vaishnavi Mall Survey No 106,Ramachandrapuram Village & Mandal Medak,Under S R O Sangareddy,HYDERABAD502032',
    },
    'TGX9': {
        'site_name': 'RRL FIF Miyapur Hyderabad',
        'city': 'Hyderabad',
        'pincode': 500049,
        'state': 'TELANGANA',
        'state_code': '36',
        'gstin': '36AABCR1718E1ZQ',
        'is_interstate': True,
        'distance_km': 720,
        'shipping_address': 'Reliance Retail Limited (MIYAPUR)\nSy No 44 / 1 Miyapur Village,Serilingampally,Rangareddy Dist,HYDERABAD500049',
        'billing_address': 'Reliance Retail Limited\nSy No 44 / 1 Miyapur Village,Serilingampally,Rangareddy Dist,HYDERABAD500049',
    },
    'TKF4': {
        'site_name': 'RRL FIF BLR Orion OMR',
        'city': 'Bangalore',
        'pincode': 560049,
        'state': 'KARNATAKA',
        'state_code': '29',
        'gstin': '29AABCR1718E1ZL',
        'is_interstate': True,
        'distance_km': 980,
        'shipping_address': 'Reliance Retail Limited (BRIGADE UPTOWN MALL)\nOrion OMR  Brigade Golden Temple,Bangalore East,No 55 Huskur Village Bidarahalli Hobli,BANGALORE560049',
        'billing_address': 'Reliance Retail Limited\nOrion OMR  Brigade Golden Temple,Bangalore East,No 55 Huskur Village Bidarahalli Hobli,BANGALORE560049',
    },
    'TKG3': {
        'site_name': 'RRL FIF Banashankari Bangal',
        'city': 'Bangalore',
        'pincode': 560085,
        'state': 'KARNATAKA',
        'state_code': '29',
        'gstin': '29AABCR1718E1ZL',
        'is_interstate': True,
        'distance_km': 980,
        'shipping_address': 'Reliance Retail Limited (BANASHANKARI)\nBuilding No 92/10,Katriguppe Main road Banashankari,Next to Bigbazar,BANGALORE560085',
        'billing_address': 'Reliance Retail Limited\nBuilding No 92/10,Katriguppe Main road Banashankari,Next to Bigbazar,BANGALORE560085',
    },
    'TJI4': {
        'site_name': 'RRL FIF Lucknow Bhoothnath Mar',
        'city': 'Lucknow',
        'pincode': 226016,
        'state': 'UTTAR PRADESH',
        'state_code': '09',
        'gstin': '09AABCR1718E1ZN',
        'is_interstate': True,
        'distance_km': 1380,
        'shipping_address': 'Reliance Retail Limited (BHOOTNATH)\nKhasra No 141,Sheikhpura Faizabad Rd Lucknow,Opp Bhoothnath Market,LUCKNOW226016',
        'billing_address': 'Reliance Retail Limited Khasra No 141,Sheikhpura Faizabad Rd Lucknow,Opp Bhoothnath Market,LUCKNOW226016',
    },
    'TKU5': {
        'site_name': 'RRL FIF Lucknow Raebareilly',
        'city': 'Lucknow',
        'pincode': 226014,
        'state': 'UTTAR PRADESH',
        'state_code': '09',
        'gstin': '09AABCR1718E1ZN',
        'is_interstate': True,
        'distance_km': 1380,
        'shipping_address': 'Reliance Retail Limited (RRL FIF LUCKNOW RAEB)\nKhasara No 1977/2684,Saraswati Puram Raebareilly Road,Sgpgi Raebareilly Road Lucknow,LUCKNOW226014',
        'billing_address': 'Reliance Retail Limited Khasara No 1977/2684,Saraswati Puram Raebareilly Road,Sgpgi Raebareilly Road Lucknow,LUCKNOW226014',
    },
    'TMN2': {
        'site_name': 'RRL TF Erandawane Pune',
        'city': 'Pune',
        'pincode': 411004,
        'state': 'MAHARASHTRA',
        'state_code': '27',
        'gstin': '27AABCR1718E1ZP',
        'is_interstate': False, # Intra-state CGST + SGST
        'distance_km': 450,
        'shipping_address': 'Reliance Retail Limited (RRL TRENDS FOOTWEAR ERANDAWANE PUNE)\nSuma Shilp DTC 93/5 Asurvey NO 8 13/1/2 CTS NO 14091410 Erandawane 411004 PUNE - MAHARASHTRA',
        'billing_address': 'Reliance Retail Limited\nSuma Shilp DTC 93/5 Asurvey NO 8 13/1/2 CTS NO 14091410 Erandawane 411004 PUNE - MAHARASHTRA',
    },
    'TUA7': {
        'site_name': 'RRL TF Star Mall Madhyamgram',
        'city': 'Kolkata',
        'pincode': 700129,
        'state': 'WEST BENGAL',
        'state_code': '19',
        'gstin': '19AABCR1718E1ZM',
        'is_interstate': True,
        'distance_km': 1950,
        'shipping_address': 'Reliance Retail Limited (RRL TF STAR MALL MAD)\nShop no 1S1 1S2 1S3 1st floor Star Mall 74/Mall/1 Jessore Road North Madhyamgram 700129 KOLKATA - West Bengal',
        'billing_address': 'Reliance Retail Limited\nShop no 1S1 1S2 1S3 1st floor Star Mall 74/Mall/1 Jessore Road North Madhyamgram 700129 KOLKATA - West Bengal',
    },
}

DISPATCH_FROM_SNAPSHOT = {
    "city": "Nagpur",
    "code": "WH-NGP",
    "name": "Tattly Threads",
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
    "contact_person": "Operations Manager"
}

def clean_addr(text, max_len=120):
    t = re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()
    t = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', t).strip()
    return t[:max_len]

async def process_pipeline():
    print("=" * 80)
    print("SMRITI RETAIL OS: RIL_Dispatch3 -> INVOICES TT195-TT202 GENERATION PIPELINE")
    print("=" * 80)

    # 1. Read RIL_Dispatch3.xlsx
    df_raw = pd.read_excel(DISPATCH3_EXCEL, sheet_name="08-09-2026")
    col_n = df_raw.columns[13] # Cartoon number
    col_inv = df_raw.columns[14] # Invoice details

    # Filter out rows where Column N is '*'
    df_clean = df_raw[df_raw[col_n].astype(str).str.strip() != '*'].copy()
    print(f"Total rows in sheet: {len(df_raw)} | Clean rows (excluding *): {len(df_clean)}")

    # 2. Database connection
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    size_cols = [36, 37, 38, 39, 40, 41, 42]
    invoice_records = []
    
    # Track Excel row indices for updating Column O
    store_excel_row_indices = {}

    for store_code, inv_no, po_num in STORE_INV_MAP:
        meta = STORE_METADATA[store_code]
        sub = df_clean[df_clean['STORE NAME'] == store_code]
        store_excel_row_indices[store_code] = sub.index.tolist()

        cartons = sorted(list(set(sub[col_n].dropna().tolist())))
        inv_id = f"inv-dispatch-ril3-{store_code.lower()}"
        
        # Check if already exists in DB, delete if re-running
        cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s", (inv_id,))
        cur.execute("DELETE FROM sales_invoices WHERE id = %s OR invoice_no = %s", (inv_id, inv_no))

        unpivoted_items = []
        tot_qty = 0
        tot_taxable = Decimal("0.00")
        tot_tax = Decimal("0.00")
        tot_cgst = Decimal("0.00")
        tot_sgst = Decimal("0.00")
        tot_igst = Decimal("0.00")

        is_inter = meta['is_interstate']

        line_no = 1
        for row_idx, r in sub.iterrows():
            art = str(r['ARTICLE']).strip()
            color = str(r['COLOR']).strip()
            mrp = Decimal(str(r['MRP']))
            unit_rate = round(mrp * Decimal("0.5624"), 2)

            for sz in size_cols:
                qty_val = r.get(sz, 0)
                if pd.notna(qty_val) and float(qty_val) > 0:
                    qty = int(qty_val)
                    qty_dec = Decimal(str(qty))
                    taxable = qty_dec * unit_rate

                    if is_inter:
                        cgst = Decimal("0.00")
                        sgst = Decimal("0.00")
                        igst = round(taxable * Decimal("0.05"), 2)
                        tax = igst
                    else:
                        cgst = round(taxable * Decimal("0.025"), 2)
                        sgst = round(taxable * Decimal("0.025"), 2)
                        igst = Decimal("0.00")
                        tax = cgst + sgst

                    tot_amt = taxable + tax

                    item_code = f"{art}-{color}-{sz}"
                    item_name = f"{art} {color} {sz}"
                    prod_id = f"prod-{art.lower()}-{color.lower()}-{sz}"

                    unpivoted_items.append({
                        "line_no": line_no,
                        "code": item_code,
                        "name": item_name,
                        "product_id": prod_id,
                        "quantity": qty_dec,
                        "price": unit_rate,
                        "mrp": mrp,
                        "disc_pct": Decimal("43.76"),
                        "taxable_value": taxable,
                        "tax_amount": tax,
                        "cgst_amount": cgst,
                        "sgst_amount": sgst,
                        "igst_amount": igst,
                        "total_amount": tot_amt,
                        "hsn_code": "64032012",
                        "gst_rate": Decimal("5.00"),
                        "source_line_type": "DISPATCH_IMPORT",
                        "source_line_id": f"{store_code}:{row_idx}:{sz}"
                    })

                    tot_qty += qty
                    tot_taxable += taxable
                    tot_tax += tax
                    tot_cgst += cgst
                    tot_sgst += sgst
                    tot_igst += igst
                    line_no += 1

        grand_total = round(tot_taxable + tot_tax, 0)
        round_adj = grand_total - (tot_taxable + tot_tax)
        words = number_to_indian_words(float(grand_total))

        # Build rule snapshot
        rule_snapshot = {
            "grouping": "STORE_NAME",
            "tax_rate": "5.00",
            "discount_pct": "43.76",
            "po_reference": po_num,
            "pricing_formula": "unit_rate = round(mrp * 0.5624, 2)",
            "cartons": cartons,
            "source_sheet": "08-09-2026"
        }

        # Build delivery location snapshot
        delivery_snapshot = {
            "gstin": meta['gstin'],
            "sis_code": store_code,
            "store_code": store_code,
            "po_reference": po_num,
            "state_name": meta['state'],
            "state_code": meta['state_code'],
            "city": meta['city'],
            "pincode": meta['pincode'],
            "site_name": meta['site_name']
        }

        # Insert sales_invoice header
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
                %s, gen_random_uuid(), 'COMP-001', 'MAIN', %s, '2026-09-08',
                'cust-rrl-192b561d', 'Reliance Retail Limited', %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, 'STATE BANK OF INDIA',
                '43976711765', 'SBIN0030425', 'CREDIT', 'POSTED', 'HISTORICAL_IMPORT',
                'RIL_DISPATCH_XLSX', %s, 'DISPATCH_20260908_RIL3_V1', NOW(),
                'VALIDATED', %s, %s,
                %s, %s, %s,
                %s, 'wh-ngp-001',
                %s, %s, %s,
                NOW(), NOW(), True, False, 1
            )
        """, (
            inv_id, inv_no, meta['gstin'], meta['gstin'],
            meta['billing_address'], meta['shipping_address'], meta['site_name'], meta['state'],
            meta['state_code'], is_inter, tot_taxable, tot_tax,
            grand_total, round_adj, words,
            DISPATCH3_EXCEL,
            f"Store-grouped dispatch 3 import; SIS Code={store_code}; Cartons={cartons}; PO={po_num}",
            store_code, store_code, store_code, po_num,
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
            "invoice_no": inv_no,
            "invoice_id": inv_id,
            "po_number": po_num,
            "cartons": cartons,
            "rows_count": len(sub),
            "items_count": len(unpivoted_items),
            "pairs": tot_qty,
            "taxable_value": float(tot_taxable),
            "cgst_amount": float(tot_cgst),
            "sgst_amount": float(tot_sgst),
            "igst_amount": float(tot_igst),
            "tax_total": float(tot_tax),
            "grand_total": float(grand_total),
            "round_adj": float(round_adj),
            "is_interstate": is_inter,
            "meta": meta,
            "items": unpivoted_items
        })

        print(f"  [CREATED] {inv_no} -> Store: {store_code:5} | Cartons: {str(cartons):10} | Items: {len(unpivoted_items):2} | Pairs: {tot_qty:3} | Total: Rs. {grand_total:>10,.2f}")

    cur.close()
    conn.close()

    # 3. Update Column O in RIL_Dispatch3.xlsx
    print("\n--- Updating Column O (Invoice details) in RIL_Dispatch3.xlsx ---")
    wb = openpyxl.load_workbook(DISPATCH3_EXCEL)
    ws = wb["08-09-2026"]

    # Header is row 1. Data rows start at row 2.
    # Openpyxl is 1-indexed, pandas is 0-indexed.
    # pandas row idx corresponds to openpyxl row idx + 2.
    updated_cells_count = 0
    for store_code, inv_no, po_num in STORE_INV_MAP:
        indices = store_excel_row_indices[store_code]
        for row_idx in indices:
            excel_row = row_idx + 2
            cell = ws.cell(row=excel_row, column=15) # Column 15 is Column O
            cell.value = inv_no
            cell.alignment = Alignment(horizontal="center", vertical="center")
            updated_cells_count += 1

    try:
        wb.save(DISPATCH3_EXCEL)
        print(f"SUCCESS: Updated {updated_cells_count} rows in Column O of RIL_Dispatch3.xlsx with new invoice numbers!")
    except PermissionError:
        fallback_excel = os.path.join(os.path.dirname(DISPATCH3_EXCEL), "RIL_Dispatch3_Updated.xlsx")
        wb.save(fallback_excel)
        print(f"NOTE: RIL_Dispatch3.xlsx is open in Excel. Saved updated workbook to: {fallback_excel}")
        os.makedirs(OUTPUT_BASE_DIR, exist_ok=True)
        dest_in_final = os.path.join(OUTPUT_BASE_DIR, "RIL_Dispatch3.xlsx")
        wb.save(dest_in_final)
        print(f"Saved copy to: {dest_in_final}")

    # 4. Generate Tax Invoice PDFs
    print("\n--- Rendering Tax Invoice PDFs via InvoicePdfService ---")
    pdf_out_dir = os.path.join(OUTPUT_BASE_DIR, "Tax_Invoice_PDFs")
    os.makedirs(pdf_out_dir, exist_ok=True)

    sm = get_company_sessionmaker("smriti001")
    async with sm() as session:
        for rec in invoice_records:
            inv_no = rec['invoice_no']
            inv_id = rec['invoice_id']
            pdf_filename = f"{rec['store_code']}_{rec['po_number']}_{inv_no.replace('/', '_')}.pdf"
            pdf_path = os.path.join(pdf_out_dir, pdf_filename)

            await InvoicePdfService.render_pdf_to_file(
                session=session,
                invoice_id=inv_id,
                output_pdf_path=pdf_path,
                company_id="COMP-001"
            )
            print(f"  [PDF GENERATED] {pdf_filename} ({os.path.getsize(pdf_path):,} bytes)")

    # 5. Generate E-Way Bill JSON & Excel Register
    print("\n--- Generating E-Way Bill Payloads and Excel Register ---")
    eway_json_dir = os.path.join(OUTPUT_BASE_DIR, "Eway_JSON")
    os.makedirs(eway_json_dir, exist_ok=True)

    bills = []
    for rec in invoice_records:
        meta = rec['meta']
        inv_no = rec['invoice_no']
        is_inter = rec['is_interstate']

        # Determine transaction type
        trans_type = 4 if is_inter else 3

        item_list = []
        for it in rec['items']:
            item_list.append({
                "itemNo": it['line_no'],
                "productName": it['name'],
                "productDesc": f"Footwear {it['name']}"[:100],
                "hsnCode": "64041990",
                "quantity": float(it['quantity']),
                "qtyUnit": "PRS",
                "taxableAmount": float(it['taxable_value']),
                "sgstRate": 0.0 if is_inter else 2.5,
                "cgstRate": 0.0 if is_inter else 2.5,
                "igstRate": 5.0 if is_inter else 0.0,
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
            "docDate": "08/09/2026",
            "transType": trans_type,
            # Bill From: Supplier Legal Registered Identity
            "fromGstin": "27AAXFT2508H1ZR",
            "fromTrdName": "TATTLY THREADS",
            "fromStateCode": 27,
            # Dispatch From: Physical Origin of Goods (NIC Rule 10 - Nagpur Depot)
            "fromAddr1": "Om Sai Nagar, Kalamana",
            "fromAddr2": "Tattly Threads Nagpur Depot",
            "fromPlace": "Nagpur",
            "fromPincode": 440029,
            "actualFromStateCode": 27,
            "actFromStateCode": 27,
            # Consignee / Bill To & Ship To
            "toGstin": meta['gstin'],
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": clean_addr(meta['shipping_address'].splitlines()[0], 120),
            "toAddr2": clean_addr(meta['shipping_address'].splitlines()[1] if len(meta['shipping_address'].splitlines()) > 1 else "", 120),
            "toPlace": meta['city'],
            "toPincode": meta['pincode'],
            "toStateCode": int(meta['state_code']),
            "actualToStateCode": int(meta['state_code']),
            "actToStateCode": int(meta['state_code']),
            "totalValue": rec['taxable_value'],
            "cgstValue": rec['cgst_amount'],
            "sgstValue": rec['sgst_amount'],
            "igstValue": rec['igst_amount'],
            "cessValue": 0.0,
            "TotNonAdvolVal": 0.0,
            "OthValue": rec['round_adj'],
            "totInvValue": rec['grand_total'],
            "transMode": 1,
            "transDistance": meta['distance_km'],
            "transporterName": "",
            "transporterId": "",
            "transDocNo": "",
            "transDocDate": "",
            "vehicleNo": "",
            "vehicleType": "",
            "mainHsnCode": "64041990",
            "itemList": item_list
        }
        bills.append(bill)

        # Write individual JSON
        indiv_path = os.path.join(eway_json_dir, f"{inv_no.replace('/', '_')}_Eway.json")
        with open(indiv_path, "w", encoding="utf-8") as f:
            json.dump({"version": "1.0.1118", "billLists": [bill]}, f, indent=2)

    # Write Bulk Upload JSON
    bulk_json_path = os.path.join(OUTPUT_BASE_DIR, "EWayBill_Bulk_Upload_RIL3.json")
    with open(bulk_json_path, "w", encoding="utf-8") as f:
        json.dump({"version": "1.0.1118", "billLists": bills}, f, indent=2)
    print(f"SUCCESS: Saved Bulk E-Way JSON: {bulk_json_path}")
    print(f"SUCCESS: Saved 8 Individual E-Way JSONs in: {eway_json_dir}")

    # Generate Excel Generation Register
    reg_path = os.path.join(OUTPUT_BASE_DIR, "EWayBill_Generation_Register_RIL3.xlsx")
    create_excel_register(bills, reg_path, "E-WAY BILL GENERATION REGISTER — RIL DISPATCH 3 (TT195 TO TT202)")

    # 6. Create 7-Zip Archive and Mirror
    print("\n--- Packaging 7-Zip Archive and Mirroring to Eway Folder ---")
    seven_zip_path = r"C:\Program Files\7-Zip\7z.exe"
    archive_path = os.path.join(OUTPUT_BASE_DIR, "Final_RIL3_Package.7z")
    
    if os.path.exists(seven_zip_path):
        cmd = [
            seven_zip_path, "a", "-t7z", "-m0=lzma2", "-mx=9", "-y",
            archive_path,
            bulk_json_path,
            reg_path,
            eway_json_dir,
            pdf_out_dir
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"SUCCESS: Created 7z Archive: {archive_path} ({os.path.getsize(archive_path):,} bytes)")
        else:
            print("7-zip error:", res.stderr)

    # Mirror everything to Eway/Final_RIL3
    os.makedirs(MIRROR_BASE_DIR, exist_ok=True)
    for item in os.listdir(OUTPUT_BASE_DIR):
        s = os.path.join(OUTPUT_BASE_DIR, item)
        d = os.path.join(MIRROR_BASE_DIR, item)
        if os.path.isdir(s):
            if os.path.exists(d):
                shutil.rmtree(d)
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
    print(f"SUCCESS: Mirrored all artifacts to: {MIRROR_BASE_DIR}")

    print("\n" + "=" * 80)
    print("ALL 8 INVOICES (TT195-TT202) PROCESSED, DB COMMITTED, AND EXPORTED SUCCESSFULLY!")
    print("=" * 80)


def create_excel_register(bills, out_path, title="E-WAY BILL GENERATION REGISTER"):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "E-Way Bills"
    ws.views.sheetView[0].showGridLines = True
    
    headers = [
        "SR NO", "INVOICE NO", "DATE", "TRANS TYPE", "SUPPLIER (BILL FROM)",
        "DISPATCH FROM", "DISPATCH PIN", "CONSIGNEE", "STORE CODE", "DESTINATION",
        "DEST PIN", "QTY (PRS)", "TAXABLE VALUE (RS)", "IGST (RS)", "CGST (RS)",
        "SGST (RS)", "TOTAL VALUE (RS)", "DISTANCE (KM)", "TRANSPORT MODE", "STATUS"
    ]
    
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Segoe UI", size=9, bold=True, color="FFFFFF")
    border_thin = Border(left=Side(style="thin", color="CBD5E1"),
                         right=Side(style="thin", color="CBD5E1"),
                         top=Side(style="thin", color="CBD5E1"),
                         bottom=Side(style="thin", color="CBD5E1"))
                         
    ws.row_dimensions[1].height = 24
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    title_cell = ws.cell(row=1, column=1, value=f"SMRITI RETAIL OS — {title}")
    title_cell.font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    
    ws.row_dimensions[3].height = 22
    for col_idx, h in enumerate(headers, start=1):
        c = ws.cell(row=3, column=col_idx, value=h)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = border_thin
        
    tot_qty = 0
    tot_tx = Decimal("0.00")
    tot_ig = Decimal("0.00")
    tot_cg = Decimal("0.00")
    tot_sg = Decimal("0.00")
    tot_inv = Decimal("0.00")
    
    row_font = Font(name="Segoe UI", size=9)
    status_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    status_font = Font(name="Segoe UI", size=9, bold=True, color="166534")
    
    for idx, b in enumerate(bills, start=1):
        r = idx + 3
        ws.row_dimensions[r].height = 18
        
        q_sum = sum(it.get("quantity", 0) for it in b.get("itemList", []))
        tot_qty += q_sum
        tot_tx += Decimal(str(b.get("totalValue", 0)))
        tot_ig += Decimal(str(b.get("igstValue", 0)))
        tot_cg += Decimal(str(b.get("cgstValue", 0)))
        tot_sg += Decimal(str(b.get("sgstValue", 0)))
        tot_inv += Decimal(str(b.get("totInvValue", 0)))
        
        tt_desc = {1: "1-Regular", 2: "2-BillTo-ShipTo", 3: "3-BillFrom-DispFrom", 4: "4-Combination"}.get(b.get("transType"), str(b.get("transType")))
        
        ws.cell(row=r, column=1, value=idx).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=2, value=b.get("docNo")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=3, value=b.get("docDate")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=4, value=tt_desc).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=5, value="Tattly Threads (Mumbai)").alignment = Alignment(horizontal="left")
        ws.cell(row=r, column=6, value="Nagpur Depot (Kalamana)").alignment = Alignment(horizontal="left")
        ws.cell(row=r, column=7, value=b.get("fromPincode")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=8, value=b.get("toTrdName")).alignment = Alignment(horizontal="left")
        ws.cell(row=r, column=9, value=b.get("toAddr1", "")[:20]).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=10, value=b.get("toPlace")).alignment = Alignment(horizontal="left")
        ws.cell(row=r, column=11, value=b.get("toPincode")).alignment = Alignment(horizontal="center")
        
        c_q = ws.cell(row=r, column=12, value=q_sum)
        c_q.number_format = "#,##0"
        c_q.alignment = Alignment(horizontal="right")
        
        c_tx = ws.cell(row=r, column=13, value=b.get("totalValue"))
        c_tx.number_format = "#,##0.00"
        c_tx.alignment = Alignment(horizontal="right")
        
        c_ig = ws.cell(row=r, column=14, value=b.get("igstValue"))
        c_ig.number_format = "#,##0.00"
        c_ig.alignment = Alignment(horizontal="right")
        
        c_cg = ws.cell(row=r, column=15, value=b.get("cgstValue"))
        c_cg.number_format = "#,##0.00"
        c_cg.alignment = Alignment(horizontal="right")
        
        c_sg = ws.cell(row=r, column=16, value=b.get("sgstValue"))
        c_sg.number_format = "#,##0.00"
        c_sg.alignment = Alignment(horizontal="right")
        
        c_tot = ws.cell(row=r, column=17, value=b.get("totInvValue"))
        c_tot.number_format = "#,##0.00"
        c_tot.alignment = Alignment(horizontal="right")
        
        ws.cell(row=r, column=18, value=b.get("transDistance")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=19, value="ROAD (1)").alignment = Alignment(horizontal="center")
        
        c_st = ws.cell(row=r, column=20, value="PART-A READY")
        c_st.font = status_font
        c_st.fill = status_fill
        c_st.alignment = Alignment(horizontal="center")
        
        for col_i in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=col_i)
            cell.border = border_thin
            if col_i != 20:
                cell.font = row_font
                
    # Total Row
    tot_r = len(bills) + 4
    ws.row_dimensions[tot_r].height = 24
    ws.merge_cells(start_row=tot_r, start_column=1, end_row=tot_r, end_column=11)
    ws.cell(row=tot_r, column=1, value="CONSOLIDATED TOTAL").alignment = Alignment(horizontal="center", vertical="center")
    
    tot_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    for col_i in range(1, len(headers) + 1):
        cell = ws.cell(row=tot_r, column=col_i)
        cell.fill = tot_fill
        cell.font = Font(name="Segoe UI", size=9, bold=True, color="FFFFFF")
        cell.border = border_thin
        
    ws.cell(row=tot_r, column=12, value=tot_qty).number_format = "#,##0"
    ws.cell(row=tot_r, column=13, value=float(tot_tx)).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=14, value=float(tot_ig)).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=15, value=float(tot_cg)).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=16, value=float(tot_sg)).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=17, value=float(tot_inv)).number_format = "#,##0.00"
    
    for col_i in range(12, 18):
        ws.cell(row=tot_r, column=col_i).alignment = Alignment(horizontal="right", vertical="center")
        
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)
        
    ws.column_dimensions['A'].width = 7
    ws.column_dimensions['B'].width = 18
    ws.column_dimensions['E'].width = 24
    ws.column_dimensions['F'].width = 24
    ws.column_dimensions['H'].width = 26
    
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    wb.save(out_path)
    print(f"Saved Excel Register: {out_path}")


if __name__ == "__main__":
    asyncio.run(process_pipeline())
