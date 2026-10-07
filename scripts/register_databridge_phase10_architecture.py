"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-07
Modified     : 2026-10-07
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance & Preflight Registration — Phase 10 WebSocket Streaming
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


def register_databridge_phase10_architecture():
    print(f"[DataBridge Phase 10 Registration] Connecting to {DB_CONN.split('@')[-1]}...")
    conn = psycopg2.connect(DB_CONN)
    conn.autocommit = True
    cur = conn.cursor()
    now = datetime.now(timezone.utc)

    # 1. Update Architecture Decision ADR-DATABRIDGE-01 to include Phase 9 & 10
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
            'Universal multi-source data bridge with strict tenant isolation, WORM audit logging, catalog, party, procurement, sales, inventory movement adapters, high-volume async queue with outbox chunking, multi-format streaming export engine, strangler-fig migration of legacy exchange.py, Phase 6 multi-tenant migration toolkit with deterministic soft-delete rollback engine, Phase 7 automated schema mapping intelligence and field detection engine, Phase 8 external third-party connector framework, Phase 9 automated background pull scheduler and real-time webhook dispatcher, and Phase 10 live WebSocket streaming and real-time progress telemetry server.',
            'Phase 1 Core Foundation, Phase 2 Catalog Domain Adapters, Phase 3A Party Domain Adapters, Phase 3B Inward Procurement Transaction Adapters, Phase 3C Outward Sales Transaction Adapters, Phase 3D Inventory Movement & Stock Transfer Adapters, Phase 4 High-Volume Asynchronous Import Engine & Chunked Task Queue, Phase 5 Multi-Format Streaming Exporter & Strangler-Fig Migration, Phase 6 Multi-Tenant Enterprise Data Migration & Rollback Toolkit, Phase 7 Automated Schema Mapping Intelligence & Field Detection Engine, Phase 8 External Third-Party Connector Framework, Phase 9 Automated Background Pull Scheduler & Real-Time Webhook Dispatcher, and Phase 10 Live WebSocket Streaming & Real-Time Progress Telemetry Server.',
            'Strangler-fig migration of legacy exchange.py over 10 phases.',
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
            migration_plan = EXCLUDED.migration_plan,
            modified_at = %s;
    """, (now, now, now, now))
    print("[DataBridge Phase 10 Registration] Updated architecture decision ADR-DATABRIDGE-01.")

    # 2. Register Platform Capabilities in architecture_capabilities
    capabilities = [
        (
            'databridge.broadcaster',
            'databridge',
            'SMRITI DataBridge Real-Time Telemetry Broadcaster',
            'In-memory pub/sub telemetry broadcaster delivering sub-second progress frames over WebSockets.',
            'DataBridgeBroadcaster',
            'backend/app/services/databridge/broadcaster.py',
            'DataBridgeBroadcaster',
            '/api/v1/databridge/ws/progress',
        ),
        (
            'databridge.scheduler_engine',
            'databridge',
            'SMRITI DataBridge Automated Background Pull Scheduler',
            'Tenant-isolated background connector pull scheduler executing recurring sync jobs.',
            'DataBridgeScheduler',
            'backend/app/services/databridge/scheduler_engine.py',
            'DataBridgeScheduler',
            '/api/v1/databridge/schedules',
        ),
        (
            'databridge.webhook_dispatcher',
            'databridge',
            'SMRITI DataBridge Real-Time Webhook Intake and CDC Dispatcher',
            'Cryptographic HMAC-SHA256 signature verifier and outbound Change Data Capture event dispatcher.',
            'DataBridgeWebhookDispatcher',
            'backend/app/services/databridge/webhook_dispatcher.py',
            'DataBridgeWebhookDispatcher',
            '/api/v1/databridge/webhooks',
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
        print(f"[DataBridge Phase 10 Registration] Registered capability '{cap_key}'.")

    conn.close()

    # 3. Issue Preflight Certificates for all Phase 1-10 files
    databridge_files = [
        ("backend/app/services/databridge/service.py", "databridge", "databridge.core_foundation", "service.py", "CANONICAL", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/__init__.py", "databridge", "databridge.core_foundation", "__init__.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/models.py", "databridge", "databridge.core_foundation", "models.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/exceptions.py", "databridge", "databridge.core_foundation", "exceptions.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/api/v1/databridge.py", "databridge", "databridge.core_foundation", "databridge.py", "APPROVED", "backend/app/services/databridge/service.py"),
        ("backend/app/services/databridge/async_engine.py", "databridge", "databridge.async_engine", "async_engine.py", "CANONICAL", "backend/app/services/databridge/async_engine.py"),
        ("backend/app/services/databridge/export_engine.py", "databridge", "databridge.export_engine", "export_engine.py", "CANONICAL", "backend/app/services/databridge/export_engine.py"),
        ("backend/app/services/databridge/migration_engine.py", "databridge", "databridge.migration_toolkit", "migration_engine.py", "CANONICAL", "backend/app/services/databridge/migration_engine.py"),
        ("backend/app/services/databridge/schema_mapping_engine.py", "databridge", "databridge.schema_mapping_engine", "schema_mapping_engine.py", "CANONICAL", "backend/app/services/databridge/schema_mapping_engine.py"),
        ("backend/app/services/databridge/scheduler_engine.py", "databridge", "databridge.scheduler_engine", "scheduler_engine.py", "CANONICAL", "backend/app/services/databridge/scheduler_engine.py"),
        ("backend/app/services/databridge/webhook_dispatcher.py", "databridge", "databridge.webhook_dispatcher", "webhook_dispatcher.py", "CANONICAL", "backend/app/services/databridge/webhook_dispatcher.py"),
        ("backend/app/services/databridge/broadcaster.py", "databridge", "databridge.broadcaster", "broadcaster.py", "CANONICAL", "backend/app/services/databridge/broadcaster.py"),
        ("backend/app/services/databridge/connectors/__init__.py", "databridge", "databridge.connector_framework", "__init__.py", "APPROVED", "backend/app/services/databridge/connectors/orchestrator.py"),
        ("backend/app/services/databridge/connectors/base.py", "databridge", "databridge.connector_framework", "base.py", "CANONICAL", "backend/app/services/databridge/connectors/base.py"),
        ("backend/app/services/databridge/connectors/orchestrator.py", "databridge", "databridge.connector_framework", "orchestrator.py", "CANONICAL", "backend/app/services/databridge/connectors/orchestrator.py"),
        ("backend/app/services/databridge/connectors/tally_connector.py", "databridge", "databridge.connector_framework", "tally_connector.py", "CANONICAL", "backend/app/services/databridge/connectors/tally_connector.py"),
        ("backend/app/services/databridge/connectors/shopify_connector.py", "databridge", "databridge.connector_framework", "shopify_connector.py", "CANONICAL", "backend/app/services/databridge/connectors/shopify_connector.py"),
        ("backend/app/services/databridge/connectors/sap_b1_connector.py", "databridge", "databridge.connector_framework", "sap_b1_connector.py", "CANONICAL", "backend/app/services/databridge/connectors/sap_b1_connector.py"),
        ("backend/app/services/databridge/connectors/unicommerce_connector.py", "databridge", "databridge.connector_framework", "unicommerce_connector.py", "CANONICAL", "backend/app/services/databridge/connectors/unicommerce_connector.py"),
        ("backend/app/services/databridge/adapters/__init__.py", "databridge", "databridge.catalog_adapters", "__init__.py", "APPROVED", "backend/app/services/databridge/adapters/base_adapter.py"),
        ("backend/app/services/databridge/adapters/base_adapter.py", "databridge", "databridge.catalog_adapters", "base_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/base_adapter.py"),
        ("backend/app/services/databridge/adapters/item_adapter.py", "databridge", "databridge.catalog_adapters", "item_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/item_adapter.py"),
        ("backend/app/services/databridge/adapters/variant_adapter.py", "databridge", "databridge.catalog_adapters", "variant_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/variant_adapter.py"),
        ("backend/app/services/databridge/adapters/barcode_adapter.py", "databridge", "databridge.catalog_adapters", "barcode_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/barcode_adapter.py"),
        ("backend/app/services/databridge/adapters/pricebook_adapter.py", "databridge", "databridge.catalog_adapters", "pricebook_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/pricebook_adapter.py"),
        ("backend/app/services/databridge/adapters/customer_adapter.py", "databridge", "databridge.party_adapters", "customer_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/customer_adapter.py"),
        ("backend/app/services/databridge/adapters/supplier_adapter.py", "databridge", "databridge.party_adapters", "supplier_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/supplier_adapter.py"),
        ("backend/app/services/databridge/adapters/purchase_order_adapter.py", "databridge", "databridge.procurement_adapters", "purchase_order_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/purchase_order_adapter.py"),
        ("backend/app/services/databridge/adapters/grn_adapter.py", "databridge", "databridge.procurement_adapters", "grn_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/grn_adapter.py"),
        ("backend/app/services/databridge/adapters/purchase_invoice_adapter.py", "databridge", "databridge.procurement_adapters", "purchase_invoice_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/purchase_invoice_adapter.py"),
        ("backend/app/services/databridge/adapters/purchase_debit_note_adapter.py", "databridge", "databridge.procurement_adapters", "purchase_debit_note_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/purchase_debit_note_adapter.py"),
        ("backend/app/services/databridge/adapters/sales_invoice_adapter.py", "databridge", "databridge.sales_adapters", "sales_invoice_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/sales_invoice_adapter.py"),
        ("backend/app/services/databridge/adapters/sales_return_adapter.py", "databridge", "databridge.sales_adapters", "sales_return_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/sales_return_adapter.py"),
        ("backend/app/services/databridge/adapters/sales_order_adapter.py", "databridge", "databridge.sales_adapters", "sales_order_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/sales_order_adapter.py"),
        ("backend/app/services/databridge/adapters/stock_transfer_adapter.py", "databridge", "databridge.inventory_adapters", "stock_transfer_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/stock_transfer_adapter.py"),
        ("backend/app/services/databridge/adapters/stock_audit_adapter.py", "databridge", "databridge.inventory_adapters", "stock_audit_adapter.py", "CANONICAL", "backend/app/services/databridge/adapters/stock_audit_adapter.py"),
        ("src/components/databridge/DataBridgeWorkspace.tsx", "databridge", "databridge.workspace_ux", "DataBridgeWorkspace.tsx", "CANONICAL", "src/components/databridge/DataBridgeWorkspace.tsx"),
        ("src/components/databridge/databridgeService.ts", "databridge", "databridge.workspace_ux", "databridgeService.ts", "CANONICAL", "src/components/databridge/databridgeService.ts"),
        ("src/components/databridge/databridgeTypes.ts", "databridge", "databridge.workspace_ux", "databridgeTypes.ts", "APPROVED", "src/components/databridge/databridgeTypes.ts"),
        ("src/components/databridge/useDataBridgeProgressStream.ts", "databridge", "databridge.workspace_ux", "useDataBridgeProgressStream.ts", "APPROVED", "src/components/databridge/useDataBridgeProgressStream.ts"),
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

    print("[DataBridge Phase 10 Registration] All Phase 1 through 10 architecture certificates issued successfully.")


if __name__ == "__main__":
    register_databridge_phase10_architecture()
