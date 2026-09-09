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
import re
import json
import datetime
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
import openpyxl
import psycopg2

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
SOURCE_FILE = r"F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch-2.xlsx"
SHEET_NAME = "08-09-2026"

def money(val):
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def normalized_color(val):
    v = str(val).strip().upper()
    v = {"CHIKOO": "CHIKKU", "GUNMETAL": "GUNMTL"}.get(v, v)
    return v.replace(" ", "")

def number_to_indian_words(num: float) -> str:
    if num == 0:
        return "Zero Rupees Only"

    single_digits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    double_digits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens_multiple = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def get_word_for_three_digits(n: int) -> str:
        word = ""
        if n >= 100:
            word += single_digits[n // 100] + " Hundred "
            n %= 100
        if 10 <= n < 20:
            word += double_digits[n - 10] + " "
        elif n >= 20:
            word += tens_multiple[n // 10] + " " + single_digits[n % 10] + " "
        elif n > 0:
            word += single_digits[n] + " "
        return word

    str_words = ""
    integer_part = int(num)
    paisa_part = round((num - integer_part) * 100)

    if integer_part >= 10000000:
        str_words += get_word_for_three_digits(integer_part // 10000000) + "Crore "
        integer_part %= 10000000
    if integer_part >= 100000:
        str_words += get_word_for_three_digits(integer_part // 100000) + "Lakh "
        integer_part %= 100000
    if integer_part >= 1000:
        str_words += get_word_for_three_digits(integer_part // 1000) + "Thousand "
        integer_part %= 1000
    if integer_part > 0:
        str_words += get_word_for_three_digits(integer_part)

    trimmed_rupees = str_words.strip()
    rupee_unit = "Rupee" if int(abs(num)) == 1 else "Rupees"

    if trimmed_rupees:
        result = f"{trimmed_rupees} {rupee_unit}"
    else:
        result = "Zero Rupees"

    if paisa_part > 0:
        result += " and " + get_word_for_three_digits(paisa_part).strip() + " Paisa"
    result += " Only"
    return re.sub(r' {2,}', ' ', result).strip()

def main():
    print("=" * 100)
    print("SMRITI RETAIL OS — DISPATCH INVOICE SYNCHRONIZATION")
    print(f"Source Excel: {SOURCE_FILE}")
    print(f"Active Sheet: {SHEET_NAME}")
    print("=" * 100)

    # 1. Load Excel workbook and classify stores
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

    # Classify stores into update and exclude
    update_stores = {}
    exclude_stores = {}
    for store, rlist in stores_rows.items():
        has_star = any("*" in r["col_n"] for r in rlist)
        has_green = any("92D050" in r["fill_color"].upper() or "00FF00" in r["fill_color"].upper() or (r["fill_color"] and r["fill_color"] not in ("00000000", "0", "None", "")) for r in rlist)
        if has_star or has_green:
            exclude_stores[store] = rlist
        else:
            update_stores[store] = rlist

    print(f"Total stores found: {len(stores_rows)}")
    print(f"  - Excluded stores (star in N or green in O): {len(exclude_stores)}")
    print(f"  - Target update stores: {len(update_stores)}")

    if len(update_stores) != 25:
        raise RuntimeError(f"Expected exactly 25 update stores, found {len(update_stores)}")

    # 2. Connect to database
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Load products mapping
        cur.execute("SELECT sku, id, item_id, name, hsn_code, gst_percentage FROM products WHERE is_deleted = false")
        product_map = {r[0].upper(): {"product_id": r[1], "item_id": r[2], "name": r[3], "hsn": r[4], "gst": r[5]} for r in cur.fetchall() if r[0]}

        # Load invoices to update
        cur.execute("""
            SELECT si.id, si.invoice_no, si.delivery_store_code, si.is_interstate,
                   si.taxable_value, si.tax_total, si.grand_total,
                   COALESCE(SUM(sii.quantity), 0) as old_qty,
                   COUNT(sii.id) as old_lines
            FROM sales_invoices si
            LEFT JOIN sales_invoice_items sii ON si.id = sii.invoice_id
            WHERE si.delivery_store_code = ANY(%s)
              AND si.import_batch_id = 'DISPATCH_20260902_STORE_GROUPED_V2'
            GROUP BY si.id, si.invoice_no, si.delivery_store_code, si.is_interstate,
                     si.taxable_value, si.tax_total, si.grand_total
            ORDER BY CAST(SPLIT_PART(si.invoice_no, '/', 2) AS INTEGER)
        """, (list(update_stores.keys()),))

        db_invoices = cur.fetchall()
        if len(db_invoices) != 25:
            raise RuntimeError(f"Expected 25 invoices in DB for update stores, found {len(db_invoices)}")

        print("\n" + "=" * 130)
        print(f"{'STORE':<8} | {'INVOICE NO':<16} | {'OLD QTY':<9} | {'NEW QTY':<9} | {'DIFF QTY':<9} | {'OLD TOTAL':<12} | {'NEW TOTAL':<12} | {'DIFF TOTAL':<11} | STATUS")
        print("=" * 130)

        total_old_qty = Decimal("0")
        total_new_qty = Decimal("0")
        total_old_grand = Decimal("0")
        total_new_grand = Decimal("0")
        total_lines_inserted = 0
        now_utc = datetime.datetime.now(datetime.timezone.utc)

        for inv in db_invoices:
            inv_id, inv_no, store, is_interstate, old_taxable, old_tax, old_grand, old_qty, old_lines = inv
            rlist = update_stores[store]

            total_old_qty += old_qty
            total_old_grand += old_grand

            # Build new lines from Excel
            new_lines = []
            inv_qty = Decimal("0")
            inv_subtotal_taxable = Decimal("0.00")
            inv_cgst = Decimal("0.00")
            inv_sgst = Decimal("0.00")
            inv_igst = Decimal("0.00")

            line_seq = 0
            for item in rlist:
                v = item["vals"]
                article = str(v[col_map["ARTICLE"]]).strip().upper()
                raw_color = str(v[col_map["COLOR"]]).strip().upper()
                color = normalized_color(raw_color)
                mrp = money(v[col_map["MRP"]])

                for size in (36, 37, 38, 39, 40, 41, 42):
                    raw_qty = v[col_map[size]]
                    if raw_qty in (None, "", "-") or float(raw_qty) <= 0:
                        continue
                    qty = Decimal(str(raw_qty))
                    sku = f"{article}-{color}-{size}".upper()

                    pinfo = product_map.get(sku)
                    if not pinfo:
                        raise RuntimeError(f"Missing product in master for SKU: {sku}")

                    line_seq += 1
                    # Unit rate: MRP * 0.5624 (Trade discount 43.76%)
                    unit_rate = (mrp * Decimal("0.5624")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    line_taxable = (unit_rate * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    inv_subtotal_taxable += line_taxable

                    if is_interstate:
                        line_igst = (line_taxable * Decimal("0.05")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        line_cgst = Decimal("0.00")
                        line_sgst = Decimal("0.00")
                        line_tax = line_igst
                        inv_igst += line_igst
                    else:
                        line_cgst = (line_taxable * Decimal("0.025")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        line_sgst = (line_taxable * Decimal("0.025")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        line_igst = Decimal("0.00")
                        line_tax = line_cgst + line_sgst
                        inv_cgst += line_cgst
                        inv_sgst += line_sgst

                    line_total = line_taxable + line_tax
                    inv_qty += qty

                    new_lines.append({
                        "invoice_id": inv_id,
                        "product_id": pinfo["product_id"],
                        "code": sku,
                        "name": f"{article} {raw_color} {size}",
                        "quantity": qty,
                        "price": unit_rate,
                        "hsn_code": "64032012",
                        "gst_rate": Decimal("5.00"),
                        "tax_amount": line_tax,
                        "total_amount": line_total,
                        "mrp": mrp,
                        "disc_pct": Decimal("43.76"),
                        "taxable_value": line_taxable,
                        "igst_amount": line_igst,
                        "cgst_amount": line_cgst,
                        "sgst_amount": line_sgst,
                        "line_no": line_seq,
                        "item_id": pinfo["item_id"],
                        "source_line_type": "DISPATCH_IMPORT",
                        "source_line_id": f"{store}:{line_seq}"
                    })

            inv_total_tax = inv_igst if is_interstate else (inv_cgst + inv_sgst)
            pre_round = inv_subtotal_taxable + inv_total_tax
            new_grand = round(pre_round)
            round_adj = new_grand - pre_round
            words = number_to_indian_words(float(new_grand))

            # 1. Delete existing lines for this invoice
            cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s", (inv_id,))

            # 2. Insert updated lines
            for nl in new_lines:
                cur.execute("""
                    INSERT INTO sales_invoice_items (
                        invoice_id, product_id, code, name, quantity, price, hsn_code,
                        gst_rate, tax_amount, total_amount, mrp, disc_pct, taxable_value,
                        igst_amount, cgst_amount, sgst_amount, line_no, item_id,
                        source_line_type, source_line_id
                    ) VALUES (
                        %(invoice_id)s, %(product_id)s, %(code)s, %(name)s, %(quantity)s, %(price)s, %(hsn_code)s,
                        %(gst_rate)s, %(tax_amount)s, %(total_amount)s, %(mrp)s, %(disc_pct)s, %(taxable_value)s,
                        %(igst_amount)s, %(cgst_amount)s, %(sgst_amount)s, %(line_no)s, %(item_id)s,
                        %(source_line_type)s, %(source_line_id)s
                    )
                """, nl)
            total_lines_inserted += len(new_lines)

            # 3. Update invoice header
            cur.execute("""
                UPDATE sales_invoices
                SET taxable_value = %s,
                    tax_total = %s,
                    grand_total = %s,
                    net_amount = %s,
                    rounding_amount = %s,
                    amount_in_words = %s,
                    source_file = %s,
                    source_document_id = %s,
                    modified_at = %s
                WHERE id = %s
            """, (
                inv_subtotal_taxable, inv_total_tax, new_grand, new_grand,
                round_adj, words, SOURCE_FILE, "RIL_Dispatch-2.xlsx",
                now_utc, inv_id
            ))

            diff_qty = inv_qty - old_qty
            diff_grand = new_grand - old_grand
            status_str = "REDUCED" if diff_qty < 0 or diff_grand < 0 else ("INCREASED" if diff_qty > 0 or diff_grand > 0 else "IDENTICAL")

            total_new_qty += inv_qty
            total_new_grand += new_grand

            print(f"{store:<8} | {inv_no:<16} | {old_qty:<9.0f} | {inv_qty:<9.0f} | {diff_qty:<+9.0f} | {old_grand:<12.2f} | {new_grand:<12.2f} | {diff_grand:<+11.2f} | {status_str}")

        print("=" * 130)
        print(f"{'TOTAL':<8} | {'25 INVOICES':<16} | {total_old_qty:<9.0f} | {total_new_qty:<9.0f} | {total_new_qty - total_old_qty:<+9.0f} | {total_old_grand:<12.2f} | {total_new_grand:<12.2f} | {total_new_grand - total_old_grand:<+11.2f} |")
        print("=" * 130)

        # Commit the transaction
        conn.commit()
        print("\nDATABASE COMMIT SUCCESSFUL: 25 Invoices and all line items atomically updated in smriti001!")
        print(f"Total Line Items Inserted: {total_lines_inserted}")

    except Exception as e:
        conn.rollback()
        print(f"\nDATABASE TRANSACTION ROLLED BACK DUE TO ERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
