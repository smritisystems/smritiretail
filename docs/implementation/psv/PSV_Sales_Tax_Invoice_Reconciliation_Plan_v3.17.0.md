<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: PSV Sales Tax Invoice Quantity Reconciliation & Goods Receiving Architecture

## 1. Objective
Establish an authoritative quantity reconciliation and physical receiving subsystem in the **Party Stock Visibility (PSV)** module on branch `smritiNX`. Link Sales Tax Invoices (`sales_invoices`, `sales_invoice_items`) with physical store dock delivery events (`psv_stock_events`), providing transparent reconciliation across Documented Quantity, Physically Received Quantity, Pending Approval Quantity, Approved Quantity, Shortage Quantity, Excess Quantity, and Quality Inspection Rejections.

## 2. Business Motivation
In retail distribution (such as Modern Trade with Reliance Retail or multi-store franchise channels), goods billed on statutory Sales Tax Invoices frequently experience split deliveries, transit shortages, damage, or delayed delivery. Without linking Sales Tax Invoices to store dock receiving events, ERP systems suffer from inventory discrepancies, unverified stock inflation, and disputed receivables. This subsystem guarantees that:
- Every billed piece is tracked against physical delivery dock verification.
- Received inventory awaiting manager sign-off is quarantined and does not prematurely inflate live store balance.
- Shortages, excess shipments, and inspection rejections are detected instantly with audit logs.

## 3. Scope
- Backend schemas and DTOs in `backend/app/schemas/psv.py`.
- Service layer algorithms in `backend/app/services/psv_projection.py` implementing multi-dimensional variant matching across Article/Style Code, Color, Size, and SKU.
- REST endpoints in `backend/app/api/v1/psv.py` for reconciliation querying, inward goods receipt submission, and manager event approval.
- Automated integration test suite in `backend/app/tests/test_psv_invoice_reconciliation.py`.
- Interactive frontend UI in `src/components/PsvTab.tsx` with sub-tab switching, KPI summary cards, discrepancy filters, and inward receiving modal.
- TypeScript interfaces in `src/types.ts`.

## 4. Current State
- `psv_parties` stores distributor/partner headers and stock counts.
- `psv_stock_events` records ledger movements (`BILLED_TO_PARTNER`, `STORE_RECEIVED`, `SOLD_TO_CUSTOMER`, `STORE_RETURN`).
- Sales Tax Invoices exist in `sales_invoices` and `sales_invoice_items`.
- However, there was no unified reconciliation view or API computing exact Document vs Received vs Shortage vs Excess quantities per invoice line item with variant dimensions.

## 5. Gap Analysis
1. **Lack of Item-Level Documented vs Received Visibility:** Operators could only see high-level stock counts, not line-by-line invoice fulfillment.
2. **Missing Quarantined Pending Approval State:** Store dock arrivals were either unrecorded or directly credited to stock without manager authorization.
3. **Absence of Variant Catalog Dimension Matching:** Matching was limited to raw SKU barcodes, ignoring canonical Article Code, Color, and Size dimensions.

## 6. Architecture Impact
- **Non-Destructive Shadow Ledger:** PSV maintains its shadow stock projection architecture without modifying transactional accounting vouchers.
- **Strict Isolation of Unapproved Goods:** Events with `approval_status = "PENDING"` are tracked in `pending_approval_qty` and excluded from available live store balances until approved by a Manager/Admin.
- **Tenancy Boundary:** All reconciliation queries strictly enforce `company_id` isolation.

## 7. Proposed Design
```
Sales Invoices (sales_invoices / sales_invoice_items)
           │
           ▼
[PSVProjectionService.get_quantity_reconciliation]
  ├── Multi-Dimensional Join (Style Code, Color, Size, SKU)
  ├── Event Sourcing Aggregation:
  │     STORE_RECEIVED (APPROVED)  ──> approved_qty
  │     STORE_RECEIVED (PENDING)   ──> pending_approval_qty
  │     REJECTED                   ──> rejected_qty
  └── Discrepancy Computation:
        short_qty  = max(0, document_qty - received_qty)
        excess_qty = max(0, received_qty - document_qty)
           │
           ▼
REST API: GET /api/v1/psv/reconciliation
           │
           ▼
Frontend: PsvTab.tsx (Invoice & Receiving Reconciliation Dashboard)
```

## 8. Files Created
1. `backend/app/tests/test_psv_invoice_reconciliation.py`
2. `docs/walkthrough/psv/PSV_Sales_Tax_Invoice_Reconciliation_v3.17.0.md`
3. `docs/implementation/psv/PSV_Sales_Tax_Invoice_Reconciliation_Plan_v3.17.0.md`

## 9. Files Modified
1. `backend/app/schemas/psv.py`
2. `backend/app/services/psv_projection.py`
3. `backend/app/api/v1/psv.py`
4. `src/types.ts`
5. `src/components/PsvTab.tsx`
6. `docs/walkthrough/README.md`
7. `docs/implementation/README.md`

## 10. Dependencies
- FastAPI Core backend with PostgreSQL (`psv_parties`, `psv_stock_events`, `sales_invoices`, `sales_invoice_items`, `products`, `item_variants`, `items`).
- React 18 frontend with Recharts, Tailwind CSS tokens, and SMRITI API client (`apiFetchV1`).

## 11. Risks
- **Risk:** High invoice volume causing slow reconciliation response.
  - **Mitigation:** Batch querying with pre-aggregated `events_by_inv_line` and `events_by_inv_sku` maps in Python, indexed by `invoice_id` and `company_id`.
- **Risk:** Premature inventory leakage into available stock.
  - **Mitigation:** Quarantine by default (`approval_status = "PENDING"`) enforced at the service level unless authorized manager sign-off is provided.

## 12. Rollback Strategy
- All backend schema additions are purely additive (no table alterations or destructive migrations).
- Reverting `PsvTab.tsx` restores the original 1-tab velocity dashboard without any database impact.

## 13. Verification Plan
- Column and attribute parity inspection across `sales_invoices`, `sales_invoice_items`, and `psv_stock_events`.
- Automated test runs verifying unreceived projection, exact delivery, shortages, excess receipts, multi-truck consignments, and manager promotion.
- Full TypeScript static analysis (`tsc --noEmit`).

## 14. Test Plan
- Run `backend/app/tests/test_psv_invoice_reconciliation.py` (9 tests).
- Run regression tests `backend/app/tests/test_psv.py` and `backend/app/tests/test_psv_store_mapping.py` (16 tests).
- Run `npm run lint`.

## 15. Documentation Impact
- Architectural Walkthrough created under `docs/walkthrough/psv/PSV_Sales_Tax_Invoice_Reconciliation_v3.17.0.md`.
- Master walkthrough index updated in `docs/walkthrough/README.md`.
- Master implementation plan index updated in `docs/implementation/README.md`.

## 16. Deployment Plan
1. Deploy updated backend codebase to target environment.
2. Build and bundle updated frontend client assets (`npm run build`).
3. Zero database schema migrations required (fully additive DTO and projection logic).

## 17. Status
**Completed** — Fully implemented, certified with 25/25 Pytest backend tests green, 0 `tsc --noEmit` errors, and verified in active repository.

## 18. Related ADRs
- `ADR-028`: PSV Shadow Projection & Non-Authoritative Visibility Engine
- `ADR-042`: SMRITI System Parameters & Mutability Governance
- `ADR-PSV-01`: Multi-Dimensional Footwear/Apparel Catalog Reconciliation

## 19. Related Walkthroughs
- [docs/walkthrough/psv/PSV_Sales_Tax_Invoice_Reconciliation_v3.17.0.md](../walkthrough/psv/PSV_Sales_Tax_Invoice_Reconciliation_v3.17.0.md)
