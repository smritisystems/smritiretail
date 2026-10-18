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
Classification: Diagnostic Script for Purchase Dates
"""

import asyncio
import httpx
import json

URL = "https://tattlythreads.smritisys.com"

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        login = await client.post(f"{URL}/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Columns of purchase_receipts
        q_cols_grn = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_receipts' ORDER BY ordinal_position;"
        r = await client.post(f"{URL}/api/v1/database-manager/query", json={"database": "smritisys", "query": q_cols_grn}, headers=headers)
        print("=== COLUMNS OF purchase_receipts ===")
        for col in r.json().get("rows", []):
            print(f"{col['column_name']:<25} : {col['data_type']}")

        # 2. Columns of purchase_orders
        q_cols_po = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_orders' ORDER BY ordinal_position;"
        r2 = await client.post(f"{URL}/api/v1/database-manager/query", json={"database": "smritisys", "query": q_cols_po}, headers=headers)
        print("\n=== COLUMNS OF purchase_orders ===")
        for col in r2.json().get("rows", []):
            print(f"{col['column_name']:<25} : {col['data_type']}")

        # 3. Columns of purchase_bills
        q_cols_pb = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_bills' ORDER BY ordinal_position;"
        r3 = await client.post(f"{URL}/api/v1/database-manager/query", json={"database": "smritisys", "query": q_cols_pb}, headers=headers)
        print("\n=== COLUMNS OF purchase_bills ===")
        for col in r3.json().get("rows", []):
            print(f"{col['column_name']:<25} : {col['data_type']}")

        # 4. Actual rows in purchase_receipts
        q_grn_data = "SELECT id, receipt_no, created_at, notes FROM purchase_receipts ORDER BY id DESC LIMIT 5;"
        r4 = await client.post(f"{URL}/api/v1/database-manager/query", json={"database": "smritisys", "query": q_grn_data}, headers=headers)
        print("\n=== SAMPLE ROWS IN purchase_receipts ===")
        for row in r4.json().get("rows", []):
            print(row)

        # 5. Actual rows in purchase_orders
        q_po_data = "SELECT id, order_no, created_at, notes FROM purchase_orders ORDER BY id DESC LIMIT 5;"
        r5 = await client.post(f"{URL}/api/v1/database-manager/query", json={"database": "smritisys", "query": q_po_data}, headers=headers)
        print("\n=== SAMPLE ROWS IN purchase_orders ===")
        for row in r5.json().get("rows", []):
            print(row)

        # 6. Actual rows in purchase_bills
        q_pb_data = "SELECT id, bill_no, bill_date, created_at, notes FROM purchase_bills ORDER BY id DESC LIMIT 5;"
        r6 = await client.post(f"{URL}/api/v1/database-manager/query", json={"database": "smritisys", "query": q_pb_data}, headers=headers)
        print("\n=== SAMPLE ROWS IN purchase_bills ===")
        for row in r6.json().get("rows", []):
            print(row)

if __name__ == "__main__":
    asyncio.run(main())
