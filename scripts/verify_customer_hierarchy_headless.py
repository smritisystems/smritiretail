"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-25
Modified     : 2026-10-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Headless Customer Hierarchy Verification
"""

import json
import os
import sys
import urllib.request

if "/app" not in sys.path:
    sys.path.insert(0, "/app")

from app.core.security import create_access_token

def run_verification():
    token = create_access_token({
        "sub": "USR-58094466",
        "type": "access",
        "username": "cashier_58094466",
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": "MAIN"
    })

    headers = {
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "MAIN",
        "Authorization": f"Bearer {token}",
    }

    def api_get(endpoint):
        url = f"http://localhost:8000{endpoint}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())

    print("======================================================================")
    print(" SMRITI RETAIL OS: HEADLESS CUSTOMER HIERARCHY VERIFICATION SUITE")
    print("======================================================================")

    # 1. Query Directory for ShopperStop
    print("\n--- TEST 1: DIRECTORY SEARCH (q=ShopperStop) ---")
    status, data = api_get("/api/v1/crm/customers/directory?q=ShopperStop")
    print(f"HTTP Status: {status}")
    print(f"Total Matches: {data.get('total')}")
    parent_id = None
    child_id = None
    for it in data.get("items", []):
        rel = it.get("relationship_type")
        code = it.get("code")
        name = it.get("name")
        children = it.get("child_count")
        is_dep = it.get("is_dependant")
        parent_name = it.get("parent_customer_name")
        parent_code = it.get("parent_customer_code")
        print(f"  * [{rel.upper()}] Code: {code} | Name: {name} | Children: {children} | Dependant: {is_dep} | Parent: {parent_name} ({parent_code})")
        if rel == "parent":
            parent_id = it.get("id")
        elif rel == "child":
            child_id = it.get("id")

    assert parent_id is not None, "Parent account ShopperStop not found"
    assert child_id is not None, "Child account ShopperStop Demo Branch not found"
    print(">> TEST 1 PASSED: Parent and Child properly identified in directory.")

    # 2. Filter by relationship=parent
    print("\n--- TEST 2: FILTER BY RELATIONSHIP (relationship=parent) ---")
    status, data = api_get("/api/v1/crm/customers/directory?q=ShopperStop&relationship=parent")
    print(f"HTTP Status: {status}")
    items = data.get("items", [])
    print(f"Returned Items Count: {len(items)}")
    for it in items:
        print(f"  * Code: {it.get('code')} | RelType: {it.get('relationship_type')} | Name: {it.get('name')}")
        assert it.get("relationship_type") == "parent", f"Expected parent, got {it.get('relationship_type')}"
    assert len(items) == 1, f"Expected exactly 1 parent, got {len(items)}"
    print(">> TEST 2 PASSED: Only parent records returned.")

    # 3. Filter by relationship=child
    print("\n--- TEST 3: FILTER BY RELATIONSHIP (relationship=child) ---")
    status, data = api_get("/api/v1/crm/customers/directory?q=ShopperStop&relationship=child")
    print(f"HTTP Status: {status}")
    items = data.get("items", [])
    print(f"Returned Items Count: {len(items)}")
    for it in items:
        print(f"  * Code: {it.get('code')} | RelType: {it.get('relationship_type')} | Name: {it.get('name')} | Parent: {it.get('parent_customer_name')}")
        assert it.get("relationship_type") == "child", f"Expected child, got {it.get('relationship_type')}"
    assert len(items) == 1, f"Expected exactly 1 child, got {len(items)}"
    print(">> TEST 3 PASSED: Only child records returned.")

    # 4. Filter by parent_id
    print(f"\n--- TEST 4: FILTER BY PARENT_ID (parent_id={parent_id}) ---")
    status, data = api_get(f"/api/v1/crm/customers/directory?parent_id={parent_id}")
    print(f"HTTP Status: {status}")
    items = data.get("items", [])
    print(f"Children returned for parent {parent_id}: {len(items)}")
    for it in items:
        print(f"  * Child Code: {it.get('code')} | Child Name: {it.get('name')} | Parent: {it.get('parent_customer_name')}")
        assert it.get("id") == child_id, "Returned child ID does not match expected child ID"
    assert len(items) == 1, f"Expected 1 child for parent, got {len(items)}"
    print(">> TEST 4 PASSED: Filter by parent_id returned exact subordinate children.")

    # 5. List dependants by parent UUID
    print(f"\n--- TEST 5: GET DEPENDANTS BY PARENT UUID ({parent_id}) ---")
    status, data = api_get(f"/api/v1/crm/customers/{parent_id}/dependants")
    print(f"HTTP Status: {status}")
    print(f"Dependants Count: {len(data)}")
    for dep in data:
        dep_code = dep.get("dependantCustomerCode") or dep.get("dependant_customer_code")
        dep_name = dep.get("dependantCustomerName") or dep.get("dependant_customer_name")
        dep_status = dep.get("dependantCustomerStatus") or dep.get("dependant_customer_status")
        dep_id = dep.get("dependantCustomerId") or dep.get("dependant_customer_id")
        print(f"  * Subordinate Code: {dep_code} | Name: {dep_name} | Status: {dep_status} | ID: {dep_id}")
    assert len(data) == 1, f"Expected 1 dependant, got {len(data)}"
    dep0_id = data[0].get("dependantCustomerId") or data[0].get("dependant_customer_id")
    assert dep0_id == child_id, f"Dependant ID mismatch: {dep0_id} vs {child_id}"
    print(">> TEST 5 PASSED: Dependants endpoint returns subordinates by parent UUID.")

    # 6. List dependants by parent Code
    print("\n--- TEST 6: GET DEPENDANTS BY PARENT CODE (CUST-68351893) ---")
    status, data = api_get("/api/v1/crm/customers/CUST-68351893/dependants")
    print(f"HTTP Status: {status}")
    print(f"Dependants Count: {len(data)}")
    for dep in data:
        dep_code = dep.get("dependantCustomerCode") or dep.get("dependant_customer_code")
        dep_name = dep.get("dependantCustomerName") or dep.get("dependant_customer_name")
        dep_status = dep.get("dependantCustomerStatus") or dep.get("dependant_customer_status")
        dep_id = dep.get("dependantCustomerId") or dep.get("dependant_customer_id")
        print(f"  * Subordinate Code: {dep_code} | Name: {dep_name} | Status: {dep_status} | ID: {dep_id}")
    assert len(data) == 1, f"Expected 1 dependant, got {len(data)}"
    dep0_id = data[0].get("dependantCustomerId") or data[0].get("dependant_customer_id")
    assert dep0_id == child_id, f"Dependant ID mismatch: {dep0_id} vs {child_id}"
    print(">> TEST 6 PASSED: Dependants endpoint resolves parent code transparently.")

    # 7. Single Customer Get & Verification
    print(f"\n--- TEST 7: SINGLE CUSTOMER RETRIEVAL (GET /crm/customers/{child_id}) ---")
    status, c_data = api_get(f"/api/v1/crm/customers/{child_id}")
    print(f"HTTP Status: {status}")
    print(f"  * Name: {c_data.get('name')}")
    print(f"  * Code: {c_data.get('code')}")
    print(f"  * Group: {c_data.get('customer_group_id')}")
    print(">> TEST 7 PASSED: Single customer detail retrieved cleanly.")

    print("\n======================================================================")
    print(" ALL 7 LIVE API HIERARCHY VERIFICATIONS COMPLETED SUCCESSFULLY (100%)")
    print("======================================================================")

if __name__ == "__main__":
    run_verification()
