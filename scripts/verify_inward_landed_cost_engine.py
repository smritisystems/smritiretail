"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.33.0
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

sys.path.insert(0, ".")
from backend.app.core.security import create_access_token

BASE_URL = "http://127.0.0.1:8000/api/v1"


def make_request(path: str, method: str = "GET", data: dict = None, token: str = ""):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        print(f"HTTP Error {e.code} on {method} {path}: {err_content}")
        return e.code, json.loads(err_content) if err_content else {}


def run_verification():
    print("================================================================================")
    print(" SMRITI INWARD LANDED COST & COMMERCIAL ENGINE — E2E VERIFICATION SUITE")
    print("================================================================================")

    # 1. Generate Auth Token
    token = create_access_token({
        "sub": "usr-admin",
        "company_id": "COMP-001",
        "branch_id": "BR-MAIN-001",
        "tenant_id": "smriti001",
    })
    print("[PASS] Step 1: JWT Access Token generated for 'usr-admin'")

    # 2. Test Inward Cost Types
    status, types = make_request("/purchase/inward-cost-types", "GET", token=token)
    assert status == 200, f"Expected 200, got {status}"
    assert len(types) >= 19, f"Expected >= 19 types, got {len(types)}"
    type_codes = {t["code"] for t in types}
    expected_sample = {"FREIGHT", "CARTAGE", "HAMALI", "LOADING", "INSURANCE", "CUSTOMS_DUTY"}
    assert expected_sample.issubset(type_codes), f"Missing expected types: {expected_sample - type_codes}"
    print(f"[PASS] Step 2: GET /purchase/inward-cost-types returned {len(types)} seeded canonical types")

    # 3. Test Landed Cost Allocation Preview (Hamilton-Hare Cent-Balancing)
    preview_payload = {
        "items": [
            {
                "line_id": "line-1",
                "item_id": "SH-001",
                "item_name": "Premium Cotton Shirt - Blue 40",
                "accepted_qty": 200.0,
                "purchase_rate": 1450.0,
                "net_amount": 290000.0,
                "weight_kg": 0.4,
            },
            {
                "line_id": "line-2",
                "item_id": "SH-002",
                "item_name": "Casual Oxford Shirt - White 42",
                "accepted_qty": 296.0,
                "purchase_rate": 1300.0,
                "net_amount": 384800.0,
                "weight_kg": 0.35,
            },
            {
                "line_id": "line-3",
                "item_id": "SH-003",
                "item_name": "Linen Blend Formal Shirt - Grey 38",
                "accepted_qty": 250.0,
                "purchase_rate": 1650.0,
                "net_amount": 412500.0,
                "weight_kg": 0.45,
            },
            {
                "line_id": "line-4",
                "item_id": "SH-004",
                "item_name": "Basic Crewneck T-Shirt - Black L",
                "accepted_qty": 474.0,
                "purchase_rate": 850.0,
                "net_amount": 402900.0,
                "weight_kg": 0.25,
            },
        ],
        "cost_components": [
            {
                "component_type": "FREIGHT",
                "description": "Bhiwandi Hub to Main Store Freight",
                "amount": 2500.0,
                "taxable_amount": 2500.0,
                "tax_rate": 18.0,
                "tax_amount": 450.0,
                "total_amount": 2950.0,
                "itc_eligible": True,
                "is_capitalizable": True,
                "allocation_method": "VALUE",
                "transporter_name": "Gati KWE Logistics",
                "document_type": "LR",
                "document_no": "LR-99882",
            },
            {
                "component_type": "HAMALI",
                "description": "Unloading & Dock Handling",
                "amount": 1500.0,
                "taxable_amount": 1500.0,
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "total_amount": 1500.0,
                "itc_eligible": False,
                "is_capitalizable": True,
                "allocation_method": "VALUE",
            },
        ],
        "allocation_method": "VALUE",
    }

    status, preview = make_request("/purchase/landed-cost/preview", "POST", preview_payload, token=token)
    assert status == 200, f"Expected 200, got {status}: {preview}"

    print(f"[PASS] Step 3: Landed Cost Preview Result:")
    print(f"       Total Purchase Value:   Rs. {float(preview['total_purchase_value']):,.2f}")
    print(f"       Total Capitalized Cost: Rs. {float(preview['total_addon_cost']):,.2f}")
    print(f"       Final Inventory Cost:   Rs. {float(preview['final_inventory_cost']):,.2f}")
    print(f"       Reconciled Allocated:   Rs. {float(preview['reconciled_allocated_cost']):,.2f}")
    print(f"       Penny Balanced:         {preview['is_balanced']}")

    # Mathematical Assertions
    assert abs(float(preview["total_purchase_value"]) - 1490200.0) < 0.01
    assert abs(float(preview["total_addon_cost"]) - 4000.0) < 0.01
    assert abs(float(preview["final_inventory_cost"]) - 1494200.0) < 0.01
    assert abs(float(preview["reconciled_allocated_cost"]) - 4000.0) < 0.01
    assert preview["is_balanced"] is True

    # Line item checks
    allocations = {a["item_id"]: a for a in preview["allocations"]}
    assert "SH-001" in allocations
    assert "SH-002" in allocations
    assert "SH-003" in allocations
    assert "SH-004" in allocations

    print("\n   [Line Item Mathematical Breakdown]:")
    for item_id, a in allocations.items():
        print(f"   -> {item_id:6s} | Accepted: {a['accepted_qty']:3.0f} | Base: Rs.{a['purchase_rate']:7.2f} | Addon: +Rs.{a['addon_per_unit']:5.2f} | Landed: Rs.{a['landed_cost']:7.2f} | Total Alloc: Rs.{a['allocated_cost']:7.2f}")

    total_line_allocated = sum(a["allocated_cost"] for a in preview["allocations"])
    assert abs(total_line_allocated - 4000.0) < 0.0001, f"Expected exactly 4000.00, got {total_line_allocated}"
    print(f"   [Hamilton-Hare Audit] Sum of line allocations: Rs. {total_line_allocated:.2f} (Variance: Rs. 0.0000)")

    # 4. Test Live GRN Creation with Cost Components and SKU Landed Cost Persistence
    import psycopg2
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("SELECT id FROM suppliers WHERE (company_id = 'COMP-001' OR company_id IS NULL) AND is_active = True AND is_deleted = False LIMIT 1;")
    row = cur.fetchone()
    if not row:
        cur.execute("INSERT INTO suppliers (id, name, code, company_id, branch_id, is_active, is_deleted, outstanding) VALUES ('sup-comp-001', 'Primary Vendor COMP-001', 'SUP-C001', 'COMP-001', 'BR-MAIN-001', True, False, 0.00) ON CONFLICT (id) DO NOTHING;")
        conn.commit()
        supplier_id = "sup-comp-001"
    else:
        supplier_id = row[0]

    cur.execute("SELECT id, name, sku FROM products WHERE company_id = 'COMP-001' OR company_id IS NULL LIMIT 2;")
    prod_rows = cur.fetchall()
    p1 = prod_rows[0] if len(prod_rows) > 0 else ("prod-1", "Item 1", "SKU-1")
    p2 = prod_rows[1] if len(prod_rows) > 1 else ("prod-2", "Item 2", "SKU-2")
    conn.close()

    receipt_suffix = int(sys.argv[1]) if len(sys.argv) > 1 else (int(datetime.now().timestamp()) % 100000)
    grn_payload = {
        "receipt_no": f"GRN-LC-{receipt_suffix}",
        "supplier_id": supplier_id,
        "po_id": None,
        "receipt_date": "2026-09-19",
        "status": "RECEIVED",
        "notes": "E2E Verification GRN with multi-component landed cost and freight allocation",
        "items": [
            {
                "product_id": p1[0],
                "item_id": p1[0],
                "code": p1[2],
                "name": p1[1],
                "ordered_qty": 200.0,
                "received_qty": 200.0,
                "accepted_qty": 200.0,
                "rejected_qty": 0.0,
                "unit_price": 1450.0,
                "cost_price": 1450.0,
                "tax_rate": 5.0,
                "discount_pct": 0.0,
            },
            {
                "product_id": p2[0],
                "item_id": p2[0],
                "code": p2[2],
                "name": p2[1],
                "ordered_qty": 300.0,
                "received_qty": 298.0,
                "accepted_qty": 296.0,
                "rejected_qty": 2.0,
                "unit_price": 1300.0,
                "cost_price": 1300.0,
                "tax_rate": 5.0,
                "discount_pct": 0.0,
            }
        ],
        "cost_components": [
            {
                "component_type": "FREIGHT",
                "description": "Interstate Primary Freight",
                "amount": 2500.0,
                "taxable_amount": 2500.0,
                "tax_rate": 18.0,
                "tax_amount": 450.0,
                "total_amount": 2950.0,
                "itc_eligible": True,
                "is_capitalizable": True,
                "allocation_method": "VALUE",
                "transporter_name": "VRL Logistics",
                "document_no": "VRL-771120",
            },
            {
                "component_type": "HAMALI",
                "description": "Dock Handling & Stacking",
                "amount": 500.0,
                "taxable_amount": 500.0,
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "total_amount": 500.0,
                "itc_eligible": False,
                "is_capitalizable": True,
                "allocation_method": "VALUE",
            }
        ]
    }

    status, receipt = make_request("/purchase/receipts/", "POST", grn_payload, token=token)
    assert status in (200, 201), f"Expected 200/201, got {status}: {receipt}"
    receipt_id = receipt["id"]
    print(f"\n[PASS] Step 4: Purchase Receipt created successfully! ID: {receipt_id} (Receipt No: {receipt['receipt_no']})")

    # 5. Verify Persisted Cost Components
    status, persisted_comps = make_request(f"/purchase/receipts/{receipt_id}/cost-components", "GET", token=token)
    assert status == 200, f"Expected 200, got {status}"
    assert len(persisted_comps) == 2, f"Expected 2 components, got {len(persisted_comps)}"
    print(f"[PASS] Step 5: GET /purchase/receipts/{receipt_id}/cost-components returned {len(persisted_comps)} persisted components:")
    for comp in persisted_comps:
        print(f"       -> {comp['component_type']:10s}: Amount Rs.{float(comp['amount']):,.2f} | Transporter: {comp.get('transporter_name') or 'N/A'}")

    # 6. Verify "Why This Cost" Forensic Drilldown
    first_item_id = receipt["items"][0]["id"]
    status, breakdown = make_request(f"/purchase/receipts/{receipt_id}/landed-cost/breakdown/{first_item_id}", "GET", token=token)
    assert status == 200, f"Expected 200, got {status}"
    item_display = breakdown.get("sku") or breakdown.get("product_id") or "Item"
    print(f"\n[PASS] Step 6: 'Why This Cost' Explainability Breakdown for Item '{item_display}':")
    print(f"       Purchase Base Rate:  Rs. {float(breakdown.get('net_purchase_rate') or breakdown.get('purchase_rate', 0)):,.2f}")
    print(f"       Total Addon / Unit:  Rs. {float(breakdown['total_addon_per_unit']):,.2f}")
    print(f"       Final Landed Cost:   Rs. {float(breakdown['final_landed_cost']):,.2f}")
    print("       Component Addon Details:")
    for c in breakdown["components"]:
        print(f"         • {c['component_type']:10s}: Rs.{float(c['allocated_amount']):,.2f} (+Rs.{float(c['allocated_per_unit']):.2f}/unit) [{c['allocation_method']}]")

    print("\n================================================================================")
    print(" ALL 6 INWARD LANDED COST & FREIGHT ENGINE VERIFICATIONS PASSED (100% GREEN)")
    print("================================================================================")


if __name__ == "__main__":
    run_verification()
