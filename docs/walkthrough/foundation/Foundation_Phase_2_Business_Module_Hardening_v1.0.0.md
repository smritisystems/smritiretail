<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.39.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Phase 2 Formal Walkthrough
-->

# Walkthrough: Foundation Phase 2 — Business Module Hardening & Canonical Authority Convergence

**Version:** 1.0.0  
**Phase:** Foundation Phase 2  
**Date:** 2026-09-18  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal Governance & Architecture Hardening  
**Status:** FROZEN  

---

## 1. Purpose
This walkthrough documents the full implementation, architectural hardening, and verification of **Phase 2: Business Module Hardening & Canonical Authority Convergence** in SMRITI Retail OS. Following the successful delivery and freezing of Phase 1 (Control Plane, Master Entities, Transactional Documents, Partner Bridges, Master Resolver Index), Phase 2 operationalizes and converges these capabilities across live core business flows:
1. Routing universal search, barcode lookups, and CSV billing imports through `IdentityResolver.resolve()`.
2. Converging sales transactions into `CanonicalSalesPostingWriter` as the sole transactional authority, establishing governed identity allocations (`SAL-INV-*`) alongside un-coded UUIDv7 ledger boundaries (`stock_movements`, `payment_transactions`).
3. Deploying Alembic migration `v1469` to enforce database-level atomic upsert guarantees on `smriti_identity_alias` and restoring strict Rule 12 column parity across all three production database environments (`smritisys`, `smriti001`, `smriti002`).
4. Retiring historical architectural debt by eliminating dual domain directories (`hr`/`hrm`), consolidating four duplicate modal pairs into canonical studio components, and mounting all API routers (`barcodes.py`) to achieve a verified **0 Registered Debt** and **0 P0/P1 Violations** state on `scripts/architecture_duplication_gate.py`.

---

## 2. Scope
The scope of Phase 2 encompasses four interconnected engineering slices:
- **Slice 2.1: Resolver & Master Index Integration:**
  - Fast barcode scanning in `UniversalSearchEngine.quick_barcode_scan()` (`backend/app/services/search_engine.py`).
  - Catalog lookup in CSV Billing Import (`backend/app/api/v1/billing_csv.py`).
- **Slice 2.2: Canonical Sales Authority Convergence:**
  - `CanonicalSalesPostingWriter.post_sales_transaction()` (`backend/app/services/canonical_sales_writer.py`) hardened with atomic transaction rollback and caller-controlled session lifecycle.
  - Server-side governed identity code allocation for `SalesInvoice` (`SAL-INV-*`).
  - Strict preservation of ledger boundaries for `stock_movements` and `payment_transactions` (RFC 9562 UUIDv7 technical IDs, no sequential row locks).
  - Modern POS shift lifecycle enforcement eliminating client-supplied shift IDs (`backend/app/tests/test_pos.py`).
- **Slice 2.3: Concurrency & Webhook Hardening:**
  - Alembic migration `v1469_phase2_alias_atomic_upsert_and_hardening.py` creating unique functional index `uq_smriti_identity_alias_lower` on `smriti_identity_alias (entity_type, LOWER(alias_code), COALESCE(company_id, ''))`.
  - Concurrency race condition absorption via PostgreSQL savepoint nested transactions in `IdentityEngine.register_alias()`.
  - Multi-database column parity restoration across `smritisys`, `smriti001`, and `smriti002`.
- **Slice 2.4: Architectural Legacy Debt Retirement:**
  - Retirement of `src/components/hrm` domain folder into `src/components/hr`.
  - Consolidation of 4 duplicate modal pairs (`POApprovalMatchModal`, `WavePickingStudioModal`, `InterBranchTransferModal`, `ShiftCommissionStudioModal`) into their canonical studio implementations (`ThreeWayMatchingModal`, `WarehouseWavePickingModal`, `StockTransferStudioModal`, `CommissionStudioModal`).
  - Verification of unmounted backend router `barcodes.py` mounted under `/api/v1/barcodes`.
  - Architecture duplication gate reduction to 0 registered debt items.

---

## 3. Files Created
1. `backend/alembic/versions/v1469_phase2_alias_atomic_upsert_and_hardening.py` — Alembic schema migration for alias case-insensitive uniqueness and multi-database column synchronization.
2. `backend/app/tests/test_phase2_resolver_integration.py` — Test suite for Tier 0 in-memory cache, barcode scan, and CSV import identity resolution (3/3 pass).
3. `backend/app/tests/test_phase2_canonical_writer_convergence.py` — Test suite for CanonicalSalesPostingWriter, ledger boundaries, idempotency replay, and atomic rollback (3/3 pass).
4. `backend/app/tests/test_phase2_concurrency_hardening.py` — Multi-worker concurrent alias registration, collision protection, case-insensitivity, and Rule 12 column parity test suite (4/4 pass).
5. `docs/walkthrough/foundation/Foundation_Phase_2_Business_Module_Hardening_v1.0.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/search_engine.py` — Wired `IdentityResolver.resolve()` into `quick_barcode_scan()` with Tier 0 fast-path resolution.
2. `backend/app/api/v1/billing_csv.py` — Replaced legacy ad-hoc barcode queries in `_lookup_catalog()` with universal `IdentityResolver.resolve()`.
3. `backend/app/services/canonical_sales_writer.py` — Corrected session handling (`self.db` -> caller `session`) and implemented atomic `await session.rollback()` on stock deduction or posting failures when `commit=True`.
4. `backend/app/services/identity/code_generator.py` — Updated table column reference from `reg.target_table` to canonical `reg.database_table` on `SmritiIdentityRegistry`.
5. `backend/app/services/identity/engine.py` — Hardened `register_alias` with nested savepoint handling to absorb concurrent insert races idempotently.
6. `backend/app/tests/test_pos.py` — Modernized POS shift fixtures to eliminate client-supplied shift IDs.
7. `scripts/architecture_duplication_gate.py` — Updated registered historical baseline debt sets to empty sets (`set()`) reflecting complete Phase 2 debt retirement.
8. `src/components/hr/CommissionStudioModal.tsx` — Added backwards-compatible `ShiftCommissionStudioModal` alias export.
9. `docs/implementation/README.md` — Updated master implementation status to Completed.
10. `docs/implementation/foundation/Foundation_Phase_2_Business_Module_Hardening_And_Canonical_Authority_Plan_v1.0.0.md` — Marked Phase 2 plan status as Completed.
11. `docs/walkthrough/README.md` — Registered Phase 2 walkthrough in master index.
12. `CHANGELOG.md` — Documented release 6.39.0.

### Files Deleted (Consolidated Debt Retirement)
1. `src/components/hrm/ShiftCommissionStudioModal.tsx` — Consolidated into `src/components/hr/CommissionStudioModal.tsx`.
2. `src/components/procurement/POApprovalMatchModal.tsx` — Consolidated into `src/components/purchase/ThreeWayMatchingModal.tsx`.
3. `src/components/warehouse/InterBranchTransferModal.tsx` — Consolidated into `src/components/inventory/StockTransferStudioModal.tsx`.
4. `src/components/warehouse/WavePickingStudioModal.tsx` — Consolidated into `src/components/inventory/WarehouseWavePickingModal.tsx`.

---

## 5. Architecture Decisions
1. **ADR-IDENTITY-004: Tiered Discovery Hierarchy Convergence:**
   - External scans and user queries first query the in-memory `IdentityResolutionCache` (Tier 0). On miss, they route through `IdentityResolver.resolve()` evaluating governed identity codes, case-insensitive aliases (`smriti_identity_alias`), allocation log reverse UUIDv7 lookups, and sovereign business keys (`items.code`, `products.barcode`, `sales_invoices.invoice_no`).
2. **ADR-SALES-002: Canonical Authority Over All Invoicing:**
   - All commercial channels (POS counter retail, B2B wholesale tax invoices, customer PO conversions) must submit to `CanonicalSalesPostingWriter.post_sales_transaction()`. Direct raw insertions into `sales_invoices` or `sales_invoice_items` are strictly prohibited.
3. **ADR-LEDGER-001: Separation of Identity-Coded Documents from Ledger Boundaries:**
   - High-throughput audit ledgers (`stock_movements`, `payment_transactions`) strictly use RFC 9562 UUIDv7 identifiers and have `identity_code_enabled=False`. They do not acquire sequential row-level numbering locks, protecting POS checkout throughput from serialization bottlenecks.
4. **ADR-GOV-003: Zero Registered Baseline Debt Standard:**
   - Historical debt registered during Phase 1 baseline freezing is permanently eliminated rather than grandfathered. All parallel domain folders and duplicate modal components must be consolidated into their single canonical owner.

---

## 6. Design Rationale
- **Concurrency Absorption in Alias Registration:** Under high-speed parallel operations (e.g. multi-register POS shifts opening simultaneously or multi-lane barcode imports), concurrent workers may attempt to register identical external barcodes or GSTIN aliases. Wrapping the insert in `session.begin_nested()` absorbs the PostgreSQL `UniqueViolationError`, rolls back the subtransaction to the savepoint without invalidating the outer transaction, and re-queries the row committed by the winning worker.
- **Atomic Rollback Ownership:** When a caller invokes `CanonicalSalesPostingWriter` with `commit=True`, the writer owns transaction lifecycle. If WMS stock validation fails (`HTTPException(400)`), the writer issues an explicit `await session.rollback()`, ensuring uncommitted header records and line items are never left dirty in the database session.

---

## 7. Implementation Summary
### Slice 2.1: Resolver Integration
- In `UniversalSearchEngine.quick_barcode_scan()`, incoming barcode strings are resolved against `IdentityResolver.resolve()`. If found, the canonical entity UUID and governed `identity_code` are immediately hydrated into the search result.
- In `billing_csv.py`, `_lookup_catalog()` delegates all barcode and item code matching to `IdentityResolver.resolve()`, ensuring external partner codes mapped in `smriti_identity_alias` are recognized during CSV batch ingestion.

### Slice 2.2: Canonical Sales Authority
- Fixed session management bug where `self.db` was accessed instead of caller `session`.
- Fixed collision protection sequence advance loop in `code_generator.py` referencing `reg.database_table`.
- Enforced Income Tax Act Section 269ST compliance rejecting single cash receipts exceeding ₹2,00,000.
- Updated POS shift test fixtures in `test_pos.py` to adhere to server-generated UUIDv7 technical IDs.

### Slice 2.3: Concurrency & Multi-DB Parity
- Created Alembic migration `v1469` applying unique functional index `uq_smriti_identity_alias_lower` on `smriti_identity_alias`.
- Restored 100% column parity across `smritisys`, `smriti001`, and `smriti002` for `items`, `item_variants`, and `sales_invoices`.
- Verified 10 concurrent async workers registering identical aliases resolve to the same persisted record without error.

### Slice 2.4: Architectural Legacy Debt Retirement
- Merged `src/components/hrm` into `src/components/hr`.
- Removed four unreferenced duplicate modal files (`POApprovalMatchModal.tsx`, `WavePickingStudioModal.tsx`, `InterBranchTransferModal.tsx`, `ShiftCommissionStudioModal.tsx`).
- Verified router `backend/app/api/v1/barcodes.py` mounted at `/api/v1/barcodes`.
- Executed `scripts/architecture_duplication_gate.py` asserting 11/11 checks pass with 0 registered debt and 0 P0/P1 violations.

---

## 8. Tests Executed
1. `pytest app/tests/test_phase2_resolver_integration.py -v` — 3/3 passed in 38.18s.
2. `pytest app/tests/test_phase2_concurrency_hardening.py -v` — 4/4 passed in 41.06s.
3. `pytest app/tests/test_phase2_canonical_writer_convergence.py -v` — 3/3 passed in 48.59s.
4. `pytest app/tests/test_pos.py -v` — 17/17 passed in 181.25s.
5. `python scripts/architecture_duplication_gate.py` — 11/11 checks passed in 2.11s.
6. `npx tsc --noEmit` — 0 TypeScript compilation errors.
7. `python -m compileall backend/app -q` — 0 Python syntax errors.
8. `python scratch/check_all_parity.py` — Multi-database column parity confirmed across `smritisys`, `smriti001`, `smriti002`.

---

## 9. Verification Results
All four verification gates are satisfied with literal terminal proof:

```
================================================================================
 SMRITI ARCHITECTURE GOVERNANCE — CI / PRE-COMMIT GATE (HARDENED)
================================================================================
 Checks Executed:    11
 P0/P1 Violations:   0
 Registered Debt:    0
================================================================================
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
================================================================================
```

```
======================= 3 passed, 11 warnings in 38.18s =======================
app/tests/test_phase2_resolver_integration.py::test_quick_barcode_scan_tier0_identity_code_resolution PASSED
app/tests/test_phase2_resolver_integration.py::test_quick_barcode_scan_cache_hit_on_repeat_scans PASSED
app/tests/test_phase2_resolver_integration.py::test_billing_csv_catalog_lookup_via_identity_resolver PASSED
```

```
======================= 4 passed, 11 warnings in 41.06s =======================
app/tests/test_phase2_concurrency_hardening.py::test_concurrent_alias_registration_same_entity PASSED
app/tests/test_phase2_concurrency_hardening.py::test_alias_collision_protection PASSED
app/tests/test_phase2_concurrency_hardening.py::test_alias_case_insensitive_lookup_and_registration PASSED
app/tests/test_phase2_concurrency_hardening.py::test_schema_parity_rule12_items_table PASSED
```

```
======================= 3 passed, 11 warnings in 48.59s =======================
app/tests/test_phase2_canonical_writer_convergence.py::test_canonical_writer_happy_path_with_ledger_boundaries PASSED
app/tests/test_phase2_canonical_writer_convergence.py::test_canonical_writer_idempotency_replay PASSED
app/tests/test_phase2_canonical_writer_convergence.py::test_canonical_writer_insufficient_stock_atomic_rollback PASSED
```

```
================= 17 passed, 11 warnings in 181.25s (0:03:01) =================
17/17 POS Tests Green
```

---

## 10. Known Limitations
- Background queue workers executing offline sync for remote counters rely on network connectivity to flush into the transactional outbox.
- AI analytical capabilities under `backend/app/ai/` remain intentionally scaffolded per Rule 3 until real transaction volume accumulates in PostgreSQL.

---

## 11. Future Work
- Implementation of Phase 3: Omnichannel Event Propagation & Analytics Aggregation over transactional outbox events (`CanonicalSalesInvoicePostedEvent`).
- Periodic automated vacuuming and re-indexing of `smriti_identity_alias` under high-volume multi-store synchronization.

---

## 12. Related ADRs
- `ADR-IDENTITY-001` — SMRITI Unified Identity Control Plane & Numbering Engine.
- `ADR-IDENTITY-002` — Business Entity Identity Code Integration & Legacy Alias Migration.
- `ADR-IDENTITY-003` — Transactional Document Identity & High-Throughput Ledger Boundaries.
- `ADR-IDENTITY-004` — Master Identity Index & Universal Cross-Domain Entity Resolver.
- `ADR-SALES-002` — Sole Authoritative Canonical Sales Posting Authority.

---

## 13. Related RFCs
- `RFC-2026-08-01` — RFC 9562 UUIDv7 Implementation Specification for Retail Systems.
- `RFC-2026-09-02` — SMRITI Section 269ST Income Tax Compliance in POS Systems.
- `RFC-2026-09-12` — SMRITI Universal Identity Resolution and Alias Canonicalization Protocol.
