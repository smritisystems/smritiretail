<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Procurement — Purchase Requisition & Multi-Level Approval Workflow
**Walkthrough Version:** v6.1.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (40/40 PASSED)

---

## 1. Purpose

Completes the internal demand front-end of the SMRITI Retail OS enterprise procurement cycle. Introduces the **Purchase Requisition** aggregate root and **ApprovalChainEngine**, enabling internal department personnel to create purchase requests, submit them through data-driven multi-level approval chains, and convert approved requisitions into downstream procurement documents (Direct Purchase Orders, Requests for Quotation, or Blanket Agreement Releases).

---

## 2. Scope

- New Alembic DDL migration: `purchase_requisitions`, `purchase_requisition_lines`, `requisition_approvals`, and `requisition_approval_policies` tables.
- New ORM models: `PurchaseRequisition`, `PurchaseRequisitionLine`, `RequisitionApproval`, and `RequisitionApprovalPolicy`.
- New `ApprovalChainEngine` — threshold-based routing, auto-approval for low-value requests, multi-stage approval management.
- New `RequisitionConversionEngine` — strategy-based conversion (`DIRECT_PO`, `RFQ`, `BPA_RELEASE`).
- New REST API router: `/api/v1/purchase/requisitions` (create, list, get, submit, approve, convert, policies).
- Pydantic schemas: `RequisitionCreate`, `RequisitionResponse`, `ApprovalDecisionRequest`, `RequisitionConvertRequest`, `ApprovalPolicyCreate`, `ApprovalPolicyResponse`.
- 6 integration test assertions verifying requisition creation, auto-approval, multi-stage approval, rejection, and strategy conversion.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v610_purchase_requisitions.py` | Alembic DDL migration — 4 new tables |
| `backend/app/procurement/engine/approval_chain_engine.py` | ApprovalChainEngine — threshold evaluation, approval routing, FSM transitions |
| `backend/app/procurement/engine/requisition_conversion_engine.py` | RequisitionConversionEngine — PO, RFQ, BPA Release conversions |
| `backend/app/api/v1/procurement_requisition.py` | REST API gateway: create, submit, approve, convert, policies |
| `backend/app/tests/test_purchase_requisition.py` | 6 integration test assertions for full requisition lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/purchase.py` | +`PurchaseRequisition`, +`PurchaseRequisitionLine`, +`RequisitionApproval`, +`RequisitionApprovalPolicy` models |
| `backend/app/schemas/purchase.py` | +`RequisitionCreate`, `RequisitionResponse`, `ApprovalDecisionRequest`, `RequisitionConvertRequest`, `ApprovalPolicyCreate`, `ApprovalPolicyResponse` DTOs |
| `backend/app/main.py` | +`procurement_requisition` import; +`app.include_router(procurement_requisition.router, ...)` |

---

## 5. Architecture Decisions

### AD-01: PurchaseRequisition as Bounded Context Aggregate Root
`PurchaseRequisition` acts as the aggregate root managing line items (`PurchaseRequisitionLine`) and immutable approval history (`RequisitionApproval`). All line-level estimated totals and approval stage transitions flow through the root.

### AD-02: Decoupled Approval & Conversion Engines
- `ApprovalChainEngine`: Responsible solely for threshold policy evaluation, approval chain creation, and FSM approval transitions (`Draft → Submitted → UnderApproval → Approved / Rejected`).
- `RequisitionConversionEngine`: Responsible solely for downstream strategy conversion (`Approved → Converted`).

### AD-03: Data-Driven Approval Policies with Default Fallbacks
If custom `RequisitionApprovalPolicy` records exist in DB for the tenant, `ApprovalChainEngine` uses them. If none exist, the engine falls back to standard enterprise threshold tiers:
- `≤ ₹10,000`: Auto-Approve (no manual approval stages required)
- `₹10,001 – ₹50,000`: Department Head Approval (`DEPT_HEAD`)
- `₹50,001 – ₹200,000`: Department Head + Finance Manager Approval (`FINANCE`)
- `> ₹200,000`: Department Head + Finance Manager + Executive Management (`MANAGEMENT`)

---

## 6. Design Rationale

Purchase Requisitions bridge internal operational demand with external commercial procurement:
- Ensures every Purchase Order or RFQ has a traceable demand origin.
- Prevents unauthorized capital expenditure via value-based approval limits.
- Supports flexible post-approval fulfillment paths (Spot PO, Competitive RFQ, or BPA Release).

---

## 7. Implementation Summary

### Database Schema

```text
requisition_approval_policies
    id, policy_name, min_value, max_value,
    required_approver_role, stage_order, auto_approve

purchase_requisitions
    id, requisition_no, title, requestor_id, department, cost_center,
    estimated_total, status (Draft/Submitted/UnderApproval/Approved/Converted/Rejected/Cancelled),
    current_approval_stage, converted_doc_type, converted_doc_id

purchase_requisition_lines
    requisition_id → purchase_requisitions.id (CASCADE)
    product_id, requested_quantity, estimated_unit_price, line_total, preferred_supplier_id

requisition_approvals
    requisition_id → purchase_requisitions.id (CASCADE)
    stage_order, stage_name, required_approver_role, approver_id, decision (PENDING/APPROVED/REJECTED), decided_at
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/purchase/requisitions` | Create draft requisition |
| `GET` | `/api/v1/purchase/requisitions` | List all requisitions |
| `GET` | `/api/v1/purchase/requisitions/{id}` | Get requisition details |
| `POST` | `/api/v1/purchase/requisitions/{id}/submit` | Submit for approval |
| `POST` | `/api/v1/purchase/requisitions/{id}/approve` | Record approval decision |
| `POST` | `/api/v1/purchase/requisitions/{id}/convert` | Convert to PO/RFQ/BPA Release |
| `POST` | `/api/v1/purchase/requisitions/policies` | Create approval policy |
| `GET` | `/api/v1/purchase/requisitions/policies` | List approval policies |

---

## 8. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_create_draft_requisition` | **PASSED** |
| 2 | `test_low_value_requisition_auto_approved` | **PASSED** |
| 3 | `test_high_value_requisition_generates_multi_stage_approval` | **PASSED** |
| 4 | `test_approver_decisions_advance_stage_to_approved` | **PASSED** |
| 5 | `test_rejection_marks_requisition_rejected` | **PASSED** |
| 6 | `test_approved_requisition_converts_to_direct_po` | **PASSED** |

**Overall Result: 40/40 PASSED across complete procurement stack**

**Verification Status: Done**

---

## 9. Known Limitations & Future Work

- Delegation of approval authority (e.g. out-of-office approver re-assignment) is not yet supported.
- Notification dispatch (email/SMS/Slack on pending approval) is ready for event bus hook-up but not yet wired.
- Line-item level approval splitting (approving line 1 while rejecting line 2) is deferred to future enterprise enhancements.
