"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
- Pushpa Devi Jawahar Mallah (Founder & Chairperson)
- Jawahar Ramkripal Mallah (Founder, CEO & Chief Software Architect)

Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.92.3
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import asyncio
import httpx

sys.stdout.reconfigure(encoding="utf-8")

URL = "https://tattlythreads.smritisys.com"

async def check_remote():
    print("=" * 80)
    print("AUDIT: Verifying Inventory & Accounting Transaction Tables on Remote Host")
    print(f"Host: {URL}")
    print("=" * 80)

    async with httpx.AsyncClient(timeout=30.0) as client:
        login = await client.post(
            f"{URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        if login.status_code != 200:
            print("Login failed:", login.status_code, login.text)
            return

        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        tables = [
            "products",
            "items",
            "item_variants",
            "item_barcodes",
            "stock_movements",
            "product_batch_stocks",
            "stock_transfers",
            "stock_audits",
            "purchase_orders",
            "purchase_order_items",
            "purchase_receipts",
            "purchase_receipt_items",
            "purchase_bills",
            "purchase_bill_items",
            "sales_invoices",
            "sales_invoice_items",
            "sales_orders",
            "sales_returns",
            "general_ledger_entries",
            "journal_vouchers",
            "accounts",
            "payment_transactions",
            "commission_ledgers",
            "customer_credit_ledger_entries",
            "eway_bills",
            "e_invoices"
        ]

        print("\n1. REMOTE CONTROL PLANE DATABASE ('smritisys'):")
        sys_total = 0
        for t in tables:
            r = await client.post(
                f"{URL}/api/v1/database-manager/query",
                json={"database": "smritisys", "query": f"SELECT count(*) FROM {t};"},
                headers=headers
            )
            res = r.json()
            if res.get("success"):
                cnt = res["rows"][0]["count"]
                sys_total += cnt
                status = f"{cnt} rows" if cnt > 0 else "0 rows (Clean)"
                print(f"   - {t:32}: {status}")
            else:
                err = res.get("error", "Unknown error")
                print(f"   - {t:32}: Error/Not Present ({err})")
        print(f"\n   >>> TOTAL TRANSACTION ROWS IN REMOTE 'smritisys': {sys_total} <<<")

        print("\n2. REMOTE TENANT DATABASE ('smriti001'):")
        tenant_total = 0
        for t in tables:
            r = await client.post(
                f"{URL}/api/v1/database-manager/query",
                json={"database": "smriti001", "query": f"SELECT count(*) FROM {t};"},
                headers=headers
            )
            res = r.json()
            if res.get("success"):
                cnt = res["rows"][0]["count"]
                tenant_total += cnt
                status = f"{cnt} rows" if cnt > 0 else "0 rows (Clean)"
                print(f"   - {t:32}: {status}")
            else:
                err = res.get("error", "Unknown error")
                print(f"   - {t:32}: Error/Not Present ({err})")
        print(f"\n   >>> TOTAL TRANSACTION ROWS IN REMOTE 'smriti001': {tenant_total} <<<")

if __name__ == "__main__":
    asyncio.run(check_remote())
