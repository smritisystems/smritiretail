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

po_fp = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly_Threads_Consolidated_PO_Extraction.xlsx"
wb = openpyxl.load_workbook(po_fp, read_only=True, data_only=True)
ws = wb['PO_Line_Items_All']

po_items_map = {}
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
    key = (po_num, style, color, size)
    po_items_map[key] = row_dict

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor()

invoices = [
    ("TT2026-2027/104", "inv-tt-104", "5182778198", "TUK5"),
    ("TT2026-2027/105", "inv-tt-105", "5182778209", "TYAC"),
]

for inv_no, inv_id, po_num, sis in invoices:
    print("\n" + "=" * 95)
    print(f"RECONCILIATION: {inv_no} (SIS: {sis}, PO: {po_num})")
    print("=" * 95)

    cur.execute("""
        SELECT code, name, quantity, price, mrp, disc_pct, taxable_value, gst_rate, tax_amount, total_amount
        FROM sales_invoice_items
        WHERE invoice_id = %s
        ORDER BY id;
    """, (inv_id,))
    inv_items = cur.fetchall()

    matched = 0
    mismatched = 0

    print(f"{'ARTICLE / SIZE':<22} | {'QTY':<4} | {'PO MRP':<8} | {'INV MRP':<8} | {'PO RATE':<8} | {'INV RATE':<8} | {'PO TAXABLE':<10} | {'INV TAXABLE':<11} | {'STATUS'}")
    print("-" * 95)

    for it in inv_items:
        code, name, qty, price, mrp, disc, tx_val, rate, tax_amt, tot_amt = it

        matched_po_row = None
        for (p_num, p_style, p_color, p_sz), p_row in po_items_map.items():
            if p_num == po_num and p_style in code and p_sz == str(code.split("-")[-1]):
                matched_po_row = p_row
                break

        if matched_po_row:
            po_mrp = Decimal(str(matched_po_row.get('MRP', '0')))
            po_base_cost = Decimal(str(matched_po_row.get('Base_Cost', '0'))).quantize(Decimal("0.01"))
            po_line_tx = (Decimal(qty) * po_base_cost).quantize(Decimal("0.01"))
            
            mrp_match = (po_mrp == mrp)
            rate_match = (po_base_cost == price)
            tx_match = (po_line_tx == tx_val)

            if mrp_match and rate_match and tx_match:
                matched += 1
                status = "EXACT MATCH ✓"
            else:
                mismatched += 1
                status = "MISMATCH"

            print(f"{name:<22} | {int(qty):<4} | {float(po_mrp):>8.2f} | {float(mrp):>8.2f} | {float(po_base_cost):>8.2f} | {float(price):>8.2f} | {float(po_line_tx):>10.2f} | {float(tx_val):>11.2f} | {status}")

    print("-" * 95)
    print(f"Result for {inv_no}: {matched}/{len(inv_items)} lines 100% matched with official PO {po_num}.")

conn.close()
