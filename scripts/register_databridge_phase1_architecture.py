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
Classification: Architecture Governance & Preflight Registration
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

def register_databridge_architecture():
    print(f"[DataBridge Registration] Connecting to {DB_CONN.split('@')[-1]}...")
    conn = psycopg2.connect(DB_CONN)
    conn.autocommit = True
    cur = conn.cursor()
    now = datetime.now(timezone.utc)

    # 1. Register / Update Architecture Decision
    cur.execute("""
        INSERT INTO architecture_decisions (
            decision_id, subject, canonical_owner, secondary_owner, classification,
            reason, scope, migration_plan, status, approved_by, approval_date, created_at, modified_at
        ) VALUES (
            'ADR-DATABRIDGE-01',
            'SMRITI DataBridge Enterprise Import/Export & Transfer Architecture',
            'backend/app/services/databridge/service.py',
            'backend/app/api/v1/databridge.py',
            'ENTERPRISE_PLATFORM_CAPABILITY',
            'Universal multi-source data bridge with strict tenant isolation, WORM audit logging, and canonical capability licensing.',
            'Phase 1 Core Foundation across backend services and API v1 endpoints.',
            'Strangler-fig migration of legacy exchange.py over 9 phases.',
            'APPROVED',
            'Jawahar Ramkripal Mallah',
            %s, %s, %s
        )
        ON CONFLICT (decision_id) DO UPDATE SET
            status = 'APPROVED',
            canonical_owner = EXCLUDED.canonical_owner,
            secondary_owner = EXCLUDED.secondary_owner,
            modified_at = EXCLUDED.modified_at;
    """, (now, now, now))
    print("[DataBridge Registration] Registered architecture decision ADR-DATABRIDGE-01.")

    # 2. Register Architecture Entity in architecture_entities
    cur.execute("""
        INSERT INTO architecture_entities (
            entity_key, domain_id, canonical_name, canonical_db, canonical_table,
            canonical_model, canonical_service, canonical_api, status, version, owner, created_at, modified_at
        ) VALUES (
            'databridge',
            'system',
            'SMRITI DataBridge Enterprise Capability',
            'smritiXXX',
            'tenant_capability_bindings',
            'backend/app/services/databridge/models.py',
            'backend/app/services/databridge/service.py',
            '/api/v1/databridge',
            'ACTIVE',
            1,
            'Jawahar Ramkripal Mallah',
            %s, %s
        )
        ON CONFLICT (entity_key) DO UPDATE SET
            status = 'ACTIVE',
            canonical_service = EXCLUDED.canonical_service,
            canonical_api = EXCLUDED.canonical_api,
            modified_at = EXCLUDED.modified_at;
    """, (now, now))
    print("[DataBridge Registration] Registered architecture entity 'databridge'.")

    # 3. Register Architecture Capability in architecture_capabilities
    cur.execute("""
        INSERT INTO architecture_capabilities (
            capability_key, entity_key, name, business_intent,
            canonical_component, canonical_file, canonical_service, canonical_api,
            status, version, created_at, modified_at
        ) VALUES (
            'databridge.core_foundation',
            'databridge',
            'SMRITI DataBridge Core Foundation',
            'Governed tenant boundary validation, licensing entitlement enforcement, and WORM audit logging.',
            'DataBridgeService',
            'backend/app/services/databridge/service.py',
            'DataBridgeService',
            '/api/v1/databridge',
            'APPROVED',
            1,
            %s, %s
        )
        ON CONFLICT (capability_key) DO UPDATE SET
            status = 'APPROVED',
            canonical_file = EXCLUDED.canonical_file,
            canonical_service = EXCLUDED.canonical_service,
            canonical_api = EXCLUDED.canonical_api,
            modified_at = EXCLUDED.modified_at;
    """, (now, now))
    print("[DataBridge Registration] Registered architecture capability 'databridge.core_foundation'.")

    conn.close()

    # 4. Issue Preflight Certificates for Phase 1 Files
    phase1_files = [
        ("backend/app/services/databridge/service.py", "databridge", "databridge.core_foundation", "service.py", "CANONICAL", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/__init__.py", "databridge", "databridge.core_foundation", "__init__.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/models.py", "databridge", "databridge.core_foundation", "models.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/exceptions.py", "databridge", "databridge.core_foundation", "exceptions.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/api/v1/databridge.py", "databridge", "databridge.core_foundation", "databridge.py", "APPROVED", "backend/app/services/databridge/service.py"),
    ]

    for rel_path, entity, cap, proposed_name, decision, canonical_owner in phase1_files:
        full_path = os.path.join(REPO_ROOT, rel_path.replace("/", os.sep))
        content = ""
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

        cert = PreflightCertificateManager.issue_certificate(
            entity=entity,
            capability=cap,
            asset_type="SOURCE_CODE",
            proposed_name=proposed_name,
            decision=decision,
            canonical_owner=canonical_owner,
            target_file_path=rel_path,
            content=content,
            ttl_hours=168,
        )
        print(f"[DataBridge Preflight] Issued certificate {cert['certificate_id']} for {rel_path}")

    print("[DataBridge Registration] All Phase 1 architecture certificates issued successfully.")


if __name__ == "__main__":
    register_databridge_architecture()
