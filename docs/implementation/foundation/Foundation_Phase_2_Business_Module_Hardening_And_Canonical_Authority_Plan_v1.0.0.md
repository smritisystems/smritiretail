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

  * Version    : 6.39.0
  * Created    : 2026-09-18
  * Modified   : 2026-09-18
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal Core Architecture
-->

# Implementation Plan: Phase 2 — Business Module Hardening & Canonical Authority Convergence

**Plan Version:** v1.0.0  
**Status:** Completed — Fully Verified, Hardened & Frozen  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Classification:** Core Business Architecture  

---

## 1. Objective
Following the formal freeze of the complete SMRITI Unified Identity architecture (Phase 1.0 through Phase 1.4), the objective of **Phase 2** is to harden the core business application modules (POS, Billing, Inventory, Sales, Procurement, and CRM) on top of the unified identity and resolution foundation.

This encompasses four core pillars:
1. **Universal Resolution Ingestion:** Migrate all ad-hoc barcode, SKU, party code, and document lookups across POS and Billing to the high-performance `IdentityResolver` (utilizing the sub-millisecond in-memory cache and grouped batch resolution).
2. **Canonical Financial Write Authority Convergence:** Unify disparate invoice, stock movement, and payment writers into a single authoritative transaction engine (`CanonicalSalesPostingWriter` and `sales_ledger_svc.py`), eliminating divergent stock decrement semantics.
3. **Database Concurrency & Webhook Hardening:** Deploy true atomic `INSERT ... ON CONFLICT (company_id, LOWER(alias_code)) DO NOTHING` upserts for external partner identifiers and stress-test numbering sequence allocation under concurrent POS multi-counter loads.
4. **Elimination of Registered Architectural Legacy Debt:** Resolve all 5 baseline historical debts registered in `scripts/architecture_duplication_gate.py` (merging `hr`/`hrm` parallel directories, consolidating the 4 duplicate modal pairs into unified canonical workspaces, and cleanly mounting/retiring `barcodes.py`).

---

## 2. Business Motivation
In high-volume omnichannel retail operations (e.g. Reliance Retail dispatches, multi-terminal supermarket POS billing, and distributor wholesale invoicing), system responsiveness, inventory accuracy, and financial consistency are paramount:
- **Zero Latency Cart Ingestion:** Barcode scans, customer loyalty lookups, and invoice recalls must execute in sub-millisecond time. Utilizing `IdentityResolver.resolve_batch()` and `IdentityResolutionCache` eliminates redundant sequential database round-trips.
- **Stock Movement Integrity:** If POS checkout, B2B invoicing, and e-commerce order fulfillment compute inventory deductions using different algorithms or uncoordinated database triggers, stock drift occurs. Establishing a single canonical sales posting writer guarantees that every confirmed invoice creates exactly one authoritative stock ledger entry per inventory item.
- **Webhook Resilience:** As external payment gateways (Razorpay, Pine Labs, UPI) push asynchronous settlement webhooks simultaneously, atomic idempotency guarantees that duplicate callbacks cannot corrupt ledger balances or throw 500 errors.
- **Maintainability & Governance:** Retaining parallel directories and duplicate modals creates confusion for developers and increases bundle size. Consolidating them into single-source-of-truth workspaces enforces the SMRITI Single Workspace Principle.

---

## 3. Scope

### Sub-Phase 2.1: Business Module Resolver & Master Index Integration
- Rewire POS item scanning (`ProPosBillingTerm.tsx`, `BillingTerm.tsx`, `pos.py`) to resolve barcodes and SKUs through `IdentityResolver.resolve()`.
- Rewire Barcode CSV Import (`BarcodeCSVImportModal.tsx`, `billing_csv.py`) to utilize `IdentityResolver.resolve_batch()` for single-round-trip bulk catalog matching.
- Connect customer, supplier, and party lookups to Tier 1 (`CRM-CUS`, `PUR-SUP`, `MST-PRT`) and Tier 2 (GSTIN, PAN) resolution.
- Enhance Universal Browse (`UniversalBrowseEngine.tsx`, `f2LookupRegistry.ts`) with omnichannel search powered by `/api/v1/identity/search`.

### Sub-Phase 2.2: Canonical Sales & Billing Authority Convergence
- Characterize and harmonize the POS checkout call graph (`POST /api/v1/pos/checkout`) with `CanonicalSalesPostingWriter`.
- Preserve essential POS-specific invariants:
  1. Shift pessimistically locked and verified `OPEN`.
  2. Cashier staff attribution recorded per line.
  3. Denomination tracking and mid-shift cash transaction integrity.
  4. Multi-tender payment capture via `PaymentsEngine`.
  5. Atomicity: failure rolls back invoice, stock movement, outbox event, and shift updates together.
- Standardize invoice idempotency caching to prevent duplicate bill numbers during network retries.

### Sub-Phase 2.3: Concurrency Hardening & High-Throughput Webhook Protection
- Implement native PostgreSQL `INSERT ... ON CONFLICT (company_id, LOWER(alias_code)) DO NOTHING` / `DO UPDATE` for `smriti_identity_alias`.
- Execute a 100-worker concurrent benchmark testing simultaneous POS checkout invoice generation and numbering allocation.
- Harden the transactional outbox worker against duplicate delivery.

### Sub-Phase 2.4: Architectural Legacy Debt Retirement
- **Debt Item 1:** Consolidate parallel frontend directories `src/components/hr` and `src/components/hrm` into the canonical `src/components/hr` module.
- **Debt Item 2:** Consolidate duplicate modal pairs:
  - `WavePickingStudioModal.tsx` and `WarehouseWavePickingModal.tsx` -> Unified `WarehouseWavePickingStudioModal.tsx`.
  - `CommissionStudioModal.tsx` and `ShiftCommissionStudioModal.tsx` -> Unified `ShiftCommissionStudioModal.tsx`.
  - `InterBranchTransferModal.tsx` and `StockTransferStudioModal.tsx` -> Unified `StockTransferStudioModal.tsx`.
  - `ThreeWayMatchingModal.tsx` and `POApprovalMatchModal.tsx` -> Unified `POThreeWayMatchingModal.tsx`.
- **Debt Item 3:** Address unmounted router `backend/app/api/v1/barcodes.py`: Mount under canonical barcode authority or cleanly merge into `products.py`.

---

## 4. Current State

### A. Current Lookup Paths
- POS billing (`ProPosBillingTerm.tsx`) calls `/api/v1/pos/products` or `/api/v1/products/barcode/{code}` directly.
- CSV Ingestion (`billing_csv.py`) executes raw queries on `products` and `secondary_barcodes` with fallback loops.
- Party lookup executes raw queries against `parties` or `customers` without leveraging the 934 external aliases already indexed in `smriti_identity_alias`.

### B. Current Financial Writers
- `CanonicalSalesPostingWriter` is fully implemented and passes all Gate 11C contracts, allocating governed identities via `IdentityEngine.allocate_internal()`.
- However, legacy routes (`sales.py:create_sales_invoice` and direct manual adjustments) still contain legacy stock deduction logic that should be formally decommissioned.

### C. Architecture Gate Status
- Gate checks: 11/11 Passed.
- P0/P1 Violations: 0.
- Registered Debt: 5 items (all explicitly frozen pending Phase 2).

---

## 5. Gap Analysis

| Dimension | Current State | Target State (Phase 2) | Architectural Delta |
| :--- | :--- | :--- | :--- |
| **Barcode / SKU Resolution** | Ad-hoc queries to `products` & `secondary_barcodes` | Centralized `IdentityResolver.resolve()` & `resolve_batch()` | Cache hits (<0.05ms), polymorphic alias fallback (EAN, UPC, Supplier SKU) |
| **Bulk CSV Catalog Resolution** | $O(N)$ database round-trips per CSV row | Single $O(1)$ batch round-trip via `IdentityEngine.resolve_batch()` | 85%+ latency reduction on large dispatch CSVs |
| **Sales Invoicing Authority** | Dual write paths (POS vs Standard Sales) | 100% convergence through `CanonicalSalesPostingWriter` | Single transaction boundary, zero stock drift, unified outbox events |
| **External Alias Concurrency** | Application-level check + DB constraint | Atomic PostgreSQL `INSERT ... ON CONFLICT` | Race-free concurrent webhook ingestion |
| **Frontend Architecture Debt** | Parallel `hr`/`hrm` folders; 4 duplicate modal pairs | Unified `hr`; 4 canonical modals; 0 gate debt | Elimination of all 5 registered historical debts |

---

## 6. Architecture Impact
```text
                     ┌───────────────────────────┐
                     │ CLIENT APPLICATION LAYER  │
                     │  (POS, Billing, WMS, F2)  │
                     └─────────────┬─────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [READ / RESOLUTION PATH]                  [WRITE / POSTING PATH]
  IdentityResolver.resolve()              CanonicalSalesPostingWriter
  IdentityResolver.resolve_batch()                      │
  searchMasterIdentity() (F2)              ┌────────────┼────────────┐
              │                            ▼            ▼            ▼
              ▼                     IdentityEngine   StockLedger   Payments
  IdentityResolutionCache              UUIDv7 +       FEFO Batch    Engine
    (Sub-millisecond)                 SAL-INV-*        Movement     (UUIDv7)
              │                            │            │            │
              └────────────────────────────┼────────────┴────────────┘
                                           ▼
                                 POSTGRESQL TENANT DB
                                (Atomic Single Commit)
```

---

## 7. Proposed Phased Design

### Slice 1: Resolver Migration (POS & CSV)
- Integrate `IdentityResolver.resolve()` into backend product lookup endpoints.
- Update `billing_csv.py` to use `IdentityEngine.resolve_batch()`.
- Add integration tests verifying identical resolution outputs and cache hits.

### Slice 2: Sales Posting Writer Convergence
- Audit `SalesService.create_sales_invoice` and ensure full delegation to `CanonicalSalesPostingWriter`.
- Verify shift locking, cashier attribution, and outbox event publishing in POS checkout.
- Verify exact stock movement creation (1 movement per inventory line).

### Slice 3: Concurrency Hardening
- Alembic migration adding PostgreSQL functional unique index and native upsert statement for `smriti_identity_alias`.
- Execute multi-worker stress test verifying zero deadlocks and zero duplicate identity codes.

### Slice 4: Debt Retirement & Gate Cleanliness
- Merge `src/components/hrm` into `src/components/hr`.
- Unify the 4 modal pairs into canonical studio modals.
- Update `scripts/architecture_duplication_gate.py` to assert 0 registered debts remaining.

---

## 8. Files Created (Projected)
- `backend/alembic/versions/v1469_phase2_alias_atomic_upsert_and_hardening.py`
- `backend/app/tests/test_phase2_resolver_integration.py`
- `backend/app/tests/test_phase2_canonical_writer_convergence.py`
- `scripts/verify_phase2_hardening.py`
- `docs/walkthrough/foundation/Foundation_Phase_2_Business_Module_Hardening_v1.0.0.md`

---

## 9. Files Modified (Projected)
- `backend/app/services/pos.py`
- `backend/app/services/sales.py`
- `backend/app/api/v1/billing_csv.py`
- `backend/app/services/identity/engine.py`
- `backend/app/services/canonical_sales_writer.py`
- `src/components/billing/propos/ProPosBillingTerm.tsx`
- `src/components/billing/BarcodeCSVImportModal.tsx`
- `scripts/architecture_duplication_gate.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- Fully relies on the frozen **Phase 1.0 – Phase 1.4 Unified Identity Architecture**.
- No modification permitted to Phase 1.0–1.4 schemas or APIs (they remain immutable contracts).

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **POS Checkout Latency Amplification** | Slower cashier checkout during peak hours | Pessimistic locking kept minimal; in-memory cache resolves items in <0.05ms; single database transaction commit. |
| **Stock Movement Drift during Migration** | Physical inventory mismatch | Dual-read comparison during characterization test runs before retiring legacy stock logic. |
| **Frontend Modal Import Breakages** | Compilation failures on modal consolidation | Run `npx tsc --noEmit` and Vite build validation continuously during component merges. |

---

## 12. Rollback Strategy
- Every database change is wrapped in standard Alembic upgrade/downgrade routines.
- Business module migrations are executed in backward-compatible slices.
- If any regression occurs, caller services can revert to existing compatibility adapters without data loss.

---

## 13. Verification Plan
- **Pre-flight Gate:** Architecture Duplication Gate must pass with 0 P0/P1 violations.
- **Type Checking:** TypeScript compiler (`npx tsc --noEmit`) must exit with code 0.
- **Python Compilation:** `python -m py_compile` must exit with code 0 across all modified services.
- **Multi-Database Parity:** Rule 12 column-by-column and constraint diff verified across all 3 databases (`smritisys`, `smriti001`, `smriti002`).
- **Automated Regression:** All existing 34/34 Phase 1 identity tests + new Phase 2 test suites must pass 100% green.

---

## 14. Test Plan
1. `test_phase2_resolver_integration.py`: Test barcode, SKU, and CSV batch resolution via `IdentityResolver`.
2. `test_phase2_canonical_writer_convergence.py`: Test POS checkout, stock movement creation, and cashier attribution through `CanonicalSalesPostingWriter`.
3. `test_phase2_concurrency_stress.py`: Concurrently simulate 100 POS transactions and webhook alias registrations.
4. `test_phase2_debt_elimination.py`: Validate elimination of all registered duplicate modal pairs and parallel directories.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create formal walkthrough `docs/walkthrough/foundation/Foundation_Phase_2_Business_Module_Hardening_v1.0.0.md` upon completion.
- Update `CHANGELOG.md` with version `6.39.0`.
- Update User Guide and Developer Guide as applicable.

---

## 16. Deployment Plan
1. Stage in Development environment (`D:\Smriti_Retail_OS`).
2. Run full test suite and multi-database parity verification.
3. Commit and push from development.
4. Pull into Test environment (`F:\Smriti9`) per Environment Rule.

---

## 17. Status
**Completed — All 4 Slices Implemented, Verified with 100% Passing Tests, Multi-Database Parity, and 0 Architectural Debt.**

---

## 18. Related ADRs
- `ADR-001: Separation of Technical Primary Keys and Governed Identity Codes`
- `ADR-005: One-Way Projections and Statutory Snapshot Immutability`
- `ADR-008: SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture`
- `ADR-015: SMRITI Unified Identity Control Plane & Numbering Engine`

---

## 19. Related Walkthroughs
- `Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md`
- `Foundation_Unified_Identity_Phase_1_1_Business_Entity_Integration_v1.0.0.md`
- `Foundation_Unified_Identity_Phase_1_2_Transactional_Identity_v1.0.0.md`
- `Foundation_Unified_Identity_Phase_1_3_External_And_Partner_Identity_v1.0.0.md`
- `Foundation_Unified_Identity_Phase_1_4_Master_Identity_Index_And_Resolver_v1.0.0.md`
- `Foundation_Phase_2_Business_Module_Hardening_v1.0.0.md`
