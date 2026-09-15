"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Preflight Enforcement Engine
"""

import sys
import os
import argparse
import json
import psycopg2
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.semantic_fingerprinter import SemanticFingerprint
from lib.certificate_manager import PreflightCertificateManager

sys.stdout.reconfigure(encoding="utf-8")

DB_CONN = "postgresql://postgres:postgres@localhost:5432/smritisys"


def query_registry(entity: str, capability: str, proposed_name: str, file_path: str = None, adr_id: str = None, asset_type: str = "component") -> dict:
    conn = psycopg2.connect(DB_CONN)
    cur = conn.cursor()

    full_cap_key = f"{entity}.{capability}" if entity and capability and "." not in capability else capability

    # 1. Check if entity is registered
    cur.execute("SELECT entity_key, canonical_name, canonical_ui FROM architecture_entities WHERE entity_key = %s;", (entity,))
    entity_row = cur.fetchone()

    # 2. Check if capability is registered
    cur.execute("""
        SELECT capability_key, entity_key, canonical_component, canonical_file, canonical_service, canonical_api, status
        FROM architecture_capabilities
        WHERE capability_key = %s OR capability_key = %s;
    """, (full_cap_key, capability))
    cap_row = cur.fetchone()

    # 3. Check if there is an active ADR / Decision specifically targeting proposed asset
    cur.execute("""
        SELECT decision_id, subject, canonical_owner, secondary_owner, classification, status, reason
        FROM architecture_decisions
        WHERE (%s != '' AND (canonical_owner ILIKE %s OR secondary_owner ILIKE %s OR subject ILIKE %s));
    """, (proposed_name, f"%{proposed_name}%", f"%{proposed_name}%", f"%{proposed_name}%"))
    decision_rows = cur.fetchall()

    conn.close()

    # Case A: Explicit frozen investigation ADR exists
    for dec in decision_rows:
        if dec[5] == "ARCHITECTURE_DECISION_REQUIRED":
            return {
                "status": "ARCHITECTURE_DECISION_REQUIRED",
                "entity": entity,
                "capability": capability,
                "message": f"Operation blocked by frozen architecture governance decision '{dec[0]}': {dec[1]}.",
                "decision_id": dec[0],
                "reason": dec[6],
                "exit_code": 2,
            }

    # Case B: If capability already has a canonical implementation
    if cap_row:
        cap_key, ent_key, canon_comp, canon_file, canon_svc, canon_api, cap_status = cap_row
        cert = PreflightCertificateManager.issue_certificate(
            entity=ent_key,
            capability=cap_key,
            asset_type=asset_type,
            proposed_name=proposed_name or canon_comp,
            decision="REUSE_EXISTING",
            canonical_owner=canon_file,
            target_file_path=file_path,
        )
        return {
            "status": "REUSE_EXISTING",
            "entity": ent_key,
            "capability": cap_key,
            "message": f"Canonical implementation already exists for '{cap_key}'. You MUST reuse the existing canonical asset instead of creating a second implementation.",
            "canonical_component": canon_comp,
            "canonical_file": canon_file,
            "canonical_service": canon_svc,
            "canonical_api": canon_api,
            "certificate_id": cert["certificate_id"],
            "exit_code": 1,
        }

    # Case C: Semantic check from file content if path provided
    if file_path and os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        fingerprint = SemanticFingerprint(content, file_path)
        if fingerprint.detected_entities and fingerprint.detected_capabilities:
            detected_ent = fingerprint.detected_entities[0]
            detected_cap = fingerprint.detected_capabilities[0]
            detected_full_key = f"{detected_ent}.{detected_cap}"

            conn2 = psycopg2.connect(DB_CONN)
            cur2 = conn2.cursor()
            cur2.execute("""
                SELECT capability_key, canonical_component, canonical_file
                FROM architecture_capabilities
                WHERE capability_key = %s OR capability_key = %s;
            """, (detected_full_key, detected_cap))
            match = cur2.fetchone()
            conn2.close()

            if match:
                return {
                    "status": "DUPLICATE_CANDIDATE",
                    "entity": detected_ent,
                    "capability": match[0],
                    "message": f"Semantic fingerprint of '{file_path}' matches existing canonical capability '{match[0]}'. Renaming cannot bypass governance.",
                    "canonical_component": match[1],
                    "canonical_file": match[2],
                    "exit_code": 1,
                }

    # Case D: Check semantic keywords in proposed name
    name_lower = proposed_name.lower()
    if entity == "customer" and any(k in name_lower for k in ["lookup", "search", "finder", "browse"]):
        return {
            "status": "DUPLICATE_CANDIDATE",
            "entity": "customer",
            "capability": "customer.lookup",
            "message": f"Proposed name '{proposed_name}' semantically overlaps canonical capability 'customer.lookup'.",
            "canonical_component": "UniversalBrowseEngine.tsx",
            "canonical_file": "src/components/drilldown/UniversalBrowseEngine.tsx",
            "exit_code": 1,
        }

    # Case E: UNKNOWN MUST NEVER MEAN CREATE_NEW
    # If entity is not registered, return ARCHITECTURE_DECISION_REQUIRED
    if not entity_row:
        return {
            "status": "ARCHITECTURE_DECISION_REQUIRED",
            "entity": entity,
            "capability": capability,
            "message": f"Entity '{entity}' is not registered in the Architecture Registry. (UNKNOWN ≠ CREATE_NEW). You must stop and obtain an approved Architecture Decision before proceeding.",
            "exit_code": 2,
        }

    # Case F: NO MATCH != CREATE_APPROVED
    # If capability is novel/unregistered, verify whether an explicit ADR approves it
    if not cap_row:
        if not adr_id:
            return {
                "status": "ARCHITECTURE_DECISION_REQUIRED",
                "entity": entity,
                "capability": capability,
                "message": f"Capability '{full_cap_key}' is not registered under entity '{entity}'. (NO_MATCH ≠ CREATE_APPROVED). Novel capabilities require an approved Architecture Decision. Pass --adr <ADR_ID> if authorized.",
                "exit_code": 2,
            }

        # Validate ADR in database
        conn3 = psycopg2.connect(DB_CONN)
        cur3 = conn3.cursor()
        cur3.execute("SELECT decision_id, subject, status FROM architecture_decisions WHERE decision_id = %s;", (adr_id,))
        adr_row = cur3.fetchone()
        conn3.close()

        if not adr_row or adr_row[2] != "APPROVED":
            return {
                "status": "ARCHITECTURE_DECISION_REQUIRED",
                "entity": entity,
                "capability": capability,
                "message": f"Provided ADR '{adr_id}' was not found or is not in APPROVED status. Code creation is blocked.",
                "exit_code": 2,
            }

    # Case G: CREATE_APPROVED (Novel, validated, approved by ADR)
    cert = PreflightCertificateManager.issue_certificate(
        entity=entity,
        capability=full_cap_key,
        asset_type=asset_type,
        proposed_name=proposed_name,
        decision="CREATE_APPROVED",
        canonical_owner=proposed_name,
        target_file_path=file_path,
    )
    return {
        "status": "CREATE_APPROVED",
        "entity": entity,
        "capability": capability,
        "message": f"Creation of capability '{full_cap_key}' under entity '{entity}' is authorized by architecture governance.",
        "certificate_id": cert["certificate_id"],
        "exit_code": 0,
    }


def main():
    parser = argparse.ArgumentParser(description="SMRITI Architecture Preflight Tool")
    parser.add_argument("--entity", required=True, help="Business entity (e.g. customer, item, stock_movement)")
    parser.add_argument("--capability", required=True, help="Business capability (e.g. lookup, crud, wave_picking)")
    parser.add_argument("--type", default="component", help="Asset type (component, table, column, route, service)")
    parser.add_argument("--name", default="", help="Proposed asset name (e.g. CustomerLookup.tsx)")
    parser.add_argument("--path", default="", help="Path to existing or drafted file for semantic analysis")
    parser.add_argument("--adr", default="", help="Approved Architecture Decision ID (required for novel capabilities)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON response")

    args = parser.parse_args()

    result = query_registry(
        entity=args.entity.strip().lower(),
        capability=args.capability.strip().lower(),
        proposed_name=args.name.strip(),
        file_path=args.path.strip() if args.path else None,
        adr_id=args.adr.strip() if args.adr else None,
        asset_type=args.type.strip() if args.type else "component",
    )

    result["timestamp"] = datetime.now(timezone.utc).isoformat()

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("================================================================================")
        print(" SMRITI ARCHITECTURE GOVERNANCE — PREFLIGHT VERIFICATION")
        print("================================================================================")
        print(f" Status:       {result['status']}")
        print(f" Entity:       {result['entity']}")
        print(f" Capability:   {result['capability']}")
        print(f" Message:      {result['message']}")
        if "canonical_file" in result:
            print(f" Canonical:    {result['canonical_file']}")
        if "decision_id" in result:
            print(f" Decision ID:  {result['decision_id']}")
        if "certificate_id" in result:
            print(f" Certificate:  {result['certificate_id']}")
        print("================================================================================")

    sys.exit(result["exit_code"])


if __name__ == "__main__":
    main()
