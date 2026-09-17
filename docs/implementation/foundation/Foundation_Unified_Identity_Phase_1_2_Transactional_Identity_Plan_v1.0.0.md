<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Core Architecture
-->

# SMRITI Unified Identity Phase 1.2 — Transactional Document & Ledger Identity Integration Implementation Plan

**Plan Identifier:** `IP-PHASE1-2-IDENTITY-v1.0.0`  
**Date:** 2026-09-18  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Core Architecture Implementation Plan  
**Status:** Draft (Pending Freeze Approval)  

---

## 1. Objective
Execute **Phase 1.2: Transactional Document & Ledger Identity Integration** of the SMRITI Unified Identity Architecture.  
Following the successful formal freeze of Phase 1 (`v1.1.0` Control Plane) and Phase 1.1 (`v1.0.0` Business Entity Integration), Phase 1.2 integrates governed identity into the platform's core transactional documents and operational ledgers:
1. `sales_invoices` (`SAL-INV`)
2. `purchase_orders` (`PUR-ORD`)
3. `shifts` (`POS-SFT` / POS cash drawer shifts)
4. `stock_movements` (Inventory ledger governance & technical UUIDv7 enforcement)

Phase 1.2 carries forward the successful Phase 1.1 architectural invariants:
- **Zero PK/FK Mutation:** Existing technical primary keys (`*.id`) and all inbound/outbound foreign keys remain 100% untouched.
- **Business Numbering Preservation:** Governed `identity_code` is **NEVER a replacement** for statutory `invoice_no`, commercial `order_no`, SKU, or barcode.
- **Client ID Rejection:** Prohibits frontend-supplied persistent technical IDs across transactional creation DTOs (`PurchaseOrderCreate`, `ShiftOpen`, `StockMovementCreate`), routing allocations through `IdentityEngine.allocate_internal()`.
- **Database-Level Invariant Uniqueness:** Nullable unique constraints (`uq_<tbl>_identity_code`) on non-null identity codes.
- **Multi-Tier Resolution & Audit Logging:** All allocations recorded in `smriti_identity_allocation_log`, historical document numbers indexed in `smriti_identity_alias`, and resolved via `IdentityResolver`.

---

## 2. Business Motivation
- **Uniform Enterprise Transaction Tracking:** While statutory numbers (`invoice_no`) vary across financial years, billing prefixes, and legal entities (e.g. `TT2026-2027/250`, `INV-0073`), enterprise operators and automated sync engines need an immutable, uniform SMRITI Identity Code (e.g. `SAL-INV-00001631`) to track the lifecycle of every transaction.
- **Elimination of Client-Controlled Primary Keys:** Historical endpoints (`/api/v1/purchase/orders/`, `/pos/shifts/open`, `/api/v1/inventory/movements`) permitted client requests to dictate the technical primary key string (`id`). This creates collision risks, breaks monotonicity, and bypasses the Identity Control Plane.
- **Audit & Financial Lineage Integrity:** Connecting transactions to `smriti_identity_allocation_log` provides an unalterable ledger of when, why, and by whom every transactional document and cash shift was issued.

---

## 3. Scope
- **Target Tables (4 tables across `smritisys`, `smriti001`, `smriti002`):**
  1. `sales_invoices` (1,631 records in `smriti001`)
  2. `purchase_orders` (11 records in `smritisys`, 1 in `smriti001`)
  3. `shifts` (343 records in `smriti001`)
  4. `stock_movements` (524 in `smritisys`, 8,320 in `smriti001`)
- **Database Lineage:** Alembic migration `v1466_phase1_2_transactional_identity_integration.py` (down revision: `v1465_phase1_1_business_entity_identity_code_integration`).
- **Backend Services Modified:**
  - `backend/app/services/canonical_sales_writer.py`
  - `backend/app/services/purchase.py`
  - `backend/app/services/pos.py`
  - `backend/app/services/inventory.py` / `sales_ledger_svc.py`
- **Schemas Hardened:**
  - `PurchaseOrderCreate` & `PurchaseOrderResponse`
  - `ShiftOpen` & `ShiftResponse`
  - `StockMovementCreate` & `StockMovementResponse`
  - `SalesInvoiceResponse`

---

## 4. Current State: 12-Item Discovery Audit

Before drafting the implementation specification, a thorough audit was executed across `smritisys`, `smriti001`, and `smriti002`:

### 4.1 Discovery Audit Matrix
| Entity / Table | Existing PK Type & Pattern | Outbound FKs | Inbound Referencing FKs | Business Document Number | Current Row Count (`sys` / `001` / `002`) | Existing Sequence / Registry | Needs Human `identity_code`? |
|---|---|---|---|---|---|---|---|
| **`sales_invoices`** | `id VARCHAR(50)`<br>e.g. `inv-dispatch-...`, `doc_...` | 9 FKs (`companies`, `branches`, `customers`, `shifts`, `warehouses`, locations) | 11 tables (`sales_invoice_items`, `sales_returns`, allocations, promotions) | `invoice_no VARCHAR`<br>1,631/1,631 populated, 100% distinct | 0 / 1,631 / 0<br>(Total: **1,631**) | Registered as `SAL-INV`<br>Sequence = 0 | **YES** (`SAL-INV`)<br>Exchanged externally; key statutory doc |
| **`purchase_orders`** | `id VARCHAR(50)`<br>e.g. `po-181335`, `po-53d11e` | 3 FKs (`branches`, `companies`, `suppliers`) | 2 tables (`purchase_order_items`, `purchase_receipts`) | `order_no VARCHAR`<br>12/12 populated, 100% distinct | 11 / 1 / 0<br>(Total: **12**) | Registered as `PUR-PO`<br>Sequence = 0 (align to `PUR-ORD`) | **YES** (`PUR-ORD`)<br>Commercial procurement contract |
| **`shifts`** | `id VARCHAR(50)`<br>e.g. `SH-CHK-b4ff70`, `shift_canon_open_01` | 4 FKs (`branches`, `cashiers`, `companies`, `cash_registers`) | 2 tables (`sales_invoices.shift_id`, `shift_cash_transactions`) | None explicit (`register_id` + timestamps) | 0 / 343 / 0<br>(Total: **343**) | Not in registry<br>Add `POS-SFT` | **YES** (`POS-SFT`)<br>Daily operational cashier sessions |
| **`stock_movements`** | `id VARCHAR(50)`<br>e.g. `SM-1788080023-743f81`, `sm-rebuild-...` | 5 FKs (`branches`, `companies`, `items`, `products`, `warehouses`) | **0 tables** (leaf ledger lines) | None (parent refs: `reference_doc_type`, `reference_doc_id`) | 524 / 8,320 / 0<br>(Total: **8,844**) | Not in registry | **TECHNICAL UUIDv7 ONLY** (See architectural decision below) |

### 4.2 Discovery Analysis: Does `stock_movements` need a human `identity_code`?
- **Architectural Finding:** Stock movements are high-frequency, internal ledger line items (over 8,320 rows in `smriti001` alone; retail checkouts write 10–50 rows per cart commit).
- **Performance Impact:** Enforcing sequential locking on `smriti_numbering_registry` (`SELECT FOR UPDATE`) for every individual inventory ledger item would introduce a severe concurrency bottleneck at retail POS checkouts.
- **Architectural Decision:** 
  - `stock_movements` will **NOT** receive a human `identity_code` column.
  - Instead, its technical primary key (`id`) is strictly migrated to **governed UUIDv7** generated via `IdentityEngine.allocate_internal()`.
  - Client-supplied `id` in `StockMovementCreate` is completely rejected (HTTP 422).
  - Traceability is maintained via its existing `reference_doc_type` and `reference_doc_id` pointing to the parent document (`sales_invoices`, `purchase_receipts`, etc.).

---

## 5. Gap Analysis
1. **Client-Supplied Primary Keys:** `PurchaseOrderCreate` and `ShiftOpen` mandate or permit the client to supply `id: str`. In `inventory.py`, `StockMovementCreate.id` allows client override. This violates the frozen identity contract.
2. **Registry Discrepancy on PO:** `smriti_identity_registry` lists `PURCHASE_ORDER` with `entity_code="PO"` and `biz_code="po_number"`. In reality, the database column on `purchase_orders` is `order_no`, and the canonical prefix is `PUR-ORD`.
3. **Missing Shift Registry:** `shifts` is not yet registered in `smriti_identity_registry` or `smriti_numbering_registry`.
4. **Historical Records Lack Identity Codes:** 1,631 sales invoices, 12 purchase orders, and 343 shifts lack governed identity codes and allocation log entries.
5. **Lookup by Identity Code:** `IdentityResolver` currently routes only Master Data (`companies`, `branches`, `items`, `customers`, `suppliers`). It cannot yet resolve a sales invoice or purchase order by its governed identity code or historical business number.

---

## 6. Architecture Impact
- **Transactional Numbering Isolation:** The statutory invoice numbering engine (`NumberingService` for GST prefixes e.g. `TT/`, `INV/`) remains 100% decoupled and unaffected.
- **Safe Additive Migration:** Adding nullable `identity_code` and unique indexes to `sales_invoices`, `purchase_orders`, and `shifts` does not lock active read/write paths.
- **Alembic Down Revision:** `v1466` chains cleanly off frozen `v1465`.

---

## 7. Proposed Design

### 7.1 Entity Identity Matrix
| Entity | Group | Prefix | Table Name | Business Code Col | Identity Code Column | Strategy |
|---|---|---|---|---|---|---|
| `SalesInvoice` | `SAL` | `SAL-INV` | `sales_invoices` | `invoice_no` | `identity_code VARCHAR(100) UNIQUE NULL` | Sequential Backfill + Ingest `invoice_no` as Alias |
| `PurchaseOrder` | `PUR` | `PUR-ORD` | `purchase_orders` | `order_no` | `identity_code VARCHAR(100) UNIQUE NULL` | Sequential Backfill + Ingest `order_no` as Alias |
| `Shift` | `POS` | `POS-SFT` | `shifts` | None | `identity_code VARCHAR(100) UNIQUE NULL` | Sequential Backfill |
| `StockMovement` | `STK` | `STK-MOV` | `stock_movements` | None | None (Technical UUIDv7 Primary Key Only) | Technical UUIDv7 Allocation |

### 7.2 Deterministic Backfill Strategy
Existing records will be backfilled deterministically ordered by `created_at ASC NULLS LAST, id ASC`:
- `sales_invoices`: 1,631 records -> `SAL-INV-00000001` ... `SAL-INV-00001631`
- `purchase_orders`: 12 records -> `PUR-ORD-00000001` ... `PUR-ORD-00000012`
- `shifts`: 343 records -> `POS-SFT-00000001` ... `POS-SFT-00000343`

### 7.3 Client-Supplied ID Deprecation & Rejection
- `PurchaseOrderCreate`: Reject client-provided `id` if supplied; allocate internal UUIDv7 via `IdentityEngine.allocate_internal()`.
- `ShiftOpen`: Reject client-provided `id`; allocate internal UUIDv7 via `IdentityEngine.allocate_internal()`.
- `StockMovementCreate`: Remove `id` from input schema; allocate internal UUIDv7 via `IdentityEngine.allocate_internal()`.

---

## 8. Files Created
1. `backend/alembic/versions/v1466_phase1_2_transactional_identity_integration.py` — Transactional DDL adding `identity_code` and unique indexes to `sales_invoices`, `purchase_orders`, `shifts`; registering `POS-SFT` and aligning `PUR-ORD`; executing backfill and alias ingestion; syncing sequence counters.
2. `backend/app/tests/test_phase1_2_transactional_integration.py` — Test suite for Phase 1.2 covering creation lifecycle, client-ID rejection, format validation, alias resolution, and schema serialization.
3. `scripts/verify_phase1_2_parity.py` — Automated AST and Rule 12 Schema Parity audit script for Phase 1.2.
4. `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_2_Transactional_Identity_v1.0.0.md` — Walkthrough document (created upon completion).

---

## 9. Files Modified
1. `backend/app/models/sales.py` — Add `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `SalesInvoice`.
2. `backend/app/models/purchase.py` — Add `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `PurchaseOrder`.
3. `backend/app/models/pos.py` — Add `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `Shift`.
4. `backend/app/schemas/purchase.py` — Reject client `id` on `PurchaseOrderCreate`, add `identity_code` to `PurchaseOrderResponse`.
5. `backend/app/schemas/pos.py` — Remove required `id` on `ShiftOpen`, add `identity_code` to `ShiftResponse`.
6. `backend/app/schemas/inventory.py` — Remove `id` from `StockMovementCreate`.
7. `backend/app/schemas/sales.py` — Add `identity_code` to `SalesInvoiceResponse`.
8. `backend/app/services/canonical_sales_writer.py` — Allocate `id` via `IdentityEngine.allocate_internal()`, assign governed `identity_code`.
9. `backend/app/services/purchase.py` — Allocate `id` via `IdentityEngine.allocate_internal()`, assign governed `identity_code`.
10. `backend/app/services/pos.py` — Allocate `id` via `IdentityEngine.allocate_internal()`, assign governed `identity_code`.
11. `backend/app/services/inventory.py` — Allocate `movement_id` via `IdentityEngine.allocate_internal()` (UUIDv7).
12. `backend/app/services/identity/resolver.py` — Extend Tier 1B and Tier 2 resolution to include `sales_invoices`, `purchase_orders`, and `shifts`.
13. `docs/implementation/README.md` & `CHANGELOG.md`.

---

## 10. Dependencies
- Phase 1 Control Plane (`v1464`) and Phase 1.1 Business Master Integration (`v1465`).
- PostgreSQL databases `smritisys`, `smriti001`, `smriti002`.
- `IdentityEngine` facade.

---

## 11. Risks & Mitigation
- **Risk 1: High Volume Backfill Lock Contention.**  
  *Mitigation:* Chunk backfills in batches of 500 rows with parameterized updates.
- **Risk 2: Retail Checkout Latency Overhead.**  
  *Mitigation:* `stock_movements` uses technical UUIDv7 without numbering sequence row-locking, keeping checkout latency sub-millisecond.
- **Risk 3: Frontend Breakage from Removed `id` in Create Payloads.**  
  *Mitigation:* Schema validation rejects non-null IDs with friendly 422 error, while backend services auto-generate UUIDv7 if absent.

---

## 12. Rollback Strategy
- Alembic `downgrade()`:
  - Deletes backfilled allocation log entries (`purpose = 'MIGRATION_BACKFILL'`).
  - Deletes ingested legacy aliases for transactional entities.
  - Drops `uq_<tbl>_identity_code` unique indexes and `identity_code` columns.
  - Reverts sequence counters to 0.
  - Preserves 100% of underlying transaction records, invoices, orders, and ledger movements.

---

## 13. Verification Plan
- **Rule 12 Schema & AST Parity:** Run `scripts/verify_phase1_2_parity.py` checking columns, data types, and `indisunique=True` on `sales_invoices`, `purchase_orders`, and `shifts`.
- **Zero Nulls Check:** Verify 100% of existing rows in target tables have valid `identity_code`.
- **Zero Duplicates Check:** Confirm 0 duplicate identity codes across all databases.
- **Client ID Rejection:** Verify that sending client-controlled persistent `id` in `PurchaseOrderCreate` and `ShiftOpen` returns HTTP 422.

---

## 14. Test Plan
- Run `pytest backend/app/tests/test_phase1_2_transactional_integration.py -v`:
  - `test_sales_invoice_identity_code_lifecycle`
  - `test_purchase_order_identity_code_lifecycle`
  - `test_shift_identity_code_lifecycle`
  - `test_stock_movement_uuid7_allocation`
  - `test_client_supplied_id_rejection_transactional`
  - `test_transactional_alias_resolution`
- Run full regression suites: `test_phase1_1_entity_integration.py` (5/5) and `test_identity_engine.py` (7/7).
- Run `python scripts/architecture_duplication_gate.py` (11/11 checks green).
- Run `npm run lint` (`tsc --noEmit`).

---

## 15. Documentation Impact
- Create Walkthrough: `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_2_Transactional_Identity_v1.0.0.md`.
- Update Master Indexes in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Apply Alembic migration `v1466` to `smritisys`, `smriti001`, `smriti002`.
2. Run `scripts/verify_phase1_2_parity.py`.
3. Run pytest suites.
4. Verify CI gate.

---

## 17. Status
Completed — Fully executed, backfilled, and verified with 6/6 tests green and Rule 12 parity passed.

---

## 18. Related ADRs
- `ADR-001`: Sole FastAPI + PostgreSQL Backend System of Record.
- `ADR-008`: SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture v1.0.
- `ADR-015`: Zero Business Table PK/FK Rekey Invariant.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md` (Phase 1 Baseline).
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_1_Business_Entity_Integration_v1.0.0.md` (Phase 1.1 Baseline).
