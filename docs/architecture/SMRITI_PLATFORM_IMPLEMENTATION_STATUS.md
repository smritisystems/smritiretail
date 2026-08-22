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

## Next Approved Slice: Slice 2 (Universal Party & Universal Item Foundations)

**Scope**:
- Universal Party model (`parties`) with role/profile extensions (`customer_profiles`, `supplier_profiles`, `party_roles`) in tenant data planes (`smritiXXX`).
- Universal Item model (`items`/`products`) with variant, barcode, and batch tracking foundations in tenant data planes (`smritiXXX`).
- Backward-compatible adapters ensuring existing POS, Billing, Procurement, and WMS modules operate without regression.
- Strict preservation of `stock_movements` as the sole authoritative stock ledger.

Out of scope for Slice 2: PDT, Analytics plane, microservices decomposition, full metadata-driven UI generation, industry templates.

## Governance Rule

Do not mark the frozen blueprint as implemented because individual modules or tests pass. Update this tracker when implementation evidence changes, and update an individual historical document only when its current status or guidance would otherwise mislead readers.
