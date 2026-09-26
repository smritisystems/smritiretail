<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Classification: Architecture Decision Record — DRAFT (NOT COMMITTED TO DB)
Created      : 2026-09-03
-->

# ADR-PURCHASE-001-DRAFT: Three-Way Matching — Product Decision Required

**Status:** DRAFT — `ARCHITECTURE_DECISION_REQUIRED` — not inserted into `smritisys.architecture_decisions` until approved  
**Domain:** `purchase`  
**Date:** 2026-09-03  
**Author:** Jawahar Ramkripal Mallah  

---

## Context

The original governance seed registered `purchase.three_way_match` with `canonical_api = /api/v1/purchase/match`. That endpoint **does not exist** in the backend — it was a fictional API claim.

There are two distinct scenarios in the purchase domain:

### Scenario A: Local PO Approval & Match Workflow (FUNCTIONING TODAY)

**Component:** `POApprovalMatchModal.tsx` / `ThreeWayMatchingModal.tsx`  
**Engine:** `threeWayMatchEngine.ts` (local TypeScript engine)  
**Capability:** `purchase.po_approval_workflow`  
**Status:** ACTIVE — functioning without backend dependency  

The local engine performs:
- Status transitions: `DRAFT → PENDING_APPROVAL → APPROVED → SENT → INVOICED → THREE_WAY_MATCHED → CLOSED / DISPUTED`
- GM-PURCHASE approval authority enforcement
- Local variance matching (PO qty vs GRN qty vs invoice amount)
- Dispute settlement and PO closure

### Scenario B: Backend 3-Way Matching Commit (NOT IMPLEMENTED)

**Would-be endpoint:** `POST /api/v1/purchase/3way-matching/commit`  
**Status:** BLOCKED — endpoint does not exist  
**Capability:** `purchase.three_way_match`  
**Status:** BLOCKED  

This would be the authoritative backend transaction that:
1. Locks PO and GRN records (SELECT FOR UPDATE)
2. Validates variance tolerances in Postgres
3. Creates a matched record in a `po_three_way_matches` table
4. Updates PO status atomically
5. Triggers GST ITC eligibility signals

## Product Decision Required

Before `purchase.three_way_match` can be activated:

**Decision 1:** Is local three-way matching via `threeWayMatchEngine.ts` sufficient for the business? If YES → the `BLOCKED` capability remains an aspirational placeholder and the `ACTIVE` `purchase.po_approval_workflow` is the production path.

**Decision 2:** If backend three-way matching IS required — what does the `po_three_way_matches` table look like? What tolerance rules apply (qty variance %, value variance %)? Does it integrate with GST ITC automation?

**Decision 3:** Who owns the backend endpoint? Is it a new route in `purchase.py` or a new router `three_way_match.py`?

## Current Registry State

| Capability | Status | integration_type | backend_api_status |
|---|---|---|---|
| `purchase.po_approval_workflow` | `ACTIVE` | `LOCAL_ENGINE` | `NONE` |
| `purchase.three_way_match` | `BLOCKED` | `BACKEND_BLOCKED` | `UNIMPLEMENTED` |

## Consequences

- The functioning local workflow (`purchase.po_approval_workflow`) is now correctly registered as `ACTIVE` — it was invisible in the prior registry.
- `purchase.three_way_match` is correctly classified as `BLOCKED` — it is not a functioning capability.
- No backend code is created by this ADR. A product decision is required first.

## Related ADRs

- ADR-WMS-001 (entity model pattern)
