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

# Walkthrough: PSV Sales Tax Invoice Quantity Reconciliation & Inward Receiving Architecture

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the **Sales Tax Invoice Quantity Reconciliation and Inward Goods Receiving Subsystem** within the **Party Stock Visibility (PSV)** module on branch `smritiNX`. The objective is to establish an authoritative link between Sales Tax Invoices (`sales_invoices`, `sales_invoice_items`) and physical delivery events at retail stores and partner distributor locations (`psv_stock_events`), providing transparent quantity reconciliation across:
- **Documented Quantity** (Billed on Tax Invoices)
- **Physically Received Quantity** (Recorded at the store delivery dock)
- **Pending Approval Quantity** (Received units awaiting managerial verification)
- **Approved Quantity** (Managerially authorized units credited to live stock)
- **Shortage Quantity** ($\max(0, \text{Document Qty} - \text{Received Qty})$)
- **Excess Quantity** ($\max(0, \text{Received Qty} - \text{Document Qty})$)
- **Inspection Rejections** (Units rejected during quality audit with audit failure reasons)

---

## 2. Scope
- **Backend Schema & DTO Contracts:** Added Pydantic schemas in `backend/app/schemas/psv.py` for itemized reconciliation, aggregated summaries, inward receipt requests, and event approval.
- **Transactional Ledger & Service Architecture:** Implemented `get_quantity_reconciliation`, `record_invoice_receipt`, and enhanced `project_posted_invoice` in `backend/app/services/psv_projection.py`.
- **REST Endpoints:** Exposed `GET /api/v1/psv/reconciliation`, `POST /api/v1/psv/receive-invoice`, `POST /api/v1/psv/events/{event_id}/approve`, and `POST /api/v1/psv/invoices/{invoice_id}/project` in `backend/app/api/v1/psv.py`.
- **Catalog Dimension Matching:** Integrated resolution across Article/Style Code, Color, Size, and Barcode/SKU through `products`, `item_variants`, and `items`.
- **Stock Ledger Safety Enforcement:** Ensured goods awaiting approval (`PENDING`) remain segregated as `pending_approval_qty` without inflating live available stock balances until approved by an authorized Manager or Admin.
- **Frontend User Interface:** Upgraded `src/components/PsvTab.tsx` with a dual-view sub-tab layout: "Distributor Stock Tracker" (original velocity view) and "Invoice & Receiving Reconciliation" (new interactive reconciliation dashboard, KPI metrics, discrepancy filters, and inward receiving modal). Added corresponding TypeScript interfaces in `src/types.ts`.

---

## 3. Files Created
1. `backend/app/tests/test_psv_invoice_reconciliation.py`: 9 integration tests covering invoice projection, exact matching, shortages, excess receipts, quarantine/promotion, multi-truck deliveries, rejections, variant matching, and company multi-tenant isolation.
2. `docs/walkthrough/psv/PSV_Sales_Tax_Invoice_Reconciliation_v3.17.0.md`: This comprehensive architectural walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/psv.py`: Added reconciliation and receiving DTOs (`PSVQuantityReconciliationItem`, `PSVQuantityReconciliationSummary`, `PSVQuantityReconciliationResponse`, `PSVReceiveInvoiceLineReq`, `PSVReceiveInvoiceReq`, `PSVReceiveInvoiceResp`).
2. `backend/app/services/psv_projection.py`: Added `get_quantity_reconciliation`, `record_invoice_receipt`, and enhanced party resolution in `project_posted_invoice`.
3. `backend/app/api/v1/psv.py`: Mounted `/reconciliation`, `/receive-invoice`, and `/invoices/{invoice_id}/project` REST endpoints.
4. `src/types.ts`: Added frontend TypeScript interfaces matching backend reconciliation response models.
5. `src/components/PsvTab.tsx`: Added sub-tab switcher, KPI metric tiles, discrepancy detection filters, detailed variant table, manager approval actions, and inward goods receipt modal.
6. `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

---

## 5. Architecture Decisions
- **ADR-PSV-01: Multi-Dimensional Matching Engine:** Item reconciliation does not rely solely on raw barcode strings. Instead, it matches using canonical footwear/apparel catalog dimensions: **Style/Article Code + Color + Size + SKU**, falling back to line ID matching when multiple identical SKUs exist on the same invoice.
- **ADR-PSV-02: Quarantine by Default (Stock Ledger Safety):** All physical receiving events recorded by operational staff default to `approval_status = "PENDING"`. Quarantined quantities are reflected in `pending_approval_qty` and are strictly excluded from `effective_stock` computations until an authorized Manager or Admin approves the event.
- **ADR-PSV-03: Event Sourcing & Idempotent Audit Trail:** Every receiving operation creates immutable `PSVStockEvent` rows (`STORE_RECEIVED`, `REJECTED`) tagged with vehicle numbers, transporter LR numbers, inspection failure causes, and user ID attribution. Re-projecting or updating existing invoices is completely idempotent.

---

## 6. Design Rationale
In enterprise retail distribution, delivery trucks often deliver goods in multiple consignments or suffer partial damage during transit. Relying exclusively on financial Sales Invoices creates blind spots between billed quantities and inventory physically lying on store shelves. By linking Sales Tax Invoices directly to dock receiving events and inspection logs, SMRITI Retail OS eliminates phantom inventory, detects delivery shortages immediately, and prevents store managers from claiming missing goods as on-hand inventory.

---

## 7. Implementation Summary
```
Sales Tax Invoice (sales_invoices / sales_invoice_items)
       │
       ▼
 [psv_projection.get_quantity_reconciliation]
       │
       ├── Document Qty  ◄── sales_invoice_items.quantity
       ├── Received Qty  ◄── psv_stock_events (STORE_RECEIVED)
       ├── Pending Qty   ◄── psv_stock_events (PENDING approval)
       ├── Approved Qty  ◄── psv_stock_events (APPROVED status)
       ├── Short Qty     ◄── max(0, Document Qty - Received Qty)
       ├── Excess Qty    ◄── max(0, Received Qty - Document Qty)
       └── Rejected Qty  ◄── psv_stock_events (REJECTED status)
       │
       ▼
REST API: GET /api/v1/psv/reconciliation
       │
       ▼
React Client: PsvTab.tsx (Invoice & Receiving Reconciliation View)
```

---

## 8. Tests Executed
1. **Backend Integration Tests:** `backend/app/tests/test_psv_invoice_reconciliation.py`
   - `test_reconciliation_unreceived_invoice_projection`: Validates unreceived invoice items show Document Qty with zero received and full shortage.
   - `test_reconciliation_exact_receipt_reconciled`: Validates 1:1 receipt sets status to `RECONCILED` with 0 shortage.
   - `test_reconciliation_partial_receipt_shortage`: Validates partial deliveries record accurate `short_qty` and `SHORTAGE` status.
   - `test_reconciliation_excess_receipt`: Validates surplus dock arrivals compute `excess_qty` and `EXCESS` status.
   - `test_reconciliation_pending_approval_and_promotion`: Validates manager approval transitions pending events to approved stock.
   - `test_reconciliation_multiple_receipt_deliveries`: Validates sequential split truck deliveries aggregate accurately.
   - `test_reconciliation_rejections_tracking`: Validates inspection rejections log rejection reasons without inflating received stock.
   - `test_reconciliation_variant_matching`: Validates multi-dimensional variant matching across Article, Color, and Size.
   - `test_reconciliation_multi_tenant_isolation`: Validates company multi-tenant isolation prevents cross-tenant data leakage.
2. **PSV Regression Suite:** `backend/app/tests/test_psv.py` and `backend/app/tests/test_psv_store_mapping.py` (16/16 passed).
3. **Frontend Compilation & Linting:** `npm run lint` (`tsc --noEmit`) exited with code 0 (0 errors).

---

## 9. Verification Results
- **Pytest (New Suite):** 9/9 passed in 57.74s
- **Pytest (Regression Suites):** 16/16 passed
- **Total Backend Verification:** 25/25 passed
- **TypeScript Static Analysis:** 0 compiler errors (`tsc --noEmit` exit code 0)

---

## 10. Known Limitations
- Automatic e-Way Bill OCR parsing is currently simulated through manual receiving entry; automated PDF extraction will be integrated in Phase 4.

---

## 11. Future Work
- Integration with statutory Goods Received Note (GRN) PDF printing directly from the PSV receiving modal.
- Automated debit note draft generation for chronic supplier or transporter delivery shortages.

---

## 12. Related ADRs
- `ADR-042`: SMRITI System Parameters & Mutability Governance
- `ADR-PSV-01`: Multi-Dimensional Footwear/Apparel Catalog Reconciliation

---

## 13. Related RFCs
- `RFC-PSV-2026-01`: Sales Tax Invoice Integration with Party Stock Visibility

---

<!-- End of Walkthrough -->
