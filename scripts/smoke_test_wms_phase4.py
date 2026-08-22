"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import uuid
import asyncio
import psycopg2
import httpx
from datetime import datetime, timezone, timedelta
from jose import jwt

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath("backend"))
from app.main import app
from app.core.config import settings


def generate_test_token(user_id: str = "usr-super", company_id: str = "COMP-001", branch_id: str = "BR-001", role: str = "SYSADMIN"):
    payload = {
        "sub": user_id,
        "company_id": company_id,
        "branch_id": branch_id,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def run_company_smoke_test(client: httpx.AsyncClient, company_id: str, branch_id: str, db_name: str, warehouse_id: str):
    print(f"\n-----------------------------------------------------------------")
    print(f"  Testing Multi-Company Tenant: {company_id} (Database: {db_name})")
    print(f"-----------------------------------------------------------------")

    token = generate_test_token(company_id=company_id, branch_id=branch_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "X-Company-Code": company_id,
        "X-Branch-Code": branch_id,
    }

    db_url = f"postgresql://postgres:postgres@localhost:5432/{db_name}"
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    unique_suffix = uuid.uuid4().hex[:8]
    test_prod_id = f"prod-smoke-{company_id.lower()}-{unique_suffix}"
    test_barcode = f"BAR-{company_id.upper()}-{unique_suffix.upper()}"
    test_batch_no = f"BATCH-{company_id.upper()}-{unique_suffix.upper()}"
    created_audit_id = None

    try:
        # Step 0: Setup dedicated isolated product & batch stock in Postgres
        print(f"[Step 0] Creating test product {test_prod_id} with 25 batch stock in {db_name}...")
        cur.execute("""
            INSERT INTO products (
                id, uuid, company_id, branch_id, name, code, sku, category,
                barcode, price, cost_price, stock, reserved_stock, gst_percentage,
                is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, 'Hardware',
                %s, 750.00, 500.00, 25, 0.0000, 18.00,
                true, false, NOW(), NOW()
            )
        """, (
            test_prod_id, str(uuid.uuid4()), company_id, branch_id,
            f"Smoke Product {company_id} {unique_suffix}",
            f"SMK-{company_id.upper()}-{unique_suffix.upper()}",
            f"SKU-{company_id.upper()}-{unique_suffix.upper()}",
            test_barcode
        ))

        cur.execute("""
            INSERT INTO product_batch_stocks (
                id, uuid, company_id, branch_id, warehouse_id, product_id,
                batch_no, quantity, reserved_quantity, damaged_quantity,
                is_active, is_deleted, created_at, modified_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, 25.0000, 0.0000, 0.0000,
                true, false, NOW(), NOW()
            )
        """, (
            f"pbs-{company_id.lower()}-{unique_suffix}", str(uuid.uuid4()),
            company_id, branch_id, warehouse_id,
            test_prod_id, test_batch_no
        ))
        conn.commit()
        print(f"  [OK] Test product and batch stock established in {db_name}.")

        # Step 1: List Audits
        print("\n[Step 1] GET /api/v1/wms/audits")
        r1 = await client.get("/api/v1/wms/audits", headers=headers)
        assert r1.status_code == 200
        print(f"  [OK] Response [{r1.status_code}]: Found audits for tenant {company_id}.")

        # Step 2: Create Stock Audit
        print(f"\n[Step 2] POST /api/v1/wms/audits (Create Snapshot Audit in {warehouse_id})")
        create_payload = {
            "warehouse_id": warehouse_id,
            "audit_type": "CYCLE_COUNT",
            "notes": f"Live Smoke Audit {company_id} {unique_suffix}"
        }
        r2 = await client.post("/api/v1/wms/audits", json=create_payload, headers=headers)
        assert r2.status_code == 201, f"Expected 201, got {r2.status_code}: {r2.text}"
        audit_data = r2.json()
        created_audit_id = audit_data["id"]
        audit_no = audit_data["audit_no"]
        print(f"  [OK] Response [{r2.status_code}]: Created Audit {audit_no} (ID: {created_audit_id})")
        assert audit_data["status"] == "IN_PROGRESS"

        # Step 3: GET Audit details
        print(f"\n[Step 3] GET /api/v1/wms/audits/{created_audit_id}")
        r3 = await client.get(f"/api/v1/wms/audits/{created_audit_id}", headers=headers)
        assert r3.status_code == 200
        detail = r3.json()
        target_item = next(it for it in detail["items"] if it["product_id"] == test_prod_id)
        print(f"  [OK] Snapshotted item: System Qty = {target_item['system_qty']}, Counted Qty = {target_item['counted_qty']}, Variance = {target_item['variance_qty']}")
        assert float(target_item["system_qty"]) == 25.0

        # Step 4: Rapid Barcode Scan increment
        print(f"\n[Step 4] POST /api/v1/wms/audits/{created_audit_id}/scan (Scan Barcode {test_barcode})")
        scan_payload = {
            "barcode_or_sku": test_barcode,
            "qty_increment": 10.0,
            "batch_no": test_batch_no
        }
        r4 = await client.post(f"/api/v1/wms/audits/{created_audit_id}/scan", json=scan_payload, headers=headers)
        assert r4.status_code == 200
        scan_res = r4.json()
        print(f"  [OK] Response [{r4.status_code}]: Counted Qty = {scan_res['counted_qty']}, Variance = {scan_res['variance_qty']}")
        assert float(scan_res["counted_qty"]) == 10.0

        # Step 5: Manual Count Record update (counted = 20, deficit = -5)
        print(f"\n[Step 5] POST /api/v1/wms/audits/{created_audit_id}/count (Update item count)")
        count_payload = {
            "item_id": target_item["id"],
            "counted_qty": 20.0,
            "discrepancy_reason": "DAMAGED",
            "notes": "5 units damaged"
        }
        r5 = await client.post(f"/api/v1/wms/audits/{created_audit_id}/count", json=count_payload, headers=headers)
        assert r5.status_code == 200
        count_res = r5.json()
        print(f"  [OK] Response [{r5.status_code}]: Item counted = {count_res['counted_qty']}, variance = {count_res['variance_qty']}")
        assert float(count_res["variance_qty"]) == -5.0

        # Step 6: Reconcile Audit
        print(f"\n[Step 6] POST /api/v1/wms/audits/{created_audit_id}/reconcile")
        r6 = await client.post(f"/api/v1/wms/audits/{created_audit_id}/reconcile", json={}, headers=headers)
        assert r6.status_code == 200
        recon_res = r6.json()
        print(f"  [OK] Response [{r6.status_code}]: Reconciled status = {recon_res['status']}")
        assert recon_res["status"] == "COMPLETED"

        # Step 7: Verify Database Mutations
        print(f"\n[Step 7] Verifying database state post-reconciliation in {db_name}...")
        cur.execute("SELECT quantity FROM product_batch_stocks WHERE id = %s", (f"pbs-{company_id.lower()}-{unique_suffix}",))
        final_batch_qty = cur.fetchone()[0]
        print(f"  [OK] Batch stock updated to {final_batch_qty} in {db_name}")
        assert float(final_batch_qty) == 20.0

        cur.execute("SELECT stock FROM products WHERE id = %s", (test_prod_id,))
        final_prod_stock = cur.fetchone()[0]
        print(f"  [OK] Product stock cache updated to {final_prod_stock} in {db_name}")
        assert int(final_prod_stock) == 20

        print(f"  [OK] Multi-company tenant {company_id} PASSED.")

    finally:
        print(f"\n[Teardown] Cleaning up test records in {db_name}...")
        if created_audit_id:
            cur.execute("DELETE FROM stock_audit_items WHERE audit_id = %s", (created_audit_id,))
            cur.execute("DELETE FROM stock_audits WHERE id = %s", (created_audit_id,))
        cur.execute("DELETE FROM stock_movements WHERE product_id = %s", (test_prod_id,))
        cur.execute("DELETE FROM product_batch_stocks WHERE product_id = %s", (test_prod_id,))
        cur.execute("DELETE FROM products WHERE id = %s", (test_prod_id,))
        conn.commit()
        conn.close()
        print(f"  [OK] Database {db_name} cleanly restored with zero residual test rows.")


async def run_smoke_test():
    print("=================================================================")
    print("  SMRITI WMS Phase 4: Multi-Company Live HTTP Smoke Test Suite   ")
    print("=================================================================")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test COMP-001 (smriti001)
        await run_company_smoke_test(
            client=client,
            company_id="COMP-001",
            branch_id="BR-001",
            db_name="smriti001",
            warehouse_id="wh-central-001"
        )

        # 2. Test COMP-002 (smriti002)
        await run_company_smoke_test(
            client=client,
            company_id="COMP-002",
            branch_id="BR-002",
            db_name="smriti002",
            warehouse_id="wh-central-001"
        )

    print("\n=================================================================")
    print("  [OK] ALL MULTI-COMPANY LIVE HTTP SMOKE TESTS PASSED PERFECTLY! ")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
