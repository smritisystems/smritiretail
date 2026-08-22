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
| Warehouse and Distribution | Partial | WMS capabilities exist; complete distribution lifecycle verification remains. |
| eCommerce | Partial | Capability and operational flows exist; full shared-engine reuse is not yet verified. |
| Pricing, Promotions, GST, Payments | Partial | Implementations exist; cross-capability version governance is pending. |
| Documents and numbering | Partial | Document and numbering functionality exists; historical version binding is pending. |
| Accounting and authoritative ledgers | Partial | Accounting models exist; complete posting and reproducibility guarantees are not yet verified. |
| PSV | Partial | PSV models and flows exist; ownership must remain explicitly separate from stock truth. |
| CGE / loyalty | Partial | Loyalty, promotion, commission, and referral components exist; unified CGE governance is pending. |
| PDT | Pending | Predictive distribution twin and demand forecasting are not implemented as a verified plane. |
| Capability and template registry | Pending | Blueprint registries are not yet implemented as a complete control-plane subsystem. |
| Formula, rule, policy, workflow engines | Partial | Related logic exists in modules; centralized versioned registries and execution contracts are pending. |
| Offline-first operation | Partial | Offline queue models exist; conflict resolution and end-to-end sync guarantees are pending. |
| Event/outbox processing | Partial | Outbox models exist; consumers, retries, dead-letter handling, and observability are pending. |
| Analytics/Intelligence Plane | Pending | Separate scalable analytical storage and workload isolation are not yet verified. |
| Audit and compliance | Partial | Audit/compliance foundations exist; complete coverage across all financial and regulatory operations is pending. |

## Milestone 1: Routing Boundary

**Status: Partially Verified, hardened and baseline established.**

Verified in the focused suite (63/63 passing tests):

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
- 73 multi-module tests passing.

### Slice 4: Pricing, GST, Payments, and Document Engine Unification (Verified)
- 4-level hierarchical pricing resolution (`PriceBook` + `CustomerPriceTier` + volume breaks), gapless row-locked `DocumentSeries` sequence allocation with `NumberingAuditLog`, and idempotent multi-tender `PaymentTransaction` settlement verified.
- 77 multi-module tests passing.

### Slice 5: Approval, Workflow, and Communicator Engines (Verified)
- Multi-tier document approval hierarchy (`ApprovalPolicy`, `ApprovalRequest`, `ApprovalAction`) and unified communicator template dispatch audit ledgers (`CommunicatorTemplate`, `CommunicatorLog`) verified.
- 81 multi-module tests passing.

## Next Approved Slice: Slice 6 (Capability, Template, and Workspace Resolution)

**Scope**:
- Business industry capabilities resolution in control plane (`smritisys`).
- Business workspace templates (Retail, Supermarket, Wholesale, Apparel, Pharmacy, Restaurant).
- User and role workspace policy binding.

Out of scope for Slice 6: PDT, Analytics plane, microservices decomposition, full metadata-driven UI generation.

## Governance Rule

Do not mark the frozen blueprint as implemented because individual modules or tests pass. Update this tracker when implementation evidence changes, and update an individual historical document only when its current status or guidance would otherwise mislead readers.
