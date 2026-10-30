"""
Verify Post-Execution PO Dates and Procurement Chain Parity on tattlythreads.smritisys.com
"""
import asyncio
import httpx

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

        # 2. Query full procurement chain: PO -> GRN -> Bill
        q_chain = """
            SELECT 
                po.order_no,
                po.status as po_status,
                po.created_at as po_created,
                po.grand_total as po_total,
                pr.receipt_no,
                pr.status as grn_status,
                pr.created_at as grn_created,
                pb.bill_no,
                pb.bill_date
            FROM purchase_orders po
            JOIN purchase_receipts pr ON pr.order_id = po.id::text OR pr.receipt_no = REPLACE(po.order_no, 'PO-', 'GRN-')
            LEFT JOIN purchase_bills pb ON pb.order_id = po.id::text OR pb.receipt_id = pr.id::text
            WHERE pr.receipt_no LIKE 'GRN-%'
            ORDER BY pr.created_at;
        """
        resp = await client.post(
            f"{API_URL}/api/v1/database-manager/query",
            json={"database": DB_NAME, "query": q_chain},
            headers=headers
        )
        assert resp.status_code == 200, f"Query chain failed: {resp.text}"
        rows = resp.json()["rows"]
        print(f"Total Matched Procurement Chains in {DB_NAME}: {len(rows)}")
        print(f"\n{'#':<3} | {'PO NUMBER':<22} | {'PO CREATED_AT':<24} | {'GRN CREATED_AT':<24} | {'BILL DATE':<10} | {'CHRONO ORDER'}")
        print("-" * 105)

        all_chrono_valid = True
        total_po_amount = 0.0
        for idx, r in enumerate(rows, 1):
            po_ts = str(r["po_created"])
            grn_ts = str(r["grn_created"])
            b_date = str(r["bill_date"])
            po_val = float(r["po_total"] or 0.0)
            total_po_amount += po_val

            # Valid if PO created_at <= GRN created_at
            chrono = "OK (PO <= GRN)" if po_ts <= grn_ts else "INVERTED (PO > GRN)"
            if "INVERTED" in chrono:
                all_chrono_valid = False

            print(f"{idx:<3} | {r['order_no']:<22} | {po_ts[:19]:<24} | {grn_ts[:19]:<24} | {b_date:<10} | {chrono}")

        print("-" * 105)
        print(f"Total PO Amount: INR {total_po_amount:,.2f}")
        print(f"All 28 Procurement Chains Chronologically Valid (PO <= GRN): {all_chrono_valid}")

        # 3. Check backup table audit log
        q_bkp = "SELECT count(*) as bkp_pos FROM _backup_purchase_orders_date;"
        resp_bkp = await client.post(
            f"{API_URL}/api/v1/database-manager/query",
            json={"database": DB_NAME, "query": q_bkp},
            headers=headers
        )
        if resp_bkp.status_code == 200 and resp_bkp.json().get("rows"):
            print(f"\nBackup Audit Table in {DB_NAME}:")
            print(f"  _backup_purchase_orders_date: {resp_bkp.json()['rows'][0]['bkp_pos']} rows backed up")
        else:
            print("\nBackup table not yet created (pending execution).")

if __name__ == "__main__":
    asyncio.run(main())
