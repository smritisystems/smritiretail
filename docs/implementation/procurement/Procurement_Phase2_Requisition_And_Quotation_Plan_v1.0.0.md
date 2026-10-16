<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Procurement Phase 2 — Purchase Requisition (PR), Supplier RFQ & Quotation Comparison Matrix

## 1. Objective
Implement missing upstream procurement capabilities within the canonical `purchase` ("Purchase & Procurement") context of SMRITI Retail OS:
1. **Purchase Requisition (PR / Store Indents):** Full multi-line indent creation, required by date, justification, submit/approve/reject workflow, and idempotent conversion to draft Purchase Orders or RFQs.
2. **Supplier Request for Quotation (RFQ) & Quotation Comparison:** Multi-supplier quote entry, transparent landed cost calculation formulas (base price, discount, GST, freight allocation), side-by-side comparison matrix, documented vendor selection justification, and conversion to Purchase Orders.
3. **Consolidated BI Reporting:** Extending `SMRITI_STUDIOS["purchase_studio"]` with Pending Requisitions, Requisition-to-PO Tracking, and RFQ Comparison registers.

## 2. Business Motivation
Outlets and store departments need a structured way to request stock or capital procurement with management approval before commitments are made with vendors. Purchasing teams require a formal RFQ process to invite multiple supplier quotations, compare true landed costs (accounting for freight and tax variations), document why a supplier was selected (quality, delivery time, or terms—not merely lowest quoted unit price), and seamlessly convert the winning bid into a binding Purchase Order without manual re-keying.

## 3. Scope
- **Backend Schema & Migration:** Add additive tables `purchase_requisitions`, `purchase_requisition_items`, `supplier_rfqs`, `supplier_rfq_items`, `supplier_quotations`, `supplier_quotation_items` via migration `v1534_procurement_pr_rfq_quotations`.
- **Backend APIs & Services:** Implement `backend/app/api/v1/procurement_phase2.py` and `backend/app/services/procurement_phase2.py` with multi-tenant company/branch scoping, status validation, landed-cost computation, and PO conversion endpoints.
- **Frontend Workspaces:**
  - `src/components/purchase/PurchaseRequisitionWorkspace.tsx`: Store indent grid, submission, approval modal, and PO conversion button.
  - `src/components/purchase/SupplierRfqWorkspace.tsx`: RFQ creation, quote entry dialog, landed cost comparison grid, and documented PO conversion.
  - Mount both workspaces within `src/components/PurchaseStudioTab.tsx`.
- **Reports Extension:** Add `RPT-PUR-005` (Pending Requisitions), `RPT-PUR-006` (Requisition-to-PO Conversion), and `RPT-PUR-007` (Quotation Comparison) to `backend/app/api/v1/reports.py` and `ReportDesignerTab.tsx`.
- **Automated Tests:** Comprehensive unit and integration test suites in `backend/tests/` and `src/tests/`.

## 4. Current State
- Mature Purchase Order and GRN subsystems exist in `purchase.py`, `PurchaseStudioTab.tsx`, `POWorkspaceTab.tsx`, and `GrnStudioTab.tsx`.
- Approval matrix exists in `ApprovalMatrixTab.tsx` with live PO confirmation/cancellation wired.
- Automated reorder triggers exist (`AutoPOModal`), but manual multi-department PR indents and multi-vendor quotation comparison matrices are absent.

## 5. Gap Analysis
| Required Capability | Current State | Target Architecture |
|---|---|---|
| **Purchase Requisition (PR)** | Automated reorder suggestions only | Full manual/department indent lifecycle (`DRAFT` → `SUBMITTED` → `APPROVED` → `CONVERTED`) |
| **Supplier RFQ** | Non-existent (Sales quotation only) | Structured RFQ invitation for multiple vendors |
| **Quotation Comparison** | Non-existent | Mathematical landed-cost engine with transparent formula + documented justification |
| **Vendor Selection to PO** | Manual PO entry | Idempotent one-click conversion of selected quote to draft Purchase Order |
| **PR/RFQ BI Reports** | Missing in central catalog | Registered in `purchase_studio` in `reports.py` and rendered via `SmritiReportEngine` |

## 6. Architecture Impact
- **Zero Root Duplication:** No new top-level routes or navigation modules. All capabilities sit cleanly inside `purchase` ("Purchase & Procurement") and `reports` ("BI Reports & Analytics").
- **Strict Tenancy:** All tables inherit `BaseEntity` with `company_id` and `branch_id`. Queries filter through `TenantContext`.
- **Idempotency & Integrity:** Requisitions and Quotations maintain `po_id` foreign keys to prevent double-conversion and ensure complete audit traceability.

## 7. Proposed Design & Data Models
### Landed Cost Formula
$$\text{Taxable Unit Price} = \text{Unit Price} \times \left(1 - \frac{\text{Discount \%}}{100}\right)$$
$$\text{Tax Amount} = \text{Qty} \times \text{Taxable Unit Price} \times \frac{\text{Tax Rate \%}}{100}$$
$$\text{Allocated Freight} = \text{Total Freight} \times \left(\frac{\text{Line Base Value}}{\sum \text{Line Base Values}}\right)$$
$$\text{Unit Landed Cost} = \text{Taxable Unit Price} + \frac{\text{Tax Amount} + \text{Allocated Freight}}{\text{Qty}}$$

## 8. Files Created
- `backend/alembic/versions/v1534_procurement_pr_rfq_quotations.py`
- `backend/app/models/procurement_phase2.py`
- `backend/app/schemas/procurement_phase2.py`
- `backend/app/services/procurement_phase2.py`
- `backend/app/api/v1/procurement_phase2.py`
- `src/components/purchase/PurchaseRequisitionWorkspace.tsx`
- `src/components/purchase/SupplierRfqWorkspace.tsx`
- `backend/tests/test_procurement_phase2.py`
- `src/tests/procurementPhase2.test.ts`
- `docs/walkthrough/procurement/Procurement_Phase2_Requisition_And_Quotation_v1.0.0.md`

## 9. Files Modified
- `backend/app/models/__init__.py`
- `backend/app/models/purchase.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/api/v1/reports.py`
- `src/components/PurchaseStudioTab.tsx`
- `src/components/ReportDesignerTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, SQLAlchemy, Pydantic V2, React 18, Tailwind CSS, Lucide React icons, Vitest, Pytest.

## 11. Risks
- *Risk:* Concurrent conversion of the same requisition into multiple POs.
  *Mitigation:* Database-level row locking (`SELECT FOR UPDATE`) and atomic state validation preventing re-conversion if `status == 'CONVERTED_TO_PO'` or `po_id IS NOT NULL`.
- *Risk:* Floating point discrepancies in freight allocation.
  *Mitigation:* Penny-balancing remainder allocation to the highest-value line item.

## 12. Rollback Strategy
- Non-destructive additive tables. In the event of rollback, revert migration via `alembic downgrade -1` and unmount UI tabs.

## 13. Verification Plan
- Unit test suite for landed-cost calculations.
- API lifecycle test for PR: Draft → Submit → Approve → Convert to PO.
- Multi-supplier quotation comparison and documented selection test.
- Tenant isolation tests preventing cross-company visibility.
- Vitest tests for UI workspace mounting and action triggers.

## 14. Test Plan
- Run targeted Pytest and Vitest test suites.
- Run full regression suite (`npm test`).
- Run `tsc --noEmit` and `architecture_duplication_gate.py`.

## 15. Documentation Impact
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Create comprehensive 13-section walkthrough.

## 16. Deployment Plan
- Apply migration `v1534_procurement_pr_rfq_quotations.py`.
- Restart FastAPI service and Vite frontend.

## 17. Status
Completed.

## 18. Related ADRs
- SMRITI Universal Tenancy and BaseEntity Contract.
- SMRITI Backend System-of-Record Policy (FastAPI + Postgres sole backend).
- ADR-0081: Architecture Duplication Gate & Preflight Certificate Policy.

## 19. Related Walkthroughs
- `Procurement_Phase2_Requisition_And_Quotation_v1.0.0.md`
- `Procurement_And_Reports_Audit_And_Enhancement_v1.0.0.md`
