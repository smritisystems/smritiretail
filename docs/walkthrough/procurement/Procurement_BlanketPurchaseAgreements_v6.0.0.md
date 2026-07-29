<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Procurement — Blanket Purchase Agreements & Scheduled Delivery Releases
**Walkthrough Version:** v6.0.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (34/34 PASSED)

---

## 1. Purpose

Extends the SMRITI Retail OS enterprise procurement stack with **Blanket Purchase Agreement (BPA)** capabilities — long-term, pre-negotiated commercial commitments that allow scheduled delivery releases without re-negotiating individual purchase orders. This phase completes the strategic procurement lifecycle from vendor sourcing through to scheduled delivery fulfillment.

---

## 2. Scope

- New Alembic DB migration: `blanket_purchase_agreements` and `blanket_purchase_agreement_lines` tables; `bpa_id` and `bpa_release_no` columns on `purchase_orders`.
- New ORM models: `BlanketPurchaseAgreement` and `BlanketPurchaseAgreementLine`.
- New `BlanketReleaseEngine` — commitment ceiling enforcement, auto-exhaustion, sequential release numbering.
- New REST API router: `/api/v1/purchase/bpa` (create, list, get, release).
- Pydantic schemas: `BPACreate`, `BPAResponse`, `BPAReleaseRequest`, `BPAReleaseItemRequest`, `BPALineCreate`, `BPALineResponse`.
- 6 integration test assertions verifying the full BPA lifecycle.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v600_blanket_purchase_agreements.py` | Alembic DDL migration — 2 new tables + 2 new columns on purchase_orders |
| `backend/app/procurement/engine/blanket_release_engine.py` | BlanketReleaseEngine — release issuance, ceiling enforcement, auto-exhaustion |
| `backend/app/api/v1/procurement_bpa.py` | REST API gateway: POST create, GET list, GET by id, POST release |
| `backend/app/tests/test_blanket_agreement.py` | 6 integration test assertions for the full BPA lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/purchase.py` | +`BlanketPurchaseAgreement`, +`BlanketPurchaseAgreementLine` models; +`bpa_id`, `bpa_release_no` columns on `PurchaseOrder` |
| `backend/app/schemas/purchase.py` | +`BPACreate`, `BPAResponse`, `BPALineCreate`, `BPALineResponse`, `BPAReleaseRequest`, `BPAReleaseItemRequest` |
| `backend/app/main.py` | +`procurement_bpa` import; +`app.include_router(procurement_bpa.router, ...)` |

---

## 5. Architecture Decisions

### AD-01: BlanketPurchaseAgreement as Aggregate Root
`BlanketPurchaseAgreement` is the aggregate root owning `BlanketPurchaseAgreementLine` children via `cascade="all, delete-orphan"`. This keeps commercial commitment data cohesive and prevents orphaned line items.

### AD-02: BlanketReleaseEngine as Dedicated Domain Service
Release issuance is extracted into a standalone `BlanketReleaseEngine` rather than placed in a generic `PurchaseService`. This maintains single-responsibility separation and makes the ceiling enforcement logic independently testable and auditable.

### AD-03: Auto-Exhaustion Transition
The engine automatically transitions a BPA to `Exhausted` when ALL product lines reach `remaining_quantity <= 0` or the `remaining_value` ceiling is reached. No manual state management required by operators.

### AD-04: Release PO Order Number Uniqueness
Release PO `order_no` carries a UUID suffix (`PO-REL-{BPA_CODE}-R{N}-{UUID6}`) to guarantee global uniqueness even across concurrent test sessions or high-frequency release scheduling.

### AD-05: Value Ceiling as Independent Guard
Both the per-line `remaining_quantity` ceiling AND the aggregate `remaining_value` ceiling are validated independently — an over-quantity release and an over-value release are both caught separately.

---

## 6. Design Rationale

The BPA model follows the Blanket Order / Frame Agreement pattern established in mature ERPs (SAP ME21N, Oracle iProcurement). The SMRITI implementation:
- Avoids re-negotiation overhead for high-velocity repeat procurement.
- Maintains audit-traceable release lineage with sequential `bpa_release_no`.
- Enforces both quantity and value ceilings at the domain engine level — not just at the API layer.
- Keeps the aggregate lifecycle FSM simple: `Draft → Active → Exhausted | Expired | Cancelled`.

---

## 7. Implementation Summary

### Database Layer

```text
blanket_purchase_agreements
    id, bpa_code, title, supplier_id,
    valid_from, valid_to,
    max_commitment_value, released_value, remaining_value,
    status (Draft/Active/Exhausted/Expired/Cancelled)

blanket_purchase_agreement_lines
    bpa_id → blanket_purchase_agreements.id (CASCADE)
    product_id, agreed_unit_price,
    committed_quantity, released_quantity, remaining_quantity

purchase_orders (modified)
    +bpa_id → blanket_purchase_agreements.id (SET NULL)
    +bpa_release_no (Integer)
```

### Domain Engine Flow

```text
BlanketReleaseEngine.issue_bpa_release()
    │
    ├── Validate BPA status = Active
    ├── Validate validity period (valid_from ≤ now ≤ valid_to)
    ├── For each release item:
    │       ├── Verify product is committed on BPA
    │       ├── Check remaining_quantity ceiling
    │       ├── Deduct released_quantity / remaining_quantity on line
    │       └── Build PurchaseOrderItem
    ├── Check aggregate remaining_value ceiling
    ├── Deduct released_value / remaining_value on BPA
    ├── Auto-exhaust BPA if all lines fully consumed
    └── Create CONFIRMED PurchaseOrder linked via bpa_id + bpa_release_no
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/purchase/bpa` | Create new BPA |
| `GET` | `/api/v1/purchase/bpa` | List all BPAs for tenant |
| `GET` | `/api/v1/purchase/bpa/{bpa_id}` | Get BPA by ID |
| `POST` | `/api/v1/purchase/bpa/{bpa_id}/release` | Issue scheduled delivery release |

---

## 8. Tests Executed

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py -v
```

**Literal Output (summary):**
```
app/tests/test_blanket_agreement.py::test_create_bpa_with_committed_lines PASSED [ 85%]
app/tests/test_blanket_agreement.py::test_bpa_release_creates_purchase_order PASSED [ 88%]
app/tests/test_blanket_agreement.py::test_bpa_remaining_quantities_decrease_after_release PASSED [ 91%]
app/tests/test_blanket_agreement.py::test_bpa_release_exceeding_line_ceiling_is_rejected PASSED [ 94%]
app/tests/test_blanket_agreement.py::test_sequential_releases_increment_release_number PASSED [ 97%]
app/tests/test_blanket_agreement.py::test_bpa_auto_exhausts_when_fully_released PASSED [100%]
====================== 34 passed, 150 warnings in 10.60s ======================
```

---

## 9. Verification Results

| # | Assertion | Result |
|---|-----------|--------|
| 1 | BPA created with Active status and correct commitment ceilings | **PASSED** |
| 2 | Scheduled delivery release PO created with correct bpa_release_no=1 and subtotal | **PASSED** |
| 3 | BPA remaining_value and line remaining_quantity decrease after release | **PASSED** |
| 4 | Over-commitment release rejected with HTTP 400 | **PASSED** |
| 5 | Sequential release POs carry bpa_release_no 1, 2, 3 | **PASSED** |
| 6 | BPA auto-transitions to 'Exhausted' when all lines fully consumed | **PASSED** |

**Overall: 34/34 across complete procurement stack (Phases 1–5)**

**Verification Status: Done**

---

## 10. Known Limitations

- BPA validity period expiry (`Expired` transition) is not yet automated — requires a scheduled background job or manual operator trigger. Currently the engine validates the validity window on release but does not auto-flip status to `Expired`.
- Multi-product BPA value ceiling validation is aggregate only — individual product value sub-limits are not yet supported.
- BPA amendment / re-negotiation (increase/decrease committed quantities mid-agreement) requires a version control pattern not yet implemented.

---

## 11. Future Work

- Background scheduler: auto-expire BPAs when `valid_to` passes.
- BPA Amendment Engine: version-controlled quantity/price revisions mid-agreement.
- Partial BPA Cancellation: cancel individual line commitments without closing the whole agreement.
- BPA Report: commitment utilization report per supplier and per product.
- UI: BPA dashboard with release calendar and remaining commitment visualization.

---

## 12. Related ADRs

- ADR-PROC-001: FastAPI + Postgres as system of record (SMRITI Backend System-of-Record Policy)
- ADR-PROC-002: Engine-per-capability pattern (BlanketReleaseEngine, ThreeWayMatchingEngine, BlanketReleaseEngine)

---

## 13. Related RFCs

- Phase 1 (v5.6.0): Procurement_ProductVendor_Catalog_v5.6.0.md
- Phase 2 (v5.7.0): Procurement_VendorContract_And_PO_Sourcing_v5.7.0.md
- Phase 3 (v5.8.0): Procurement_LandedCost_ThreeWayMatching_v5.8.0.md
- Phase 4 (v5.9.0): Procurement_RFQ_Quotation_Comparison_v5.9.0.md
