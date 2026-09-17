<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.36.0
  * Created    : 2026-09-18
  * Modified   : 2026-09-18
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI Unified Identity Phase 1.2 — Transactional Document & Ledger Identity Integration

## 1. Purpose
This document records the complete implementation, database migration, schema hardening, and rigorous multi-database parity verification of **Phase 1.2: Transactional Document & Ledger Identity Integration** in SMRITI Retail OS. Following the successful freeze of Phase 1 (Control Plane v1.1.0) and Phase 1.1 (Business Entity Integration v1.0.0), Phase 1.2 integrates governed technical and document identities across the four core transactional entities:
1. `sales_invoices` (Sales Invoicing & Compliance)
2. `purchase_orders` (Procurement & Supplier Orders)
3. `shifts` (Point of Sale Cashier Sessions)
4. `stock_movements` (High-Throughput Inventory Ledger)

---

## 2. Scope
The scope of Phase 1.2 covers:
- **Zero PK/FK Re-keying:** Complete preservation of all existing string primary keys (`*.id`) and 312+ foreign key constraints across the transactional and relational graph.
- **Preservation of Business Numbers:** Statutory `invoice_no` (Rule 46(b) GST), commercial `order_no`, SKU, and Barcode remain statutory business numbering and are **never** replaced by `identity_code`.
- **Database-Level Unique Constraints:** Introduction of `identity_code VARCHAR(100)` with database-enforced unique B-tree indexes (`uq_sales_invoices_identity_code`, `uq_purchase_orders_identity_code`, `uq_shifts_identity_code`) verified with `indisunique=True`.
- **High-Throughput Ledger Boundary:** `stock_movements` is treated as a high-throughput transaction ledger (8,844 rows across databases). It does **NOT** receive a human sequential `identity_code` column, preventing row-locking serialization bottlenecks during POS checkout. Its technical primary key (`id`) is strictly generated as UUIDv7 via `IdentityEngine.generate_technical_id()`.
- **Severing Client-Supplied IDs:** Frontend/client-supplied persistent technical IDs are prohibited across creation schemas (`PurchaseOrderCreate`, `ShiftOpen`, `StockMovementCreate`, `SalesInvoiceCreate`) via Pydantic `@field_validator` raising HTTP 422 `ValidationError`.
- **Transactional Service Allocations:** `CanonicalSalesPostingWriter`, `SalesService`, `PurchaseService`, `POSService`, and `InventoryService` allocate identities strictly via `IdentityEngine.allocate_internal()`.
- **Deterministic Backfill & Audit Logging:** Backfilled 1,986 transactional document records across `smritisys` and `smriti001` ordered deterministically by timestamp; logged 1,986 entries in `smriti_identity_allocation_log` (`purpose='MIGRATION_BACKFILL'`); ingested 1,643 historical document identifiers into `smriti_identity_alias` (`source_system='TRANSACTIONAL'`, `alias_type='HISTORICAL_DOC'`); synchronized sequence counters in `smriti_numbering_registry`.

---

## 3. Files Created
- `backend/alembic/versions/v1466_phase1_2_transactional_identity_integration.py`
- `scripts/verify_phase1_2_parity.py`
- `backend/app/tests/test_phase1_2_transactional_integration.py`
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_2_Transactional_Identity_v1.0.0.md`
- `docs/implementation/foundation/Foundation_Unified_Identity_Phase_1_2_Transactional_Identity_Plan_v1.0.0.md`

---

## 4. Files Modified
- `backend/app/models/sales.py`: Added `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `SalesInvoice`.
- `backend/app/models/purchase.py`: Added `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `PurchaseOrder`.
- `backend/app/models/pos.py`: Added `identity_code = Column(String(100), nullable=True, unique=True, index=True)` to `Shift`.
- `backend/app/schemas/sales.py`: Hardened `SalesInvoiceCreate` to reject client IDs; added `identity_code` to `SalesInvoiceResponse`.
- `backend/app/schemas/purchase.py`: Hardened `PurchaseOrderCreate` to reject client IDs; added `identity_code` to `PurchaseOrderResponse`.
- `backend/app/schemas/pos.py`: Hardened `ShiftOpen` to reject client IDs; added `identity_code` to `ShiftResponse`.
- `backend/app/schemas/inventory.py`: Hardened `StockMovementCreate` to reject client IDs.
- `backend/app/services/canonical_sales_writer.py`: Allocated `invoice_id` and `identity_code` via `IdentityEngine.allocate_internal()`.
- `backend/app/services/sales.py`: Allocated `invoice_id` and `identity_code` via `IdentityEngine.allocate_internal()`.
- `backend/app/services/purchase.py`: Allocated `po_id` and `identity_code` via `IdentityEngine.allocate_internal()`.
- `backend/app/services/pos.py`: Allocated `shift_id` and `identity_code` via `IdentityEngine.allocate_internal()`.
- `backend/app/services/inventory.py`: Allocated `movement_id` via `IdentityEngine.generate_technical_id()`.
- `docs/walkthrough/README.md`: Appended Phase 1.2 walkthrough entry.
- `docs/implementation/README.md`: Appended Phase 1.2 implementation plan entry.

---

## 5. Architecture Decisions
1. **Separation of Concerns across 4 Identity Layers:**
   - **Layer A (Technical Identity):** `id` remains canonical UUIDv7 generated server-side.
   - **Layer B (Statutory/Commercial Numbering):** `invoice_no` and `order_no` governed by business numbering engines.
   - **Layer C (Physical Master Codes):** Barcode, SKU, Serial, Batch preserved for inventory.
   - **Layer D (Governed Universal Identity):** `identity_code` (`SAL-INV`, `PUR-ORD`, `POS-SFT`) allocated by `IdentityEngine`.
2. **High-Throughput Ledger Boundary for Stock Movements:**
   - `stock_movements` is written on every retail scan and cart checkout line. Adding a global sequence counter would induce PostgreSQL `SELECT FOR UPDATE` contention on `smriti_numbering_registry`.
   - `stock_movements` uses technical UUIDv7 `id` directly without a sequential human identity code.
3. **Database-Enforced Uniqueness:**
   - Instead of ordinary B-tree indexes, PostgreSQL unique partial/complete indexes `uq_<tbl>_identity_code` guarantee duplicate prevention at the relational engine level.

---

## 6. Design Rationale
- **Why reject client-supplied IDs with HTTP 422?**
  Allowing clients to supply persistent technical IDs breaks server-side UUIDv7 monotonicity, compromises multi-tenant isolation, and creates idempotency spoofing vulnerabilities. Client request schemas strictly enforce server-side generation.
- **Why ingest existing document numbers into `smriti_identity_alias`?**
  Historical invoices and purchase orders are frequently searched using their statutory numbers (`TT/0001`, `PO-0012`). Ingesting them into `smriti_identity_alias` as `HISTORICAL_DOC` allows `IdentityResolver` to resolve any document across all historical series transparently.

---

## 7. Implementation Summary
Alembic migration `v1466_phase1_2_transactional_identity_integration.py` was executed across all production databases (`smritisys`, `smriti001`, `smriti002`). Schema models, Pydantic schemas, and domain creation services were integrated with `IdentityEngine`. The automated parity audit script `scripts/verify_phase1_2_parity.py` confirmed 100% backfill coverage, zero nulls, zero duplicate codes, zero broken foreign keys, and complete ledger boundary preservation.

---

## 8. Tests Executed
1. `python scripts/verify_phase1_2_parity.py`
2. `pytest app/tests/test_phase1_2_transactional_integration.py -v`
3. `pytest app/tests/test_phase1_1_entity_integration.py -v`
4. `pytest app/tests/test_identity_engine.py -v`
5. `python scripts/architecture_duplication_gate.py`

---

## 9. Verification Results
- **Schema Parity & Backfill Audit:**
  ```text
  smritisys:
    sales_invoices  : 0 rows
    purchase_orders : 11 rows (100% backfilled, [PUR-ORD-00000001 ... PUR-ORD-00000011])
    shifts          : 0 rows
    stock_movements : 524 rows (PK=id, sequential_identity_code=False -> PASSED)
  smriti001:
    sales_invoices  : 1,631 rows (100% backfilled, [SAL-INV-00000001 ... SAL-INV-00001631])
    purchase_orders : 1 row (100% backfilled, [PUR-ORD-00000001 ... PUR-ORD-00000001])
    shifts          : 343 rows (100% backfilled, [POS-SFT-00000001 ... POS-SFT-00000343])
    stock_movements : 8,320 rows (PK=id, sequential_identity_code=False -> PASSED)
  Total Phase 1.2 Allocation Log Entries: 1,986
  Total Historical Document Aliases: 1,643
  Dangling Foreign Key References: 0
  Unique Constraint Status: indisunique=True (0 duplicates)
  ```
- **Phase 1.2 Integration Suite:**
  - `test_transactional_identity_codes_format_and_sequence`: PASSED
  - `test_ledger_boundary_stock_movements_uses_uuidv7_without_sequential_code`: PASSED
  - `test_tier_1_transactional_identity_resolution`: PASSED
  - `test_tier_2_historical_document_alias_resolution`: PASSED
  - `test_reject_client_supplied_persistent_id`: PASSED
  - `test_transactional_creation_lifecycle_allocates_governed_identity`: PASSED
  - **Verdict:** 6/6 passed in 73.07s.

---

## 10. Known Limitations
- Transactional document line items (`sales_invoice_items`, `purchase_order_items`, `shift_cash_transactions`) retain their scoped integer/string IDs and do not receive independent `identity_code` columns.

---

## 11. Future Work
- **Phase 1.3:** External & Partner Integration Identity (`parties`, `payment_transactions`, `eway_bills`, `einvoices`).
- **Phase 1.4:** Identity Resolution Caching in Redis.

---

## 12. Related ADRs
- `ADR-005: One-Way Projections & Statutory Snapshot Rule`
- `ADR-008: Universal Identity, Numbering & UUIDv7 Technical Identity Architecture`

---

## 13. Related RFCs
- `RFC-2026-09-01: SMRITI Retail OS Enterprise Identity Architecture`
