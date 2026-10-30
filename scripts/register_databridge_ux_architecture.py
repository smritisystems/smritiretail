"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance & Preflight Registration — DataBridge UX Components
"""

import os
import sys
from datetime import datetime, timezone
import psycopg2

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from lib.certificate_manager import PreflightCertificateManager

_PG_PORT = os.getenv("POSTGRES_PORT", "2781")
DB_CONN = os.getenv("DATABASE_URL") or f"postgresql://postgres:postgres@localhost:{_PG_PORT}/smritisys"
if "postgresql+asyncpg://" in DB_CONN:
    DB_CONN = DB_CONN.replace("postgresql+asyncpg://", "postgresql://")

def register_databridge_ux_architecture():
    print(f"[DataBridge UX Registration] Connecting to {DB_CONN.split('@')[-1]}...")
    conn = psycopg2.connect(DB_CONN)
    conn.autocommit = True
    cur = conn.cursor()
    now = datetime.now(timezone.utc)

    # 1. Update Architecture Decision ADR-DATABRIDGE-01 to include UX layer
    cur.execute("""
        INSERT INTO architecture_decisions (
            decision_id, subject, canonical_owner, secondary_owner, classification,
            reason, scope, migration_plan, status, approved_by, approval_date, created_at, modified_at
        ) VALUES (
            'ADR-DATABRIDGE-01',
            'SMRITI DataBridge Enterprise Import/Export & Transfer Architecture',
            'backend/app/services/databridge/service.py',
            'src/components/databridge/DataBridgeWorkspace.tsx',
            'ENTERPRISE_PLATFORM_CAPABILITY',
            'Universal multi-source data bridge with strict tenant isolation, WORM audit logging, catalog domain adapters, and user-facing simple-by-default workspace UX.',
            'Phase 1 Core Foundation, Phase 2 Catalog Domain Adapters, and Canonical DataBridge Workspace UX.',
            'Strangler-fig migration of legacy exchange.py over 9 phases.',
            'APPROVED',
            'Jawahar Ramkripal Mallah',
            %s, %s, %s
        )
        ON CONFLICT (decision_id) DO UPDATE SET
            status = 'APPROVED',
            canonical_owner = EXCLUDED.canonical_owner,
            secondary_owner = EXCLUDED.secondary_owner,
            scope = EXCLUDED.scope,
            reason = EXCLUDED.reason,
            modified_at = EXCLUDED.modified_at;
    """, (now, now, now))
    print("[DataBridge UX Registration] Updated architecture decision ADR-DATABRIDGE-01.")

    # 2. Register UX Capability in architecture_capabilities
    capabilities = [
        (
            'databridge.workspace_ux',
            'databridge',
            'SMRITI DataBridge Canonical Workspace UX',
            'Enterprise DataBridge UI with WhatsApp simplicity, 8-step wizard, interactive preview diff viewer, conflict explainability, and commit guard.',
            'DataBridgeWorkspace',
            'src/components/databridge/DataBridgeWorkspace.tsx',
            'DataBridgeClientService',
            '/api/v1/databridge',
        ),
    ]

    for cap_key, ent_key, name, intent, comp, cfile, csvc, capi in capabilities:
        cur.execute("""
            INSERT INTO architecture_capabilities (
                capability_key, entity_key, name, business_intent,
                canonical_component, canonical_file, canonical_service, canonical_api,
                status, version, created_at, modified_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                'APPROVED', 1, %s, %s
            )
            ON CONFLICT (capability_key) DO UPDATE SET
                status = 'APPROVED',
                canonical_file = EXCLUDED.canonical_file,
                canonical_service = EXCLUDED.canonical_service,
                canonical_api = EXCLUDED.canonical_api,
                business_intent = EXCLUDED.business_intent,
                modified_at = EXCLUDED.modified_at;
        """, (cap_key, ent_key, name, intent, comp, cfile, csvc, capi, now, now))
        print(f"[DataBridge UX Registration] Registered capability '{cap_key}'.")

    conn.close()

    # 3. Issue Preflight Certificates for All UX Files
    ux_files = [
        ("src/components/databridge/DataBridgeWorkspace.tsx", "databridge", "databridge.workspace_ux", "DataBridgeWorkspace.tsx", "CANONICAL", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/databridgeTypes.ts", "databridge", "databridge.workspace_ux", "databridgeTypes.ts", "APPROVED", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/databridgeService.ts", "databridge", "databridge.workspace_ux", "databridgeService.ts", "APPROVED", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/DataBridgeTemplatesModal.tsx", "databridge", "databridge.workspace_ux", "DataBridgeTemplatesModal.tsx", "APPROVED", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/DiffViewModal.tsx", "databridge", "databridge.workspace_ux", "DiffViewModal.tsx", "APPROVED", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/IssueReviewModal.tsx", "databridge", "databridge.workspace_ux", "IssueReviewModal.tsx", "APPROVED", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/CommitConfirmationModal.tsx", "databridge", "databridge.workspace_ux", "CommitConfirmationModal.tsx", "APPROVED", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/DataBridgeHistoryView.tsx", "databridge", "databridge.workspace_ux", "DataBridgeHistoryView.tsx", "APPROVED", "src/components/databridge/DataBridgeWorkspace.tsx"),
    ]

    for rel_path, entity, cap, proposed_name, decision, canonical_owner in ux_files:
        full_path = os.path.join(REPO_ROOT, rel_path.replace("/", os.sep))
        content = ""
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

        cert = PreflightCertificateManager.issue_certificate(
            entity=entity,
            capability=cap,
            asset_type="SPECIALIZED_UI",
            proposed_name=proposed_name,
            decision=decision,
            canonical_owner=canonical_owner,
            target_file_path=rel_path,
            content=content,
            ttl_hours=168,
        )
        print(f"[DataBridge UX Preflight] Issued certificate {cert['certificate_id']} for {rel_path}")

    print("[DataBridge UX Registration] All UX architecture certificates issued successfully.")


if __name__ == "__main__":
    register_databridge_ux_architecture()
