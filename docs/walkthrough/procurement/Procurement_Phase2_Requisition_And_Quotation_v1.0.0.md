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

# Walkthrough: Procurement Phase 2 — Purchase Requisition (PR) & Supplier RFQ / Quotation Comparison v1.0.0

## 1. Purpose
This walkthrough documents and verifies the implementation of the missing upstream procurement lifecycle capabilities in SMRITI Retail OS:
1. **Purchase Requisitions (PR / Store Indents):** Multi-department store requisition lifecycle (`DRAFT` → `SUBMITTED` → `APPROVED` → `CONVERTED_TO_PO`) with atomic row-locking on conversion to prevent double-ordering.
2. **Supplier Requests for Quotation (RFQ) & Landed-Cost Quotations:** Multi-vendor quote recording, landed-cost formula calculation (base price, discount, GST, and proportional freight allocation with penny-balancing), side-by-side comparative matrix, documented vendor selection scoring, and one-click Purchase Order creation.
3. **Consolidated BI Procurement Reports:** Registration of `RPT-PUR-005` (Pending Purchase Requisitions Register), `RPT-PUR-006` (Requisition-to-PO Conversion & Tracking), and `RPT-PUR-007` (Supplier RFQ & Quotation Comparison Register) in `SMRITI_STUDIOS["purchase_studio"]` and `ReportDesignerTab.tsx`.

## 2. Scope
- Additive database tables via Alembic migration (`v1534_procurement_pr_rfq_quotations.py`):
  - `purchase_requisitions`
  - `purchase_requisition_items`
  - `supplier_rfqs`
  - `supplier_rfq_items`
  - `supplier_quotations`
  - `supplier_quotation_items`
- SQLAlchemy models in `backend/app/models/purchase.py` and model exports in `backend/app/models/__init__.py`.
- Pydantic v2 schemas in `backend/app/schemas/procurement_phase2.py`.
- Transactional business services in `backend/app/services/procurement_phase2.py`.
- REST API router in `backend/app/api/v1/procurement_phase2.py` mounted in `backend/app/main.py`.
- Frontend UI Workspaces in `src/components/purchase/PurchaseRequisitionWorkspace.tsx` and `src/components/purchase/SupplierRfqWorkspace.tsx` mounted seamlessly as sub-tabs in `PurchaseStudioTab.tsx`.
- Central BI reporting endpoints in `backend/app/api/v1/reports.py` and UI wiring in `src/components/ReportDesignerTab.tsx`.
- Preflight Certification and AST scanning adherence via `.architecture/certificates/` and `scripts/architecture_duplication_gate.py`.
- Pytest and Vitest test coverage ensuring landed-cost precision, selection rules, and report queries.

## 3. Files Created
- `backend/alembic/versions/v1534_procurement_pr_rfq_quotations.py`
- `backend/app/schemas/procurement_phase2.py`
- `backend/app/services/procurement_phase2.py`
- `backend/app/api/v1/procurement_phase2.py`
- `src/components/purchase/PurchaseRequisitionWorkspace.tsx`
- `src/components/purchase/SupplierRfqWorkspace.tsx`
- `backend/tests/test_procurement_phase2.py`
- `src/tests/procurementPhase2.test.ts`
- `.architecture/certificates/PF-2026-1016-AF08F7.json`
- `.architecture/certificates/PF-2026-1016-0BEA8A.json`
- `.architecture/certificates/PF-2026-1016-27B116.json`
- `.architecture/certificates/PF-2026-1016-B6EDEF.json`
- `docs/implementation/procurement/Procurement_Phase2_Requisition_And_Quotation_Plan_v1.0.0.md`
- `docs/walkthrough/procurement/Procurement_Phase2_Requisition_And_Quotation_v1.0.0.md`

## 4. Files Modified
- `backend/app/models/purchase.py`
- `backend/app/models/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/api/v1/reports.py`
- `backend/app/main.py`
- `src/components/PurchaseStudioTab.tsx`
- `src/components/ReportDesignerTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Decision 1: Upstream Sub-tabs within Canonical Purchase Studio:**
  Rather than registering a top-level route that fractures the navigation tree and duplicates supplier/purchase concepts, `PurchaseStudioTab.tsx` was enhanced with `TopLevelView` options (`"requisitions"` and `"rfqs"`), placing them naturally alongside `"generate"` (Order creation) and `"workspace"` (PO Registry).
- **Decision 2: Strict Penny-Balanced Landed-Cost Formula:**
  Landed unit cost calculation strictly follows:
  $$\text{Discounted Price} = \text{Base Price} \times (1 - \frac{\text{Discount \%}}{100})$$
  $$\text{Tax Amount} = \text{Discounted Price} \times \frac{\text{GST \%}}{100}$$
  $$\text{Item Freight} = \text{Freight Total} \times \frac{\text{Item Base Total}}{\text{Sum of All Items Base Total}}$$
  Residual penny differences from integer/cent division are allocated to the final line item, guaranteeing exact zero-variance reconciliation.
- **Decision 3: Documented Vendor Selection Gate:**
  In accordance with institutional purchasing guidelines, the system does not automatically award the bid to the lowest numeric quotation. The operator must record a mandatory justification text (and evaluation score), creating a verifiable audit trail prior to PO generation.
- **Decision 4: Architecture Duplication Gate & Preflight Certification:**
  All four new implementation files were granted preflight certificates (`PF-2026-1016-AF08F7`, `PF-2026-1016-0BEA8A`, `PF-2026-1016-27B116`, `PF-2026-1016-B6EDEF`) with explicit `@smriti_capability` annotations, resulting in 0 violations across all 11 architecture duplication checks.

## 6. Design Rationale
- Multi-department stores and distribution centers require departmental indents before committing to purchase orders.
- Direct conversion from an Approved Requisition or Selected Quotation to a Purchase Order preserves traceability (`requisition_id` / `source_rfq_id`) and locks source rows with `SELECT FOR UPDATE` to eliminate duplicate conversions.
- Integrating `RPT-PUR-005`, `RPT-PUR-006`, and `RPT-PUR-007` into `SMRITI_STUDIOS["purchase_studio"]` makes them instantly accessible in the BI Reports Center with unified CSV, Excel, and Print export capabilities.

## 7. Implementation Summary
- **Database Schema:** 6 relational tables with branch isolation (`company_id`, `branch_id`), audit timestamps, and indexing on status, numbers, and dates.
- **Backend Services:** `ProcurementPhase2Service` encapsulates state transitions, approval validation, landed cost arithmetic, comparison matrix transposition, and PO creation.
- **FastAPI Endpoints:** RESTful endpoints for PR and RFQ lifecycles registered under `/api/v1/purchase/requisitions/`, `/api/v1/purchase/rfqs/`, and `/api/v1/purchase/quotations/`.
- **Frontend Workspaces:**
  - `PurchaseRequisitionWorkspace`: Interactive table, multi-item creation modal, submit, approve, reject, and PO conversion actions.
  - `SupplierRfqWorkspace`: RFQ creation, multi-line quote recording with live landed cost calculation, side-by-side comparative matrix modal, documented selection scoring, and PO generation.
- **Report Studio Integration:** Reports `RPT-PUR-005`, `RPT-PUR-006`, and `RPT-PUR-007` added to `purchase_studio` catalog and `ReportDesignerTab.tsx`.

## 8. Tests Executed
1. `backend/tests/test_procurement_phase2.py`:
   - Landed-cost calculation precision and penny-balancing formula verification.
   - Pydantic schema validation for requisitions and quotations.
   - SMRITI Report Studio catalog registration verification for PR and RFQ reports.
2. `src/tests/procurementPhase2.test.ts`:
   - Landed unit cost formula math check (base, discount, GST, freight).
   - Documented vendor selection rule enforcement (blocking empty justification).
   - Report catalog verification for `RPT-PUR-005`, `RPT-PUR-006`, and `RPT-PUR-007`.
3. `backend/tests/test_procurement_reports_audit.py`:
   - Regression audit of procurement reports `RPT-PUR-001` through `RPT-PUR-004`.
4. `src/tests/procurementAndReportsAudit.test.ts`:
   - Frontend catalog and report engine tests.
5. `scripts/architecture_duplication_gate.py`:
   - Full 11-check AST duplication and preflight gate run.
6. `npx tsc --noEmit`:
   - Full TypeScript compilation validation.

## 9. Verification Results
- **Pytest:** 4/4 tests passed (100% green).
- **Vitest:** 5/5 test files passed, 18/18 tests green.
- **Architecture Duplication Gate:** Passed (0 violations).
- **TypeScript:** Clean compilation with zero diagnostics.

## 10. Known Limitations
- Supplier Quotation OCR ingestion remains a future enhancement once document processing pipelines are standardized.
- Automatic supplier quotation request emails require outgoing SMTP / WhatsApp gateway configuration.

## 11. Future Work
- Electronic supplier quotation portal for direct quote entry by invited vendors.
- Two-way RFQ reverse auctions with live time-window bidding.
- Machine-learning quotation price anomalies and trend analysis against historical purchases.

## 12. Related ADRs
- `ADR-0081`: SMRITI Architecture Duplication Gate & Preflight Certificate Policy
- `ADR-0042`: Canonical Domain Separation and Module Governance
- `ADR-0035`: BI Report Designer Unified Catalog Architecture

## 13. Related RFCs
- `RFC-2026-08`: Purchase Requisition & Upstream Procurement Pipeline Specification
- `RFC-2026-11`: Landed Cost Transparency and Multi-Factor Vendor Evaluation
