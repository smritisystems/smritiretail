<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.34.1
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Identity Generator Inventory (IGI)

**Standard:** SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture v1.0  
**Audit Date:** 2026-09-18  
**Scope:** Complete SMRITI Retail OS Repository (`backend/app`, `src/`, PostgreSQL `smritisys` & `smriti001`)  
**Status:** Canonical Audit Baseline  

---

## 1. Executive Summary & Inventory Totals

This inventory catalogues every persistent ID generator, sequence manager, client-side timestamp/random ID maker, and primary key mechanism across the SMRITI platform.

| Category | Count | Status / Architectural Decision |
| :--- | :--- | :--- |
| **Total Base Database Tables Audited** | 268 | Canonical DB Schema |
| **Tables with `character varying(50)` PK** | 252 | Retain as Canonical String UUIDv7 Target |
| **Tables with Native `uuid` PK** | 2 | `master_types`, `master_values` — Standardize |
| **Tables with `integer` PK** | 7 | Migration required (Item tables & logs) |
| **Tables with Dedicated `uuid` Column** | 225 | Redundant dual-identity column (Phase Migration to PK) |
| **Tables Missing `uuid` Column** | 43 | Needs backfill during Unified Identity upgrade |
| **Database Sequences (`pg_sequences`)** | 8 | Governed Document Numbering & System Sequences |
| **Backend Ad-Hoc Generators Identified** | 60+ locations | Replace with Centralized `IdentityEngine` |
| **Frontend ID Generators (`src/`)** | 45+ locations | Strictly Prohibit / Replace with Backend Assignment |

---

## 2. Backend Identity Generators Inventory

| Source Location | Current Generator Mechanism | Entity / Scope | Identifier Classification | Target Architectural Decision |
| :--- | :--- | :--- | :--- | :--- |
| `backend/app/db/base.py:28-29` | `Column(String(50), primary_key=True)` + `uuid = Column(String(36), default=uuid4)` | Universal Base Entity | `CANONICAL_SYSTEM_ID` + `LOCAL_TECHNICAL_ID` | **Refactor:** Unite into single canonical `id` (UUIDv7) + `identity_code`. |
| `backend/app/services/item_master_svc.py:134-135` | `f"itm_{uuid.uuid4().hex[:12]}"` | Item (`items.id`) | `CANONICAL_SYSTEM_ID` | **Replace:** Migrate to `IdentityService.generate_identity(MST, ITEM)` -> UUIDv7 + `MST-ITM-0000XXXX`. |
| `backend/app/services/item_master_svc.py:134` | `f"ITM-{uuid.uuid4().hex[:8].upper()}"` | Item SKU (`items.item_code`) | `BUSINESS_CODE` | **Govern:** Retain as default `BUSINESS_CODE` if empty; never treat as primary identity. |
| `backend/app/services/inventory.py:149` | `f"PROD-{uuid.uuid4().hex[:8]}"` | Product/Variant (`products.id`) | `CANONICAL_SYSTEM_ID` | **Replace:** Migrate to canonical UUIDv7 + `MST-PRD-0000XXXX`. |
| `backend/app/services/crm.py:264` | `f"cust-{uuid.uuid4().hex[:8]}"` | Customer (`customers.id`) | `CANONICAL_SYSTEM_ID` | **Replace:** Migrate to canonical UUIDv7 + `MST-CUS-0000XXXX`. |
| `backend/app/services/crm.py:267` | `f"CUST-{uuid.uuid4().hex[:8].upper()}"` | Customer Code (`customers.code`) | `BUSINESS_CODE` | **Govern:** Retain as customer business code. |
| `backend/app/services/purchase.py:51` | `def _uid(): return uuid.uuid4().hex[:8]` | Purchase Module Scope | `LOCAL_TECHNICAL_ID` | **Eliminate:** 32-bit truncated hex creates severe collision hazards. Replace with UUIDv7. |
| `backend/app/services/purchase.py:204` | `f"poi-{_uid()}"` | Purchase Order Item (`poi.id`) | `CANONICAL_SYSTEM_ID` | **Replace:** Canonical UUIDv7. |
| `backend/app/services/sales.py:66` | `def _uid(): return uuid.uuid4().hex[:8]` | Sales Module Scope | `LOCAL_TECHNICAL_ID` | **Eliminate:** Replace with centralized UUIDv7 generator. |
| `backend/app/services/sales.py:1345` | Accepts `so_in.id` directly from client | Sales Order (`sales_orders.id`) | `CANONICAL_SYSTEM_ID` | **Fix Immediately:** Backend must own ID generation; reject or ignore client-supplied PK. |
| `backend/app/models/workflow.py:22` | `def _uid(): return uuid.uuid4().hex[:8]` | Workflow History (`id`) | `CANONICAL_SYSTEM_ID` | **Replace:** Migrate to standard BaseEntity UUIDv7. |
| `backend/app/models/user_assignment.py:23` | `f"uca-{uuid_pkg.uuid4().hex[:12]}"` | User Company Assignment (`id`) | `CANONICAL_SYSTEM_ID` | **Replace:** Standardize to UUIDv7. |
| `backend/app/models/user_assignment.py:51` | `f"uba-{uuid_pkg.uuid4().hex[:12]}"` | User Branch Assignment (`id`) | `CANONICAL_SYSTEM_ID` | **Replace:** Standardize to UUIDv7. |
| `backend/app/models/training.py:36,49,59` | `Column(String(36), default=str(uuid.uuid4()))` | Training Sessions/Certificates | `CANONICAL_SYSTEM_ID` | **Standardize:** Migrate from ad-hoc String(36) UUIDv4 to standard BaseEntity UUIDv7. |
| `backend/app/models/numbering.py:18` | `DocumentSeries` running sequence counter | Sales / Purchase / Returns | `DOCUMENT_NUMBER` | **Keep & Integrate:** Governed Shoper 9 parity document series; map into Numbering Registry. |
| `backend/app/models/product_identity.py:48` | `ProductIdentity.business_key` + `fingerprint` | Product SKU / Barcode Lifecycle | `BUSINESS_CODE` | **Keep & Harmonize:** Specialized barcode fingerprint engine; harmonize with SMRITI Identity Engine. |

---

## 3. Frontend ID Generator Inventory (`src/`)

| Source Location | Current Frontend Generator | Classification | Issue / Violation | Architectural Remedy |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/sales/SalesOrderTab.tsx:62` | `id: crypto.randomUUID()` in POST body | `CANONICAL_SYSTEM_ID` (Client Generated) | **Violation of Rule 32 & ID-010**; Client dictates server PK | Remove client `id` field; Backend assigns canonical UUIDv7 upon creation. |
| `src/utils/wavePickingOptimiser.ts:101` | ``TASK-${Date.now()}-${Math.floor(Math.random()*999)}`` | `LOCAL_TECHNICAL_ID` | Ad-hoc client timestamp ID | UI-only task tracker; if persisted, must use backend `ACT-WPK-XXXXXXXX`. |
| `src/utils/vendorReturnEngine.ts:147` | ``RTVID-${Date.now()}`` | `DOCUMENT_NUMBER` | Client generated business identity | Server must allocate return identity via `SAL-RET` / `PUR-RET` series. |
| `src/utils/vendorReturnEngine.ts:213` | ``DNID-${Date.now()}`` | `DOCUMENT_NUMBER` | Client generated debit note ID | Server allocates `FIN-DBN` document series. |
| `src/utils/threeWayMatchEngine.ts:170` | ``POID-${Date.now()}`` | `FOREIGN_KEY` / Ref | Fake PO reference generation | Must resolve canonical `PurchaseOrder.id`. |
| `src/utils/stockTransferEngine.ts:95` | ``STO-${Date.now().toString().slice(-9)}`` | `DOCUMENT_NUMBER` | Client transfer numbering | Server allocates `INV-TRN` sequence. |
| `src/utils/salesReturnEngine.ts:135,207` | ``RETID-${Date.now()}``, ``EXCID-${Date.now()}`` | `DOCUMENT_NUMBER` | Client return/exchange ID | Replace with server allocation. |
| `src/utils/rtvEngine.ts:181` | ``RTV-${Date.now()}-${this.counter}`` | `DOCUMENT_NUMBER` | Client counter ID | Server-side RTV sequence. |
| `src/utils/rmaEngine.ts:110` | ``RMA-${Date.now().toString().slice(-8)}`` | `DOCUMENT_NUMBER` | Client RMA ID | Server-side RMA sequence. |
| `src/utils/replenishmentEngine.ts:102` | ``SUGG-${item.sku}-${Date.now()}`` | `LEGITIMATE_SEPARATE_ENTITY_ID` | Suggestion ID with embedded SKU & time | Map to `COL-SUG-XXXXXXXX` in Action Center. |
| `src/utils/omniOrderEngine.ts:112` | ``OMO-${Date.now().toString().slice(-9)}`` | `DOCUMENT_NUMBER` | Client eCommerce order number | Reconcile with `SAL-ORD` server series. |
| `src/utils/markdownEngine.ts:132` | ``MKDPLN-${this.planCounter++}-${Date.now()}`` | `LOCAL_TECHNICAL_ID` | In-memory plan counter | If saved, backend allocates `MST-MKD` entity code. |
| `src/utils/loyaltyLedgerEngine.ts:94` | ``LDG-${Date.now()}-${Math.floor(Math.random()*9999)}`` | `CANONICAL_SYSTEM_ID` | Client loyalty ledger record ID | Server assigns canonical UUIDv7 on transaction post. |
| `src/utils/ipoEngine.ts:133,240` | ``IPOID-${Date.now()}``, ``IGRNID-${Date.now()}`` | `DOCUMENT_NUMBER` | Inter-branch PO and GRN ID | Server document series allocation. |
| `src/utils/interBranchTransferEngine.ts:134`| ``STOID-${Date.now()}`` | `DOCUMENT_NUMBER` | Stock transfer order ID | Server document series allocation. |
| `src/notifications/notification_store.tsx:118` | `crypto.randomUUID()` | `TEMPORARY_ID` | UI transient toast/notification ID | **Allowed Exception:** Pure client ephemeral UI state; never persisted in database. |

---

## 4. Full Table Classification Matrix (268 Base Tables)

Every database table is classified into its canonical SMRITI Identity Group and architectural role:

| Identity Group | Tables Included | Primary Key Schema | Dual UUID Column | Proposed SMRITI Identity Code Format |
| :--- | :--- | :--- | :--- | :--- |
| **`ORG` (Organization)** | `companies`, `branches`, `tenants`, `tenant_settings`, `store_registers`, `cash_registers`, `tax_jurisdictions` | `character varying(50)` | Present (225 tables) | `ORG-CMP-XXXXXXXX`, `ORG-BRN-XXXXXXXX` |
| **`MST` (Master Data)** | `items`, `products`, `item_barcodes`, `item_batches`, `item_prices`, `categories`, `departments`, `brands`, `parties`, `customers`, `suppliers`, `customer_groups`, `size_groups`, `product_identities`, `barcode_providers`, `identity_rules`, `master_types`, `master_values` | `character varying(50)` (2 with `uuid`) | Present in 95% | `MST-ITM-XXXXXXXX`, `MST-CUS-XXXXXXXX`, `MST-SUP-XXXXXXXX`, `MST-BAR-XXXXXXXX` |
| **`INV` (Inventory)** | `warehouses`, `warehouse_locations`, `stock_movements`, `product_batch_stocks`, `inventory_snapshots`, `stock_counts`, `stock_transfers`, `inter_branch_transfers` | `character varying(50)` | Present | `INV-WHS-XXXXXXXX`, `INV-STM-XXXXXXXX`, `INV-BAT-XXXXXXXX` |
| **`SAL` (Sales)** | `sales_invoices`, `sales_invoice_items`, `sales_orders`, `sales_order_items`, `sales_quotations`, `sales_quotation_items`, `sales_returns`, `sales_return_items` | `varchar(50)` + 4 `integer` items tables | Present | `SAL-INV-XXXXXXXX`, `SAL-ORD-XXXXXXXX`, `SAL-RET-XXXXXXXX` |
| **`PUR` (Purchase)** | `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_receipt_items`, `purchase_bills`, `purchase_returns`, `supplier_payments` | `character varying(50)` | Present | `PUR-ORD-XXXXXXXX`, `PUR-RCP-XXXXXXXX`, `PUR-BIL-XXXXXXXX` |
| **`POS` (Point of Sale)** | `pos_profiles`, `pos_registers`, `pos_shifts`, `legacy_pos_shifts`, `pos_hold_bills`, `counter_sessions` | `character varying(50)` | Present | `POS-PRF-XXXXXXXX`, `POS-SHF-XXXXXXXX`, `POS-SES-XXXXXXXX` |
| **`FIN` (Finance)** | `accounts`, `account_balance_snapshots`, `payment_ledgers`, `bank_statements`, `bank_statement_lines`, `customer_ledger_entries` | `character varying(50)` | Present | `FIN-ACC-XXXXXXXX`, `FIN-LED-XXXXXXXX`, `FIN-BNK-XXXXXXXX` |
| **`TAX` (Tax & Compliance)** | `tax_rules`, `tax_rates`, `tax_inv_templates`, `e_way_bills`, `compliance_thresholds` | `character varying(50)` (1 composite) | Present | `TAX-RUL-XXXXXXXX`, `TAX-EWB-XXXXXXXX` |
| **`CRM` (Customer Relations)** | `customers`, `customer_groups`, `loyalty_cards`, `loyalty_ledgers`, `referral_programs`, `customer_promotions` | `character varying(50)` | Present | `CRM-LOY-XXXXXXXX`, `CRM-REF-XXXXXXXX` |
| **`RPT` (Reporting & Analytics)** | `report_definitions`, `report_saved_views`, `dashboards`, `dashboard_widgets`, `prepared_reports`, `report_schedules` | `character varying(50)` | Present | `RPT-REP-XXXXXXXX`, `RPT-TPL-XXXXXXXX`, `RPT-VER-XXXXXXXX` |
| **`FCT` (Forecast & SICE)** | `replenishment_suggestions`, `pricing_rules`, `discount_policies` | `character varying(50)` | Present | `FCT-FOR-XXXXXXXX`, `FCT-SCN-XXXXXXXX` |
| **`COL` (Collaboration)** | To be registered in Control Plane | Proposed schema | New | `COL-CMT-XXXXXXXX`, `COL-SUG-XXXXXXXX`, `COL-DEC-XXXXXXXX` |
| **`ACT` (Action Center)** | `action_definitions`, `approval_requests`, `approval_actions`, `workflow_instances` | `character varying(50)` | Present | `ACT-ACT-XXXXXXXX`, `ACT-WKF-XXXXXXXX` |
| **`AUD` (Audit & Governance)** | `audit_logs` (`integer`), `numbering_audit_logs`, `barcode_registry_audit`, `architecture_decisions` | `varchar(50)` + 1 `integer` | Present | `AUD-EVT-XXXXXXXX`, `AUD-LOG-XXXXXXXX` |
| **`INT` (Integration Hub)** | `sync_queue` (`integer`), `outbox_messages`, `integration_endpoints`, `legacy_menu_maps` | `varchar(50)` + 1 `integer` | Present | `INT-MAP-XXXXXXXX`, `INT-SYN-XXXXXXXX` |
| **`SYS` (System & Control Plane)** | `users`, `roles`, `permissions`, `document_series`, `system_parameters`, `alembic_version` | `character varying(50)` | Present | `SYS-USR-XXXXXXXX`, `SYS-ROL-XXXXXXXX`, `SYS-SER-XXXXXXXX` |

---

## 5. Architectural Gap Analysis & Anti-Pattern Findings

1. **Dual-Identity Divergence (`id` vs `uuid`):**
   `BaseEntity` in `backend/app/db/base.py` declares both `id = Column(String(50), primary_key=True)` and `uuid = Column(String(36), default=uuid4, unique=True)`.
   - In 252 tables, foreign keys reference `id`, which currently holds arbitrary strings like `comp-sal-359785` or `itm_b928e5c78679`.
   - The `uuid` column is largely an unreferenced secondary index.
   - **Resolution:** Migrate `id` directly to UUIDv7, making the primary key the canonical technical identity without needing a separate duplicate column.

2. **Truncated Hex Collision Hazard:**
   Functions like `def _uid(): return uuid.uuid4().hex[:8]` in `purchase.py`, `sales.py`, and `workflow.py` discard 96 bits of entropy, leaving only 32 bits. At retail scale (100,000s of transactions and lines), hash collisions are statistically certain.
   - **Resolution:** Centralize all technical ID creation in `IdentityService` using full 128-bit sortable UUIDv7.

3. **Frontend Persistent ID Creation:**
   Multiple frontend components (e.g. `SalesOrderTab.tsx:62`, `vendorReturnEngine.ts`, `rtvEngine.ts`) synthesize persistent IDs (`crypto.randomUUID()`, `Date.now()`) and submit them to backend APIs.
   - **Resolution:** Remove client-side ID parameters. All API POST requests must omit `id` and allow the backend Identity Engine to atomically generate UUIDv7 + `identity_code`.

4. **Mixed Integer vs String Primary Keys in Transaction Items:**
   `sales_invoice_items`, `sales_order_items`, `sales_quotation_items`, and `sales_return_items` use autoincrementing `integer` primary keys, while header tables use `varchar(50)`.
   - **Resolution:** Follow Section 47 & 50 migration safety pattern to backfill canonical UUIDv7 for all line item tables.
