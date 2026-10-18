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
Classification: Synchronize Live GRN Notes with Real Invoice Dates
"""

import openpyxl
import datetime
from collections import defaultdict
import httpx
import asyncio

EXCEL_FILE = r"F:\Smriti-Clients Data\Tattly Threads\Purchase\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx"
BASE_URL = "https://tattlythreads.smritisys.com"

def clean_doc_no(val: str) -> str:
    return "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in str(val)).strip("_")

async def main():
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    ws = wb["Sheet1"]

    excel_bills = {}
    for r in list(ws.iter_rows(values_only=True))[2:]:
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
            grn_num = f"GRN-{v_code}-{clean_b}"
            excel_bills[grn_num] = {
                "vendor_code": v_code,
                "bill_no": b_no,
                "bill_date": b_date,
            }

    async with httpx.AsyncClient(timeout=30.0) as client:
        login = await client.post(f"{BASE_URL}/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        r_grn = await client.get(f"{BASE_URL}/api/v1/purchase/receipts", headers=headers)
        live_grns = r_grn.json()

        updated = 0
        for g in live_grns:
            rcpt_no = g.get("receipt_no")
            if rcpt_no in excel_bills:
                info = excel_bills[rcpt_no]
                b_no = info["bill_no"]
                b_d = info["bill_date"]
                new_notes = f"GRN Inward against Vendor Bill {b_no} (Dated {b_d}) | Effective Opening Stock Date: {b_d} | [LOGISTICS & LANDED COST: Date: {b_d}] | [VALUATION_COMPLETED]"
                put_res = await client.put(f"{BASE_URL}/api/v1/purchase/receipts/{g['id']}", json={"notes": new_notes}, headers=headers)
                if put_res.status_code == 200:
                    updated += 1
                else:
                    print(f"Failed {rcpt_no}: {put_res.status_code}")

        print(f"Successfully updated notes on {updated} / {len(excel_bills)} live GRNs!")

if __name__ == "__main__":
    asyncio.run(main())
