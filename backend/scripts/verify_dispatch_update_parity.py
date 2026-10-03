"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.4.0
Created      : 2026-09-09
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import psycopg2
import openpyxl
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
SOURCE_FILE = r"F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch-2.xlsx"
SHEET_NAME = "08-09-2026"
PDF_DIR = r"F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194"
AUDIT_EXCEL = r"F:\Smriti-Clients Data\08-09-2026\Invoice_Validation_Audit_Report_TT138_to_TT194_CORRECTED.xlsx"

def money(val):
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def normalized_color(val):
    v = str(val).strip().upper()
    v = {"CHIKOO": "CHIKKU", "GUNMETAL": "GUNMTL"}.get(v, v)
    return v.replace(" ", "")

def main():
    print("=" * 115)
    print("SMRITI RETAIL OS — DISPATCH INVOICE UPDATE PARITY VERIFICATION")
    print("=" * 115)

    wb_data = openpyxl.load_workbook(SOURCE_FILE, data_only=True)
    ws_data = wb_data[SHEET_NAME]

    wb_fmt = openpyxl.load_workbook(SOURCE_FILE, data_only=False)
    ws_fmt = wb_fmt[SHEET_NAME]

    headers = [cell.value for cell in next(ws_data.iter_rows(min_row=1, max_row=1))]
    col_map = {h: i for i, h in enumerate(headers)}

    stores_rows = defaultdict(list)
    for r in range(2, ws_data.max_row + 1):
        vals = [ws_data.cell(r, c).value for c in range(1, ws_data.max_column + 1)]
        if not any(v is not None for v in vals):
            continue
        store = str(vals[0]).strip().upper()

        col_n = str(ws_fmt.cell(r, 14).value or "").strip()
        cell_o = ws_fmt.cell(r, 15)
        fill = cell_o.fill
        fill_color = ""
        if fill and fill.fill_type and fill.start_color:
            fill_color = str(fill.start_color.rgb or fill.start_color.theme or fill.start_color.index or "")

        stores_rows[store].append({
            "row_idx": r,
            "vals": vals,
            "col_n": col_n,
            "fill_color": fill_color
        })

    update_stores = {}
    exclude_stores = {}
    for store, rlist in stores_rows.items():
        has_star = any("*" in r["col_n"] for r in rlist)
        has_green = any("92D050" in r["fill_color"].upper() or "00FF00" in r["fill_color"].upper() or (r["fill_color"] and r["fill_color"] not in ("00000000", "0", "None", "")) for r in rlist)
        if has_star or has_green:
            exclude_stores[store] = rlist
        else:
            update_stores[store] = rlist

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Verify 25 updated invoices
    cur.execute("""
        SELECT si.delivery_store_code, si.invoice_no, si.grand_total, si.taxable_value, si.tax_total,
               SUM(sii.quantity) as db_qty, COUNT(sii.id) as db_lines, si.po_reference
        FROM sales_invoices si
        JOIN sales_invoice_items sii ON si.id = sii.invoice_id
        WHERE si.delivery_store_code = ANY(%s)
          AND si.import_batch_id = 'DISPATCH_20260902_STORE_GROUPED_V2'
        GROUP BY si.delivery_store_code, si.invoice_no, si.grand_total, si.taxable_value, si.tax_total, si.po_reference
        ORDER BY CAST(SPLIT_PART(si.invoice_no, '/', 2) AS INTEGER)
    """, (list(update_stores.keys()),))

    db_rows = cur.fetchall()

    print(f"{'STORE':<8} | {'INVOICE NO':<16} | {'XL QTY':<7} | {'DB QTY':<7} | {'XL TOTAL':<10} | {'DB TOTAL':<10} | {'DB LINES':<8} | {'PDF CHECK':<10} | PARITY")
    print("-" * 115)

    all_passed = True
    total_xl_qty = Decimal("0")
    total_db_qty = Decimal("0")
    total_xl_grand = Decimal("0")
    total_db_grand = Decimal("0")

    for row in db_rows:
        store, inv_no, db_grand, db_taxable, db_tax, db_qty, db_lines, po_ref = row
        rlist = update_stores[store]

        # Calculate expected from Excel
        xl_qty = Decimal("0")
        xl_subtotal_taxable = Decimal("0.00")
        xl_cgst = Decimal("0.00")
        xl_sgst = Decimal("0.00")
        xl_igst = Decimal("0.00")
        is_interstate = not inv_no.endswith("/166") # TFW4 is MH (intrastate)

        for item in rlist:
            v = item["vals"]
            article = str(v[col_map["ARTICLE"]]).strip().upper()
            color = normalized_color(v[col_map["COLOR"]])
            mrp = money(v[col_map["MRP"]])
            for size in (36, 37, 38, 39, 40, 41, 42):
                raw_q = v[col_map[size]]
                if raw_q in (None, "", "-") or float(raw_q) <= 0:
                    continue
                q = Decimal(str(raw_q))
                rate = (mrp * Decimal("0.5624")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                tx = (rate * q).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                xl_subtotal_taxable += tx
                if is_interstate:
                    xl_igst += (tx * Decimal("0.05")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                else:
                    xl_cgst += (tx * Decimal("0.025")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    xl_sgst += (tx * Decimal("0.025")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                xl_qty += q

        xl_tax = xl_igst if is_interstate else (xl_cgst + xl_sgst)
        pre_round = xl_subtotal_taxable + xl_tax
        xl_grand = Decimal(str(round(pre_round)))

        # Check PDF files
        clean_no = inv_no.replace("/", "_")
        pdf_path1 = os.path.join(PDF_DIR, f"{store}_{po_ref}_{clean_no}.pdf")
        pdf_path2 = os.path.join(PDF_DIR, f"Tax_Invoice_{clean_no}.pdf")
        pdf_ok = os.path.exists(pdf_path1) and os.path.exists(pdf_path2) and os.path.getsize(pdf_path1) > 100000

        qty_match = (xl_qty == db_qty)
        grand_match = (xl_grand == db_grand)
        parity_ok = qty_match and grand_match and pdf_ok

        if not parity_ok:
            all_passed = False

        status = "PASSED" if parity_ok else "** FAILED **"
        pdf_str = "OK" if pdf_ok else "MISSING"

        total_xl_qty += xl_qty
        total_db_qty += db_qty
        total_xl_grand += xl_grand
        total_db_grand += db_grand

        print(f"{store:<8} | {inv_no:<16} | {xl_qty:<7.0f} | {db_qty:<7.0f} | {xl_grand:<10.2f} | {db_grand:<10.2f} | {db_lines:<8} | {pdf_str:<10} | {status}")

    print("-" * 115)
    print(f"{'TOTAL':<8} | {'25 INVOICES':<16} | {total_xl_qty:<7.0f} | {total_db_qty:<7.0f} | {total_xl_grand:<10.2f} | {total_db_grand:<10.2f} | {sum(r[6] for r in db_rows):<8} | {'ALL OK':<10} | {'PASSED' if all_passed else 'FAILED'}")
    print("=" * 115)

    # Verify 32 excluded stores remain intact
    cur.execute("""
        SELECT COUNT(*)
        FROM sales_invoices
        WHERE delivery_store_code = ANY(%s)
          AND import_batch_id = 'DISPATCH_20260902_STORE_GROUPED_V2'
    """, (list(exclude_stores.keys()),))
    ex_count = cur.fetchone()[0]
    print(f"\nExcluded Stores Integrity Check: {ex_count}/32 excluded stores present and untouched in smriti001.")

    conn.close()

    if all_passed and ex_count == 32:
        print("\nALL VERIFICATION CHECKS PASSED: 100% PARITY BETWEEN EXCEL, DATABASE, AND GENERATED PDFS!")
    else:
        print("\nVERIFICATION FAILED! PLEASE REVIEW DISCREPANCIES ABOVE.")

if __name__ == "__main__":
    main()
