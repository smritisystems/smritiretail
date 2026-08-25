"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.41.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timezone


def seed_capability_master_data():
    """
    Authoritative seeder for platform capabilities, feature flags, module states, and tenant bindings.
    """
    capabilities = [
        ("cap_pos", "POS", "Point of Sale (POS)", "COMMERCE", "High-throughput cashier till, shift reconciliation, and offline transaction processing.", ["INVENTORY", "SALES", "ACCOUNTING"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_sales", "SALES", "Sales & Billing Engine", "COMMERCE", "Order-to-cash lifecycle, sales invoicing, credit memos, and quotations.", ["INVENTORY", "ACCOUNTING"], True, True, "v1.0.0", "ACTIVE"),
        ("cap_purchase", "PURCHASE", "Procurement & Purchase Engine", "OPERATIONS", "Procure-to-pay lifecycle, supplier POs, goods receipt notes (GRN), and supplier bills.", ["INVENTORY", "ACCOUNTING"], True, True, "v1.0.0", "ACTIVE"),
        ("cap_inventory", "INVENTORY", "Inventory & Stock Management", "CORE", "Perpetual inventory tracking, stock movements, adjustments, and reorder levels.", [], True, True, "v1.0.0", "ACTIVE"),
        ("cap_wms", "WMS", "Warehouse Management System (WMS)", "OPERATIONS", "Multi-location bin/rack tracking, batch & expiry control, wave picking, and packing.", ["INVENTORY"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_distribution", "DISTRIBUTION", "Distribution & Store Replenishment", "OPERATIONS", "Multi-branch hub-and-spoke replenishment and inter-store transfer orders.", ["INVENTORY", "WMS"], False, False, "v1.0.0", "ACTIVE"),
        ("cap_ecom", "ECOM", "eCommerce & Omnichannel Connectors", "COMMERCE", "Shopify, WooCommerce, and custom webstore synchronization and real-time inventory reservation.", ["INVENTORY", "SALES"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_psv", "PSV", "Production Observability (PSV)", "PLATFORM", "Immutable stock event ledger and projection engine for real-time SKU observability.", ["INVENTORY"], False, False, "v1.0.0", "ACTIVE"),
        ("cap_pdt", "PDT", "Product Digital Twin (PDT)", "OPERATIONS", "Individual unit serialization, lifecycle traceability, warranty, and batch history.", ["INVENTORY", "BARCODE"], False, False, "v1.0.0", "ACTIVE"),
        ("cap_cge", "CGE", "Commercial Growth Engine (CGE)", "COMMERCE", "Integrated customer loyalty tiers, referral reward programs, and sales commission structures.", ["CRM", "SALES"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_crm", "CRM", "Customer Relationship Management (CRM)", "CORE", "Universal customer profiles, customer groups, credit limits, and interaction history.", [], True, True, "v1.0.0", "ACTIVE"),
        ("cap_accounting", "ACCOUNTING", "Authoritative Double-Entry Accounting", "CORE", "General ledger, journal vouchers, chart of accounts, and financial statement snapshots.", [], True, True, "v1.0.0", "ACTIVE"),
        ("cap_gst", "GST", "Statutory GST & E-Invoicing Engine", "COMPLIANCE", "GST compliance, E-Way Bill generation, NIC E-Invoice JSON payloads, and GSTR summaries.", ["SALES", "ACCOUNTING"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_payments", "PAYMENTS", "Multi-Tender Payment Gateway & Ledger", "COMMERCE", "Cash, UPI, Credit/Debit card, split tenders, and payment reconciliation ledger.", ["ACCOUNTING"], True, True, "v1.0.0", "ACTIVE"),
        ("cap_pricing", "PRICING", "Dynamic Pricing & Price Books", "COMMERCE", "Multi-tier price books, customer-specific pricing, and bulk quantity breaks.", ["INVENTORY"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_promotions", "PROMOTIONS", "Promotions, Coupons & Discounts", "COMMERCE", "Rule-based promotional campaigns, coupon codes, and bundle discount mechanics.", ["PRICING", "SALES"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_fulfillment", "FULFILLMENT", "Order Fulfillment & Logistics", "OPERATIONS", "Dispatch desk, multi-package shipment manifest generation, and courier tracking.", ["SALES", "INVENTORY"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_barcode", "BARCODE", "Barcode Studio & Layout Engine", "OPERATIONS", "Custom thermal label layout designer, barcode symbologies (Code128, EAN13, QR), and batch printing.", [], False, True, "v1.0.0", "ACTIVE"),
        ("cap_label_print", "LABEL_PRINTING", "Thermal Label & Receipt Printing", "OPERATIONS", "QZ Tray direct spooling to ESC/POS thermal receipt and Zebra/Honeywell barcode printers.", ["BARCODE"], False, True, "v1.0.0", "ACTIVE"),
        ("cap_reporting", "REPORTING", "Analytics & Intelligence Reporting", "PLATFORM", "Financial reports, item-wise profitability, stock ledger valuation, and executive dashboards.", [], True, True, "v1.0.0", "ACTIVE"),
        ("cap_communicator", "COMMUNICATOR", "Omnichannel Communicator Hub", "PLATFORM", "WhatsApp Business, SMS transactional alerts, automated payment reminder triggers, and webhooks.", [], False, False, "v1.0.0", "ACTIVE"),
        ("cap_document", "DOCUMENT", "Document Governance & Numbering", "CORE", "Configurable transactional numbering series, prefix/suffix masks, and document revision tracking.", [], True, True, "v1.0.0", "ACTIVE"),
        ("cap_approval", "APPROVAL", "Approval Matrix & Workflows", "PLATFORM", "Multi-tier approval matrices for high-value purchase orders, expense vouchers, and credit adjustments.", [], False, True, "v1.0.0", "ACTIVE"),
        ("cap_search", "SEARCH", "Unified Global Search Engine", "PLATFORM", "Sub-millisecond fuzzy search across SKU catalog, customer records, invoices, and serial numbers.", [], True, True, "v1.0.0", "ACTIVE"),
        ("cap_integration", "INTEGRATION", "Transactional Outbox & Integrations", "PLATFORM", "Reliable event publishing, webhook delivery, and third-party accounting export pipelines.", [], False, True, "v1.0.0", "ACTIVE"),
        ("cap_audit", "AUDIT", "Immutable Audit Trail & Governance", "PLATFORM", "Tamper-evident audit logging, user action tracking, and data mutation snapshots.", [], True, True, "v1.0.0", "ACTIVE"),
    ]

    flags = [
        ("ff_dark_mode", "DARK_MODE_V2", "Dark Mode V2", "UI", "Modern OLED dark mode theme", True, '{"COMP-001": true}'),
        ("ff_sync_p2p", "OFFLINE_SYNC_P2P", "Peer-to-Peer Offline Sync", "SYNC", "Local LAN device discovery and P2P sync", False, '{"COMP-001": false}'),
        ("ff_enhanced_audit", "ENHANCED_AUDIT_TRAIL", "Enhanced Audit Trail", "SECURITY", "SHA-256 tamper-evident payload verification", True, '{"COMP-001": true}'),
        ("ff_ocr_scan", "OCR_INVOICE_SCAN", "OCR Supplier Invoice Ingestion", "AI", "AI OCR extraction for purchase invoices", False, '{}'),
        ("ff_demand_forecast", "AI_DEMAND_FORECAST", "AI Demand Forecasting", "AI", "Predictive replenishment reorder triggers", False, '{}'),
    ]

    module_states = [
        ("mod_pos", "MOD-POS", "smriti001", "ACTIVE", "v3.40.0", True, datetime.now(timezone.utc)),
        ("mod_inv", "MOD-INV", "smriti001", "ACTIVE", "v3.40.0", True, datetime.now(timezone.utc)),
        ("mod_sales", "MOD-SALES", "smriti001", "ACTIVE", "v3.40.0", True, datetime.now(timezone.utc)),
        ("mod_purch", "MOD-PURCHASE", "smriti001", "ACTIVE", "v3.40.0", True, datetime.now(timezone.utc)),
        ("mod_fin", "MOD-FINANCE", "smriti001", "ACTIVE", "v3.40.0", True, datetime.now(timezone.utc)),
        ("mod_wms", "MOD-WMS", "smriti001", "ACTIVE", "v3.40.0", False, datetime.now(timezone.utc)),
        ("mod_crm", "MOD-CRM", "smriti001", "ACTIVE", "v3.40.0", True, datetime.now(timezone.utc)),
    ]

    # 1. SEED CONTROL PLANE (smritisys)
    print("\n--- Seeding Capability Master Data into [smritisys] ---")
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
        cur = conn.cursor()

        # Platform Capabilities
        rows = [
            (
                cid, cid, code, name, cat, desc, json.dumps(deps), is_core, def_en, min_v, stat, True, False, 1
            )
            for cid, code, name, cat, desc, deps, is_core, def_en, min_v, stat in capabilities
        ]
        execute_values(
            cur,
            """
            INSERT INTO platform_capabilities (
                id, uuid, code, name, category, description, dependencies, is_core, default_enabled, min_version, status, is_active, is_deleted, version
            ) VALUES %s
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                dependencies = EXCLUDED.dependencies,
                is_core = EXCLUDED.is_core,
                default_enabled = EXCLUDED.default_enabled,
                min_version = EXCLUDED.min_version,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            """,
            rows,
        )

        # Feature Flags
        flag_rows = [
            (fid, fid, k, name, cat, desc, g_en, overrides, True, False, 1)
            for fid, k, name, cat, desc, g_en, overrides in flags
        ]
        execute_values(
            cur,
            """
            INSERT INTO feature_flags (
                id, uuid, key, name, category, description, is_global_enabled, company_overrides, is_active, is_deleted, version
            ) VALUES %s
            ON CONFLICT (key) DO UPDATE SET
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                is_global_enabled = EXCLUDED.is_global_enabled,
                company_overrides = EXCLUDED.company_overrides::jsonb,
                is_active = EXCLUDED.is_active;
            """,
            flag_rows,
        )

        # Module States
        execute_values(
            cur,
            """
            INSERT INTO module_states (id, module_uuid, tenant_id, state, version, is_critical, updated_at)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                module_uuid = EXCLUDED.module_uuid,
                state = EXCLUDED.state,
                version = EXCLUDED.version,
                is_critical = EXCLUDED.is_critical,
                updated_at = NOW();
            """,
            module_states,
        )

        conn.commit()
        conn.close()
        print("Successfully seeded control plane data in [smritisys].")
    except Exception as e:
        print(f"Error seeding [smritisys]: {e}")

    # 2. SEED TENANT CAPABILITIES (smriti001, smriti002, smritisys)
    for db_name in ["smriti001", "smriti002", "smritisys"]:
        print(f"\n--- Seeding Tenant Capabilities into [{db_name}] ---")
        try:
            conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
            cur = conn.cursor()

            tenant_caps = [
                (f"tcb_{code.lower()}", f"uuid_tcb_{code.lower()}", code, True, "ENTERPRISE", "ACTIVE", True, False, 1)
                for _, code, _, _, _, _, _, def_en, _, _ in capabilities
                if def_en
            ]
            execute_values(
                cur,
                """
                INSERT INTO tenant_capability_bindings (
                    id, uuid, capability_code, is_enabled, plan_tier, status, is_active, is_deleted, version
                ) VALUES %s
                ON CONFLICT (capability_code) DO UPDATE SET
                    is_enabled = EXCLUDED.is_enabled,
                    plan_tier = EXCLUDED.plan_tier,
                    status = EXCLUDED.status,
                    is_active = EXCLUDED.is_active;
                """,
                tenant_caps,
            )

            # Seed Feature Flags into Tenant DBs as well
            flag_rows = [
                (fid, fid, k, name, cat, desc, g_en, overrides, True, False, 1)
                for fid, k, name, cat, desc, g_en, overrides in flags
            ]
            execute_values(
                cur,
                """
                INSERT INTO feature_flags (
                    id, uuid, key, name, category, description, is_global_enabled, company_overrides, is_active, is_deleted, version
                ) VALUES %s
                ON CONFLICT (key) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    description = EXCLUDED.description,
                    is_global_enabled = EXCLUDED.is_global_enabled,
                    company_overrides = EXCLUDED.company_overrides::jsonb,
                    is_active = EXCLUDED.is_active;
                """,
                flag_rows,
            )

            conn.commit()
            conn.close()
            print(f"Successfully seeded tenant bindings into [{db_name}].")
        except Exception as e:
            print(f"Error seeding [{db_name}]: {e}")


if __name__ == "__main__":
    seed_capability_master_data()
