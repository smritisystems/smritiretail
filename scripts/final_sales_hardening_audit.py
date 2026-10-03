"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.36.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Sales & POS Universal Transaction & Movement Integrity Audit Suite
Capability   : @SmritiCapability("SALES", "FINAL_SALES_HARDENING_AUDIT")
"""

import asyncio
import io
import json
import os
import sys
import time
import uuid
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from datetime import datetime, timezone, date
from decimal import Decimal
from pathlib import Path
import httpx
import psycopg2
from psycopg2.extras import RealDictCursor

# Backend and DB configuration
API_BASE = "http://127.0.0.1:1981"
DB_URL = "postgresql://postgres:postgres@localhost:2781/smriti001"
OUTPUT_DIR = Path("F:/SMRITRretailNX/scratch/sales_hardening_audit")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# SMRITI sysadmin token generation
sys.path.insert(0, "F:/SMRITRretailNX/backend")
from app.core.security import create_access_token

JWT_TOKEN = create_access_token({
    "sub": "usr-admin",
    "role": "SYSADMIN",
    "company_id": "COMP-001",
    "branch_id": "BR-001",
})

HEADERS = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "Content-Type": "application/json",
    "X-Company-Id": "COMP-001",
    "X-Branch-Id": "BR-001",
}


def get_db_conn(max_retries=15, delay=1.0):
    for i in range(max_retries):
        try:
            return psycopg2.connect(DB_URL)
        except Exception:
            time.sleep(delay)
    return psycopg2.connect(DB_URL)


async def wait_for_api(max_attempts=30, delay_sec=2):
    async with httpx.AsyncClient(timeout=5.0) as client:
        for attempt in range(1, max_attempts + 1):
            try:
                res = await client.get(f"{API_BASE}/health")
                if res.status_code == 200:
                    print(f"   [OK] API is healthy and reachable at {API_BASE} (attempt {attempt})")
                    return True
            except Exception:
                pass
            await asyncio.sleep(delay_sec)
    raise RuntimeError(f"API did not become healthy within {max_attempts * delay_sec}s.")


# ─────────────────────────────────────────────────────────────────────────────
# 1. SALES ORDER INTEGRITY AUDIT (Gates: Normal, Duplicate, 10x Burst, Idemp)
# ─────────────────────────────────────────────────────────────────────────────

async def audit_sales_order(product: dict, customer: dict):
    print("\n" + "=" * 90)
    print("[GATE 1] SALES ORDER TRANSACTION INTEGRITY AUDIT")
    print("=" * 90)

    order_suffix = uuid.uuid4().hex[:8].upper()
    so_no = f"SO-AUDIT-{order_suffix}"
    idemp_key = f"IDEMP-SO-{order_suffix}"

    so_payload = {
        "order_no": so_no,
        "date": date.today().isoformat(),
        "customer_name": customer["name"],
        "customer_id": customer["id"],
        "status": "Draft",
        "items": [
            {
                "product_id": product["id"],
                "code": product["code"],
                "name": product["name"],
                "quantity": 5.0,
                "price": float(product["price"] or 500.0),
                "gst_rate": 12.0,
                "tax_amount": 300.0,
                "total_amount": 2800.0,
                "ean": product["barcode"] or product["code"],
            }
        ]
    }

    results = {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1A. Normal Posting
        print(f"\n--- 1A: Normal Posting of Sales Order '{so_no}' ---")
        headers_with_idemp = {**HEADERS, "X-Idempotency-Key": idemp_key}
        res_normal = await client.post(f"{API_BASE}/api/v1/sales/orders", headers=headers_with_idemp, json=so_payload)
        print(f"   * Status Code: {res_normal.status_code}")
        print(f"   * Response Body: {res_normal.text[:200]}")
        assert res_normal.status_code == 201, f"Expected 201, got {res_normal.status_code}"
        created_so = res_normal.json()
        results["1A_normal_posting"] = "PASS (HTTP 201 Created)"

        # 1B. Sequential Duplicate Request
        print(f"\n--- 1B: Sequential Duplicate Request with same Order No '{so_no}' (different idemp key) ---")
        dup_headers = {**HEADERS, "X-Idempotency-Key": f"DIFFERENT-KEY-{order_suffix}"}
        res_dup = await client.post(f"{API_BASE}/api/v1/sales/orders", headers=dup_headers, json=so_payload)
        print(f"   * Status Code: {res_dup.status_code}")
        print(f"   * Response Body: {res_dup.text[:200]}")
        assert res_dup.status_code == 409, f"Expected 409 Conflict, got {res_dup.status_code}"
        results["1B_duplicate_blocked"] = f"PASS (HTTP {res_dup.status_code} Conflict - Duplicate Order Number Rejected)"

        # 1C. 10x Concurrent Burst
        burst_suffix = uuid.uuid4().hex[:8].upper()
        burst_so_no = f"SO-BURST-{burst_suffix}"
        burst_payload = {**so_payload, "order_no": burst_so_no}

        print(f"\n--- 1C: 10x Simultaneous Concurrency Burst for '{burst_so_no}' ---")
        burst_tasks = [
            client.post(f"{API_BASE}/api/v1/sales/orders", headers=HEADERS, json=burst_payload)
            for _ in range(10)
        ]
        burst_responses = await asyncio.gather(*burst_tasks, return_exceptions=True)
        status_counts = {}
        for r in burst_responses:
            code = type(r).__name__ if isinstance(r, Exception) else r.status_code
            status_counts[code] = status_counts.get(code, 0) + 1

        print(f"   * 10x Burst Status Code Distribution: {status_counts}")
        c201 = status_counts.get(201, 0)
        c409 = status_counts.get(409, 0)
        assert c201 == 1, f"Expected exactly 1x 201, got {c201}"
        assert c409 == 9, f"Expected exactly 9x 409, got {c409}"
        results["1C_10x_concurrency"] = f"PASS (1x 201 + 9x 409)"

        # 1D. Idempotent Replay (Identical Payload + Same Key)
        print(f"\n--- 1D: Idempotent Replay of '{so_no}' with key '{idemp_key}' ---")
        res_replay = await client.post(f"{API_BASE}/api/v1/sales/orders", headers=headers_with_idemp, json=so_payload)
        print(f"   * Status Code: {res_replay.status_code}")
        print(f"   * Replayed Document ID: {res_replay.json().get('id')} (Matches original: {res_replay.json().get('id') == created_so['id']})")
        assert res_replay.status_code in [200, 201], f"Expected 200/201, got {res_replay.status_code}"
        assert res_replay.json().get("id") == created_so["id"]
        results["1D_idempotent_replay"] = "PASS (Cached Document Returned)"

        # 1E. Idempotency Collision (Altered Payload with Same Key)
        print(f"\n--- 1E: Idempotency Collision (Altered Quantity with Same Key '{idemp_key}') ---")
        altered_payload = {**so_payload, "items": [{**so_payload["items"][0], "quantity": 99.0}]}
        res_collision = await client.post(f"{API_BASE}/api/v1/sales/orders", headers=headers_with_idemp, json=altered_payload)
        print(f"   * Status Code: {res_collision.status_code}")
        print(f"   * Collision Message: {res_collision.text[:200]}")
        assert res_collision.status_code == 409, f"Expected 409 Conflict, got {res_collision.status_code}"
        results["1E_payload_divergence_blocked"] = "PASS (HTTP 409 SMRITI-IDEMP-001)"

    # Database Verification
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT COUNT(*) AS cnt FROM sales_orders WHERE order_no = %s;", (burst_so_no,))
    burst_db_count = cur.fetchone()["cnt"]
    assert burst_db_count == 1, f"Expected 1 DB row for burst SO, found {burst_db_count}"
    conn.close()

    print(f"   * Database Row Invariance: Exactly 1 record for '{burst_so_no}' in PostgreSQL.")
    results["1F_db_row_invariance"] = "PASS (Exactly 1 row created)"
    return results, so_no


# ─────────────────────────────────────────────────────────────────────────────
# 2. SALES INVOICE & STOCK OUTWARD INTEGRITY AUDIT
# ─────────────────────────────────────────────────────────────────────────────

async def audit_sales_invoice(product: dict, customer: dict, warehouse: dict):
    print("\n" + "=" * 90)
    print("[GATE 2] SALES INVOICE & STOCK OUTWARD INTEGRITY AUDIT")
    print("=" * 90)

    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT stock FROM products WHERE id = %s;", (product["id"],))
    stock_before = cur.fetchone()["stock"]
    print(f"   * Baseline Product Stock ({product['code']}): {stock_before} units")

    inv_suffix = uuid.uuid4().hex[:8].upper()
    inv_no = f"INV-AUDIT-{inv_suffix}"
    idemp_key = f"IDEMP-INV-{inv_suffix}"

    inv_payload = {
        "invoice_no": inv_no,
        "customer_id": customer["id"],
        "warehouse_id": warehouse["id"],
        "status": "Confirmed",
        "payment_mode": "CASH",
        "items": [
            {
                "product_id": product["id"],
                "code": product["code"],
                "name": product["name"],
                "quantity": 2.0,
                "price": float(product["price"] or 500.0),
                "gst_rate": 12.0,
                "total_amount": float(2.0 * float(product["price"] or 500.0) * 1.12),
            }
        ]
    }

    results = {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 2A. Normal Settled Posting
        print(f"\n--- 2A: Normal Posting of Settled Sales Invoice '{inv_no}' (Qty=2.0) ---")
        headers = {**HEADERS, "X-Idempotency-Key": idemp_key}
        res_inv = await client.post(f"{API_BASE}/api/v1/sales/invoices", headers=headers, json=inv_payload)
        print(f"   * Status Code: {res_inv.status_code}")
        print(f"   * Response Body: {res_inv.text[:200]}")
        assert res_inv.status_code == 201, f"Expected 201, got {res_inv.status_code}"
        created_inv = res_inv.json()
        results["2A_normal_invoice_posting"] = "PASS (HTTP 201 Created)"

        # 2B. Stock Decrement Verification
        cur.execute("SELECT stock FROM products WHERE id = %s;", (product["id"],))
        stock_after_normal = cur.fetchone()["stock"]
        print(f"   * Stock After Normal Invoice: {stock_after_normal} units (Delta = {stock_before - stock_after_normal})")
        assert stock_before - stock_after_normal == 2, f"Stock should decrease by 2, got delta {stock_before - stock_after_normal}"
        results["2B_stock_decrement"] = "PASS (Physical stock decremented by exactly 2 units)"

        # 2C. Authoritative StockMovement Check
        cur.execute("""
            SELECT id, movement_type, reference_doc_type, reference_doc_id, quantity
            FROM stock_movements
            WHERE reference_doc_id = %s;
        """, (created_inv["id"],))
        movements = cur.fetchall()
        print(f"   * Outward Stock Movements Created: {len(movements)}")
        assert len(movements) == 1, f"Expected 1 stock movement, got {len(movements)}"
        assert movements[0]["movement_type"] == "OUTWARD_SALE"
        assert Decimal(str(movements[0]["quantity"])) == Decimal("2.0000") or Decimal(str(movements[0]["quantity"])) == Decimal("2.00")
        results["2C_outward_stock_movement"] = "PASS (Exactly 1 OUTWARD_SALE movement posted)"

        # 2D. Sequential Duplicate Invoice Block
        print(f"\n--- 2D: Sequential Duplicate Invoice Request with same Invoice No '{inv_no}' ---")
        dup_headers = {**HEADERS, "X-Idempotency-Key": f"DIFF-KEY-{inv_suffix}"}
        res_dup_inv = await client.post(f"{API_BASE}/api/v1/sales/invoices", headers=dup_headers, json=inv_payload)
        print(f"   * Status Code: {res_dup_inv.status_code}")
        print(f"   * Response Body: {res_dup_inv.text[:200]}")
        assert res_dup_inv.status_code == 409, f"Expected 409 Conflict, got {res_dup_inv.status_code}"
        results["2D_duplicate_invoice_blocked"] = f"PASS (HTTP {res_dup_inv.status_code} Conflict)"

        # 2E. 10x Concurrent Burst
        burst_inv_suffix = uuid.uuid4().hex[:8].upper()
        burst_inv_no = f"INV-BURST-{burst_inv_suffix}"
        burst_inv_payload = {
            **inv_payload,
            "invoice_no": burst_inv_no,
            "items": [{**inv_payload["items"][0], "quantity": 3.0}]
        }

        stock_before_burst = stock_after_normal
        print(f"\n--- 2E: 10x Simultaneous Concurrency Burst for Settled Invoice '{burst_inv_no}' (Qty=3.0) ---")
        burst_tasks = [
            client.post(f"{API_BASE}/api/v1/sales/invoices", headers=HEADERS, json=burst_inv_payload)
            for _ in range(10)
        ]
        burst_resps = await asyncio.gather(*burst_tasks, return_exceptions=True)
        counts = {}
        for r in burst_resps:
            c = type(r).__name__ if isinstance(r, Exception) else r.status_code
            counts[c] = counts.get(c, 0) + 1

        print(f"   * 10x Burst Status Counts: {counts}")
        c201 = counts.get(201, 0)
        c409 = counts.get(409, 0)
        assert c201 == 1, f"Expected 1x 201, got {c201}"
        assert c409 == 9, f"Expected 9x 409, got {c409}"
        results["2E_10x_invoice_concurrency"] = "PASS (1x 201 + 9x 409)"

        # 2F. Stock Invariance Under Concurrency Attack
        cur.execute("SELECT stock FROM products WHERE id = %s;", (product["id"],))
        stock_after_burst = cur.fetchone()["stock"]
        burst_delta = stock_before_burst - stock_after_burst
        print(f"   * Stock Before Burst: {stock_before_burst} | After Burst: {stock_after_burst} | Delta: {burst_delta}")
        assert burst_delta == 3, f"Stock delta under 10x burst must be exactly 3, got {burst_delta}"
        results["2F_stock_invariance_under_attack"] = "PASS (Stock deducted exactly 3 units; zero phantom movements)"

        # Check DB invoice and movement count
        cur.execute("SELECT id FROM sales_invoices WHERE invoice_no = %s;", (burst_inv_no,))
        burst_inv_record = cur.fetchall()
        assert len(burst_inv_record) == 1, f"Expected 1 invoice in DB, got {len(burst_inv_record)}"
        cur.execute("SELECT COUNT(*) AS cnt FROM stock_movements WHERE reference_doc_id = %s;", (burst_inv_record[0]["id"],))
        burst_sm_count = cur.fetchone()["cnt"]
        assert burst_sm_count == 1, f"Expected 1 stock movement for burst invoice, got {burst_sm_count}"
        results["2G_single_ledger_movement"] = "PASS (Exactly 1 movement row in DB)"

    conn.close()
    return results, created_inv


# ─────────────────────────────────────────────────────────────────────────────
# 3. DELIVERY / DISPATCH & E-WAY BILL INTEGRITY AUDIT
# ─────────────────────────────────────────────────────────────────────────────

async def audit_delivery_dispatch(party_id: str, item_id: str, invoice_id: str):
    print("\n" + "=" * 90)
    print("[GATE 3] DELIVERY / DISPATCH & E-WAY BILL INTEGRITY AUDIT")
    print("=" * 90)

    results = {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 3A. Create Distribution Order
        print(f"\n--- 3A: Creating Distribution Order for Party '{party_id}' ---")
        res_do = await client.post(f"{API_BASE}/api/v1/distribution/orders", headers=HEADERS, json={
            "party_id": party_id,
            "order_type": "PRIMARY",
            "supplier_state": "27",
            "recipient_state": "27",
            "line_items": [{"item_id": item_id, "quantity": 4.0}]
        })
        print(f"   * Distribution Order Creation Status: {res_do.status_code}")
        assert res_do.status_code == 200, f"Expected 200, got {res_do.status_code} {res_do.text}"
        do_data = res_do.json()
        do_id = do_data["order_id"]
        do_no = do_data["order_no"]
        print(f"   * Created Order: ID={do_id} | OrderNo={do_no}")

        # Normal Dispatch
        print(f"\n--- 3B: Dispatching Order '{do_no}' ---")
        res_disp = await client.post(f"{API_BASE}/api/v1/distribution/orders/{do_id}/dispatch", headers=HEADERS)
        print(f"   * Dispatch Status: {res_disp.status_code}")
        print(f"   * Dispatch Body: {res_disp.text[:200]}")
        assert res_disp.status_code == 200
        disp_data = res_disp.json()
        challan_no = disp_data["delivery_challan_no"]
        results["3A_normal_dispatch"] = f"PASS (HTTP 200 | Challan: {challan_no})"

        # Verify Stock Movement
        conn = get_db_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, movement_type, reference_doc_id, quantity FROM stock_movements WHERE reference_doc_id = %s;", (do_no,))
        disp_movements = cur.fetchall()
        assert len(disp_movements) == 1, f"Expected 1 stock movement for dispatch, got {len(disp_movements)}"
        assert disp_movements[0]["movement_type"] == "OUTWARD_SALE"
        results["3B_dispatch_stock_movement"] = "PASS (Exactly 1 OUTWARD_SALE movement posted)"

        # 3C. Duplicate Dispatch Re-Entry Block (Altered Payload or Challan)
        print(f"\n--- 3C: Duplicate Dispatch Attempt on Already Dispatched Order with Different Challan ---")
        res_dup_disp = await client.post(
            f"{API_BASE}/api/v1/distribution/orders/{do_id}/dispatch?delivery_challan_no=DC-COLLISION",
            headers=HEADERS
        )
        print(f"   * Duplicate Dispatch Status: {res_dup_disp.status_code}")
        print(f"   * Collision Message: {res_dup_disp.text[:200]}")
        assert res_dup_disp.status_code == 409, f"Expected 409 Conflict, got {res_dup_disp.status_code}"
        results["3C_duplicate_dispatch_blocked"] = "PASS (HTTP 409 Conflict - Duplicate dispatch blocked)"

        # 3D. 10x Dispatch Concurrency Burst
        print(f"\n--- 3D: 10x Simultaneous Dispatch Concurrency Burst on Fresh Order ---")
        res_fresh_do = await client.post(f"{API_BASE}/api/v1/distribution/orders", headers=HEADERS, json={
            "party_id": party_id,
            "order_type": "PRIMARY",
            "supplier_state": "27",
            "recipient_state": "27",
            "line_items": [{"item_id": item_id, "quantity": 2.0}]
        })
        fresh_do_id = res_fresh_do.json()["order_id"]
        fresh_do_no = res_fresh_do.json()["order_no"]

        burst_disp_tasks = [
            client.post(f"{API_BASE}/api/v1/distribution/orders/{fresh_do_id}/dispatch", headers=HEADERS)
            for _ in range(10)
        ]
        burst_disp_resps = await asyncio.gather(*burst_disp_tasks, return_exceptions=True)
        disp_counts = {}
        for r in burst_disp_resps:
            c = type(r).__name__ if isinstance(r, Exception) else r.status_code
            disp_counts[c] = disp_counts.get(c, 0) + 1

        print(f"   * 10x Dispatch Burst Counts: {disp_counts}")
        # Note: 1 task succeeds initially (200), subsequent replays with exact same parameters return 200 (idempotent replay)
        # or 409 (if concurrency collision). Let's verify DB movement invariance!
        cur.execute("SELECT COUNT(*) AS cnt FROM stock_movements WHERE reference_doc_id = %s;", (fresh_do_no,))
        burst_disp_mov_cnt = cur.fetchone()["cnt"]
        print(f"   * Total Stock Movements Created in PostgreSQL for '{fresh_do_no}': {burst_disp_mov_cnt} (Must be exactly 1)")
        assert burst_disp_mov_cnt == 1, f"Expected exactly 1 stock movement, got {burst_disp_mov_cnt}"
        results["3D_dispatch_concurrency_invariance"] = "PASS (Zero phantom movements; exactly 1 outward movement in DB)"

        # 3E. E-Way Bill Creation & Duplicate Prevention
        print(f"\n--- 3E: E-Way Bill Dispatch Generation for Invoice '{invoice_id}' ---")
        ewb_no = f"EWB{uuid.uuid4().hex[:12].upper()}"
        res_ewb = await client.post(f"{API_BASE}/api/v1/sales/eway-bills", headers=HEADERS, json={
            "invoice_id": invoice_id,
            "eway_bill_no": ewb_no,
            "transporter_name": "Antigravity Safe Express Logistics",
            "transport_mode": "Road",
            "vehicle_no": "MH-12-AB-9999",
            "distance_km": 150.0,
            "consignment_value": 1120.0
        })
        print(f"   * E-Way Bill Creation Status: {res_ewb.status_code}")
        assert res_ewb.status_code in [200, 201], f"Expected 200/201, got {res_ewb.status_code}"
        ewb_data = res_ewb.json()
        print(f"   * Created E-Way Bill: {ewb_data['eway_bill_no']}")

        # Re-posting with conflicting eway bill number should yield 409 Conflict
        res_ewb_conflict = await client.post(f"{API_BASE}/api/v1/sales/eway-bills", headers=HEADERS, json={
            "invoice_id": invoice_id,
            "eway_bill_no": f"CONFLICT-{ewb_no}",
            "transporter_name": "Rogue Courier Ltd",
            "transport_mode": "Road",
            "vehicle_no": "MH-14-ZZ-0001",
        })
        print(f"   * Duplicate E-Way Bill Conflict Status: {res_ewb_conflict.status_code}")
        print(f"   * Conflict Response: {res_ewb_conflict.text[:200]}")
        assert res_ewb_conflict.status_code == 409, f"Expected 409 Conflict, got {res_ewb_conflict.status_code}"
        results["3E_eway_bill_duplicate_guard"] = "PASS (HTTP 409 Conflict - Duplicate E-Way bill blocked)"

        conn.close()

    return results


# ─────────────────────────────────────────────────────────────────────────────
# 4. SALES RETURN & RESTOCK INTEGRITY AUDIT
# ─────────────────────────────────────────────────────────────────────────────

async def audit_sales_return(product: dict, customer: dict, warehouse: dict):
    print("\n" + "=" * 90)
    print("[GATE 4] SALES RETURN & RESTOCK INTEGRITY AUDIT")
    print("=" * 90)

    results = {}
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 4A. Setup a dedicated settled baseline invoice with 5 units of product
    base_inv_no = f"INV-FOR-RET-{uuid.uuid4().hex[:8].upper()}"
    base_inv_payload = {
        "invoice_no": base_inv_no,
        "customer_id": customer["id"],
        "warehouse_id": warehouse["id"],
        "status": "Confirmed",
        "payment_mode": "CASH",
        "items": [
            {
                "product_id": product["id"],
                "code": product["code"],
                "name": product["name"],
                "quantity": 5.0,
                "price": float(product["price"] or 500.0),
                "gst_rate": 12.0,
                "total_amount": float(5.0 * float(product["price"] or 500.0) * 1.12),
            }
        ]
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res_setup = await client.post(f"{API_BASE}/api/v1/sales/invoices", headers=HEADERS, json=base_inv_payload)
        assert res_setup.status_code == 201, f"Failed baseline invoice setup: {res_setup.status_code}"
        orig_invoice = res_setup.json()
        orig_inv_id = orig_invoice["id"]
        print(f"   * Baseline Invoice Established: ID={orig_inv_id} | InvoiceNo={base_inv_no} (5 units)")

        cur.execute("SELECT stock FROM products WHERE id = %s;", (product["id"],))
        stock_before_returns = cur.fetchone()["stock"]
        print(f"   * Product Stock Prior to Returns: {stock_before_returns} units")

        # 4B. Normal Return of 2 units
        ret_suffix = uuid.uuid4().hex[:8].upper()
        ret_id = f"sr-audit-{ret_suffix}"
        ret_no = f"RET-AUDIT-{ret_suffix}"
        idemp_ret_key = f"IDEMP-RET-{ret_suffix}"

        ret_payload = {
            "id": ret_id,
            "return_no": ret_no,
            "original_invoice_id": orig_inv_id,
            "reason": "Customer change of mind - return audit test",
            "status": "processed",
            "items": [
                {
                    "product_id": product["id"],
                    "code": product["code"],
                    "name": product["name"],
                    "quantity": 2.0,
                    "price": float(product["price"] or 500.0),
                    "gst_rate": 12.0,
                    "total_amount": float(2.0 * float(product["price"] or 500.0) * 1.12),
                }
            ]
        }

        print(f"\n--- 4B: Posting Normal Sales Return of 2 units ('{ret_no}') ---")
        headers = {**HEADERS, "X-Idempotency-Key": idemp_ret_key}
        res_ret = await client.post(f"{API_BASE}/api/v1/sales/returns/", headers=headers, json=ret_payload)
        print(f"   * Sales Return Status: {res_ret.status_code}")
        print(f"   * Response Body: {res_ret.text[:200]}")
        assert res_ret.status_code == 201, f"Expected 201, got {res_ret.status_code} {res_ret.text}"
        results["4A_normal_sales_return"] = "PASS (HTTP 201 Created)"

        # 4C. Restock Verification (Stock must increase by 2)
        cur.execute("SELECT stock FROM products WHERE id = %s;", (product["id"],))
        stock_after_normal_return = cur.fetchone()["stock"]
        restock_delta = stock_after_normal_return - stock_before_returns
        print(f"   * Stock After Return: {stock_after_normal_return} (Restock Delta: +{restock_delta} units)")
        assert restock_delta == 2, f"Expected stock increase of +2, got +{restock_delta}"
        results["4B_physical_restock_invariance"] = "PASS (Physical stock incremented by exactly 2 units)"

        # 4D. Stock Movement (RETURN_INWARD) Verification
        cur.execute("""
            SELECT id, movement_type, reference_doc_type, reference_doc_id, quantity
            FROM stock_movements
            WHERE reference_doc_id = %s;
        """, (ret_id,))
        ret_movements = cur.fetchall()
        print(f"   * Return Stock Movements in DB: {len(ret_movements)}")
        assert len(ret_movements) == 1, f"Expected 1 stock movement, got {len(ret_movements)}"
        assert ret_movements[0]["movement_type"] == "RETURN_INWARD"
        assert Decimal(str(ret_movements[0]["quantity"])) == Decimal("2.0000") or Decimal(str(ret_movements[0]["quantity"])) == Decimal("2.00")
        results["4C_return_inward_movement"] = "PASS (Exactly 1 RETURN_INWARD movement posted)"

        # 4E. Exceeded Quantity Rejection (Remaining quantity is 3; attempt to return 5)
        print(f"\n--- 4E: Attempting to Return 5 units against 3 remaining ---")
        exceed_payload = {
            "id": f"sr-exceed-{ret_suffix}",
            "return_no": f"RET-EXCEED-{ret_suffix}",
            "original_invoice_id": orig_inv_id,
            "reason": "Exceeded quantity test",
            "status": "processed",
            "items": [
                {
                    "product_id": product["id"],
                    "code": product["code"],
                    "name": product["name"],
                    "quantity": 5.0,
                    "price": float(product["price"] or 500.0),
                    "gst_rate": 12.0,
                    "total_amount": float(5.0 * float(product["price"] or 500.0) * 1.12),
                }
            ]
        }
        res_exceed = await client.post(f"{API_BASE}/api/v1/sales/returns/", headers=HEADERS, json=exceed_payload)
        print(f"   * Status Code: {res_exceed.status_code}")
        print(f"   * Response Body: {res_exceed.text[:200]}")
        assert res_exceed.status_code == 422, f"Expected 422 Unprocessable Entity, got {res_exceed.status_code}"
        results["4D_exceeded_quantity_blocked"] = "PASS (HTTP 422 - Return exceeds remaining quantity)"

        # 4F. Sequential Duplicate Return Block
        print(f"\n--- 4F: Sequential Duplicate Return Request with same return_no '{ret_no}' ---")
        dup_ret_payload = {**ret_payload, "id": f"sr-diff-id-{ret_suffix}"}
        res_dup_ret = await client.post(f"{API_BASE}/api/v1/sales/returns/", headers=HEADERS, json=dup_ret_payload)
        print(f"   * Status Code: {res_dup_ret.status_code}")
        print(f"   * Response Body: {res_dup_ret.text[:200]}")
        assert res_dup_ret.status_code == 409, f"Expected 409 Conflict, got {res_dup_ret.status_code}"
        results["4E_duplicate_return_blocked"] = f"PASS (HTTP {res_dup_ret.status_code} Conflict - Duplicate document rejected)"

        # 4G. 10x Simultaneous Return Concurrency Burst for the remaining 3 units
        burst_ret_suffix = uuid.uuid4().hex[:8].upper()
        burst_ret_no = f"RET-BURST-{burst_ret_suffix}"
        burst_ret_payload = {
            "id": f"sr-burst-{burst_ret_suffix}",
            "return_no": burst_ret_no,
            "original_invoice_id": orig_inv_id,
            "reason": "10x Concurrency Burst Return",
            "status": "processed",
            "items": [
                {
                    "product_id": product["id"],
                    "code": product["code"],
                    "name": product["name"],
                    "quantity": 3.0,
                    "price": float(product["price"] or 500.0),
                    "gst_rate": 12.0,
                    "total_amount": float(3.0 * float(product["price"] or 500.0) * 1.12),
                }
            ]
        }

        stock_before_burst_ret = stock_after_normal_return
        print(f"\n--- 4G: 10x Simultaneous Return Concurrency Burst for '{burst_ret_no}' (Qty=3.0) ---")
        burst_ret_tasks = [
            client.post(f"{API_BASE}/api/v1/sales/returns/", headers=HEADERS, json=burst_ret_payload)
            for _ in range(10)
        ]
        burst_ret_resps = await asyncio.gather(*burst_ret_tasks, return_exceptions=True)
        ret_counts = {}
        for r in burst_ret_resps:
            c = type(r).__name__ if isinstance(r, Exception) else r.status_code
            ret_counts[c] = ret_counts.get(c, 0) + 1

        print(f"   * 10x Return Burst Counts: {ret_counts}")
        c201 = ret_counts.get(201, 0)
        c409 = ret_counts.get(409, 0)
        assert c201 == 1, f"Expected 1x 201, got {c201}"
        assert c409 == 9, f"Expected 9x 409, got {c409}"
        results["4F_10x_return_concurrency"] = "PASS (1x 201 + 9x 409)"

        # Check Stock Delta: exactly +3
        cur.execute("SELECT stock FROM products WHERE id = %s;", (product["id"],))
        stock_after_burst_ret = cur.fetchone()["stock"]
        burst_ret_delta = stock_after_burst_ret - stock_before_burst_ret
        print(f"   * Stock After Burst Return: {stock_after_burst_ret} (Delta: +{burst_ret_delta})")
        assert burst_ret_delta == 3, f"Expected stock increase of +3, got +{burst_ret_delta}"
        results["4G_return_stock_invariance_under_attack"] = "PASS (Stock incremented exactly 3 units; zero phantom movements)"

        # Check DB return count
        cur.execute("SELECT COUNT(*) AS cnt FROM sales_returns WHERE return_no = %s;", (burst_ret_no,))
        burst_ret_cnt = cur.fetchone()["cnt"]
        assert burst_ret_cnt == 1, f"Expected 1 sales return row, got {burst_ret_cnt}"

        cur.execute("SELECT COUNT(*) AS cnt FROM stock_movements WHERE reference_doc_id = %s;", (f"sr-burst-{burst_ret_suffix}",))
        burst_ret_mov_cnt = cur.fetchone()["cnt"]
        assert burst_ret_mov_cnt == 1, f"Expected 1 stock movement row, got {burst_ret_mov_cnt}"
        results["4H_return_single_ledger_movement"] = "PASS (Exactly 1 return row and 1 movement row in DB)"

    conn.close()
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 5. DATABASE STOCK MOVEMENT IMMUTABILITY TRIGGER AUDIT
# ─────────────────────────────────────────────────────────────────────────────

def audit_database_immutability():
    print("\n" + "=" * 90)
    print("[GATE 5] DATABASE STOCK MOVEMENT IMMUTABILITY TRIGGER AUDIT")
    print("=" * 90)

    results = {}
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Fetch any existing movement
    cur.execute("SELECT id, movement_type, quantity, product_id, warehouse_id FROM stock_movements LIMIT 1;")
    mov = cur.fetchone()
    if not mov:
        raise RuntimeError("No stock movements found in database to test immutability trigger.")

    mov_id = mov["id"]
    print(f"   * Target Stock Movement for Immutability Test: ID={mov_id} | Qty={mov['quantity']}")

    # 5A. Attempt SQL DELETE
    print("\n--- 5A: Testing Direct SQL DELETE on stock_movements ---")
    delete_blocked = False
    delete_err_msg = ""
    try:
        cur.execute("DELETE FROM stock_movements WHERE id = %s;", (mov_id,))
        conn.commit()
    except psycopg2.DatabaseError as e:
        conn.rollback()
        delete_blocked = True
        delete_err_msg = str(e)
        print(f"   ✓ SQL DELETE Blocked by Trigger: {delete_err_msg.strip()}")

    assert delete_blocked, "CRITICAL SECURITY FAILURE: Direct SQL DELETE on stock_movements was NOT blocked!"
    assert "SMRITI-LEDGER-001" in delete_err_msg, f"Expected SMRITI-LEDGER-001 in error, got: {delete_err_msg}"
    results["5A_delete_immutability_trigger"] = "PASS (SQLSTATE P0001: SMRITI-LEDGER-001 Immutable Ledger Delete Blocked)"

    # 5B. Attempt SQL UPDATE on Quantity
    print("\n--- 5B: Testing Direct SQL UPDATE on stock_movements.quantity ---")
    update_blocked = False
    update_err_msg = ""
    try:
        cur.execute("UPDATE stock_movements SET quantity = 9999.00 WHERE id = %s;", (mov_id,))
        conn.commit()
    except psycopg2.DatabaseError as e:
        conn.rollback()
        update_blocked = True
        update_err_msg = str(e)
        print(f"   ✓ SQL UPDATE Blocked by Trigger: {update_err_msg.strip()}")

    assert update_blocked, "CRITICAL SECURITY FAILURE: Direct SQL UPDATE on stock_movements quantity was NOT blocked!"
    assert "SMRITI-LEDGER-002" in update_err_msg, f"Expected SMRITI-LEDGER-002 in error, got: {update_err_msg}"
    results["5B_update_immutability_trigger"] = "PASS (SQLSTATE P0001: SMRITI-LEDGER-002 Immutable Ledger Update Blocked)"

    conn.close()
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 6. TRANSACTION ATOMICITY & ROLLBACK AUDIT
# ─────────────────────────────────────────────────────────────────────────────

async def audit_atomicity_and_rollback(customer: dict, warehouse: dict):
    print("\n" + "=" * 90)
    print("[GATE 6] TRANSACTION ATOMICITY & ZERO-PARTIAL-MOVEMENT ROLLBACK AUDIT")
    print("=" * 90)

    results = {}
    fail_suffix = uuid.uuid4().hex[:8].upper()
    fail_inv_no = f"INV-FAIL-{fail_suffix}"

    # Invoice referencing a completely invalid product ID that fails during item resolution
    fail_payload = {
        "invoice_no": fail_inv_no,
        "customer_id": customer["id"],
        "warehouse_id": warehouse["id"],
        "status": "Confirmed",
        "payment_mode": "CASH",
        "items": [
            {
                "product_id": "non_existent_product_xyz",
                "code": "INVALID-SKU",
                "name": "Invalid Product",
                "quantity": 10.0,
                "price": 500.0,
                "gst_rate": 12.0,
                "total_amount": 5600.0,
            }
        ]
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(f"{API_BASE}/api/v1/sales/invoices", headers=HEADERS, json=fail_payload)
        print(f"   * Forced Failure Response Status: {res.status_code}")
        assert res.status_code in [400, 404, 422], f"Expected failure status, got {res.status_code}"

    # Verify zero database rows created
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT COUNT(*) AS cnt FROM sales_invoices WHERE invoice_no = %s;", (fail_inv_no,))
    inv_cnt = cur.fetchone()["cnt"]
    assert inv_cnt == 0, f"Atomicity violation! Invoice record created: {inv_cnt}"

    cur.execute("SELECT COUNT(*) AS cnt FROM stock_movements WHERE remarks LIKE %s;", (f"%{fail_inv_no}%",))
    mov_cnt = cur.fetchone()["cnt"]
    assert mov_cnt == 0, f"Atomicity violation! Stock movement created: {mov_cnt}"

    conn.close()
    print(f"   ✓ Verified: Zero partial invoice records and zero partial stock movements created.")
    results["6A_rollback_atomicity"] = "PASS (Clean transaction rollback; zero phantom records)"
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 7. TENANT ISOLATION GUARD AUDIT
# ─────────────────────────────────────────────────────────────────────────────

async def audit_tenant_isolation(invoice_id: str):
    print("\n" + "=" * 90)
    print("[GATE 7] TENANT ISOLATION GUARD AUDIT")
    print("=" * 90)

    results = {}
    # 7A: Foreign Registered Tenant COMP-004 (routes to isolated database smriti004)
    token_comp4 = create_access_token({
        "sub": "usr-admin",
        "role": "SYSADMIN",
        "company_id": "COMP-004",
        "branch_id": "BR-004",
    })
    headers_comp4 = {
        "Authorization": f"Bearer {token_comp4}",
        "Content-Type": "application/json",
        "X-Company-Id": "COMP-004",
        "X-Branch-Id": "BR-004",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Cross-tenant read against COMP-001's invoice ID
        res_comp4 = await client.get(f"{API_BASE}/api/v1/sales/invoices/{invoice_id}", headers=headers_comp4)
        print(f"   * Foreign Tenant (COMP-004 / smriti004) Invoice Access Status: {res_comp4.status_code}")
        print(f"   * Response: {res_comp4.text[:150]}")
        assert res_comp4.status_code in [403, 404], f"Expected 403 or 404 for cross-tenant access, got {res_comp4.status_code}"

        # 7B: Unregistered / Denied Tenant COMP-002
        token_comp2 = create_access_token({
            "sub": "usr-admin",
            "role": "SYSADMIN",
            "company_id": "COMP-002",
            "branch_id": "BR-002",
        })
        headers_comp2 = {
            "Authorization": f"Bearer {token_comp2}",
            "Content-Type": "application/json",
            "X-Company-Id": "COMP-002",
            "X-Branch-Id": "BR-002",
        }
        res_comp2 = await client.get(f"{API_BASE}/api/v1/sales/invoices/{invoice_id}", headers=headers_comp2)
        print(f"   * Unregistered Tenant (COMP-002) Access Status: {res_comp2.status_code}")
        print(f"   * Response: {res_comp2.text[:150]}")
        assert res_comp2.status_code in [401, 403, 404], f"Expected 401/403/404, got {res_comp2.status_code}"

        results["7A_tenant_isolation"] = f"PASS (COMP-004: HTTP {res_comp4.status_code}; COMP-002: HTTP {res_comp2.status_code} - Cross-tenant isolation strictly enforced)"

    return results


# ─────────────────────────────────────────────────────────────────────────────
# 8. SYSTEM RESTART & RECOVERY PERSISTENCE AUDIT
# ─────────────────────────────────────────────────────────────────────────────

async def audit_restart_and_persistence(target_inv_no: str, target_so_no: str):
    print("\n" + "=" * 90)
    print("[GATE 8] SYSTEM RESTART & RECOVERY PERSISTENCE AUDIT")
    print("=" * 90)

    print("   * Initiating Docker container restart: 'smriti-db' and 'smriti-api'...")
    subprocess.run(["docker", "restart", "smriti-db", "smriti-api"], check=True)
    print("   * Containers restarted. Waiting for database and API to achieve healthy state...")

    # Wait for PostgreSQL
    get_db_conn(max_retries=30, delay=1.0)
    print("   * Database reconnected successfully.")

    # Wait for FastAPI Core
    await wait_for_api(max_attempts=40, delay_sec=2)

    # Verify document persistence
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id, invoice_no, grand_total, status FROM sales_invoices WHERE invoice_no = %s;", (target_inv_no,))
    inv = cur.fetchone()
    print(f"   * Re-queried Invoice after restart: {inv}")
    assert inv is not None, f"Invoice '{target_inv_no}' missing after container restart!"

    cur.execute("SELECT id, order_no, grand_total, status FROM sales_orders WHERE order_no = %s;", (target_so_no,))
    so = cur.fetchone()
    print(f"   * Re-queried Sales Order after restart: {so}")
    assert so is not None, f"Sales Order '{target_so_no}' missing after container restart!"

    # Verify Stock Movement immutability still enforced after restart
    cur.execute("SELECT id FROM stock_movements LIMIT 1;")
    test_mov_id = cur.fetchone()["id"]
    try:
        cur.execute("DELETE FROM stock_movements WHERE id = %s;", (test_mov_id,))
        conn.commit()
        trigger_active = False
    except psycopg2.DatabaseError:
        conn.rollback()
        trigger_active = True

    assert trigger_active, "Immutability trigger inactive after restart!"
    print("   ✓ PostgreSQL Immutability Trigger actively enforced post-restart.")

    conn.close()
    return {"8A_restart_persistence": "PASS (All business documents, stock movements, and triggers persistent across restart)"}


# ─────────────────────────────────────────────────────────────────────────────
# MAIN HARNESS RUNNER
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 90)
    print("SMRITI RETAIL OS -- PHASE 1 SALES HARDENING & TRANSACTION INTEGRITY AUDIT")
    print("=" * 90)
    print(f"Timestamp           : {datetime.now(timezone.utc).isoformat()}")
    print(f"API Target          : {API_BASE}")
    print(f"PostgreSQL Target   : {DB_URL}")
    print(f"Security Context    : SYSADMIN | COMP-001 | BR-001")
    print("=" * 90)

    await wait_for_api(max_attempts=30, delay_sec=2)

    # 0. Fixtures Resolution
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id, code, name, stock, barcode, price, mrp FROM products WHERE code = 'ITM-API-095A' LIMIT 1;")
    prod = cur.fetchone()
    if not prod:
        raise RuntimeError("Product ITM-API-095A not found.")

    cur.execute("SELECT id, name FROM customers WHERE is_deleted = false AND (company_id = 'COMP-001' OR company_id IS NULL) AND (branch_id = 'BR-001' OR branch_id IS NULL) LIMIT 1;")
    cust = cur.fetchone()

    cur.execute("""
        SELECT w.id, w.name, w.code
        FROM product_batch_stocks pbs
        JOIN warehouses w ON w.id = pbs.warehouse_id
        WHERE pbs.product_id = %s AND pbs.quantity > 0 AND pbs.is_deleted = false
        LIMIT 1;
    """, (prod["id"],))
    wh = cur.fetchone()
    if not wh:
        cur.execute("SELECT id, name, code FROM warehouses WHERE is_deleted = false AND (company_id = 'COMP-001' OR company_id IS NULL) LIMIT 1;")
        wh = cur.fetchone()

    cur.execute("SELECT id, legal_name FROM parties WHERE company_id = 'COMP-001' LIMIT 1;")
    party = cur.fetchone()

    cur.execute("SELECT id, item_code FROM items LIMIT 1;")
    item = cur.fetchone()

    conn.close()

    print(f"   [FIXTURES] Product   : {prod['code']} ({prod['name']}) | Stock: {prod['stock']}")
    print(f"   [FIXTURES] Customer  : {cust['id']} ({cust['name']})")
    print(f"   [FIXTURES] Warehouse : {wh['id']} ({wh['name']})")
    print(f"   [FIXTURES] Party     : {party['id']} ({party['legal_name']})")
    print(f"   [FIXTURES] Item      : {item['id']} ({item['item_code']})")

    # Run All Gates
    t0 = time.time()
    g1, created_so_no = await audit_sales_order(prod, cust)
    g2, created_inv = await audit_sales_invoice(prod, cust, wh)
    g3 = await audit_delivery_dispatch(party["id"], item["id"], created_inv["id"])
    g4 = await audit_sales_return(prod, cust, wh)
    g5 = audit_database_immutability()
    g6 = await audit_atomicity_and_rollback(cust, wh)
    g7 = await audit_tenant_isolation(created_inv["id"])
    g8 = await audit_restart_and_persistence(created_inv["invoice_no"], created_so_no)
    total_sec = time.time() - t0

    # Aggregate Report
    all_results = {
        "GATE_1_SALES_ORDER": g1,
        "GATE_2_SALES_INVOICE": g2,
        "GATE_3_DELIVERY_DISPATCH": g3,
        "GATE_4_SALES_RETURN": g4,
        "GATE_5_DATABASE_IMMUTABILITY": g5,
        "GATE_6_ATOMICITY_ROLLBACK": g6,
        "GATE_7_TENANT_ISOLATION": g7,
        "GATE_8_RESTART_PERSISTENCE": g8,
    }

    report_path = OUTPUT_DIR / "final_sales_hardening_audit_results.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)

    print("\n" + "=" * 90)
    print("PHASE 1 SALES HARDENING & TRANSACTION INTEGRITY AUDIT: 100% COMPLETE")
    print("=" * 90)
    print(f"Total Execution Time: {total_sec:.2f}s")
    print(f"Results Saved: {report_path}")
    print(json.dumps(all_results, indent=2))
    print("=" * 90)


if __name__ == "__main__":
    asyncio.run(main())
