"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.2
  Created      : 2026-09-10
  Classification: Canonical Dispatch Invoice TXAJ & TY06 Synchronization & Export Engine
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

SOURCE_EXCEL_2 = r"F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026-2.xlsx"
SOURCE_EXCEL_1 = r"F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026.xlsx"
FINAL_1009_DIR = r"F:\Smriti-Clients Data\10-09-2026\Final"
FINAL_0809_DIR = r"F:\Smriti-Clients Data\08-09-2026\Final"
MIRROR_EWAY_DIR = r"F:\Smriti-Clients Data\Eway\Final"
ROTATED_LOGO_DIR = r"F:\Smriti-Clients Data\10-09-2026\Tax_Invoices_Rotated_Logo"
TAX_INV_ARCHIVE_DIR = r"F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194"

TARGET_STORES = [
    {
        "store_code": "TXAJ",
        "inv_no": "TT2026-2027/190",
        "po_number": "5182778205",
        "site_name": "RRL TRENDS FOOTWEAR PALAVAKKAM",
        "city": "Chennai",
        "pincode": 600041,
        "state": "TAMIL NADU",
        "state_code": "33",
        "gstin": "33AABCR1718E1ZW",
        "is_interstate": True,
        "distance_km": 1340,
        "shipping_address": (
            "Reliance Retail Limited (RRL TRENDS FOOTWEAR PALAVAKKAM)\n"
            "Block 4 Right Side No 4/222 East Coast Road Palavakkam,Palavakkam,CHENNAI600041"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Block 4 Right Side No 4/222 East Coast Road Palavakkam,Palavakkam,CHENNAI600041"
        )
    },
    {
        "store_code": "TY06",
        "inv_no": "TT2026-2027/193",
        "po_number": "5182778208",
        "site_name": "VARANASI DURGAKUND",
        "city": "Varanasi",
        "pincode": 221005,
        "state": "UTTAR PRADESH",
        "state_code": "09",
        "gstin": "09AABCR1718E1ZN",
        "is_interstate": True,
        "distance_km": 1380,
        "shipping_address": (
            "Reliance Retail Limited (VARANASI DURGAKUND)\n"
            "Shyam Kripa Complex,Situated at Durgakund,B 36/10-PJ1+ PJ2,VARANASI221005"
        ),
        "billing_address": (
            "Reliance Retail Limited\n"
            "Shyam Kripa Complex,Situated at Durgakund,B 36/10-PJ1+ PJ2,VARANASI221005"
        )
    }
]

def clean_addr(text, max_len=120):
    t = re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()
    t = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', t).strip()
    return t[:max_len]

async def sync_and_export_txaj_ty06():
    print("=" * 80)
    print("SMRITI RETAIL OS: SYNCHRONIZING & EXPORTING TXAJ & TY06 FROM RIL_Dispatch10092026-2.xlsx")
    print(f"Source Excel: {SOURCE_EXCEL_2}")
    print("=" * 80)

    # 1. Read sheet 08-09-2026
    df = pd.read_excel(SOURCE_EXCEL_2, sheet_name="08-09-2026")
    size_cols = [36, 37, 38, 39, 40, 41, 42]

    # Connect DB
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    updated_invoices_info = []

    for target in TARGET_STORES:
        store_code = target["store_code"]
        inv_no = target["inv_no"]
        po_num = target["po_number"]

        sub = df[df.iloc[:, 0] == store_code]
        print(f"\nProcessing {store_code} ({inv_no}): {len(sub)} rows loaded from sheet.")
        cartons = sorted(list(set(str(c).strip() for c in sub['Cartoon number'].dropna().tolist() if str(c).strip() != '*')))
        print(f"Cartons: {cartons}")

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
        print(f"Deleted {old_items_deleted} existing items for {actual_inv_no} (ID: {inv_id}).")

        unpivoted_items = []
        tot_qty = 0
        tot_taxable = Decimal("0.00")
        tot_tax = Decimal("0.00")
        tot_cgst = Decimal("0.00")
        tot_sgst = Decimal("0.00")
        tot_igst = Decimal("0.00")

        line_no = 1
        is_interstate = target['is_interstate']

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
            "source_file": SOURCE_EXCEL_2,
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
            SOURCE_EXCEL_2, json.dumps(rule_snapshot), inv_id
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

        updated_invoices_info.append({
            "store_code": store_code,
            "inv_no": actual_inv_no,
            "inv_id": inv_id,
            "po_number": po_num,
            "target": target,
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

    sm = get_company_sessionmaker("smriti001")
    async with sm() as session:
        for u in updated_invoices_info:
            inv_no_clean = u['inv_no'].replace('/', '_')
            pdf_name_portal = f"{u['store_code']}_{u['po_number']}_{inv_no_clean}.pdf"
            pdf_name_generic = f"Tax_Invoice_{inv_no_clean}.pdf"

            primary_out = Path(FINAL_1009_DIR) / "Tax_Invoice_PDFs" / pdf_name_portal
            await InvoicePdfService.render_pdf_to_file(
                session=session,
                invoice_id=u['inv_id'],
                output_pdf_path=str(primary_out),
                company_id="COMP-001"
            )
            print(f"  [PRIMARY PDF SAVED] {primary_out} ({primary_out.stat().st_size:,} bytes)")

            for d in pdf_dirs:
                p_portal = d / pdf_name_portal
                p_generic = d / pdf_name_generic
                if p_portal != primary_out:
                    shutil.copyfile(primary_out, p_portal)
                shutil.copyfile(primary_out, p_generic)
                print(f"  [PDF COPIED] -> {p_portal.name} in {d.name}")

    # 3. Generate NIC v1.0.1118 E-Way Bill JSON Payloads
    print("\n--- Generating NIC v1.0.1118 E-Way Bill JSON Payloads ---")
    eway_dirs = [
        Path(FINAL_1009_DIR) / "Eway_JSON",
        Path(FINAL_0809_DIR) / "Eway_JSON",
        Path(MIRROR_EWAY_DIR) / "Eway_JSON"
    ]
    for d in eway_dirs:
        d.mkdir(parents=True, exist_ok=True)

    new_eway_bills = []
    for u in updated_invoices_info:
        target = u['target']
        is_interstate = target['is_interstate']

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
            "toGstin": target['gstin'],
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": clean_addr(target['shipping_address'].splitlines()[0], 120),
            "toAddr2": clean_addr(target['shipping_address'].splitlines()[1] if len(target['shipping_address'].splitlines()) > 1 else "", 120),
            "toPlace": target['city'],
            "toPincode": target['pincode'],
            "toStateCode": int(target['state_code']),
            "actualToStateCode": int(target['state_code']),
            "actToStateCode": int(target['state_code']),
            "totalValue": u['taxable_value'],
            "cgstValue": u['cgst_total'],
            "sgstValue": u['sgst_total'],
            "igstValue": u['igst_total'],
            "cessValue": 0.0,
            "totInvValue": u['grand_total'],
            "transMode": 1,
            "transDistance": target['distance_km'],
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
            indiv_path = ed / f"{inv_no_clean}_Eway.json"
            with open(indiv_path, "w", encoding="utf-8") as f:
                json.dump({"version": "1.0.1118", "billLists": [bill]}, f, indent=2)
            print(f"  [EWAY JSON SAVED] {indiv_path}")

        new_eway_bills.append(bill)

    # 4. Generate Consolidated 15-Store Bulk E-Way Bill JSON
    bulk_13_path = Path(FINAL_1009_DIR) / "EWayBill_Bulk_Upload_13_Invoices_10092026.json"
    bulk_15_path = Path(FINAL_1009_DIR) / "EWayBill_Bulk_Upload_15_Invoices_10092026.json"
    bulk_all_path = Path(FINAL_1009_DIR) / "EWayBill_Bulk_Upload_All_Updated_Invoices.json"

    all_bills = []
    base_path = bulk_13_path if bulk_13_path.exists() else (Path(FINAL_1009_DIR) / "EWayBill_Bulk_Upload_12_Invoices_10092026.json")
    if base_path.exists():
        with open(base_path, "r", encoding="utf-8") as f:
            b_data = json.load(f)
            updated_doc_nos = set(u['inv_no'] for u in updated_invoices_info)
            all_bills = [b for b in b_data.get("billLists", []) if b.get("docNo") not in updated_doc_nos]

    all_bills.extend(new_eway_bills)
    all_bills.sort(key=lambda x: x.get("docNo", ""))

    for out_p in [bulk_15_path, bulk_all_path]:
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump({"version": "1.0.1118", "billLists": all_bills}, f, indent=2)
        print(f"  [CONSOLIDATED 15-STORE BULK EWAY JSON SAVED] {out_p}")

    # 5. Update Excel Spreadsheets (Both -2 and original)
    print("\n--- Updating Excel Spreadsheets (Column O & Green Highlight) ---")
    green_fill = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")
    store_inv_map = {t['store_code']: t['inv_no'].replace('/', '_') for t in TARGET_STORES}

    for xf in [SOURCE_EXCEL_2, SOURCE_EXCEL_1]:
        if Path(xf).exists():
            wb = openpyxl.load_workbook(xf)
            if "08-09-2026" in wb.sheetnames:
                ws = wb["08-09-2026"]
                up_cnt = 0
                for r in range(2, ws.max_row + 1):
                    st = ws.cell(r, 1).value
                    if st and str(st).strip() in store_inv_map:
                        code = str(st).strip()
                        ws.cell(r, 15).value = store_inv_map[code]
                        ws.cell(r, 15).fill = green_fill
                        up_cnt += 1
                wb.save(xf)
                print(f"  [EXCEL SAVED] Marked {up_cnt} rows green in {xf} (Sheet '08-09-2026').")

    print("\n" + "=" * 80)
    print("SYNCHRONIZATION & EXPORT COMPLETE FOR TXAJ & TY06!")
    for u in updated_invoices_info:
        print(f"Store {u['store_code']} ({u['inv_no']}): {u['tot_qty']} pairs | Rs. {u['grand_total']:,.2f} | Cartons: {u['cartons']}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(sync_and_export_txaj_ty06())
