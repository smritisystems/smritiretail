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

def main():
    print("============================================================")
    print("SMRITI WMS Phase 1 Authenticated Live API Smoke Test")
    print("============================================================")

    # 1. Generate Auth Token
    print("\n1. Generating cryptographic Bearer JWT token for SYSADMIN (COMP-001)...")
    token = generate_test_token()
    print(f"   [OK] Token generated successfully: {token[:25]}...")

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
    sample = batch_stocks[0]
    print(f"        Sample Record: Product={sample['product_id']}, Batch={sample['batch_no']}, Qty={sample['quantity']}, Available={sample['available_quantity']}")

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

    print("\n============================================================")
    print("ALL 7 AUTHENTICATED WMS API SMOKE TESTS COMPLETED SUCCESSFULLY!")
    print("============================================================")

if __name__ == "__main__":
    main()
