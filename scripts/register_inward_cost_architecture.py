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

import os
import sys
from datetime import datetime, timezone
import psycopg2

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from lib.certificate_manager import PreflightCertificateManager

DB_CONN = "postgresql://postgres:postgres@localhost:5432/smritisys"


def register_architecture():
    conn = psycopg2.connect(DB_CONN)
    cur = conn.cursor()
    now = datetime.now(timezone.utc)

    # 1. Register Architecture Entities
    entities = [
        (
            "inward_cost_component_type",
            "purchase",
            "Inward Cost Component Type Master",
            "smriti001",
            "inward_cost_component_types",
            "InwardCostComponentType",
            "landed_cost.py",
            "/api/v1/purchase/inward-cost-types",
            "InwardCostDock.tsx",
            "APPROVED",
            1,
            "Jawahar Ramkripal Mallah",
            now,
            now,
        ),
        (
            "inward_cost_component",
            "purchase",
            "Inward Cost Component Expense Line",
            "smriti001",
            "inward_cost_components",
            "InwardCostComponent",
            "landed_cost.py",
            "/api/v1/purchase/receipts/{id}/cost-components",
            "InwardCostDock.tsx",
            "APPROVED",
            1,
            "Jawahar Ramkripal Mallah",
            now,
            now,
        ),
        (
            "inward_cost_allocation",
            "purchase",
            "Inward Landed Cost SKU Allocation Ledger",
            "smriti001",
            "inward_cost_allocations",
            "InwardCostAllocation",
            "landed_cost.py",
            "/api/v1/purchase/receipts/{id}/landed-cost/breakdown/{item_id}",
            "CostAllocationPreviewModal.tsx",
            "APPROVED",
            1,
            "Jawahar Ramkripal Mallah",
            now,
            now,
        ),
        (
            "inward_cost_adjustment",
            "purchase",
            "Inward Cost Post-Facto Adjustment",
            "smriti001",
            "inward_cost_adjustments",
            "InwardCostAdjustment",
            "landed_cost.py",
            "/api/v1/purchase/landed-cost/adjustments",
            "InwardCostDock.tsx",
            "APPROVED",
            1,
            "Jawahar Ramkripal Mallah",
            now,
            now,
        ),
    ]

    for ent in entities:
        cur.execute(
            """
            INSERT INTO architecture_entities (
                entity_key, domain_id, canonical_name, canonical_db, canonical_table,
                canonical_model, canonical_service, canonical_api, canonical_ui,
                status, version, owner, created_at, modified_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (entity_key) DO UPDATE SET
                canonical_name = EXCLUDED.canonical_name,
                canonical_table = EXCLUDED.canonical_table,
                canonical_model = EXCLUDED.canonical_model,
                canonical_service = EXCLUDED.canonical_service,
                canonical_api = EXCLUDED.canonical_api,
                canonical_ui = EXCLUDED.canonical_ui,
                status = EXCLUDED.status,
                modified_at = EXCLUDED.modified_at;
            """,
            ent,
        )
    print(f"Registered {len(entities)} architecture entities.")

    # 2. Register Architecture Decision (ADR-PURCH-02)
    cur.execute(
        """
        INSERT INTO architecture_decisions (
            decision_id, subject, canonical_owner, secondary_owner, classification,
            reason, scope, migration_plan, status, approved_by, approval_date,
            created_at, modified_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (decision_id) DO UPDATE SET
            subject = EXCLUDED.subject,
            canonical_owner = EXCLUDED.canonical_owner,
            secondary_owner = EXCLUDED.secondary_owner,
            classification = EXCLUDED.classification,
            reason = EXCLUDED.reason,
            status = EXCLUDED.status,
            approved_by = EXCLUDED.approved_by,
            modified_at = EXCLUDED.modified_at;
        """,
        (
            "ADR-PURCH-02",
            "Inward Landed Cost, Multi-Component Freight & SKU Allocation Ledger Engine",
            "inward_cost_component_types, inward_cost_components, inward_cost_allocations, inward_cost_adjustments",
            "LandedCostAllocationEngine",
            "CANONICAL",
            "Traceable multi-component acquisition expenses, Ind-AS 2 statutory compliance, and Hamilton-Hare largest remainder cent-balanced SKU allocation",
            "PURCHASE, GRN, INVENTORY VALUATION, WMS BATCH STOCK",
            "Alembic v1478 applied across smritisys, smriti001, smriti002",
            "APPROVED",
            "Jawahar Ramkripal Mallah",
            now,
            now,
            now,
        ),
    )
    print("Registered ADR-PURCH-02.")

    # 3. Register Architecture Capability
    cur.execute(
        """
        INSERT INTO architecture_capabilities (
            capability_key, entity_key, name, business_intent,
            canonical_component, canonical_file, canonical_service, canonical_api,
            status, version, created_at, modified_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (capability_key) DO UPDATE SET
            canonical_component = EXCLUDED.canonical_component,
            canonical_file = EXCLUDED.canonical_file,
            canonical_service = EXCLUDED.canonical_service,
            canonical_api = EXCLUDED.canonical_api,
            status = EXCLUDED.status,
            modified_at = EXCLUDED.modified_at;
        """,
        (
            "purchase.landed_cost_engine",
            "inward_cost_component",
            "Inward Landed Cost Engine",
            "Multi-component freight, cartage and landed cost allocation per GRN",
            "InwardCostDock",
            "src/components/purchase/InwardCostDock.tsx",
            "backend/app/services/landed_cost.py",
            "/api/v1/purchase/landed-cost/preview",
            "APPROVED",
            1,
            now,
            now,
        ),
    )
    print("Registered purchase.landed_cost_engine capability.")

    conn.commit()
    conn.close()

    # 4. Issue Preflight Certificates for newly created files
    new_assets = [
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "service",
            "proposed_name": "landed_cost.py",
            "target_file_path": "backend/app/services/landed_cost.py",
            "decision": "CREATE_NEW",
            "canonical_owner": "backend/app/services/landed_cost.py",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "component",
            "proposed_name": "AddCostComponentModal.tsx",
            "target_file_path": "src/components/purchase/AddCostComponentModal.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/purchase/AddCostComponentModal.tsx",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "component",
            "proposed_name": "CostAllocationPreviewModal.tsx",
            "target_file_path": "src/components/purchase/CostAllocationPreviewModal.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/purchase/CostAllocationPreviewModal.tsx",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "component",
            "proposed_name": "GrnPostedSuccessModal.tsx",
            "target_file_path": "src/components/purchase/GrnPostedSuccessModal.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/purchase/GrnPostedSuccessModal.tsx",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "component",
            "proposed_name": "InwardCostDock.tsx",
            "target_file_path": "src/components/purchase/InwardCostDock.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/purchase/InwardCostDock.tsx",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "component",
            "proposed_name": "WhyThisCostModal.tsx",
            "target_file_path": "src/components/purchase/WhyThisCostModal.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/purchase/WhyThisCostModal.tsx",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "type_definition",
            "proposed_name": "inwardCost.ts",
            "target_file_path": "src/components/purchase/types/inwardCost.ts",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/purchase/types/inwardCost.ts",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "script",
            "proposed_name": "verify_inward_landed_cost_database_parity.py",
            "target_file_path": "scripts/verify_inward_landed_cost_database_parity.py",
            "decision": "CREATE_NEW",
            "canonical_owner": "scripts/verify_inward_landed_cost_database_parity.py",
        },
        {
            "entity": "purchase",
            "capability": "purchase.landed_cost_engine",
            "asset_type": "script",
            "proposed_name": "execute_headless_grn_landed_cost_cycle.py",
            "target_file_path": "scripts/execute_headless_grn_landed_cost_cycle.py",
            "decision": "CREATE_NEW",
            "canonical_owner": "scripts/execute_headless_grn_landed_cost_cycle.py",
        },
    ]

    for asset in new_assets:
        full_path = os.path.join(REPO_ROOT, asset["target_file_path"].replace("/", os.sep))
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()

        cert = PreflightCertificateManager.issue_certificate(
            entity=asset["entity"],
            capability=asset["capability"],
            asset_type=asset["asset_type"],
            proposed_name=asset["proposed_name"],
            decision=asset["decision"],
            canonical_owner=asset["canonical_owner"],
            target_file_path=asset["target_file_path"],
            content=content,
        )
        print(f"Issued certificate {cert['certificate_id']} for {asset['target_file_path']}")


if __name__ == "__main__":
    register_architecture()
