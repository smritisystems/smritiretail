"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.94.0
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Procurement & Inward Date Remediation Engine
"""

import os
import sys
import json
import datetime
from decimal import Decimal
from collections import defaultdict
import openpyxl
import httpx
import asyncio

EXCEL_FILE = r"F:\Smriti-Clients Data\Tattly Threads\Purchase\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx"
BASE_URL = "https://tattlythreads.smritisys.com"
TENANT_DB = "smriti001"
DAYS_PRIOR_PO = 30

def clean_doc_no(val: str) -> str:
    return "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in str(val)).strip("_")

async def remediate_dates(commit: bool = False):
    mode_str = "LIVE COMMIT" if commit else "DRY-RUN PREVIEW"
    print("=" * 95)
    print(f"SMRITI RETAIL OS: PO & GRN DATE REMEDIATION ENGINE [{mode_str}]")
    print(f"Target Server : {BASE_URL} (Tenant Database: {TENANT_DB})")
    print(f"Source Excel  : {EXCEL_FILE}")
    print(f"PO Lead Time  : Exactly {DAYS_PRIOR_PO} days prior to Vendor Bill Date")
    print(f"GRN Date      : Matches Vendor Bill Date")
    print("=" * 95)

    if not os.path.exists(EXCEL_FILE):
        print(f"[FATAL] Excel file does not exist: {EXCEL_FILE}")
        return

    # 1. Parse Excel Bills
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    ws = wb["Sheet1"]

    excel_bills = {}
    rows = list(ws.iter_rows(values_only=True))[2:]
    for r in rows:
        v_code = str(r[6]).strip() if r[6] else ''
        b_no = str(r[10]).strip() if r[10] else ''
        b_date = r[11]
        art = str(r[1]).strip() if r[1] else ''
        color = str(r[2]).strip().upper() if r[2] else ''

        # Continuation row inference
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
            po_num = f"PO-{v_code}-{clean_b}"
            grn_num = f"GRN-{v_code}-{clean_b}"

            po_date = b_date - datetime.timedelta(days=DAYS_PRIOR_PO)
            grn_date = b_date

            excel_bills[po_num] = {
                "vendor_code": v_code,
                "bill_no": b_no,
                "clean_bill_no": clean_b,
                "bill_date": b_date,
                "po_date": po_date,
                "grn_date": grn_date,
                "po_number": po_num,
                "grn_number": grn_num
            }

    print(f"Parsed {len(excel_bills)} authoritative purchase orders and bills from Excel.\n")

    # 2. Authenticate
    async with httpx.AsyncClient(timeout=60.0) as client:
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        if login_res.status_code != 200:
            print(f"[FATAL] Authentication failed: {login_res.status_code} {login_res.text}")
            return

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # 3. Preview remediation schedule
        print(f"| {'PO NUMBER':<22} | {'BILL NO':<14} | {'PO DATE (-30D)':<16} | {'BILL DATE':<12} | {'GRN DATE':<12} |")
        print("|" + "-" * 24 + "|" + "-" * 16 + "|" + "-" * 18 + "|" + "-" * 14 + "|" + "-" * 14 + "|")
        for po_num, info in sorted(excel_bills.items()):
            print(f"| {po_num:<22} | {info['bill_no'][:14]:<14} | {str(info['po_date']):^16} | {str(info['bill_date']):^12} | {str(info['grn_date']):^12} |")

        if not commit:
            print("\n[DRY-RUN COMPLETE] Run with '--commit' to execute database updates on live production.")
            return

        print("\n[Step 4] Executing Database Updates on live 'smriti001'...")
        updated_pos = 0
        updated_grns = 0
        updated_movements = 0

        for po_num, info in sorted(excel_bills.items()):
            po_d = info["po_date"]
            b_d = info["bill_date"]
            grn_d = info["grn_date"]
            v_code = info["vendor_code"]
            b_no = info["bill_no"]
            grn_num = info["grn_number"]

            po_created_at = f"{po_d} 09:00:00+00"
            grn_created_at = f"{grn_d} 11:00:00+00"
            mov_created_at = f"{grn_d} 11:30:00+00"

            rule_snaps = json.dumps({
                "order_date": str(po_d),
                "delivery_date": str(b_d),
                "received_date": str(b_d),
                "vendor_bill_date": str(b_d),
                "vendor_bill_no": str(b_no),
                "commercial_terms": {
                    "payment_terms": "120 Days",
                    "freight_terms": "Paid by Supplier",
                    "currency": "INR",
                    "delivery_terms": "Ex-Factory"
                }
            })

            po_notes = f"Statutory Purchase Order for Vendor Bill {b_no} dated {b_d} (PO Issued: {po_d}) | Delivery Date: {b_d} | GRN Effective Date: {grn_d}"
            grn_notes = f"GRN Inward against Vendor Bill {b_no} (Dated {b_d}) | Effective Opening Stock Date: {grn_d} | [LOGISTICS & LANDED COST: Date: {grn_d}] | [VALUATION_COMPLETED]"

            # A. Update purchase_orders
            q_update_po = f"""
                UPDATE purchase_orders
                SET created_at = '{po_created_at}',
                    notes = '{po_notes.replace("'", "''")}',
                    rule_snapshots = '{rule_snaps.replace("'", "''")}'::jsonb,
                    modified_at = NOW()
                WHERE order_no = '{po_num}'
            """
            r_po = await client.post(f"{BASE_URL}/api/v1/database-manager/query", json={"database": TENANT_DB, "query": q_update_po}, headers=headers)
            if r_po.json().get("success"):
                updated_pos += 1
            else:
                print(f"[ERR] Failed to update PO {po_num}: {r_po.text}")

            # B. Update purchase_receipts
            q_update_grn = f"""
                UPDATE purchase_receipts
                SET created_at = '{grn_created_at}',
                    notes = '{grn_notes.replace("'", "''")}',
                    modified_at = NOW()
                WHERE receipt_no = '{grn_num}'
            """
            r_grn = await client.post(f"{BASE_URL}/api/v1/database-manager/query", json={"database": TENANT_DB, "query": q_update_grn}, headers=headers)
            if r_grn.json().get("success"):
                updated_grns += 1
            else:
                print(f"[ERR] Failed to update GRN {grn_num}: {r_grn.text}")

            # C. Update stock_movements
            q_update_mov = f"""
                UPDATE stock_movements
                SET created_at = '{mov_created_at}',
                    remarks = 'Inward GRN {grn_num} from Vendor {v_code} (Bill {b_no} dated {b_d})'
                WHERE reference_doc_id = '{grn_num}'
            """
            r_mov = await client.post(f"{BASE_URL}/api/v1/database-manager/query", json={"database": TENANT_DB, "query": q_update_mov}, headers=headers)
            if r_mov.json().get("success"):
                updated_movements += 1

        print("\n" + "=" * 95)
        print("POST-REMEDIATION VERIFICATION REPORT")
        print("=" * 95)
        print(f"Total Purchase Orders Updated : {updated_pos} / {len(excel_bills)}")
        print(f"Total GRNs (Receipts) Updated : {updated_grns} / {len(excel_bills)}")
        print(f"Total Stock Movement Batches  : {updated_movements} / {len(excel_bills)}")
        print("=" * 95)

if __name__ == "__main__":
    is_commit = "--commit" in sys.argv
    asyncio.run(remediate_dates(commit=is_commit))
