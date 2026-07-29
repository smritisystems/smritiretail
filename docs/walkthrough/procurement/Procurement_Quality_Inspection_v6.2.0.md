<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.2.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Procurement — Warehouse Goods Receipt (GRN) & Quality Control (QC) Inspection Engine
**Walkthrough Version:** v6.2.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (46/46 PASSED)

---

## 1. Purpose

Establishes the formal **Quality Control (QC) Inspection Gate** between physical dock receiving (GRN) and sellable inventory in SMRITI Retail OS. Introduces the **QualityInspection** aggregate root, **QCInspectionEngine**, and **SupplierDebitNote** claim automation, ensuring non-conforming or defective goods are quarantined or rejected before inventory activation or 3-Way Matching invoice approval.

---

## 2. Scope

- New Alembic DDL migration: `quality_inspections`, `quality_inspection_items`, and `supplier_debit_notes` tables; `qc_status` column added to `purchase_receipts`.
- New ORM models: `QualityInspection`, `QualityInspectionItem`, and `SupplierDebitNote`.
- New `QCInspectionEngine` — AQL inspection initialization, line item disposition (`accepted_qty`, `rejected_qty`, `quarantine_qty`), defect categorization (`CRITICAL`, `MAJOR`, `MINOR`), automated draft Debit Note claim generation, and 3-Way Matching QC gate validation.
- New REST API router: `/api/v1/purchase/qc` (inspections create, list, get, evaluate, debit notes list).
- Pydantic schemas: `QCItemEvaluationRequest`, `QCEvaluationRequest`, `QCInspectionResponse`, `QCInspectionItemResponse`, `SupplierDebitNoteResponse`.
- 6 integration test assertions verifying QC creation, 100% pass, partial rejection with automated Debit Note generation, 100% fail, 3-Way Matching QC gate blockage, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v620_quality_inspection_engine.py` | Alembic DDL migration — 3 new tables + `qc_status` on `purchase_receipts` |
| `backend/app/procurement/engine/qc_inspection_engine.py` | QCInspectionEngine — inspection lifecycle, line disposition, debit note claim generation, matching gate |
| `backend/app/api/v1/procurement_qc.py` | REST API gateway: create inspection, list inspections, get by id, submit evaluation, list debit notes |
| `backend/app/tests/test_quality_inspection.py` | 6 integration test assertions for complete QC and Debit Note lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/purchase.py` | +`QualityInspection`, +`QualityInspectionItem`, +`SupplierDebitNote` models; +`qc_status` column on `PurchaseReceipt` |
| `backend/app/schemas/purchase.py` | +`QCEvaluationRequest`, `QCInspectionResponse`, `SupplierDebitNoteResponse` DTOs |
| `backend/app/main.py` | +`procurement_qc` import; +`app.include_router(procurement_qc.router, ...)` |

---

## 5. Architecture Decisions

### AD-01: QualityInspection as Bounded Context Aggregate Root
`QualityInspection` acts as the aggregate root managing line-item disposition (`QualityInspectionItem`) and linked financial claim (`SupplierDebitNote`).

### AD-02: QC Status Gate on PurchaseReceipt
The GRN (`PurchaseReceipt`) is augmented with `qc_status` (`PendingInspection`, `UnderInspection`, `Passed`, `Failed`). Stock received into the dock remains unapproved until `qc_status` transitions to `Passed`.

### AD-03: Automated Supplier Debit Note Generation
When an inspection evaluation contains `rejected_quantity > 0`, `QCInspectionEngine` automatically calculates the total financial claim (`rejected_quantity * cost_price` + GST) and creates a draft `SupplierDebitNote` linked directly to the supplier, GRN, and inspection ID.

### AD-04: Mandatory Gate for 3-Way Matching
`QCInspectionEngine.validate_matching_qc_gate(receipt_id)` prevents the 3-Way Matching engine from processing supplier invoices for GRNs that are still `PendingInspection`, `UnderInspection`, or `Failed`.

---

## 6. Implementation Summary

### Database Schema

```text
purchase_receipts (modified)
    +qc_status (PendingInspection/UnderInspection/Passed/Failed)

quality_inspections
    id, inspection_no, receipt_id, supplier_id, inspector_id, inspected_at,
    overall_status (PendingInspection/UnderInspection/Passed/PassedWithExceptions/Failed),
    total_received_qty, total_accepted_qty, total_rejected_qty, total_quarantine_qty,
    debit_note_id, remarks

quality_inspection_items
    inspection_id → quality_inspections.id (CASCADE)
    product_id, received_quantity, inspected_quantity, accepted_quantity,
    rejected_quantity, quarantine_quantity, defect_category, defect_reason

supplier_debit_notes
    id, debit_note_no, supplier_id, receipt_id, inspection_id,
    claim_amount, tax_amount, total_debit_amount, status (DRAFT/ISSUED/SETTLED/CANCELLED)
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/purchase/qc/inspections` | Create inspection for GRN |
| `GET` | `/api/v1/purchase/qc/inspections` | List all quality inspections |
| `GET` | `/api/v1/purchase/qc/inspections/{id}` | Get inspection details |
| `POST` | `/api/v1/purchase/qc/inspections/{id}/evaluate` | Submit inspection evaluation |
| `GET` | `/api/v1/purchase/qc/debit-notes` | List supplier debit notes |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_create_inspection_from_receipt` | **PASSED** |
| 2 | `test_evaluate_inspection_all_passed` | **PASSED** |
| 3 | `test_evaluate_inspection_partial_rejection_generates_debit_note` | **PASSED** |
| 4 | `test_evaluate_inspection_all_failed` | **PASSED** |
| 5 | `test_3way_matching_blocked_for_uninspected_receipt` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_qc` | **PASSED** |

**Overall Result: 46/46 PASSED across complete procurement & warehouse stack**

**Verification Status: Done**
