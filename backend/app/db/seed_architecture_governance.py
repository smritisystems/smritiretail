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
Classification: Architecture Governance Seeder
"""

import sys
import json
import psycopg2

sys.stdout.reconfigure(encoding="utf-8")

DATABASES = ["smritisys", "smriti001"]

DOMAINS = [
    ("crm", "Customer Relationship Management & Party Master", "Governs customer profiles, loyalty, B2B credit, and contact points.", "Core Architecture", "ACTIVE"),
    ("inventory", "Inventory & Warehouse State Management", "Governs items, physical SKU variants, barcodes, batches, and serials.", "Core Architecture", "ACTIVE"),
    ("sales", "Sales Billing, Orders & Quotations", "Governs POS sales, B2B invoices, delivery notes, and sales orders.", "Core Architecture", "ACTIVE"),
    ("purchase", "Procurement & Inward Receipts", "Governs purchase orders, goods receipts (GRN), and vendor bills.", "Core Architecture", "ACTIVE"),
    ("pos", "Point of Sale & Cash Counter Operations", "Governs high-speed touch billing, register shifts, and drawer reconciliations.", "Core Architecture", "ACTIVE"),
    ("finance", "Accounting, Ledger & Compliance", "Governs chart of accounts, GST tax engine, vouchers, and compliance gateways.", "Core Architecture", "ACTIVE"),
    ("wms", "Warehouse Management System", "Governs zone bins, wave picking, cycle counts, and inter-branch logistics.", "Core Architecture", "ACTIVE"),
    ("hr", "Human Resources & Workforce Management", "Governs employee master, attendance, shift management, commission programs, and HR policies.", "Core Architecture", "ACTIVE"),
    ("system", "System Control Plane & Security", "Governs users, permissions, tenants, UI control plane, and architecture registry.", "Core Architecture", "ACTIVE"),
]

ENTITIES = [
    # v1394 original entities
    ("customer",       "crm",       "Customer Master Record",              "smriti001", "customers",       "Customer",       "CrmService",          "/api/v1/crm/customers",    "CustMasterWs.tsx",           "CANONICAL", 1, "CRM Lead Architect"),
    ("item",           "inventory", "Item Parent Catalog / Style Master",  "smriti001", "items",           "Item",           "ItemMasterService",    "/api/v1/items",            "ItemMasterWs.tsx",           "CANONICAL", 1, "Catalog Architect"),
    ("item_variant",   "inventory", "Physical SKU Variant Master",         "smriti001", "item_variants",   "ItemVariant",    "InventoryService",     "/api/v1/variants",         "ItemDetailsGrid.tsx",        "CANONICAL", 1, "Inventory Architect"),
    ("stock_movement", "inventory", "Transactional Stock Ledger",          "smriti001", "stock_movements", "StockMovement",  "InventoryService",     "/api/v1/inventory/stock",  "StockLedgerTab.tsx",         "CANONICAL", 1, "Inventory Architect"),
    ("sales_invoice",  "sales",     "Sales Invoice Record",                "smriti001", "sales_invoices",  "SalesInvoice",   "SalesService",         "/api/v1/sales",            "SalesStudioTab.tsx",         "CANONICAL", 1, "Sales Architect"),
    ("sales_order",    "sales",     "Sales Order Record",                  "smriti001", "sales_orders",    "SalesOrder",     "SalesOrderService",    "/api/v1/sales/orders",     "SalesOrderFormPremium.tsx",  "CANONICAL", 1, "Sales Architect"),
    ("purchase_order", "purchase",  "Purchase Order Record",               "smriti001", "purchase_orders", "PurchaseOrder",  "PurchaseService",      "/api/v1/purchase",         "PoGenerateTab.tsx",          "CANONICAL", 1, "Procurement Architect"),
    ("tax_rate",       "finance",   "GST Tax Engine & Slab Authority",     "smriti001", "tax_rates",       "TaxRate",        "gstEngine.ts",         "/api/v1/compliance/gst",   "ProPosBillingTerm.tsx",      "CANONICAL", 1, "Finance Architect"),
    # v1395 new WMS and HR entities
    ("warehouse",      "wms",       "Warehouse / Godown Location Master",  "smriti001", "warehouses",      "Warehouse",      "InventoryWmsService",  "/api/v1/wms/warehouses",   None,                         "CANONICAL", 1, "Chief Systems Architect"),
    ("stock_transfer", "wms",       "Inter-Warehouse Stock Transfer Order","smriti001", "stock_transfers", "StockTransfer",  "InventoryWmsService",  "/api/v1/wms/transfers",    "StockTransferStudioModal.tsx","CANONICAL", 1, "Chief Systems Architect"),
    ("hr_domain",      "hr",        "Human Resources Domain Aggregate",    None,        None,              None,             None,                   None,                       None,                         "CANONICAL", 1, "Chief Systems Architect"),
]
# v1395 CAPABILITY SCHEMA
# Each tuple: (cap_key, entity_key, name, business_intent, canonical_component, canonical_file,
#              canonical_service, canonical_api, semantic_fingerprint,
#              integration_type, backend_api_status, backend_api_relation, status, version)
CAPABILITIES = [
    # ── Backend API capabilities (v1394, corrected)
    ("customer.lookup", "customer", "Universal Customer Search & Resolution",
     "High-speed lookup across code, mobile, email, GSTIN, and name for billing and search.",
     "UniversalBrowseEngine.tsx", "src/components/drilldown/UniversalBrowseEngine.tsx",
     "CrmService.search_customers", "/api/v1/crm/customers",
     json.dumps({"inputs": ["mobile", "gstin", "code", "q"], "outputs": ["Customer"], "tables": ["customers"]}),
     "BACKEND_API", "IMPLEMENTED", "CONSUMED", "ACTIVE", 1),

    ("customer.crud", "customer", "Customer Master Maintenance",
     "Full lifecycle creation, re-hydration, B2B credit terms, and address updates for customers.",
     "CustMasterWs.tsx", "src/components/customer/CustMasterWs.tsx",
     "CrmService", "/api/v1/crm/customers",
     json.dumps({"inputs": ["CustomerCreate", "CustomerUpdate"], "outputs": ["Customer"], "tables": ["customers"]}),
     "BACKEND_API", "IMPLEMENTED", "CONSUMED", "ACTIVE", 1),

    ("item.catalog", "item", "Item Master & Style Management",
     "Authoritative parent item definition with brand, department, and tax classifications.",
     "ItemMasterWs.tsx", "src/components/itemMaster/ItemMasterWs.tsx",
     "ItemMasterService", "/api/v1/items",
     json.dumps({"inputs": ["code", "name", "department", "brand"], "outputs": ["Item"], "tables": ["items", "item_variants"]}),
     "BACKEND_API", "IMPLEMENTED", "CONSUMED", "ACTIVE", 1),

    ("tax.gst_calculation", "tax_rate", "Authoritative GST Calculation",
     "Comprehensive GST calculation handling inter/intra state, reverse charge, and tax slabs.",
     "ProPosBillingTerm.tsx", "src/utils/gstEngine.ts",
     "gstEngine.calculateGST", "/api/v1/compliance/gst",
     json.dumps({"inputs": ["rate", "price", "is_inter_state"], "outputs": ["GstBreakup"], "tables": ["tax_rates"]}),
     "BACKEND_API", "IMPLEMENTED", "CONSUMED", "ACTIVE", 1),

    # ── Purchase capabilities
    ("purchase.three_way_match", "purchase_order", "Purchase 3-Way Variance Matching",
     "Three-way invoice verification matching PO quantity, GRN receipts, and vendor bill amounts. "
     "BLOCKED: backend endpoint /api/v1/purchase/3way-matching/commit is not yet implemented. "
     "Product decision required before this capability can be enabled.",
     "ThreeWayMatchingModal.tsx", "src/components/purchase/ThreeWayMatchingModal.tsx",
     None, "/api/v1/purchase/3way-matching/commit",
     json.dumps({"inputs": ["po_id", "grn_id", "inv_id"], "outputs": ["MatchVariance"], "tables": ["purchase_orders"]}),
     "BACKEND_BLOCKED", "UNIMPLEMENTED", "NOT_APPLICABLE", "BLOCKED", 1),

    ("purchase.po_approval_workflow", "purchase_order", "Purchase Order Approval & Local 3-Way Match Workflow",
     "Full PO lifecycle: DRAFT->PENDING_APPROVAL->APPROVED->SENT->INVOICED->THREE_WAY_MATCHED->CLOSED/DISPUTED. "
     "Includes GM-PURCHASE approval authority and local ThreeWayMatchEngine. Functioning today without backend dependency.",
     "POApprovalMatchModal.tsx", "src/components/procurement/POApprovalMatchModal.tsx",
     "threeWayMatchEngine.ts", None,
     json.dumps({"inputs": ["PurchaseOrder"], "outputs": ["MatchReport", "POStatus"], "tables": ["purchase_orders"]}),
     "LOCAL_ENGINE", "NONE", "NOT_APPLICABLE", "ACTIVE", 1),

    # ── WMS / Warehouse capabilities (v1395)
    ("warehouse.wave_planning", "warehouse", "Warehouse Wave Planning & Optimisation Studio",
     "Zone and bin wave creation, multi-picker assignment, and order batch optimisation "
     "using the WavePickingOptimiser local engine. Planning phase only — no live backend API.",
     "WavePickingStudioModal.tsx", "src/components/warehouse/WavePickingStudioModal.tsx",
     "wavePickingOptimiser.ts", None,
     json.dumps({"inputs": ["zone", "order_ids"], "outputs": ["WavePickList"], "tables": ["warehouses"]}),
     "LOCAL_ENGINE", "NONE", "NOT_APPLICABLE", "ACTIVE", 1),

    ("warehouse.wave_execution", "warehouse", "Warehouse Wave Execution & RFID Pick Verification",
     "Physical pick execution: RFID bin scan, SKU verification, per-item pick progress, "
     "and wave commit to staging. Execution phase — distinct from wave planning.",
     "WarehouseWavePickingModal.tsx", "src/components/inventory/WarehouseWavePickingModal.tsx",
     None, None,
     json.dumps({"inputs": ["waveId", "assignedWarehouse", "bin_rfid_tag"], "outputs": ["PickedWave"], "tables": ["stock_movements"]}),
     "LOCAL_EXECUTION", "NONE", "NOT_APPLICABLE", "ACTIVE", 1),

    # ── Inventory / Stock Transfer capabilities (v1395)
    ("wms.inter_branch_transfer", "stock_transfer", "Inter-Branch Stock Dispatch (Deprecated)",
     "Branch-to-branch stock transfer using local engine. Superseded by inventory.stock_transfer. "
     "Backend route /api/v1/wms/transfers is implemented but this component does not call it. "
     "Retained for audit continuity pending ADR-INVENTORY-001 approval.",
     "InterBranchTransferModal.tsx", "src/components/warehouse/InterBranchTransferModal.tsx",
     "interBranchTransferEngine.ts", "/api/v1/wms/transfers",
     json.dumps({"inputs": ["from_branch", "to_branch", "items"], "outputs": ["TransferDispatch"], "tables": ["stock_transfers"]}),
     "LOCAL_ENGINE", "IMPLEMENTED", "AVAILABLE_NOT_USED", "DEPRECATED", 1),

    ("inventory.stock_transfer", "stock_transfer", "Stock Transfer Order Management (Canonical)",
     "10-state lifecycle STO: DRAFT->SUBMITTED->APPROVED->STOCK_RESERVED->DISPATCHED->IN_TRANSIT->"
     "PARTIALLY_RECEIVED->RECEIVED->REJECTED->CANCELLED. Two transfer types: INTER_BRANCH, WAREHOUSE_TO_BRANCH. "
     "Backend route /api/v1/wms/transfers is implemented; frontend uses local engine. "
     "UNDER_REVIEW pending ADR-INVENTORY-001.",
     "StockTransferStudioModal.tsx", "src/components/inventory/StockTransferStudioModal.tsx",
     "stockTransferEngine.ts", "/api/v1/wms/transfers",
     json.dumps({"inputs": ["from_warehouse", "to_warehouse", "transfer_type", "items"],
                 "outputs": ["StockTransferOrder"],
                 "tables": ["stock_transfers", "stock_transfer_items", "stock_movements"]}),
     "LOCAL_ENGINE", "IMPLEMENTED", "AVAILABLE_NOT_USED", "UNDER_REVIEW", 1),

    # ── HR capabilities (v1395)
    ("hr.sales_rep_commission", "hr_domain", "Sales Representative Commission Management",
     "Period-based sales revenue vs target tracking, leaderboard, payout lifecycle "
     "(PENDING->APPROVED->PAID->DISPUTED), and branch commission aggregation.",
     "CommissionStudioModal.tsx", "src/components/hr/CommissionStudioModal.tsx",
     "commissionEngine.ts", None,
     json.dumps({"inputs": ["SalesRepTarget", "SalesEntry"], "outputs": ["CommissionPayout"], "tables": []}),
     "LOCAL_ENGINE", "NONE", "NOT_APPLICABLE", "ACTIVE", 1),

    ("hr.shift_commission", "hr_domain", "Hourly Shift & Attendance Commission Management",
     "Clock-in/out, overtime, break management, and tier-based (BRONZE/SILVER/GOLD/PLATINUM) "
     "per-invoice commission for hourly/shift-based employees.",
     "ShiftCommissionStudioModal.tsx", "src/components/hrm/ShiftCommissionStudioModal.tsx",
     "shiftEngine.ts", None,
     json.dumps({"inputs": ["ShiftEmployee", "ShiftRecord"], "outputs": ["CommissionResult"], "tables": []}),
     "LOCAL_ENGINE", "NONE", "NOT_APPLICABLE", "ACTIVE", 1),

    ("hr.attendance", "hr_domain", "Employee Attendance Management",
     "Attendance tracking and leave management for store and warehouse staff. "
     "Standalone UI — no local engine or backend API.",
     "EmployeeAttendanceModal.tsx", "src/components/hr/EmployeeAttendanceModal.tsx",
     None, None,
     json.dumps({"inputs": ["EmployeeId", "Date"], "outputs": ["AttendanceRecord"], "tables": []}),
     "LOCAL_EXECUTION", "NONE", "NOT_APPLICABLE", "ACTIVE", 1),
]


DECISIONS = [
    ("ADR-FROZEN-001",
     "Inventory Product Store vs Item Catalog Dual-Model",
     "items / item_variants",
     "products",
     "FROZEN_INVESTIGATION",
     "products table (682 rows) is retained as transitional read-only compatibility store for 7-year audit compliance and backward compatibility while items (255 rows) and item_variants (682 rows) serve as Gate 11E catalog. Frozen pending formal transaction path audit.",
     "Global Product & Item Domain",
     "Do not delete or drop products table. Retain read-only query capability and legacy_id_mappings sync.",
     "ARCHITECTURE_DECISION_REQUIRED",
     "Chief Systems Architect"),

    ("ADR-FROZEN-002",
     "Sales Invoice Items vs Sales Invoice Lines Line Model",
     "sales_invoice_items",
     "sales_invoice_lines",
     "FROZEN_INVESTIGATION",
     "sales_invoice_items (6,671 rows) is active transactional line ledger using product_id. sales_invoice_lines (3 rows) contains variant_id and attribute_json for Gate 11E variant billing. Frozen pending formal billing pipeline review.",
     "Sales Invoicing Module",
     "Do not delete sales_invoice_lines. Evaluate Gate 11E variant billing compatibility before migration.",
     "ARCHITECTURE_DECISION_REQUIRED",
     "Chief Systems Architect"),

    ("ADR-FROZEN-003",
     "Customer Monolith vs Universal Party Model",
     "customers",
     "customer_profiles",
     "FROZEN_INVESTIGATION",
     "customers (15 rows tenant, 629 sys) is active transactional customer master. customer_profiles (0 rows) is unpopulated universal party scaffold (party_id). Frozen pending enterprise party model decision.",
     "CRM & Party Domain",
     "Do not delete customer_profiles. Maintain customers as canonical operational table.",
     "ARCHITECTURE_DECISION_REQUIRED",
     "Chief Systems Architect"),

    ("ADR-EXEMPT-004",
     "Physical Stock Immutable Ledger vs Materialized Balance Cache",
     "stock_movements",
     "products.stock",
     "CACHE",
     "Dual-entry inventory accounting requires immutable movement ledger for statutory audit and materialized scalar balance cache in products.stock maintained by PostgreSQL trigger trg_inventory_state_reconciliation for high-throughput POS.",
     "Inventory Physical Stock Domain",
     "Permanent architecture pattern. Products.stock cache must be kept in sync by database trigger.",
     "APPROVED",
     "Chief Systems Architect"),

    ("ADR-EXEMPT-005",
     "Universal F2 Lookup vs Specialized Alt+S Customer Search",
     "UniversalBrowseEngine.tsx",
     "AdvancedCustSearch.tsx",
     "SPECIALIZED_UI",
     "UniversalBrowseEngine is the global F2 modal across 22 entities. AdvancedCustSearch is a deep multi-criteria CRM customer query modal triggered via Alt+S inside CustMasterWs.",
     "Customer Search & F2 System",
     "Both components retained with clear operational division: F2 for general lookup, Alt+S for deep CRM filtering.",
     "APPROVED",
     "Chief Systems Architect"),

    ("ADR-EXEMPT-006",
     "Sales Order Entry Form Compatibility Wrapper",
     "SalesOrderFormPremium.tsx",
     "SalesOrderForm.tsx",
     "COMPATIBILITY",
     "SalesOrderForm.tsx is a 45-line re-export wrapper forwarding to SalesOrderFormPremium.tsx to prevent broken imports during legacy transition.",
     "Sales Order Management",
     "Retain SalesOrderForm.tsx until all calling components migrate to SalesOrderFormPremium.tsx directly.",
     "APPROVED",
     "Chief Systems Architect"),
]


def seed_database(db_name: str):
    print(f"=== Seeding Architecture Governance in {db_name} ===")
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Domains
    for d in DOMAINS:
        cur.execute("""
            INSERT INTO architecture_domains (id, name, description, lead_architect, status)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                lead_architect = EXCLUDED.lead_architect,
                status = EXCLUDED.status,
                modified_at = NOW();
        """, d)
    print(f"  [OK] Seeded {len(DOMAINS)} architecture domains.")

    # 2. Entities
    for e in ENTITIES:
        cur.execute("""
            INSERT INTO architecture_entities (
                entity_key, domain_id, canonical_name, canonical_db, canonical_table,
                canonical_model, canonical_service, canonical_api, canonical_ui,
                status, version, owner
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (entity_key) DO UPDATE SET
                domain_id = EXCLUDED.domain_id,
                canonical_name = EXCLUDED.canonical_name,
                canonical_db = EXCLUDED.canonical_db,
                canonical_table = EXCLUDED.canonical_table,
                canonical_model = EXCLUDED.canonical_model,
                canonical_service = EXCLUDED.canonical_service,
                canonical_api = EXCLUDED.canonical_api,
                canonical_ui = EXCLUDED.canonical_ui,
                status = EXCLUDED.status,
                version = EXCLUDED.version,
                owner = EXCLUDED.owner,
                modified_at = NOW();
        """, e)
    print(f"  [OK] Seeded {len(ENTITIES)} canonical entities.")

    # 3. Capabilities (v1395 schema: includes integration_type, backend_api_status, backend_api_relation)
    for c in CAPABILITIES:
        cur.execute("""
            INSERT INTO architecture_capabilities (
                capability_key, entity_key, name, business_intent,
                canonical_component, canonical_file, canonical_service,
                canonical_api, semantic_fingerprint,
                integration_type, backend_api_status, backend_api_relation,
                status, version
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (capability_key) DO UPDATE SET
                entity_key = EXCLUDED.entity_key,
                name = EXCLUDED.name,
                business_intent = EXCLUDED.business_intent,
                canonical_component = EXCLUDED.canonical_component,
                canonical_file = EXCLUDED.canonical_file,
                canonical_service = EXCLUDED.canonical_service,
                canonical_api = EXCLUDED.canonical_api,
                semantic_fingerprint = EXCLUDED.semantic_fingerprint,
                integration_type = EXCLUDED.integration_type,
                backend_api_status = EXCLUDED.backend_api_status,
                backend_api_relation = EXCLUDED.backend_api_relation,
                status = EXCLUDED.status,
                version = EXCLUDED.version,
                modified_at = NOW();
        """, c)
    print(f"  [OK] Seeded {len(CAPABILITIES)} architecture capabilities.")


    # 4. Decisions
    for dec in DECISIONS:
        cur.execute("""
            INSERT INTO architecture_decisions (
                decision_id, subject, canonical_owner, secondary_owner,
                classification, reason, scope, migration_plan, status, approved_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (decision_id) DO UPDATE SET
                subject = EXCLUDED.subject,
                canonical_owner = EXCLUDED.canonical_owner,
                secondary_owner = EXCLUDED.secondary_owner,
                classification = EXCLUDED.classification,
                reason = EXCLUDED.reason,
                scope = EXCLUDED.scope,
                migration_plan = EXCLUDED.migration_plan,
                status = EXCLUDED.status,
                approved_by = EXCLUDED.approved_by,
                modified_at = NOW();
        """, dec)
    print(f"  [OK] Seeded {len(DECISIONS)} architecture decisions (including frozen areas).")

    conn.close()
    print(f"=== {db_name} Seeding Complete ===\n")


def main():
    for db in DATABASES:
        seed_database(db)


if __name__ == "__main__":
    main()
