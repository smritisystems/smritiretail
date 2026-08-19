"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
import sys
import io
import openpyxl
import psycopg2
from decimal import Decimal

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def reconcile():
    # 1. Load PO lines from Tattly_Threads_Consolidated_PO_Extraction.xlsx
    po_fp = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly_Threads_Consolidated_PO_Extraction.xlsx"
    wb = openpyxl.load_workbook(po_fp, read_only=True, data_only=True)
    ws = wb['PO_Line_Items_All']

    po_items_map = {} # (po_number, vendor_style_code, color, size) -> row
    header = None
    for row in ws.iter_rows(values_only=True):
        if header is None:
            header = [str(c) if c is not None else '' for c in row]
            continue
        row_dict = dict(zip(header, row))
        po_num = str(row_dict.get('PO_Number', '')).strip()
        style = str(row_dict.get('Vendor_Style_Code', '')).strip().upper()
        color = str(row_dict.get('Color', '')).strip().upper()
        size = str(row_dict.get('Size', '')).strip()
        
        # Key
        key = (po_num, style, color, size)
        po_items_map[key] = row_dict

    print(f"Loaded {len(po_items_map)} PO line items from PO extraction workbook.")

    # 2. Load Invoice line items from Postgres
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()

    invoices = [
        ("TT2026-2027/104", "inv-tt-104", "5182778198", "TUK5"),
        ("TT2026-2027/105", "inv-tt-105", "5182778209", "TYAC"),
        ("TT2026-2027/106", "inv-tt-106", "PO-PENDING", "TW07"),
    ]

    for inv_no, inv_id, po_num, sis in invoices:
        print("\n" + "=" * 90)
        print(f"RECONCILIATION AUDIT: {inv_no} (SIS: {sis}, PO: {po_num})")
        print("=" * 90)

        cur.execute("""
            SELECT code, name, quantity, price, mrp, disc_pct, taxable_value, gst_rate, tax_amount, total_amount
            FROM sales_invoice_items
            WHERE invoice_id = %s
            ORDER BY id;
        """, (inv_id,))
        inv_items = cur.fetchall()

        matched_count = 0
        mismatch_count = 0
        not_in_po_count = 0

        po_taxable_sum = Decimal("0.00")
        po_tax_sum = Decimal("0.00")
        po_total_sum = Decimal("0.00")

        inv_taxable_sum = Decimal("0.00")
        inv_tax_sum = Decimal("0.00")
        inv_total_sum = Decimal("0.00")

        print(f"{'ITEM / ARTICLE':<22} | {'QTY':<4} | {'MRP (PO/INV)':<14} | {'RATE (PO/INV)':<16} | {'TAXABLE (PO/INV)':<18} | {'STATUS'}")
        print("-" * 90)

        for it in inv_items:
            code, name, qty, price, mrp, disc, tx_val, rate, tax_amt, tot_amt = it
            inv_taxable_sum += tx_val
            inv_tax_sum += tax_amt
            inv_total_sum += tot_amt

            # Parse style, color, size from code e.g. "CH-19-E-CREAM-36"
            parts = code.split("-")
            # style might be "CH-19-E", color "CREAM", size "36"
            # let's find matching key in po_items_map
            matched_po_row = None
            for (p_num, p_style, p_color, p_sz), p_row in po_items_map.items():
                if p_num == po_num:
                    sku_candidate = f"{p_style}-{p_color}-{p_sz}".upper().replace(" ", "")
                    if sku_candidate == code.upper().replace(" ", ""):
                        matched_po_row = p_row
                        break
                    # Also try color normalization (e.g. R-GOLD vs ROSE GOLD)
                    if p_style in code and p_sz == str(code.split("-")[-1]):
                        matched_po_row = p_row
                        break

            if matched_po_row:
                po_mrp = Decimal(str(matched_po_row.get('MRP', '0')))
                po_base_cost = Decimal(str(matched_po_row.get('Base_Cost', '0'))).quantize(Decimal("0.01"))
                po_line_tx = (Decimal(qty) * po_base_cost).quantize(Decimal("0.01"))
                po_line_tax = (po_line_tx * Decimal("0.05")).quantize(Decimal("0.01"))
                po_line_tot = po_line_tx + po_line_tax

                po_taxable_sum += po_line_tx
                po_tax_sum += po_line_tax
                po_total_sum += po_line_tot

                mrp_match = (po_mrp == mrp)
                rate_match = (po_base_cost == price)
                tx_match = (po_line_tx == tx_val)

                if mrp_match and rate_match and tx_match:
                    matched_count += 1
                    status = "EXACT MATCH"
                else:
                    mismatch_count += 1
                    status = f"DIFF (MRP:{po_mrp}/{mrp}, Rate:{po_base_cost}/{price})"

                print(f"{name:<22} | {int(qty):<4} | {float(po_mrp):>6.2f}/{float(mrp):<6.2f} | {float(po_base_cost):>7.2f}/{float(price):<7.2f} | {float(po_line_tx):>8.2f}/{float(tx_val):<8.2f} | {status}")
            else:
                not_in_po_count += 1
                print(f"{name:<22} | {int(qty):<4} | {'N/A':>6}/{float(mrp):<6.2f} | {'N/A':>7}/{float(price):<7.2f} | {'N/A':>8}/{float(tx_val):<8.2f} | NO PO LINE (CALCULATED)")

        print("-" * 90)
        print(f"Summary for {inv_no}:")
        print(f"  Matched PO Lines    : {matched_count}")
        print(f"  Mismatched Lines    : {mismatch_count}")
        print(f"  No PO Match (TW07)  : {not_in_po_count}")
        print(f"  Total Taxable Value : PO = Rs. {po_taxable_sum:,.2f} | Invoice = Rs. {inv_taxable_sum:,.2f} | Delta = Rs. {inv_taxable_sum - po_taxable_sum:,.2f}")
        print(f"  Total IGST (5%)     : PO = Rs. {po_tax_sum:,.2f} | Invoice = Rs. {inv_tax_sum:,.2f} | Delta = Rs. {inv_tax_sum - po_tax_sum:,.2f}")
        print(f"  Grand Total         : PO = Rs. {po_total_sum:,.2f} | Invoice = Rs. {inv_total_sum:,.2f} | Delta = Rs. {inv_total_sum - po_total_sum:,.2f}")

    conn.close()

if __name__ == "__main__":
    reconcile()
