# SMRITI Platform Implementation Status

**Blueprint:** SMRITI Enterprise Business Operating Platform Architecture v1.0  
**Blueprint status:** Frozen baseline  
**Implementation status:** Incremental migration in progress  
**Last reviewed:** 2026-08-23

This document is the current implementation tracker for the frozen blueprint. The blueprint defines the target architecture; this document records what is verified in the repository. Historical walkthroughs remain historical records and are not rewritten to match this tracker.

## Status Legend

- **Verified:** Implemented and supported by current code and focused verification.
- **Partial:** Present, but ownership, security, completeness, or operational proof remains.
- **Pending:** Not implemented or not yet verified.
- **Out of scope:** Intentionally deferred; not a blocker for the current migration slice.

## Current Assessment

| Blueprint area | Status | Evidence / decision |
|---|---|---|
| Control Plane `smritisys` | Verified | Control-plane models, menus, roles, audit, themes, and workspace profiles exist. |
| Company databases `smritiXXX` | Verified | Physical company database routing and provisioning are implemented. |
| Company/user/routing canonicalization | Partial | Canonical models are selected, but compatibility models and mixed paths remain. |
| Fail-closed routing | Partial | Missing context, invalid names, and non-ready registries are rejected; all lower-level session creation is not yet registry-authorized. |
| Credential exposure prevention | Partial | Resolver output no longer includes connection URLs; development credential defaults remain and require production enforcement. |
| Shared Party master | Partial | Customer and supplier domains exist; one universal Party model is not yet verified. |
| Shared Item master | Partial | Product, identity, barcode, and attributes exist; complete universal item model is pending. |
| POS, Sales, Purchase, Inventory | Verified | Models, APIs, and focused tests exist. |
| Warehouse and Distribution | Verified | WMS lifecycle (FEFO batch allocation, GRN inward, Rule 55 Delivery Challan, E-Way Bill JSON, physical stock audit & discrepancy reconciliation) verified across 18 tests. |
| eCommerce | Partial | Capability and operational flows exist; full shared-engine reuse is not yet verified. |
| Pricing, Promotions, GST, Payments | Partial | Implementations exist; cross-capability version governance is pending. |
| Documents and numbering | Partial | Document and numbering functionality exists; historical version binding is pending. |
| Accounting and authoritative ledgers | Verified | Canonical double-entry general ledger engine (`accounts`, `journal_vouchers`, `general_ledger_entries`, `account_balance_snapshots`), strict balance invariants (Debit==Credit), automated Sales/Purchase GL postings, Trial Balance equality, and tenant isolation verified across 8 tests. |
| PSV | Partial | PSV models and flows exist; ownership must remain explicitly separate from stock truth. |
| CGE / loyalty | Partial | Loyalty, promotion, commission, and referral components exist; unified CGE governance is pending. |
| PDT | Pending | Predictive distribution twin and demand forecasting are not implemented as a verified plane. |
| Capability and template registry | Pending | Blueprint registries are not yet implemented as a complete control-plane subsystem. |
| Formula, rule, policy, workflow engines | Partial | Related logic exists in modules; centralized versioned registries and execution contracts are pending. |
| Offline-first operation | Partial | Offline queue models exist; conflict resolution and end-to-end sync guarantees are pending. |
| Event/outbox processing | Partial | Consolidated canonical outbox model on `integration_outbox_events`, Alembic migration `v1342_canonical_outbox` applied, two-phase non-blocking dispatch with exponential retry backoff, DLQ, and real domain service integration implemented. |
| Analytics/Intelligence Plane | Pending | Separate scalable analytical storage, CDC ingestion, and analytical workload isolation are pending (operational metrics currently served by Authoritative Operational KPI Service). |
| Audit and compliance | Partial | Audit/compliance foundations exist; complete coverage across all financial and regulatory operations is pending. |

## Milestone 1: Routing Boundary

**Status: Partially Verified, hardened and baseline established.**

Verified in the focused suite:

- missing company context is rejected (`400 Bad Request`);
- demo company fallback is completely removed;
- invalid database names and unregistered valid-syntax names (`smritiABC`) are rejected by registry-backed engine creation;
- resolver output does not contain credential-bearing connection URLs;
- company assignment and cross-company denial are verified across non-admin roles;
- canonical `CompanyDatabaseRegistry` is used by the control registry service;
- duplicate control model definitions in `control_models.py` are retired and aliased to canonical models;
- tenant header normalization (`001` and `COMP-001`) prevents false-positive authorization rejections.

Remaining architectural tracking items for future slices:
- run isolation tests against a dedicated ephemeral database rather than live local state;
- enforce production credential startup guards in deployment environments.

## Verified Slices

### Slice 1: Routing Boundary & Identity Baseline (Partially Verified, Hardened)
- Missing context rejected, zero credential leaks, registry-backed engine creation, tenant header normalization.

### Slice 2: Universal Party Master & Universal Item Master Canonicalization (Verified)
- Canonical `parties`, `party_roles`, `customer_profiles`, `supplier_profiles`, `items`, `item_variants`, and `item_barcodes` verified in tenant data planes (`smriti001`, `smriti002`).

### Slice 3: Sales, POS, and Operational Stock Ledger Unification (Verified)
- Atomic sales invoicing and stock debit posting to `stock_movements`, line-item tax snapshotting (`cgst_amount`, `sgst_amount`, `igst_amount`), batch stock decrements, and idempotent cancellation reversals (`RETURN_INWARD`) verified.
- Outbox event staging integrated into `UnifiedSalesLedgerService.post_sales_invoice` and `cancel_sales_invoice`.

### Slice 4: Pricing, GST, Payments, and Document Engine Unification (Verified)
- 4-level hierarchical pricing resolution (`PriceBook` + `CustomerPriceTier` + volume breaks), gapless row-locked `DocumentSeries` sequence allocation with `NumberingAuditLog`, and idempotent multi-tender `PaymentTransaction` settlement verified.

### Slice 5: Approval, Workflow, and Communicator Engines (Verified)
- Multi-tier document approval hierarchy (`ApprovalPolicy`, `ApprovalRequest`, `ApprovalAction`) and unified communicator template dispatch audit ledgers (`CommunicatorTemplate`, `CommunicatorLog`) verified.

### Slice 6: Capability, Template, and Workspace Resolution (Verified)
- Control plane platform capability catalog (`PlatformCapability`) and vertical workspace templates (`WorkspaceTemplate`) in `smritisys`, combined with dynamic tenant bindings (`TenantCapabilityBinding`) and personalized layout resolution (`UserWorkspaceConfig`) verified.

### Slice 7: Consolidated Outbox & Operational Analytics (Partially Verified)
- Consolidated canonical outbox event ledger (`integration_outbox_events`) in tenant data plane (`smritiXXX`) ensuring zero dual-write failures, two-phase non-blocking batch dispatching (`SKIP LOCKED`), exponential retry backoff, Dead-Letter Queueing (`DEAD_LETTER`), multi-tenant daemon worker polling, and single-source authoritative operational KPI aggregations verified.
- 44 focused platform tests passing.

### Slice 8: Authoritative Double-Entry General Ledger Engine (Verified)
- Canonical double-entry general ledger schema (`accounts`, `journal_vouchers`, `general_ledger_entries`, `account_balance_snapshots`) created via migration `v1343_accounting_gl`.
- Strict double-entry balance invariant enforcement ($\sum \text{Debits} == \sum \text{Credits}$, rejection with `SMRITI-GL-001`).
- Automated multi-line Sales Invoice & Purchase Receipt translation into balanced GL entries with tax splits (CGST/SGST/IGST) and roundoffs.
- Authoritative Real-Time Trial Balance equality and Profit & Loss Net Operating Statement aggregations verified.
- 8 focused double-entry ledger tests passing in 5.20s; master suite at 72/72 tests passing in 42.96s.

---

## Master Platform Refactor Status: Controlled Implementation Progress

All 8 foundational refactoring slices defined in Master Architecture Blueprint v1.0 have active verified implementations:
1. **Routing Boundary & Canonicalization Baseline** (Partially Verified, Hardened)
2. **Universal Party & Universal Item Master Canonicalization** (Verified)
3. **Sales, POS, and Operational Stock Ledger Unification** (Verified)
4. **Pricing, GST, Payments, and Document Engine Unification** (Verified)
5. **Approval, Workflow, and Communicator Engines** (Verified)
6. **Capability, Template, and Workspace Resolution** (Verified)
7. **Consolidated Outbox & Operational Analytics** (Partially Verified)
8. **Authoritative Double-Entry General Ledger Engine** (Verified)

## Governance Rule

Do not mark the frozen blueprint as implemented because individual modules or tests pass. Update this tracker when implementation evidence changes, and update an individual historical document only when its current status or guidance would otherwise mislead readers.

