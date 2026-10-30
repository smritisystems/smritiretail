"""
Verify Post-Execution GRN Dates and Stock Movement Integrity on tattlythreads.smritisys.com
"""
import asyncio
import httpx
from datetime import datetime

API_URL = "https://tattlythreads.smritisys.com"
DB_NAME = "smriti001"

async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Login
        login_res = await client.post(
            f"{API_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json().get("access_token") or login_res.json().get("data", {}).get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # 2. Query purchase receipts
        q_receipts = """
            SELECT receipt_no, status, created_at, modified_at
            FROM purchase_receipts
            ORDER BY receipt_no;
        """
        resp = await client.post(
            f"{API_URL}/api/v1/database-manager/query",
            json={"database": DB_NAME, "query": q_receipts},
            headers=headers
        )
        assert resp.status_code == 200, f"Query receipts failed: {resp.text}"
        data = resp.json()
        rows = data["rows"]
        print(f"Total Purchase Receipts in {DB_NAME}: {len(rows)}")
        print(f"{'#':<3} | {'RECEIPT NO':<24} | {'STATUS':<12} | {'CREATED_AT':<32}")
        print("-" * 75)
        for idx, r in enumerate(rows, 1):
            print(f"{idx:<3} | {r['receipt_no']:<24} | {r['status']:<12} | {r['created_at']:<32}")

        # 3. Query stock movements count and min/max created_at per receipt
        q_movements = """
            SELECT 
                pr.receipt_no,
                count(sm.id) as movement_count,
                min(sm.created_at) as sm_min_created,
                max(sm.created_at) as sm_max_created,
                pr.created_at as pr_created
            FROM purchase_receipts pr
            LEFT JOIN stock_movements sm 
                ON sm.reference_doc_id::text = pr.id::text OR sm.reference_doc_id::text = pr.receipt_no
            GROUP BY pr.receipt_no, pr.created_at
            ORDER BY pr.receipt_no;
        """
        resp2 = await client.post(
            f"{API_URL}/api/v1/database-manager/query",
            json={"database": DB_NAME, "query": q_movements},
            headers=headers
        )
        assert resp2.status_code == 200, f"Query movements failed: {resp2.text}"
        rows2 = resp2.json()["rows"]
        print("\nStock Movement Synchronization Parity Check:")
        print(f"{'#':<3} | {'RECEIPT NO':<24} | {'MOVEMENTS':<10} | {'PR CREATED_AT':<26} | {'SM MIN CREATED_AT':<26} | {'PARITY'}")
        print("-" * 105)
        all_parity = True
        total_sm = 0
        for idx, r in enumerate(rows2, 1):
            cnt = r["movement_count"]
            total_sm += cnt
            pr_ts = str(r["pr_created"])[:19]
            sm_ts = str(r["sm_min_created"])[:19]
            parity = "MATCH" if pr_ts == sm_ts else "MISMATCH"
            if parity != "MATCH":
                all_parity = False
            print(f"{idx:<3} | {r['receipt_no']:<24} | {cnt:<10} | {pr_ts:<26} | {sm_ts:<26} | {parity}")

        print(f"\nTotal Stock Movements: {total_sm}")
        print(f"Stock Movement Parity Guaranteed: {all_parity}")

        # 4. Check backup table audit log
        q_backup = """
            SELECT count(*) as bkp_receipts FROM _backup_purchase_receipts_grn_date;
        """
        resp3 = await client.post(
            f"{API_URL}/api/v1/database-manager/query",
            json={"database": DB_NAME, "query": q_backup},
            headers=headers
        )
        bkp_receipts = resp3.json()["rows"][0]["bkp_receipts"]

        q_backup_sm = """
            SELECT count(*) as bkp_sm FROM _backup_stock_movements_grn_date;
        """
        resp4 = await client.post(
            f"{API_URL}/api/v1/database-manager/query",
            json={"database": DB_NAME, "query": q_backup_sm},
            headers=headers
        )
        bkp_sm = resp4.json()["rows"][0]["bkp_sm"]
        print(f"\nBackup Audit Tables in {DB_NAME}:")
        print(f"  _backup_purchase_receipts_grn_date: {bkp_receipts} rows backed up")
        print(f"  _backup_stock_movements_grn_date  : {bkp_sm} rows backed up")

if __name__ == "__main__":
    asyncio.run(main())
