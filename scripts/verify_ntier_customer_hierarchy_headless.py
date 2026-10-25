"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-26
Modified     : 2026-10-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Headless N-Tier Customer Hierarchy & Bulk Assign Verification
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

if "/app" not in sys.path:
    sys.path.insert(0, "/app")

from app.core.security import create_access_token


def run_verification():
    ts = str(int(time.time()))[-6:]
    token = create_access_token({
        "sub": "usr-sysadmin",
        "type": "access",
        "username": "usr_sysadmin",
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": "MAIN"
    })

    headers = {
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "MAIN",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    def api_get(endpoint):
        url = f"http://localhost:8000{endpoint}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())

    def api_post(endpoint, body):
        url = f"http://localhost:8000{endpoint}"
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())

    print("======================================================================")
    print(" SMRITI RETAIL OS: HEADLESS N-TIER HIERARCHY & BULK ASSIGN SUITE")
    print("======================================================================")

    # 1. Create 3-tier customer structure via CRM endpoints
    print("\n[Step 1] Creating 3-tier customer accounts and candidate accounts...")
    
    # 1a. Root Holding
    root_payload = {
        "name": f"Titan Holding Group {ts}",
        "code": f"TITAN-{ts}",
        "mobile": f"901{ts}11",
        "status": "Active"
    }
    status, root_cust = api_post("/api/v1/crm/customers", root_payload)
    root_id = root_cust["id"]
    print(f"  ✓ Root Holding Created: {root_cust['name']} ({root_cust['code']}) [ID: {root_id}]")

    # 1b. Regional Hub (Tier 1) subordinated to Root
    hub_payload = {
        "name": f"Titan West Hub {ts}",
        "code": f"HUB-{ts}",
        "mobile": f"902{ts}22",
        "status": "Active",
        "is_dependant": True,
        "parent_customer_id": root_id
    }
    status, hub_cust = api_post("/api/v1/crm/customers", hub_payload)
    hub_id = hub_cust["id"]
    print(f"  ✓ Regional Hub Created: {hub_cust['name']} ({hub_cust['code']}) [Parent: {root_id}]")

    # 1c. Two Store Outlets (Tier 2) subordinated to Regional Hub
    store1_payload = {
        "name": f"Titan Store Bandra {ts}",
        "code": f"STR1-{ts}",
        "mobile": f"903{ts}33",
        "status": "Active",
        "is_dependant": True,
        "parent_customer_id": hub_id
    }
    status, store1 = api_post("/api/v1/crm/customers", store1_payload)
    store1_id = store1["id"]

    store2_payload = {
        "name": f"Titan Store Andheri {ts}",
        "code": f"STR2-{ts}",
        "mobile": f"904{ts}44",
        "status": "Active",
        "is_dependant": True,
        "parent_customer_id": hub_id
    }
    status, store2 = api_post("/api/v1/crm/customers", store2_payload)
    store2_id = store2["id"]
    print(f"  ✓ Store Outlets Created: {store1['code']} & {store2['code']} under Hub [{hub_id}]")

    # 1d. Create two standalone candidate customers
    cand1_payload = {
        "name": f"Apex Franchise Chembur {ts}",
        "code": f"CND1-{ts}",
        "mobile": f"905{ts}55",
        "status": "Active"
    }
    status, cand1 = api_post("/api/v1/crm/customers", cand1_payload)
    cand1_id = cand1["id"]

    cand2_payload = {
        "name": f"Apex Franchise Colaba {ts}",
        "code": f"CND2-{ts}",
        "mobile": f"906{ts}66",
        "status": "Active"
    }
    status, cand2 = api_post("/api/v1/crm/customers", cand2_payload)
    cand2_id = cand2["id"]
    print(f"  ✓ Standalone Candidates Created: {cand1['code']} & {cand2['code']}")

    # 2. Test GET /api/v1/crm/customers/{store1_id}/hierarchy
    print("\n[Step 2] Testing N-tier recursive hierarchy discovery from leaf node (Store 1)...")
    status, tree = api_get(f"/api/v1/crm/customers/{store1_id}/hierarchy")
    assert status == 200, f"Expected 200, got {status}"
    assert tree["target_customer_id"] == store1_id, "Target customer ID mismatch"
    assert tree["total_nodes"] == 4, f"Expected 4 total nodes, got {tree['total_nodes']}"
    assert tree["max_depth"] == 2, f"Expected max_depth 2, got {tree['max_depth']}"
    assert tree["is_multi_tier"] is True, "Expected is_multi_tier to be True"

    root_node = tree["root"]
    assert root_node["id"] == root_id, f"Expected root {root_id}, got {root_node['id']}"
    assert root_node["depth"] == 0, "Expected root depth 0"
    assert len(root_node["children"]) == 1, "Expected root to have 1 child (Regional Hub)"

    hub_node = root_node["children"][0]
    assert hub_node["id"] == hub_id, f"Expected hub {hub_id}, got {hub_node['id']}"
    assert hub_node["depth"] == 1, "Expected hub depth 1"
    assert len(hub_node["children"]) == 2, "Expected hub to have 2 store children"
    print(f"  ✓ Verified 3-tier hierarchy tree: Root [{root_node['code']}] -> Hub [{hub_node['code']}] -> {len(hub_node['children'])} Outlets")

    # 3. Test GET /api/v1/crm/customers/{hub_id}/assignable-children
    print("\n[Step 3] Testing assignable children candidate query for Regional Hub...")
    status, candidates = api_get(f"/api/v1/crm/customers/{hub_id}/assignable-children?limit=100")
    assert status == 200, f"Expected 200, got {status}"
    cand_ids = {c["id"] for c in candidates}
    
    # Exclusions
    assert hub_id not in cand_ids, "Hub itself must not be in candidate list"
    assert root_id not in cand_ids, "Root holding (ancestor) must not be in candidate list"
    assert store1_id not in cand_ids, "Direct child store 1 must not be in candidate list"
    assert store2_id not in cand_ids, "Direct child store 2 must not be in candidate list"

    # Inclusions
    assert cand1_id in cand_ids, "Candidate 1 must be present in candidate list"
    assert cand2_id in cand_ids, "Candidate 2 must be present in candidate list"
    print(f"  ✓ Candidate filtering passed: {len(candidates)} eligible accounts found; self, ancestors, and direct children correctly excluded")

    # 4. Test POST /api/v1/crm/customers/{hub_id}/bulk-assign-dependants
    print("\n[Step 4] Testing bulk assignment of 2 candidates to Regional Hub...")
    bulk_payload = {
        "dependant_customer_ids": [cand1_id, cand2_id],
        "relation": "Store Branch",
        "apply_same_mailing": False,
        "replace_existing": True
    }
    status, bulk_res = api_post(f"/api/v1/crm/customers/{hub_id}/bulk-assign-dependants", bulk_payload)
    assert status == 200, f"Expected 200, got {status}"
    assert bulk_res["assigned_count"] == 2, f"Expected 2 assigned, got {bulk_res['assigned_count']}"
    assert bulk_res["skipped_count"] == 0, f"Expected 0 skipped, got {bulk_res['skipped_count']}"
    assert set(bulk_res["assigned_ids"]) == {cand1_id, cand2_id}, "Assigned IDs mismatch"
    print(f"  ✓ Bulk assign successful: {bulk_res['assigned_count']} accounts linked under Hub [{bulk_res['parent_code']}]")

    # 5. Test Cycle Prevention in Bulk Assignment
    print("\n[Step 5] Testing cycle rejection: attempting to assign Root Holding under Store 1...")
    cycle_payload = {
        "dependant_customer_ids": [root_id, store1_id],
        "relation": "Cycle Test"
    }
    status, cycle_res = api_post(f"/api/v1/crm/customers/{store1_id}/bulk-assign-dependants", cycle_payload)
    assert status == 200, f"Expected 200, got {status}"
    assert cycle_res["assigned_count"] == 0, f"Expected 0 assigned, got {cycle_res['assigned_count']}"
    assert cycle_res["skipped_count"] == 2, f"Expected 2 skipped, got {cycle_res['skipped_count']}"
    assert len(cycle_res["errors"]) >= 2, "Expected cycle and self-assignment errors"
    print(f"  ✓ Cycle prevention passed: {cycle_res['skipped_count']} invalid assignments rejected with errors: {cycle_res['errors']}")

    # 6. Verify expanded hierarchy tree
    print("\n[Step 6] Verifying expanded hierarchy tree now contains 6 total nodes...")
    status, updated_tree = api_get(f"/api/v1/crm/customers/{root_id}/hierarchy")
    assert status == 200
    assert updated_tree["total_nodes"] == 6, f"Expected 6 total nodes, got {updated_tree['total_nodes']}"
    updated_hub = updated_tree["root"]["children"][0]
    assert len(updated_hub["children"]) == 4, f"Expected 4 children under hub, got {len(updated_hub['children'])}"
    print(f"  ✓ Hierarchy verified: Hub [{updated_hub['code']}] now controls {len(updated_hub['children'])} subordinate stores across 2 tiers")

    print("\n======================================================================")
    print(" ALL 6 HEADLESS VERIFICATION GATES PASSED (100% SUCCESS)")
    print("======================================================================")


if __name__ == "__main__":
    run_verification()
