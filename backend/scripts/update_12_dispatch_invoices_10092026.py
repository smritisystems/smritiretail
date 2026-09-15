"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.0
  Created      : 2026-09-10
  Classification: Canonical Dispatch Invoice Update Engine (12 Stores from 08-09-2026)
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
from openpyxl.styles import Alignment, PatternFill
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

SOURCE_EXCEL = r"F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026.xlsx"
FINAL_1009_DIR = r"F:\Smriti-Clients Data\10-09-2026\Final"
FINAL_0809_DIR = r"F:\Smriti-Clients Data\08-09-2026\Final"
MIRROR_EWAY_DIR = r"F:\Smriti-Clients Data\Eway\Final"
TAX_INV_ARCHIVE_DIR = r"F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194"

TARGET_STORES = [
    ('TKI6', 'TT2026-2027/172', '5182778188'),
    ('TKU5', 'TT2026-2027/174', '5182778190'),
    ('TMN2', 'TT2026-2027/176', '5182778192'),
    ('TUA7', 'TT2026-2027/179', '5182778196'),
    ('TVP2', 'TT2026-2027/185', '5182778201'),
    ('TVT0', 'TT2026-2027/186', '5182778202'),
    ('TVU1', 'TT2026-2027/187', '5182778203'),
    ('TW07', 'TT2026-2027/188', '5182778158'),
    ('TW97', 'TT2026-2027/189', '5182778204'),
    ('TXSR', 'TT2026-2027/191', '5182778206'),
    ('TXSU', 'TT2026-2027/192', '5182778207'),
    ('TYAC', 'TT2026-2027/194', '5182778209'),
]

STORE_METADATA = {
    'TKI6': {
        'site_name': 'COSMOS MALL AGRA',
        'city': 'Agra',
        'pincode': 282002,
        'state': 'UTTAR PRADESH',
        'state_code': '09',
        'gstin': '09AABCR1718E1ZN',
        'is_interstate': True,
        'distance_km': 1100,
        'shipping_address': 'Reliance Retail Limited (COSMOS MALL AGRA)\n119/8 and 120/8Ashok Cosmos Mall,Agra,Sanjay Placechilli Int Road,AGRA282002',
        'billing_address': 'Reliance Retail Limited\n119/8 and 120/8Ashok Cosmos Mall,Agra,Sanjay Placechilli Int Road,AGRA282002',
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
        'billing_address': 'Reliance Retail Limited\nKhasara No 1977/2684,Saraswati Puram Raebareilly Road,Sgpgi Raebareilly Road Lucknow,LUCKNOW226014',
    },
    'TMN2': {
        'site_name': 'RRL TF Erandawane Pune',
        'city': 'Pune',
        'pincode': 411004,
        'state': 'MAHARASHTRA',
        'state_code': '27',
        'gstin': '27AABCR1718E1ZP',
        'is_interstate': False,  # Intra-state CGST (2.5%) + SGST (2.5%)
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
    'TVP2': {
        'site_name': 'RRL TRENDS FOOTWEAR HASSAN',
        'city': 'Hassan',
        'pincode': 573201,
        'state': 'KARNATAKA',
        'state_code': '29',
        'gstin': '29AABCR1718E1ZL',
        'is_interstate': True,
        'distance_km': 990,
        'shipping_address': 'Reliance Retail Limited (RRL TRENDS FOOTWEAR HASSAN)\nReliance Retail Limited Ground Floor Salagame Road Hassan 573201 HASSAN - KARNATAKA',
        'billing_address': 'Reliance Retail Limited\nReliance Retail Limited Ground Floor Salagame Road Hassan 573201 HASSAN - KARNATAKA',
    },
    'TVT0': {
        'site_name': 'RRL FIF PACIFIC MALL',
        'city': 'New Delhi',
        'pincode': 110034,
        'state': 'DELHI',
        'state_code': '07',
        'gstin': '07AABCR1718E1ZR',
        'is_interstate': True,
        'distance_km': 1100,
        'shipping_address': 'Reliance Retail Limited (RRL FIF PACIFIC MALL)\nPacific Mall Netaji Subash Place,New Delhi,Mrts Station Dmrc Phase 3 Corridor Pitampura,NEW DELHI110034',
        'billing_address': 'Reliance Retail Limited\nPacific Mall Netaji Subash Place,New Delhi,Mrts Station Dmrc Phase 3 Corridor Pitampura,NEW DELHI110034',
    },
    'TVU1': {
        'site_name': 'RRL FIF HAJIPUR',
        'city': 'Hajipur',
        'pincode': 844101,
        'state': 'BIHAR',
        'state_code': '10',
        'gstin': '10AABCR1718E1Z4',
        'is_interstate': True,
        'distance_km': 1250,
        'shipping_address': 'Reliance Retail Limited (RRL FIF HAJIPUR)\nCine Krishna Mall Srs Mall,Mohalla Cinema Road Hajipur,Khata No15 Thana No165 Khesra No243,HAJIPUR844101',
        'billing_address': 'Reliance Retail Limited\nCine Krishna Mall Srs Mall,Mohalla Cinema Road Hajipur,Khata No15 Thana No165 Khesra No243,HAJIPUR844101',
    },
    'TW07': {
        'site_name': 'RRL FOOTPRINT Tumkur NDC',
        'city': 'Tumkur',
        'pincode': 572101,
        'state': 'KARNATAKA',
        'state_code': '29',
        'gstin': '29AABCR1718E1ZL',
        'is_interstate': True,
        'distance_km': 950,
        'shipping_address': 'Reliance Retail Limited (RRL FOOTPRINT Tumkur NDC)\nSurvey No 54 1 Nandihalli Village, 55th KM Stone NH 4 Tumkur Road, Oorukere Post Tumkur 572101 KARNATAKA',
        'billing_address': 'Reliance Retail Limited\nNO 62/2, RIL BUILDING, RICHMOND ROAD, BANGALORE - 560025 Karnataka',
    },
    'TW97': {
        'site_name': 'AS RAO NAGAR',
        'city': 'Hyderabad',
        'pincode': 500062,
        'state': 'TELANGANA',
        'state_code': '36',
        'gstin': '36AABCR1718E1ZQ',
        'is_interstate': True,
        'distance_km': 720,
        'shipping_address': 'Reliance Retail Limited (AS RAO NAGAR)\nPlot No13 & 14 SyNo466 ECIL,Kapra Municipality DrAS Rao Ngr,Medchal-Malkajgiri Dist,HYDERABAD500062',
        'billing_address': 'Reliance Retail Limited\nPlot No13 & 14 SyNo466 ECIL,Kapra Municipality DrAS Rao Ngr,Medchal-Malkajgiri Dist,HYDERABAD500062',
    },
    'TXSR': {
        'site_name': 'RRL FIF HYDERABAD SU',
        'city': 'Hyderabad',
        'pincode': 500030,
        'state': 'TELANGANA',
        'state_code': '36',
        'gstin': '36AABCR1718E1ZQ',
        'is_interstate': True,
        'distance_km': 720,
        'shipping_address': 'Reliance Retail Limited (RRL FIF HYDERABAD SU)\nPlot Nos 59606364 Covered By Survey No 2,Gandipet Mandal,Situate In Gandhamguda Village,HYDERABAD500030',
        'billing_address': 'Reliance Retail Limited\nPlot Nos 59606364 Covered By Survey No 2,Gandipet Mandal,Situate In Gandhamguda Village,HYDERABAD500030',
    },
    'TXSU': {
        'site_name': 'RRL FIF BANGALORE KR',
        'city': 'Bangalore',
        'pincode': 560036,
        'state': 'KARNATAKA',
        'state_code': '29',
        'gstin': '29AABCR1718E1ZL',
        'is_interstate': True,
        'distance_km': 980,
        'shipping_address': 'Reliance Retail Limited (RRL FIF BANGALORE KR)\nSy No 44/1 Khatha No 1378,Nh48,K R Puram,BANGALORE560036',
        'billing_address': 'Reliance Retail Limited\nSy No 44/1 Khatha No 1378,Nh48,K R Puram,BANGALORE560036',
    },
    'TYAC': {
        'site_name': 'RRL TF MB HABITAT MALL',
        'city': 'Mysore',
        'pincode': 570012,
        'state': 'KARNATAKA',
        'state_code': '29',
        'gstin': '29AABCR1718E1ZL',
        'is_interstate': True,
        'distance_km': 1120,
        'shipping_address': 'Reliance Retail Limited (RRL TF MB HABITAT MALL)\nRRL Trends Footwear MB Habitat Mall Reliance Retail Limited B M Habitat Mall Jayalakshmipuram 570012 MYSORE - KARNATAKA',
        'billing_address': 'Reliance Retail Limited\nRRL Trends Footwear MB Habitat Mall Reliance Retail Limited B M Habitat Mall Jayalakshmipuram 570012 MYSORE - KARNATAKA',
    },
}

def clean_addr(text, max_len=120):
    t = re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()
    t = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', t).strip()
    return t[:max_len]

async def run_update():
    print("=" * 80)
    print("SMRITI RETAIL OS: SYNCHRONIZING 12 DISPATCH INVOICES FROM SHEET '08-09-2026'")
    print(f"Source Excel: {SOURCE_EXCEL}")
    print("=" * 80)

    # 1. Read sheet 08-09-2026
    df = pd.read_excel(SOURCE_EXCEL, sheet_name="08-09-2026")
    size_cols = [36, 37, 38, 39, 40, 41, 42]

    # Connect DB
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    updated_invoices_info = []

    for store_code, inv_no, po_num in TARGET_STORES:
        meta = STORE_METADATA[store_code]
        sub = df[df['STORE NAME'] == store_code]
        cartons = sorted(list(set(str(c).strip() for c in sub['Cartoon number'].dropna().tolist() if str(c).strip() != '*')))

        # Find existing invoice in DB by invoice_no or delivery_store_code
        cur.execute("""
            SELECT id, invoice_no FROM sales_invoices
            WHERE (invoice_no = %s OR invoice_no = %s OR delivery_store_code = %s)
              AND invoice_no LIKE 'TT2026-2027%%'
            ORDER BY id LIMIT 1
        """, (inv_no, inv_no.replace('/', '_'), store_code))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Invoice {inv_no} (Store {store_code}) not found in sales_invoices!")
        inv_id = row['id']
        actual_inv_no = row['invoice_no']

        # Delete old items
        cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s", (inv_id,))
        old_items_deleted = cur.rowcount

        unpivoted_items = []
        tot_qty = 0
        tot_taxable = Decimal("0.00")
        tot_tax = Decimal("0.00")
        tot_cgst = Decimal("0.00")
        tot_sgst = Decimal("0.00")
        tot_igst = Decimal("0.00")

        line_no = 1
        is_interstate = meta['is_interstate']

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

                    if is_interstate:
                        igst = round(taxable * Decimal("0.05"), 2)
                        cgst = Decimal("0.00")
                        sgst = Decimal("0.00")
                        tax = igst
                    else:
                        # Intrastate MH (TMN2)
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

        rule_snapshot = {
            "grouping": "STORE_NAME",
            "tax_rate": "5.00",
            "discount_pct": "43.76",
            "po_reference": po_num,
            "pricing_formula": "unit_rate = round(mrp * 0.5624, 2)",
            "cartons": cartons,
            "source_sheet": "08-09-2026",
            "source_file": SOURCE_EXCEL,
            "updated_at": datetime.now().isoformat(),
            "is_interstate": is_interstate
        }

        # Update sales_invoices header
        cur.execute("""
            UPDATE sales_invoices
            SET date = '2026-09-08',
                taxable_value = %s,
                tax_total = %s,
                grand_total = %s,
                rounding_amount = %s,
                amount_in_words = %s,
                source_file = %s,
                import_batch_id = 'DISPATCH_20260910_RIL_UPDATE',
                rule_snapshots = %s,
                modified_at = NOW()
            WHERE id = %s
        """, (
            tot_taxable, tot_tax, grand_total, round_adj, words,
            SOURCE_EXCEL, json.dumps(rule_snapshot), inv_id
        ))

        # Insert new sales_invoice_items
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
        print(f"  [DB UPDATED] {actual_inv_no} (Store {store_code}): {old_items_deleted} old items -> {len(unpivoted_items)} items | Pairs: {tot_qty} | Total: Rs. {grand_total:>10,.2f}")

        updated_invoices_info.append({
            "store_code": store_code,
            "inv_no": actual_inv_no,
            "inv_id": inv_id,
            "po_number": po_num,
            "meta": meta,
            "tot_qty": tot_qty,
            "taxable_value": float(tot_taxable),
            "tax_total": float(tot_tax),
            "cgst_total": float(tot_cgst),
            "sgst_total": float(tot_sgst),
            "igst_total": float(tot_igst),
            "grand_total": float(grand_total),
            "cartons": cartons,
            "items": unpivoted_items
        })

    cur.close()
    conn.close()

    # 2. Render PDF Invoices
    print("\n--- Generating Statutory PDF Invoices ---")
    pdf_dirs = [
        os.path.join(FINAL_1009_DIR, "Tax_Invoice_PDFs"),
        os.path.join(FINAL_0809_DIR, "Tax_Invoice_PDFs"),
        TAX_INV_ARCHIVE_DIR
    ]
    for d in pdf_dirs:
        os.makedirs(d, exist_ok=True)

    sm = get_company_sessionmaker("smriti001")
    async with sm() as session:
        for u in updated_invoices_info:
            inv_no_clean = u['inv_no'].replace('/', '_')
            pdf_name = f"{u['store_code']}_{u['po_number']}_{inv_no_clean}.pdf"
            generic_name = f"Tax_Invoice_{inv_no_clean}.pdf"

            for d in pdf_dirs:
                out_path = os.path.join(d, pdf_name)
                await InvoicePdfService.render_pdf_to_file(
                    session=session,
                    invoice_id=u['inv_id'],
                    output_pdf_path=out_path,
                    company_id="COMP-001"
                )
                print(f"  [PDF SAVED] {out_path} ({os.path.getsize(out_path):,} bytes)")

                # Also save standard name
                std_path = os.path.join(d, generic_name)
                shutil.copyfile(out_path, std_path)

    # 3. Generate NIC E-Way Bill JSON
    print("\n--- Generating NIC v1.0.1118 E-Way Bill JSON Payloads ---")
    eway_dirs = [
        os.path.join(FINAL_1009_DIR, "Eway_JSON"),
        os.path.join(FINAL_0809_DIR, "Eway_JSON"),
        os.path.join(MIRROR_EWAY_DIR, "Eway_JSON")
    ]
    for d in eway_dirs:
        os.makedirs(d, exist_ok=True)

    eway_bills = []
    for u in updated_invoices_info:
        meta = u['meta']
        is_interstate = meta['is_interstate']

        item_list = []
        for it in u['items']:
            item_list.append({
                "itemNo": it['line_no'],
                "productName": it['name'],
                "productDesc": f"Footwear {it['name']}"[:100],
                "hsnCode": "64041990",
                "quantity": float(it['quantity']),
                "qtyUnit": "PRS",
                "taxableAmount": float(it['taxable_value']),
                "sgstRate": 2.5 if not is_interstate else 0.0,
                "cgstRate": 2.5 if not is_interstate else 0.0,
                "igstRate": 0.0 if not is_interstate else 5.0,
                "cessRate": 0.0,
                "cessNonAdvol": 0.0
            })

        bill = {
            "userGstin": "27AAXFT2508H1ZR",
            "supplyType": "O",
            "subSupplyType": 1,
            "subSupplyDesc": "",
            "docType": "INV",
            "docNo": u['inv_no'],
            "docDate": "08/09/2026",
            "transType": 4 if is_interstate else 1,  # 4 = Interstate, 1 = Regular Intrastate
            "fromGstin": "27AAXFT2508H1ZR",
            "fromTrdName": "TATTLY THREADS",
            "fromStateCode": 27,
            "fromAddr1": "Om Sai Nagar, Kalamana",
            "fromAddr2": "Tattly Threads Nagpur Depot",
            "fromPlace": "Nagpur",
            "fromPincode": 440029,
            "actualFromStateCode": 27,
            "actFromStateCode": 27,
            "toGstin": meta['gstin'],
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": clean_addr(meta['shipping_address'].splitlines()[0], 120),
            "toAddr2": clean_addr(meta['shipping_address'].splitlines()[1] if len(meta['shipping_address'].splitlines()) > 1 else "", 120),
            "toPlace": meta['city'],
            "toPincode": meta['pincode'],
            "toStateCode": int(meta['state_code']),
            "actualToStateCode": int(meta['state_code']),
            "actToStateCode": int(meta['state_code']),
            "totalValue": u['taxable_value'],
            "cgstValue": u['cgst_total'],
            "sgstValue": u['sgst_total'],
            "igstValue": u['igst_total'],
            "cessValue": 0.0,
            "totInvValue": u['grand_total'],
            "transMode": 1,  # Road
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

        inv_no_clean = u['inv_no'].replace('/', '_')
        for ed in eway_dirs:
            indiv_path = os.path.join(ed, f"{inv_no_clean}_Eway.json")
            with open(indiv_path, "w", encoding="utf-8") as f:
                json.dump({"version": "1.0.1118", "billLists": [bill]}, f, indent=2)
            print(f"  [EWAY JSON SAVED] {indiv_path}")

        eway_bills.append(bill)

    # Save consolidated bulk E-Way JSON
    bulk_path_1009 = os.path.join(FINAL_1009_DIR, "EWayBill_Bulk_Upload_12_Invoices_10092026.json")
    with open(bulk_path_1009, "w", encoding="utf-8") as f:
        json.dump({"version": "1.0.1118", "billLists": eway_bills}, f, indent=2)
    print(f"  [BULK EWAY JSON SAVED] {bulk_path_1009}")

    # 4. Update Excel Sheet RIL_Dispatch10092026.xlsx
    print("\n--- Updating RIL_Dispatch10092026.xlsx (Column O & Green Highlight) ---")
    wb = openpyxl.load_workbook(SOURCE_EXCEL)
    ws = wb["08-09-2026"]
    green_fill = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")

    updated_count = 0
    store_map = dict((s[0], s[1]) for s in TARGET_STORES)

    for r in range(2, ws.max_row + 1):
        st = ws.cell(r, 1).value
        if st and str(st).strip() in store_map:
            inv_no = store_map[str(st).strip()]
            cell_o = ws.cell(r, 15)
            cell_o.value = inv_no
            cell_o.fill = green_fill
            cell_o.alignment = Alignment(horizontal="center", vertical="center")
            updated_count += 1

    updated_excel_path = r"F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026_Updated.xlsx"
    wb.save(updated_excel_path)
    print(f"Successfully highlighted and updated {updated_count} cells in {updated_excel_path}")

    # Try saving to original if lock released
    try:
        wb.save(SOURCE_EXCEL)
        print(f"SUCCESS: Also overwritten directly into original: {SOURCE_EXCEL}")
    except PermissionError:
        print(f"NOTE: Original {SOURCE_EXCEL} is currently open in Excel. Staged in RIL_Dispatch10092026_Updated.xlsx.")

    print("\n" + "=" * 80)
    print(f"SUCCESS: 12 Invoices fully updated in Database, PDFs, E-Way JSONs, and Excel!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_update())
