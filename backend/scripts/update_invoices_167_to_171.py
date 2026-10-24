"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.34.0
  Created      : 2026-09-09
  Classification: Canonical Dispatch 4 Invoice Update Engine (TT167-TT171)
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

DISPATCH4_EXCEL = r"F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch4.xlsx"
FINAL_DIR = r"F:\Smriti-Clients Data\08-09-2026\Final"
MIRROR_EWAY_DIR = r"F:\Smriti-Clients Data\Eway\Final"
TAX_INV_ARCHIVE_DIR = r"F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194"

TARGET_STORES = [
    ('TGX1', 'TT2026-2027/167', '5182778183'),
    ('TGX9', 'TT2026-2027/168', '5182778184'),
    ('TJI4', 'TT2026-2027/169', '5182778185'),
    ('TKF4', 'TT2026-2027/170', '5182778186'),
    ('TKG3', 'TT2026-2027/171', '5182778187'),
]

STORE_METADATA = {
    'TGX1': {
        'site_name': 'VAISHNAVI ASIAN MALL',
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
        'site_name': 'MIYAPUR',
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
    'TJI4': {
        'site_name': 'BHOOTNATH',
        'city': 'Lucknow',
        'pincode': 226016,
        'state': 'UTTAR PRADESH',
        'state_code': '09',
        'gstin': '09AABCR1718E1ZN',
        'is_interstate': True,
        'distance_km': 1380,
        'shipping_address': 'Reliance Retail Limited (BHOOTNATH)\nKhasra No 141,Sheikhpura Faizabad Rd Lucknow,Opp Bhoothnath Market,LUCKNOW226016',
        'billing_address': 'Reliance Retail Limited\nKhasra No 141,Sheikhpura Faizabad Rd Lucknow,Opp Bhoothnath Market,LUCKNOW226016',
    },
    'TKF4': {
        'site_name': 'BRIGADE UPTOWN MALL',
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
        'site_name': 'BANASHANKARI',
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
}

def clean_addr(text, max_len=120):
    t = re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()
    t = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', t).strip()
    return t[:max_len]

async def run_update():
    print("=" * 80)
    print("SMRITI RETAIL OS: UPDATING INVOICES TT167-TT171 BASED ON RIL_Dispatch4.xlsx")
    print("=" * 80)

    # 1. Read sheet 08-09-2026
    df = pd.read_excel(DISPATCH4_EXCEL, sheet_name="08-09-2026")
    size_cols = [36, 37, 38, 39, 40, 41, 42]

    # Connect DB
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    updated_invoices_info = []

    for store_code, inv_no, po_num in TARGET_STORES:
        meta = STORE_METADATA[store_code]
        sub = df[df['STORE NAME'] == store_code]
        cartons = sorted(list(set(str(c).strip() for c in sub['Cartoon number'].dropna().tolist() if str(c).strip() != '*')))

        # Find existing invoice in DB
        cur.execute("SELECT id FROM sales_invoices WHERE invoice_no = %s", (inv_no,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Invoice {inv_no} not found in sales_invoices!")
        inv_id = row['id']

        # Delete old items
        cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s", (inv_id,))
        old_items_deleted = cur.rowcount

        unpivoted_items = []
        tot_qty = 0
        tot_taxable = Decimal("0.00")
        tot_tax = Decimal("0.00")
        tot_igst = Decimal("0.00")

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
                    igst = round(taxable * Decimal("0.05"), 2)
                    tax = igst
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
                        "cgst_amount": Decimal("0.00"),
                        "sgst_amount": Decimal("0.00"),
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
            "updated_from": "RIL_Dispatch4.xlsx"
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
                import_batch_id = 'DISPATCH_20260908_RIL4_UPDATE',
                rule_snapshots = %s,
                modified_at = NOW()
            WHERE id = %s
        """, (
            tot_taxable, tot_tax, grand_total, round_adj, words,
            DISPATCH4_EXCEL, json.dumps(rule_snapshot), inv_id
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
        print(f"  [DB UPDATED] {inv_no} (Store {store_code}): {old_items_deleted} old items removed -> {len(unpivoted_items)} items inserted | Pairs: {tot_qty} | Total: Rs. {grand_total:>10,.2f}")

        updated_invoices_info.append({
            "store_code": store_code,
            "inv_no": inv_no,
            "inv_id": inv_id,
            "po_number": po_num,
            "meta": meta,
            "tot_qty": tot_qty,
            "taxable_value": float(tot_taxable),
            "tax_total": float(tot_tax),
            "grand_total": float(grand_total),
            "cartons": cartons,
            "items": unpivoted_items
        })

    cur.close()
    conn.close()

    # 2. Render PDF Invoices
    print("\n--- Generating PDF Invoices ---")
    pdf_dirs = [
        os.path.join(FINAL_DIR, "Tax_Invoice_PDFs"),
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
    print("\n--- Generating E-Way Bill JSON Payloads ---")
    eway_dirs = [
        os.path.join(FINAL_DIR, "Eway_JSON"),
        os.path.join(MIRROR_EWAY_DIR, "Eway_JSON")
    ]
    for d in eway_dirs:
        os.makedirs(d, exist_ok=True)

    eway_bills = []
    for u in updated_invoices_info:
        meta = u['meta']
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
            "docNo": u['inv_no'],
            "docDate": "08/09/2026",
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
            "cgstValue": 0.0,
            "sgstValue": 0.0,
            "igstValue": u['tax_total'],
            "cessValue": 0.0,
            "totInvValue": u['grand_total'],
            "transMode": 1, # Road
            "transDistance": meta['distance_km'],
            "transporterName": "V-TRANS (INDIA) LIMITED",
            "transporterId": "27AAACV1228H1Z1",
            "transDocNo": f"CN-20260908-{u['store_code']}",
            "transDocDate": "08/09/2026",
            "vehicleNo": "MH31FC9812",
            "vehicleType": "R",
            "itemList": item_list
        }

        inv_no_clean = u['inv_no'].replace('/', '_')
        for ed in eway_dirs:
            indiv_path = os.path.join(ed, f"{inv_no_clean}_Eway.json")
            with open(indiv_path, "w", encoding="utf-8") as f:
                json.dump({"version": "1.0.1118", "billLists": [bill]}, f, indent=2)
            print(f"  [EWAY JSON SAVED] {indiv_path}")

        eway_bills.append(bill)

    # 4. Update Excel Sheet RIL_Dispatch4.xlsx
    print("\n--- Updating RIL_Dispatch4.xlsx (Column O & Green Highlight) ---")
    wb = openpyxl.load_workbook(DISPATCH4_EXCEL)
    ws = wb["08-09-2026"]
    green_fill = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")

    updated_count = 0
    store_map = dict((s[0], s[1]) for s in TARGET_STORES)

    for r in range(2, ws.max_row + 1):
        st = ws.cell(r, 1).value
        if st in store_map:
            inv_no = store_map[st]
            cell_o = ws.cell(r, 15)
            cell_o.value = inv_no
            cell_o.fill = green_fill
            cell_o.alignment = Alignment(horizontal="center", vertical="center")
            updated_count += 1

    updated_excel_path = r"F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch4_Updated.xlsx"
    wb.save(updated_excel_path)
    print(f"Successfully highlighted and updated {updated_count} cells in {updated_excel_path}")

    # Try saving to original if lock released
    try:
        wb.save(DISPATCH4_EXCEL)
        print(f"SUCCESS: Also overwritten directly into original: {DISPATCH4_EXCEL}")
    except PermissionError:
        print(f"NOTE: Original {DISPATCH4_EXCEL} is currently open in Excel. Staged in RIL_Dispatch4_Updated.xlsx.")

    print("\n" + "=" * 80)
    print("SUCCESS: Invoices TT167-TT171 fully updated in Database, PDFs, E-Way, and Excel!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_update())
