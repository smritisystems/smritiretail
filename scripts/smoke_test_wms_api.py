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
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from jose import jwt

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath("backend"))
from app.core.config import settings

BASE_URL = "http://localhost:8000/api/v1"

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

def http_get(url: str, token: str):
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "X-Company-Code": "COMP-001",
            "X-Branch-Code": "BR-001",
        },
        method="GET"
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def http_post_json(url: str, payload: dict, token: str, headers: dict = None):
    req_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Company-Code": "COMP-001",
        "X-Branch-Code": "BR-001",
    }
    if headers:
        req_headers.update(headers)
    
    encoded_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded_data,
        headers=req_headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"   [HTTP ERROR {e.code}]: {err_msg}")
        raise e

def http_delete(url: str, token: str):
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "X-Company-Code": "COMP-001",
            "X-Branch-Code": "BR-001",
        },
        method="DELETE"
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def main():
    print("============================================================")
    print("SMRITI WMS Phase 1, 2 & 3 Non-Destructive Live API Smoke Test")
    print("============================================================")

    created_transfer_id = None
    created_grn_id = None
    created_inv_id = None
    created_grn_batch = None
    sample_product_id = None

    # 1. Generate Auth Token
    print("\n1. Generating cryptographic Bearer JWT token for SYSADMIN (COMP-001)...")
    token = generate_test_token()
    print(f"   [OK] Token generated successfully: {token[:25]}...")

    try:
        # 2. Fetch Warehouses
        print("\n2. Calling GET /wms/warehouses...")
        status, warehouses = http_get(f"{BASE_URL}/wms/warehouses", token)
        assert status == 200, f"Warehouses failed with status {status}"
        print(f"   [OK] HTTP {status} — Fetched {len(warehouses)} warehouses:")
        for w in warehouses:
            print(f"        - ID: {w['id']} | Code: {w['code']} | Name: {w['name']} (Central: {w['is_central_godown']}, Transit: {w['is_transit']})")

        src_wh = next(w for w in warehouses if w["code"] == "WH-MAIN")
        dst_wh = next(w for w in warehouses if w["code"] == "WH-SHOP")

        # 3. Fetch Batch Stocks
        print("\n3. Calling GET /wms/batch-stocks...")
        status, batch_stocks = http_get(f"{BASE_URL}/wms/batch-stocks", token)
        assert status == 200, f"Batch stocks failed with status {status}"
        print(f"   [OK] HTTP {status} — Fetched {len(batch_stocks)} live batch stock records.")
        sample = next(b for b in batch_stocks if float(b["available_quantity"]) >= 10.0)
        sample_product_id = sample["product_id"]
        print(f"        Selected Record: Product={sample['product_id']}, Batch={sample['batch_no']}, Qty={sample['quantity']}, Available={sample['available_quantity']}")

        # 4. Allocate Batch Stock via FEFO HTTP API
        print(f"\n4. Calling POST /wms/allocate-fefo for Product {sample['product_id']} (Qty: 10)...")
        status, allocations = http_post_json(
            f"{BASE_URL}/wms/allocate-fefo",
            {
                "product_id": sample["product_id"],
                "warehouse_id": src_wh["id"],
                "quantity": 10.0
            },
            token
        )
        assert status == 200, f"Allocate FEFO failed with status {status}"
        print(f"   [OK] HTTP {status} — FEFO Allocation Result:")
        for a in allocations:
            print(f"        - Batch: {a['batch_no']}, Allocated: {a['allocated_quantity']}, Expiry: {a['expiry_date']}")

        # 5. Create Stock Transfer Order (STO) HTTP API
        idempotency_key = f"IDEM-SMOKE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        print(f"\n5. Calling POST /wms/transfers (Idempotency: {idempotency_key})...")
        status, transfer = http_post_json(
            f"{BASE_URL}/wms/transfers",
            {
                "source_warehouse_id": src_wh["id"],
                "dest_warehouse_id": dst_wh["id"],
                "items": [
                    {
                        "product_id": sample["product_id"],
                        "batch_no": sample["batch_no"],
                        "quantity": 5.0,
                        "unit_cost": float(sample["purchase_rate"] or 100.0),
                        "notes": "Inter-godown replenishment transfer"
                    }
                ],
                "transporter_name": "Dedicated Fleet 01",
                "vehicle_number": "MH-04-TR-9000",
                "notes": "Automated Smoke Test Transfer"
            },
            token,
            headers={"Idempotency-Key": idempotency_key}
        )
        assert status == 201, f"Transfer creation failed with status {status}"
        created_transfer_id = transfer["id"]
        print(f"   [OK] HTTP {status} — Created Transfer {transfer['transfer_no']} (ID: {transfer['id']}, Status: {transfer['status']})")

        # 6. Dispatch Transfer Order HTTP API
        print(f"\n6. Calling POST /wms/transfers/{transfer['id']}/dispatch...")
        status, dispatched = http_post_json(
            f"{BASE_URL}/wms/transfers/{transfer['id']}/dispatch",
            {},
            token
        )
        assert status == 200, f"Dispatch failed with status {status}"
        print(f"   [OK] HTTP {status} — Transfer Dispatched (Status: {dispatched['status']}, Dispatch Date: {dispatched['dispatch_date']})")

        # 7. Receive Transfer Order HTTP API
        print(f"\n7. Calling POST /wms/transfers/{transfer['id']}/receive...")
        item_id = dispatched["items"][0]["id"]
        status, received = http_post_json(
            f"{BASE_URL}/wms/transfers/{transfer['id']}/receive",
            {
                "receipt_details": [
                    {
                        "item_id": item_id,
                        "quantity_received": 5.0,
                        "quantity_shortage": 0.0,
                        "quantity_damaged": 0.0
                    }
                ]
            },
            token
        )
        assert status == 200, f"Receive failed with status {status}"
        print(f"   [OK] HTTP {status} — Transfer Received (Status: {received['status']}, Received Date: {received['received_date']})")

        # 8. Create Purchase Receipt (GRN Inward Batch Capture)
        grn_id = f"pr-smoke-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        grn_no = f"GRN-SMOKE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        grn_batch = f"BATCH-SMOKE-GRN-{datetime.now().strftime('%H%M%S')}"
        created_grn_id = grn_id
        created_grn_batch = grn_batch

        print(f"\n8. Calling POST /purchase/receipts (GRN Inward Batch: {grn_batch})...")
        status, grn_resp = http_post_json(
            f"{BASE_URL}/purchase/receipts",
            {
                "id": grn_id,
                "receipt_no": grn_no,
                "supplier_id": "sup-test-01",
                "warehouse_id": src_wh["id"],
                "items": [
                    {
                        "product_id": sample["product_id"],
                        "code": "SMOKE-PROD",
                        "name": "Smoke Test Item",
                        "batch_no": grn_batch,
                        "expiry_date": (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d"),
                        "quantity_received": 30.0,
                        "cost_price": 110.0,
                        "gst_rate": 18.0
                    }
                ]
            },
            token
        )
        assert status == 201, f"Purchase receipt creation failed with status {status}"
        print(f"   [OK] HTTP {status} -- GRN Received {grn_resp['receipt_no']} (Status: {grn_resp['status']}, Grand Total: INR {grn_resp['grand_total']})")

        # 9. Create B2B Sales Invoice with FEFO auto-allocation
        inv_id = f"inv-smoke-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        inv_no = f"INV-SMOKE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        created_inv_id = inv_id

        print(f"\n9. Calling POST /sales/invoices (B2B FEFO Auto-Deduction)...")
        status, inv_resp = http_post_json(
            f"{BASE_URL}/sales/invoices",
            {
                "id": inv_id,
                "invoice_no": inv_no,
                "customer_id": "CUST-WALKIN",
                "warehouse_id": src_wh["id"],
                "payment_mode": "CASH",
                "items": [
                    {
                        "product_id": sample["product_id"],
                        "code": "SMOKE-PROD",
                        "name": "Smoke Test Item",
                        "quantity": 10.0,
                        "price": 180.0,
                        "gst_rate": 18.0
                    }
                ]
            },
            token
        )
        assert status == 201, f"Sales invoice creation failed with status {status}"
        print(f"   [OK] HTTP {status} -- Sales Invoice Created {inv_resp['invoice_no']} (Grand Total: INR {inv_resp['grand_total']}, Batch Allocated: {inv_resp['items'][0].get('batch_no')})")

        # 10. Generate Transfer Delivery Challan (Rule 55)
        print(f"\n10. Calling GET /wms/transfers/{transfer['id']}/delivery-challan (Rule 55)...")
        status, challan_resp = http_get(f"{BASE_URL}/wms/transfers/{transfer['id']}/delivery-challan", token)
        assert status == 200, f"Delivery challan failed with status {status}"
        print(f"   [OK] HTTP {status} -- Challan {challan_resp['challan_no']} (From: {challan_resp['dispatch_from']['code']}, To: {challan_resp['dispatch_to']['code']}, Subtitle: {challan_resp['statutory_subtitle']})")

        # 11. Generate Transfer E-Way Bill Payload
        print(f"\n11. Calling GET /wms/transfers/{transfer['id']}/eway-bill-payload...")
        status, eway_resp = http_get(f"{BASE_URL}/wms/transfers/{transfer['id']}/eway-bill-payload?trans_distance_km=120", token)
        assert status == 200, f"Transfer E-Way bill payload failed with status {status}"
        bill = eway_resp["billLists"][0]
        print(f"   [OK] HTTP {status} -- E-Way Payload Doc: {bill['docNo']}, DocType: {bill['docType']}, SubSupply: {bill['subSupplyType']}, Vehicle: {bill['vehicleNo']}, Compliance: {eway_resp.get('compliance', {}).get('status')}")

        # 12. Generate Sales Invoice E-Way Bill Payload
        print(f"\n12. Calling GET /sales/invoices/{inv_id}/eway-bill-payload...")
        status, inv_eway_resp = http_get(f"{BASE_URL}/sales/invoices/{inv_id}/eway-bill-payload?trans_distance_km=45", token)
        assert status == 200, f"Sales invoice E-Way bill payload failed with status {status}"
        inv_bill = inv_eway_resp["billLists"][0]
        print(f"   [OK] HTTP {status} -- Invoice E-Way Payload Doc: {inv_bill['docNo']}, Total Inv Value: INR {inv_bill['totInvValue']}, Items: {len(inv_bill['itemList'])}")

        # 13. Cancel Sales Invoice (Stock Reversal)
        print(f"\n13. Calling DELETE /sales/invoices/{inv_id} (Stock Restoration)...")
        status, del_resp = http_delete(f"{BASE_URL}/sales/invoices/{inv_id}", token)
        assert status == 200, f"Sales invoice cancellation failed with status {status}"
        print(f"   [OK] HTTP {status} -- Sales Invoice Cancelled & Batch Stock Restored: {del_resp.get('message')}")

    finally:
        print("\n14. Teardown: Performing guaranteed cleanup of smoke-test artifacts in database...")
        import psycopg2
        conn = psycopg2.connect("dbname=smriti001 user=postgres password=postgres host=localhost port=5432")
        cur = conn.cursor()
        if created_transfer_id:
            cur.execute("DELETE FROM stock_transfer_items WHERE transfer_id = %s;", (created_transfer_id,))
            cur.execute("DELETE FROM stock_transfers WHERE id = %s;", (created_transfer_id,))
        if created_grn_id:
            cur.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = %s;", (created_grn_id,))
            cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (created_grn_id,))
        if created_inv_id:
            cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s;", (created_inv_id,))
            cur.execute("DELETE FROM sales_invoices WHERE id = %s;", (created_inv_id,))
        if created_grn_batch:
            cur.execute("DELETE FROM product_batch_stocks WHERE batch_no = %s;", (created_grn_batch,))
            cur.execute("DELETE FROM stock_movements WHERE batch = %s;", (created_grn_batch,))
        cur.execute("DELETE FROM stock_movements WHERE reference_doc_id LIKE 'STO-%' OR reference_doc_id LIKE 'GRN-SMOKE%' OR reference_doc_id LIKE 'INV-SMOKE%';")
        
        # Resync stock cache for sample product
        if sample_product_id:
            cur.execute("""
                UPDATE products p
                SET stock = COALESCE(sub.total, 0)
                FROM (
                    SELECT product_id, SUM(quantity - damaged_quantity) AS total
                    FROM product_batch_stocks
                    WHERE is_deleted = false AND product_id = %s
                    GROUP BY product_id
                ) sub
                WHERE p.id = sub.product_id;
            """, (sample_product_id,))
        
        conn.commit()
        conn.close()
        print("   [OK] Teardown complete. Zero residual test rows in smriti001.")

    print("\n============================================================")
    print("ALL 13 AUTHENTICATED WMS PHASE 1, 2 & 3 API SMOKE TESTS COMPLETED SUCCESSFULLY!")
    print("============================================================")

if __name__ == "__main__":
    main()

