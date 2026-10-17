"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.1
  Created      : 2026-09-10
  Classification: Canonical Dispatch Invoice 150 Synchronization & Export Engine
"""

import asyncio
import json
import os
import re
import shutil
import sys
from decimal import Decimal
from pathlib import Path
from datetime import datetime

import openpyxl
from openpyxl.styles import PatternFill
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
ROTATED_LOGO_DIR = r"F:\Smriti-Clients Data\10-09-2026\Tax_Invoices_Rotated_Logo"
TAX_INV_ARCHIVE_DIR = r"F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194"

STORE_CODE = "T40K"
INV_NO = "TT2026-2027/150"
PO_NUMBER = "5182778163"

STORE_METADATA = {
    "site_name": "RRL FIF HESSARGATTA",
    "city": "Bangalore",
    "pincode": 560073,
    "state": "KARNATAKA",
    "state_code": "29",
    "gstin": "29AABCR1718E1ZL",
    "is_interstate": True,
    "distance_km": 980,
    "shipping_address": (
        "Reliance Retail Limited (RRL FIF HESSARGATTA)\n"
        "No39 Hessargatta Main Road,Bangalore,Bagalgunte,BANGALORE560073"
    ),
    "billing_address": (
        "Reliance Retail Limited\n"
        "No39 Hessargatta Main Road,Bangalore,Bagalgunte,BANGALORE560073"
    ),
}

def clean_addr(text, max_len=120):
    t = re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()
    t = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', t).strip()
    return t[:max_len]

async def sync_and_export_bill_150():
    print("=" * 80)
    print(f"SMRITI RETAIL OS: SYNCHRONIZING & EXPORTING BILL {INV_NO} (STORE {STORE_CODE})")
    print(f"Source Excel: {SOURCE_EXCEL}")
    print("=" * 80)

    # 1. Read sheet 08-09-2026 for T40K
    df = pd.read_excel(SOURCE_EXCEL, sheet_name="08-09-2026")
    sub = df[df['STORE NAME'] == STORE_CODE]
    print(f"Loaded {len(sub)} rows for {STORE_CODE} from sheet '08-09-2026'.")

    size_cols = [36, 37, 38, 39, 40, 41, 42]
    cartons = sorted(list(set(str(c).strip() for c in sub['Cartoon number'].dropna().tolist() if str(c).strip() != '*')))
    print(f"Cartons found: {cartons}")

    # Connect DB
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, invoice_no FROM sales_invoices
        WHERE (invoice_no = %s OR invoice_no = %s OR delivery_store_code = %s)
          AND invoice_no LIKE 'TT2026-2027%%'
        ORDER BY id LIMIT 1
    """, (INV_NO, INV_NO.replace('/', '_'), STORE_CODE))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Invoice {INV_NO} (Store {STORE_CODE}) not found in sales_invoices!")
    
    inv_id = row['id']
    actual_inv_no = row['invoice_no']

    # Delete old items
    cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s", (inv_id,))
    old_items_deleted = cur.rowcount
    print(f"Deleted {old_items_deleted} existing items for invoice {actual_inv_no} (ID: {inv_id}).")

    unpivoted_items = []
    tot_qty = 0
    tot_taxable = Decimal("0.00")
    tot_tax = Decimal("0.00")
    tot_cgst = Decimal("0.00")
    tot_sgst = Decimal("0.00")
    tot_igst = Decimal("0.00")

    line_no = 1
    is_interstate = STORE_METADATA['is_interstate']

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
                    "source_line_id": f"{STORE_CODE}:{row_idx}:{sz}"
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
        "po_reference": PO_NUMBER,
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
    print(f"[DB UPDATED] {actual_inv_no}: {len(unpivoted_items)} items | Pairs: {tot_qty} | Taxable: Rs. {tot_taxable:,.2f} | Grand Total: Rs. {grand_total:,.2f}")
    cur.close()
    conn.close()

    # 2. Render Statutory PDF Invoices
    print("\n--- Generating Statutory PDF Invoices ---")
    pdf_dirs = [
        Path(FINAL_1009_DIR) / "Tax_Invoice_PDFs",
        Path(FINAL_0809_DIR) / "Tax_Invoice_PDFs",
        Path(TAX_INV_ARCHIVE_DIR),
        Path(ROTATED_LOGO_DIR) / "All_57_Stores",
        Path(ROTATED_LOGO_DIR) / "12_Stores_Updated",
    ]
    for d in pdf_dirs:
        d.mkdir(parents=True, exist_ok=True)

    inv_no_clean = actual_inv_no.replace('/', '_')
    pdf_name_portal = f"{STORE_CODE}_{PO_NUMBER}_{inv_no_clean}.pdf"
    pdf_name_generic = f"Tax_Invoice_{inv_no_clean}.pdf"

    sm = get_company_sessionmaker("smriti001")
    async with sm() as session:
        # Render primary output
        primary_out = Path(FINAL_1009_DIR) / "Tax_Invoice_PDFs" / pdf_name_portal
        await InvoicePdfService.render_pdf_to_file(
            session=session,
            invoice_id=inv_id,
            output_pdf_path=str(primary_out),
            company_id="COMP-001"
        )
        print(f"  [PRIMARY PDF SAVED] {primary_out} ({primary_out.stat().st_size:,} bytes)")

        # Copy to all target directories and generic alias
        for d in pdf_dirs:
            p_portal = d / pdf_name_portal
            p_generic = d / pdf_name_generic
            if p_portal != primary_out:
                shutil.copyfile(primary_out, p_portal)
            shutil.copyfile(primary_out, p_generic)
            print(f"  [PDF COPIED] -> {p_portal.name} in {d.name}")

    # 3. Generate NIC v1.0.1118 E-Way Bill JSON
    print("\n--- Generating NIC v1.0.1118 E-Way Bill JSON Payload ---")
    eway_dirs = [
        Path(FINAL_1009_DIR) / "Eway_JSON",
        Path(FINAL_0809_DIR) / "Eway_JSON",
        Path(MIRROR_EWAY_DIR) / "Eway_JSON"
    ]
    for d in eway_dirs:
        d.mkdir(parents=True, exist_ok=True)

    item_list = []
    for it in unpivoted_items:
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
        "docNo": actual_inv_no,
        "docDate": "08/09/2026",
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
        "toGstin": STORE_METADATA['gstin'],
        "toTrdName": "RELIANCE RETAIL LIMITED",
        "toAddr1": clean_addr(STORE_METADATA['shipping_address'].splitlines()[0], 120),
        "toAddr2": clean_addr(STORE_METADATA['shipping_address'].splitlines()[1] if len(STORE_METADATA['shipping_address'].splitlines()) > 1 else "", 120),
        "toPlace": STORE_METADATA['city'],
        "toPincode": STORE_METADATA['pincode'],
        "toStateCode": int(STORE_METADATA['state_code']),
        "actualToStateCode": int(STORE_METADATA['state_code']),
        "actToStateCode": int(STORE_METADATA['state_code']),
        "totalValue": float(tot_taxable),
        "cgstValue": float(tot_cgst),
        "sgstValue": float(tot_sgst),
        "igstValue": float(tot_igst),
        "cessValue": 0.0,
        "totInvValue": float(grand_total),
        "transMode": 1,
        "transDistance": STORE_METADATA['distance_km'],
        "transporterName": "",
        "transporterId": "",
        "transDocNo": "",
        "transDocDate": "",
        "vehicleNo": "",
        "vehicleType": "",
        "mainHsnCode": "64041990",
        "itemList": item_list
    }

    for ed in eway_dirs:
        indiv_path = ed / f"{inv_no_clean}_Eway.json"
        with open(indiv_path, "w", encoding="utf-8") as f:
            json.dump({"version": "1.0.1118", "billLists": [bill]}, f, indent=2)
        print(f"  [EWAY JSON SAVED] {indiv_path}")

    # Append to bulk 12 JSON to create complete 13-store bulk JSON
    bulk_12_path = Path(FINAL_1009_DIR) / "EWayBill_Bulk_Upload_12_Invoices_10092026.json"
    bulk_13_path = Path(FINAL_1009_DIR) / "EWayBill_Bulk_Upload_13_Invoices_10092026.json"
    all_bills = []
    if bulk_12_path.exists():
        with open(bulk_12_path, "r", encoding="utf-8") as f:
            b12_data = json.load(f)
            all_bills = [b for b in b12_data.get("billLists", []) if b.get("docNo") != actual_inv_no]
    all_bills.append(bill)
    all_bills.sort(key=lambda x: x.get("docNo", ""))

    with open(bulk_13_path, "w", encoding="utf-8") as f:
        json.dump({"version": "1.0.1118", "billLists": all_bills}, f, indent=2)
    print(f"  [CONSOLIDATED 13-STORE BULK EWAY JSON SAVED] {bulk_13_path}")

    # 4. Update Excel Sheet RIL_Dispatch10092026.xlsx
    print("\n--- Updating RIL_Dispatch10092026.xlsx (Column O & Green Highlight) ---")
    wb = openpyxl.load_workbook(SOURCE_EXCEL)
    ws = wb["08-09-2026"]
    green_fill = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")

    updated_rows = 0
    for r in range(2, ws.max_row + 1):
        st = ws.cell(r, 1).value
        if st and str(st).strip() == STORE_CODE:
            ws.cell(r, 15).value = inv_no_clean
            ws.cell(r, 15).fill = green_fill
            updated_rows += 1

    wb.save(SOURCE_EXCEL)
    print(f"  [EXCEL SAVED] Marked {updated_rows} rows green in {SOURCE_EXCEL} (Sheet '08-09-2026').")

    print("\n" + "=" * 80)
    print(f"SYNCHRONIZATION & EXPORT COMPLETE FOR {actual_inv_no}!")
    print(f"Total Quantity: {tot_qty} pairs")
    print(f"Taxable Value: Rs. {tot_taxable:,.2f}")
    print(f"IGST (5%): Rs. {tot_igst:,.2f}")
    print(f"Grand Total: Rs. {grand_total:,.2f}")
    print(f"Cartons: {cartons}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(sync_and_export_bill_150())
