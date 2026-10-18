"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.95.0
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical PO and GRN Numbering & Date Remediation Engine
"""

import os
import sys
import json
import datetime
from decimal import Decimal
import openpyxl
import httpx
import asyncio

EXCEL_FILE = r"F:\Smriti-Clients Data\Tattly Threads\Purchase\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx"
BASE_URL = "https://tattlythreads.smritisys.com"
TENANT_DB = "smriti001"
DAYS_PRIOR_PO = 30

def clean_doc_no(val: str) -> str:
    return "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in str(val)).strip("_")

async def build_canonical_schedule():
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    ws = wb["Sheet1"]

    raw_bills = {}
    rows = list(ws.iter_rows(values_only=True))[2:]
    for r in rows:
        v_code = str(r[6]).strip() if r[6] else ''
        b_no = str(r[10]).strip() if r[10] else ''
        b_date = r[11]
        art = str(r[1]).strip() if r[1] else ''
        color = str(r[2]).strip().upper() if r[2] else ''

        if not b_no:
            if art == 'CH-20' and color == 'BEIGE':
                b_no = '707'
                b_date = datetime.date(2026, 9, 7)
            elif art == 'CH-22':
                b_no = '704'
                b_date = datetime.date(2026, 8, 10)
            elif art == 'CH-23':
                b_no = '706'
                b_date = datetime.date(2026, 8, 22)

        if v_code and b_no and b_no != 'None' and b_no != 'BNA' and b_date is not None:
            if isinstance(b_date, datetime.datetime):
                b_date = b_date.date()
            if b_date and b_date.year == 2036:
                b_date = datetime.date(2026, b_date.month, b_date.day)

            clean_b = clean_doc_no(b_no)
            key = f"{v_code}::{clean_b}"
            if key not in raw_bills:
                raw_bills[key] = {
                    "vendor_code": v_code,
                    "bill_no": b_no,
                    "clean_bill_no": clean_b,
                    "bill_date": b_date,
                    "po_date": b_date - datetime.timedelta(days=DAYS_PRIOR_PO),
                    "grn_date": b_date,
                    "legacy_po_no": f"PO-{v_code}-{clean_b}",
                    "legacy_grn_no": f"GRN-{v_code}-{clean_b}",
                }

    # Sort strictly chronologically by Bill Date, then Bill No
    sorted_bills = sorted(raw_bills.values(), key=lambda x: (x["bill_date"], x["bill_no"]))

    # Assign sequential numbers: PO/26-27/0001 .. PO/26-27/0028 and GRN/26-27/0001 .. GRN/26-27/0028
    for idx, item in enumerate(sorted_bills, start=1):
        item["seq"] = idx
        # Indian Financial Year
        b_d = item["bill_date"]
        fy = f"{str(b_d.year)[2:]}-{str(b_d.year+1)[2:]}" if b_d.month >= 4 else f"{str(b_d.year-1)[2:]}-{str(b_d.year)[2:]}"
        item["canonical_po_no"] = f"PO/{fy}/{idx:04d}"
        item["canonical_grn_no"] = f"GRN/{fy}/{idx:04d}"

    return sorted_bills

async def main():
    bills = await build_canonical_schedule()
    print("=" * 130)
    print(f"SMRITI RETAIL OS: CANONICAL DOCUMENT NUMBERING & CHRONOLOGICAL SCHEDULE ({len(bills)} TRANSACTIONS)")
    print("Standard Format: Prefix of Nature of Transaction + Financial Year (26-27) + 4-digit Running Number")
    print("PO Date Policy : Strictly 30 days prior to Vendor Bill Date")
    print("GRN Date Policy: Matches Vendor Delivery / Bill Date")
    print("=" * 130)
    header_str = (
        f"| {'#':<3} | {'CANONICAL PO NO':<16} | {'PO DATE (-30D)':<16} "
        f"| {'CANONICAL GRN NO':<17} | {'GRN/BILL DATE':<13} "
        f"| {'VENDOR BILL NO':<16} | {'LEGACY PO / GRN ID':<20} |"
    )
    print(header_str)
    print("|" + "-" * 5 + "|" + "-" * 18 + "|" + "-" * 18 + "|" + "-" * 19 + "|" + "-" * 15 + "|" + "-" * 18 + "|" + "-" * 22 + "|")
    for b in bills:
        row_str = (
            f"| {b['seq']:<3} | {b['canonical_po_no']:<16} | {str(b['po_date']):^16} "
            f"| {b['canonical_grn_no']:<17} | {str(b['bill_date']):^13} "
            f"| {b['bill_no'][:16]:<16} | {b['legacy_po_no'][:20]:<20} |"
        )
        print(row_str)
    print("=" * 130)

    # Generate SQL Migration Script file
    sql_lines = [
        "-- SMRITI RETAIL OS: CANONICAL DOCUMENT NUMBERING MIGRATION SCRIPT",
        "-- Database: smriti001",
        "-- Generated: 2026-10-19",
        "BEGIN;",
        ""
    ]
    for b in bills:
        po_c = b["canonical_po_no"]
        grn_c = b["canonical_grn_no"]
        leg_po = b["legacy_po_no"]
        leg_grn = b["legacy_grn_no"]
        b_no = b["bill_no"]
        b_d = b["bill_date"]
        po_d = b["po_date"]

        po_notes = f"Canonical Purchase Order: {po_c} | Vendor Bill: {b_no} (Dated {b_d}) | PO Issued: {po_d} | Legacy Ref: {leg_po}"
        grn_notes = f"Canonical GRN: {grn_c} | Inward against Vendor Bill {b_no} (Dated {b_d}) | PO Date: {po_d} | [LOGISTICS & LANDED COST: Date: {b_d}] | [VALUATION_COMPLETED] | Legacy Ref: {leg_grn}"

        sql_lines.append(f"-- Transaction #{b['seq']}: Vendor Bill {b_no}")
        sql_lines.append(f"UPDATE purchase_orders SET order_no = '{po_c}', notes = '{po_notes}', created_at = '{po_d} 09:00:00+00', modified_at = NOW() WHERE order_no = '{leg_po}';")
        sql_lines.append(f"UPDATE purchase_receipts SET receipt_no = '{grn_c}', notes = '{grn_notes}', created_at = '{b_d} 11:00:00+00', modified_at = NOW() WHERE receipt_no = '{leg_grn}';")
        sql_lines.append(f"UPDATE purchase_receipt_items SET purchase_order_no = '{po_c}' WHERE purchase_order_no = '{leg_po}';")
        sql_lines.append(f"UPDATE stock_movements SET reference_doc_id = '{grn_c}', created_at = '{b_d} 11:30:00+00' WHERE reference_doc_id = '{leg_grn}';")
        sql_lines.append("")

    sql_lines.append("COMMIT;")
    sql_path = r"F:\SMRITRretailNX\scripts\migrate_canonical_po_grn_numbers.sql"
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    print(f"\n[OK] Generated raw SQL migration script: {sql_path}")

if __name__ == "__main__":
    asyncio.run(main())
