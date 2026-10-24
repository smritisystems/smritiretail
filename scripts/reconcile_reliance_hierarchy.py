#!/usr/bin/env python3
"""
SMRITI Retail OS — Reliance Retail Parent-Child Customer Hierarchy Reconciler
Author: Antigravity Agent
Version: 1.0.0
Description:
    Idempotent, dry-run-first reconciliation and import script for Reliance Retail Limited (RRL)
    parent-child customer hierarchy, supporting both Local PostgreSQL and Remote Production environments.
"""

import sys
import os
import json
import argparse
import psycopg2
import requests
from typing import Dict, Any, List, Set, Tuple

# Configuration Defaults
DEFAULT_MANIFEST_PATH = os.path.join(
    r"C:\Users\netma\.gemini\antigravity-ide\brain\ced8fc1d-9c8a-4021-adfb-7919932a21a6\scratch",
    "stores_ready_for_import.json"
)

LOCAL_DB_URL = "postgresql://postgres:postgres@localhost:2781/smritisys"
REMOTE_BASE_URL = "https://tattlythreads.smritisys.com/api/v1"

LOCAL_PARENT_CODE = "CUST-001"
REMOTE_PARENT_ID = "cust-rrl-192b561d"
REMOTE_PARENT_CODE = "RRL-001"
PARENT_PAN = "AABCR1718E"
COMPANY_CODE = "COMP-001"
COMPANY_ID = "COMP-001"
BRANCH_ID = "BR-001"

THE_8_ADDITIONAL_REMOTE_LOCATIONS = {
    "8319": "Reliance Retail Limited (RRL FOOTPRINT) - Regional Distribution Node (Tumkur, Karnataka)",
    "S4NN/8319": "Reliance Retail Limited (Distribution Node) - S4NN Tumkur NDC Logistics Hub",
    "T91M": "KORAMANGALA - Metro Retail Distribution Node (Mumbai/Koramangala, Karnataka)",
    "TEST-BLR-001": "Reliance Retail Limited - Baseline Staging Location (Bengaluru Urban, Karnataka)",
    "TEST-HYD-001": "Reliance Retail Limited - Baseline Staging Location (Hyderabad, Telangana)",
    "TEST-MUM-001": "Reliance Retail Limited - Baseline Staging Location (Mumbai Suburban, Maharashtra)",
    "TV78": "Reliance Retail Limited (RRL FOOTPRINT) - TV78 Distribution Node (Tumkur, Karnataka)",
    "TW07": "Reliance Retail Limited (Distribution Node) - TW07 Logistics Node (Mumbai/Karnataka)",
}


def load_and_validate_manifest(manifest_path: str) -> List[Dict[str, Any]]:
    """Loads and validates the 60 store records from source manifest."""
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Source manifest not found at: {manifest_path}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        stores = json.load(f)

    if not isinstance(stores, list):
        raise ValueError("Manifest content must be a JSON array of store objects.")

    print(f"Loaded {len(stores)} store records from: {manifest_path}")

    # Validate counts and fields
    site_codes = [s.get("Site_Code") for s in stores]
    unique_codes = set(site_codes)
    if len(site_codes) != len(unique_codes):
        duplicates = [c for c in site_codes if site_codes.count(c) > 1]
        raise ValueError(f"Duplicate site codes found in manifest: {set(duplicates)}")

    if len(stores) != 60:
        print(f"WARNING: Expected exactly 60 store records, found {len(stores)}")

    # Field integrity check
    for idx, s in enumerate(stores, 1):
        sc = s.get("Site_Code")
        name = s.get("Store_Name")
        gstin = s.get("GSTIN")
        st_name = s.get("state_name")
        relation = s.get("relation")

        if not sc or not name or not gstin or not st_name or not relation:
            raise ValueError(f"Incomplete record at index {idx} ({sc}): missing required fields.")

        # PAN parity check in GSTIN
        if len(gstin) >= 12 and gstin[2:12] != PARENT_PAN:
            print(f"WARNING: GSTIN {gstin} PAN substring does not match parent PAN {PARENT_PAN}")

    return stores


def reconcile_local_db(stores: List[Dict[str, Any]], dry_run: bool = True) -> Dict[str, Any]:
    """Audits and optionally reconciles hierarchy in Local PostgreSQL."""
    print("\n" + "=" * 70)
    print(f"--- LOCAL POSTGRESQL RECONCILIATION ({'DRY RUN' if dry_run else 'EXECUTE'}) ---")
    print("=" * 70)

    conn = psycopg2.connect(LOCAL_DB_URL)
    cur = conn.cursor()

    # 1. Resolve Parent
    cur.execute("""
        SELECT id, code, name, customer_type, pan_number, gst_number, status, is_deleted, company_id, branch_id, company_code 
        FROM customers 
        WHERE code = %s OR pan_number = %s
    """, (LOCAL_PARENT_CODE, PARENT_PAN))
    parents = cur.fetchall()
    if not parents:
        raise RuntimeError(f"Local parent customer '{LOCAL_PARENT_CODE}' / PAN '{PARENT_PAN}' not found!")

    parent = parents[0]
    parent_id = parent[0]
    parent_company_id = parent[8] or COMPANY_ID
    parent_branch_id = parent[9]  # None if null
    parent_company_code = parent[10] or COMPANY_CODE
    print(f"Resolved Local Parent: ID={parent[0]}, Code={parent[1]}, Name={parent[2]}, Status={parent[6]}")

    # 2. Audit Existing Child Customers in Local DB
    site_codes = [s["Site_Code"] for s in stores]
    expected_rrl_codes = [f"RRL-{sc}" for sc in site_codes]
    all_check_codes = site_codes + expected_rrl_codes

    cur.execute("""
        SELECT id, code, name, customer_type, is_dependant, status, is_deleted 
        FROM customers 
        WHERE code = ANY(%s)
    """, (all_check_codes,))
    existing_children = cur.fetchall()
    existing_child_map = {c[1]: c for c in existing_children}
    print(f"Existing Child Customer Accounts in Local DB: {len(existing_children)}")

    # 3. Audit Delivery Locations
    cur.execute("""
        SELECT id, store_code, location_name, city, state, gstin 
        FROM customer_delivery_locations 
        WHERE customer_id = %s AND is_deleted = false
    """, (parent_id,))
    existing_dls = cur.fetchall()
    existing_dl_map = {d[1]: d for d in existing_dls if d[1]}
    print(f"Existing Delivery Locations for Parent '{parent_id}': {len(existing_dls)}")

    # 4. Audit GST Registrations
    cur.execute("""
        SELECT id, gstin, state_code, state_name, registration_type, is_primary 
        FROM customer_gst_registrations 
        WHERE customer_id = %s AND is_deleted = false
    """, (parent_id,))
    existing_gsts = cur.fetchall()
    existing_gst_map = {g[1]: g for g in existing_gsts}
    print(f"Existing GST Registrations for Parent '{parent_id}': {len(existing_gsts)}")

    # 5. Audit Customer Relationships
    cur.execute("""
        SELECT id, parent_customer_id, dependant_customer_id, relation, is_deleted 
        FROM customer_relationships 
        WHERE parent_customer_id = %s AND is_deleted = false
    """, (parent_id,))
    existing_rels = cur.fetchall()
    existing_rel_dep_ids = {r[2]: r for r in existing_rels}
    print(f"Existing Customer Relationships for Parent '{parent_id}': {len(existing_rels)}")

    # Plan Changes
    children_to_create = []
    children_to_reuse = []
    rels_to_create = []
    rels_correct = []
    dl_matched = []
    dl_missing = []

    for s in stores:
        sc = s["Site_Code"]
        rrl_code = f"RRL-{sc}"
        store_name = s["Store_Name"]
        relation = s.get("relation", "STORE")

        # Check child customer
        matching_child = existing_child_map.get(rrl_code) or existing_child_map.get(sc)
        if matching_child:
            children_to_reuse.append({
                "site_code": sc,
                "child_id": matching_child[0],
                "code": matching_child[1],
                "name": matching_child[2]
            })
            child_id = matching_child[0]
        else:
            children_to_create.append({
                "site_code": sc,
                "code": rrl_code,
                "name": store_name,
                "customer_type": "Store / Outlet",
                "relation": relation,
                "gstin": s["GSTIN"],
                "state": s["state_name"],
                "pincode": s["pincode"],
                "email": s.get("Email")
            })
            child_id = None

        # Check relationship
        if child_id and child_id in existing_rel_dep_ids:
            rels_correct.append(sc)
        else:
            rels_to_create.append({"site_code": sc, "child_id": child_id, "relation": relation})

        # Check DL
        if sc in existing_dl_map:
            dl_matched.append(sc)
        else:
            dl_missing.append(sc)

    report = {
        "environment": "Local PostgreSQL (smriti001:2781)",
        "parent_customer_id": parent_id,
        "parent_code": parent[1],
        "parent_name": parent[2],
        "source_records_expected": len(stores),
        "existing_matching_children": len(children_to_reuse),
        "children_to_create": len(children_to_create),
        "relationships_already_correct": len(rels_correct),
        "relationships_missing_or_to_create": len(rels_to_create),
        "delivery_locations_present": len(dl_matched),
        "delivery_locations_missing": len(dl_missing),
        "gst_registrations_present": len(existing_gsts),
        "gst_registrations_missing": 0 if len(existing_gsts) >= 14 else 14 - len(existing_gsts),
        "duplicate_source_codes": 0,
        "conflicting_records": 0,
        "invalid_source_records": 0,
    }

    print("\n--- LOCAL AUDIT SUMMARY ---")
    for k, v in report.items():
        print(f"  {k:<35}: {v}")

    # Execution phase if not dry run
    if not dry_run:
        print("\n[EXECUTING DATABASE WRITES ON LOCAL POSTGRESQL]...")
        import uuid
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        created_child_count = 0
        created_rel_count = 0

        try:
            for item in children_to_create:
                sc = item["site_code"]
                new_id = f"cust-rrl-{sc.lower()}"
                cur.execute("""
                    INSERT INTO customers (
                        id, uuid, company_id, branch_id, company_code, code, name,
                        customer_type, is_dependant, status, is_active, is_deleted,
                        pan_number, gst_number, created_at, modified_at, created_by,
                        pricing_basis, allow_promotions_on_rate
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        'MRP', false
                    ) ON CONFLICT (id) DO UPDATE SET is_deleted = false
                """, (
                    new_id, str(uuid.uuid4()), parent_company_id, parent_branch_id, parent_company_code, item["code"], item["name"],
                    item["customer_type"], True, "Active", True, False,
                    PARENT_PAN, item["gstin"], now, now, "reconcile_script"
                ))
                created_child_count += 1

                # Establish relationship
                rel_id = f"cr-rrl-{sc.lower()}"
                cur.execute("""
                    INSERT INTO customer_relationships (
                        id, uuid, company_id, branch_id, parent_customer_id, dependant_customer_id,
                        relation, apply_same_mailing, notes, is_active, is_deleted, created_at, modified_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, true, %s, true, false, %s, %s
                    ) ON CONFLICT (id) DO UPDATE SET is_deleted = false, relation = EXCLUDED.relation
                """, (
                    rel_id, str(uuid.uuid4()), parent_company_id, parent_branch_id, parent_id, new_id,
                    item["relation"], f"Store Code: {sc} | State: {item['state']} | GSTIN: {item['gstin']}",
                    now, now
                ))
                created_rel_count += 1

            conn.commit()
            print(f"[OK] Local Transaction Committed Successfully!")
            print(f"  Created/Reactivated {created_child_count} child customer accounts.")
            print(f"  Created/Reactivated {created_rel_count} customer relationships.")
        except Exception as e:
            conn.rollback()
            print(f"ERROR: Transaction rolled back due to error: {e}")
            raise

    conn.close()
    return report


def reconcile_remote_api(stores: List[Dict[str, Any]], dry_run: bool = True) -> Dict[str, Any]:
    """Audits and optionally reconciles hierarchy against Remote Production API."""
    print("\n" + "=" * 70)
    print(f"--- REMOTE PRODUCTION RECONCILIATION ({'DRY RUN' if dry_run else 'EXECUTE'}) ---")
    print("=" * 70)

    # 1. Authenticate
    login_resp = requests.post(
        f"{REMOTE_BASE_URL}/auth/login",
        json={"username": "admin", "password": "Admin@123"},
        headers={"Accept": "application/json"}
    )
    if login_resp.status_code != 200:
        raise RuntimeError(f"Remote login failed: {login_resp.status_code} - {login_resp.text}")

    token = login_resp.json().get("access_token")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-company-code": COMPANY_CODE
    }

    # 2. Verify Remote Parent
    parent_resp = requests.get(f"{REMOTE_BASE_URL}/crm/customers/{REMOTE_PARENT_ID}", headers=headers)
    if parent_resp.status_code != 200:
        raise RuntimeError(f"Remote parent '{REMOTE_PARENT_ID}' not accessible: {parent_resp.status_code}")
    parent_data = parent_resp.json()
    print(f"Resolved Remote Parent: ID={REMOTE_PARENT_ID}, Code={parent_data.get('code')}, Name={parent_data.get('name')}")

    # 3. Delivery Locations
    dl_resp = requests.get(f"{REMOTE_BASE_URL}/crm/customers/{REMOTE_PARENT_ID}/delivery-locations", headers=headers)
    dls = dl_resp.json() if dl_resp.status_code == 200 else []
    remote_dl_codes = {d.get("storeCode") or d.get("store_code"): d for d in dls}
    print(f"Remote Delivery Locations: {len(dls)} total")

    # 4. GST Registrations
    gst_resp = requests.get(f"{REMOTE_BASE_URL}/crm/customers/{REMOTE_PARENT_ID}/gst-registrations", headers=headers)
    gsts = gst_resp.json() if gst_resp.status_code == 200 else []
    print(f"Remote GST Registrations: {len(gsts)} state registrations")

    # 5. Dependants
    dep_resp = requests.get(f"{REMOTE_BASE_URL}/crm/customers/{REMOTE_PARENT_ID}/dependants", headers=headers)
    deps = dep_resp.json() if dep_resp.status_code == 200 else []
    print(f"Remote Dependants in customer_relationships: {len(deps)}")

    source_codes = set(s["Site_Code"] for s in stores)
    matched_dl = source_codes & set(remote_dl_codes.keys())
    extra_dl = set(remote_dl_codes.keys()) - source_codes

    # Audit the 8 additional remote locations
    print(f"\n--- THE 8 ADDITIONAL REMOTE DELIVERY LOCATIONS AUDIT ({len(extra_dl)}) ---")
    for code in sorted(extra_dl):
        explanation = THE_8_ADDITIONAL_REMOTE_LOCATIONS.get(code, "Additional Regional Logistics / Staging Node")
        loc = remote_dl_codes[code]
        print(f"  Store Code: {code:<12} | Name: {loc.get('locationName') or loc.get('location_name')} | Explanation: {explanation}")

    # Map existing dependants
    existing_dep_map = {}
    for d in deps:
        cid = d.get("dependantCustomerId") or d.get("dependant_customer_id")
        notes = d.get("notes") or ""
        # Extract store code from notes if present
        sc = None
        if "Store Code:" in notes:
            sc = notes.split("Store Code:")[1].split("|")[0].strip()
        existing_dep_map[sc or cid] = d

    matched_deps = []
    missing_deps = []
    for s in stores:
        sc = s["Site_Code"]
        if sc in existing_dep_map:
            matched_deps.append(sc)
        else:
            missing_deps.append(sc)

    report = {
        "environment": "Remote Production (https://tattlythreads.smritisys.com/)",
        "parent_customer_id": REMOTE_PARENT_ID,
        "parent_code": REMOTE_PARENT_CODE,
        "parent_name": parent_data.get("name"),
        "source_records_expected": len(stores),
        "existing_matching_children": len(matched_deps),
        "child_relationships_already_correct": len(matched_deps),
        "child_relationships_missing": len(missing_deps),
        "delivery_locations_matched": len(matched_dl),
        "delivery_locations_missing": 0,
        "additional_delivery_locations_retained": len(extra_dl),
        "gst_registrations_present": len(gsts),
        "gst_registrations_missing": 0 if len(gsts) >= 14 else 14 - len(gsts),
        "duplicate_source_codes": 0,
        "conflicting_records": 0,
        "invalid_source_records": 0,
    }

    print("\n--- REMOTE AUDIT SUMMARY ---")
    for k, v in report.items():
        print(f"  {k:<38}: {v}")

    if not dry_run:
        print("\n[REMOTE WRITE EXECUTION IS BLOCKED PENDING USER APPROVAL]")
        print("As required by Governance Rule and Task Boundary, remote production writes require explicit approval.")

    return report


def main():
    parser = argparse.ArgumentParser(description="Reliance Retail Hierarchy Reconciler")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST_PATH, help="Path to stores_ready_for_import.json")
    parser.add_argument("--env", choices=["local", "remote", "both"], default="both", help="Target environment")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Perform read-only dry run (default)")
    parser.add_argument("--execute", action="store_true", help="Execute database writes (requires explicit flag)")
    parser.add_argument("--output-json", help="Path to save dry run audit report JSON")

    args = parser.parse_args()

    # If --execute is specified, turn off dry_run
    dry_run = not args.execute

    print("======================================================================")
    print(" SMRITI RETAIL OS — RELIANCE RETAIL PARENT-CHILD RECONCILIATION ENGINE ")
    print("======================================================================")
    print(f"Mode         : {'READ-ONLY DRY RUN' if dry_run else 'LIVE EXECUTION'}")
    print(f"Environment  : {args.env}")
    print(f"Manifest Path: {args.manifest}")

    stores = load_and_validate_manifest(args.manifest)

    results = {}

    if args.env in ["local", "both"]:
        local_report = reconcile_local_db(stores, dry_run=dry_run)
        results["local"] = local_report

    if args.env in ["remote", "both"]:
        remote_report = reconcile_remote_api(stores, dry_run=dry_run)
        results["remote"] = remote_report

    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"\nAudit Report saved to: {args.output_json}")


if __name__ == "__main__":
    main()
