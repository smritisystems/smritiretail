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
Classification: Architecture Governance & Preflight Registration — Phase 2 Catalog Adapters
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

def register_databridge_phase2_architecture():
    print(f"[DataBridge Phase 2 Registration] Connecting to {DB_CONN.split('@')[-1]}...")
    conn = psycopg2.connect(DB_CONN)
    conn.autocommit = True
    cur = conn.cursor()
    now = datetime.now(timezone.utc)

    # 1. Update Architecture Decision ADR-DATABRIDGE-01
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
            'Universal multi-source data bridge with strict tenant isolation, WORM audit logging, catalog domain adapters, and canonical capability licensing.',
            'Phase 1 Core Foundation and Phase 2 Catalog Domain Adapters (Item, Variant, Barcode, PriceBook).',
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
    print("[DataBridge Phase 2 Registration] Updated architecture decision ADR-DATABRIDGE-01.")

    # 2. Register Phase 2 Catalog Capabilities in architecture_capabilities
    capabilities = [
        (
            'databridge.core_foundation',
            'databridge',
            'SMRITI DataBridge Core Foundation',
            'Governed tenant boundary validation, licensing entitlement enforcement, and WORM audit logging.',
            'DataBridgeService',
            'backend/app/services/databridge/service.py',
            'DataBridgeService',
            '/api/v1/databridge',
        ),
        (
            'databridge.catalog_adapters',
            'databridge',
            'SMRITI DataBridge Catalog Domain Adapters',
            'Canonical Item, Variant, Barcode, and PriceBook adapters with 7-stage lifecycle, 30-min preview tokens, and zero tenant data mutation.',
            'DataBridgeCatalogAdapters',
            'backend/app/services/databridge/adapters/base_adapter.py',
            'DataBridgeService',
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
        print(f"[DataBridge Phase 2 Registration] Registered capability '{cap_key}'.")

    conn.close()

    # 3. Issue Preflight Certificates for All Phase 1 & Phase 2 Files
    databridge_files = [
        ("backend/app/services/databridge/service.py", "databridge", "databridge.core_foundation", "service.py", "CANONICAL", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/__init__.py", "databridge", "databridge.core_foundation", "__init__.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/models.py", "databridge", "databridge.core_foundation", "models.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/exceptions.py", "databridge", "databridge.core_foundation", "exceptions.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/api/v1/databridge.py", "databridge", "databridge.core_foundation", "databridge.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/adapters/__init__.py", "databridge", "databridge.catalog_adapters", "__init__.py", "APPROVED", "backend/app/services/databridge/adapters/base_adapter.py"),
        ("backend/app/services/databridge/adapters/base_adapter.py", "databridge", "databridge.catalog_adapters", "base_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/base_adapter.py"),
        ("backend/app/services/databridge/adapters/item_adapter.py", "databridge", "databridge.catalog_adapters", "item_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/base_adapter.py"),
        ("backend/app/services/databridge/adapters/variant_adapter.py", "databridge", "databridge.catalog_adapters", "variant_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/base_adapter.py"),
        ("backend/app/services/databridge/adapters/barcode_adapter.py", "databridge", "databridge.catalog_adapters", "barcode_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/base_adapter.py"),
        ("backend/app/services/databridge/adapters/pricebook_adapter.py", "databridge", "databridge.catalog_adapters", "pricebook_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/base_adapter.py"),
    ]

    for rel_path, entity, cap, proposed_name, decision, canonical_owner in databridge_files:
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

    print("[DataBridge Phase 2 Registration] All Phase 1 and Phase 2 architecture certificates issued successfully.")


if __name__ == "__main__":
    register_databridge_phase2_architecture()
