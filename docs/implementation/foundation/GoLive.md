<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Go-Live Remediation Implementation Plan — v1.0

## 1. Objective
Remediate the 8 primary operational blockers identified in the **Read-Only Forensic Go-Live Readiness Audit**, enabling real business users to complete the entire 3-Day User Training Program workflow (`Master Creation → PO → GRN → Stock → Sales → GST Invoice → Print → E-Way Bill → Dispatch → Return`) directly from the UI without developer intervention, database manipulation, or hardcoded mock data.

## 2. Business Motivation
The read-only audit against standard `SMRITI_Retail_OS_3-Day_User_Training_Program_FINAL_v1.1.docx` revealed that while Day 1 Item/Customer Masters and Day 3 Sales Billing/A4 Tax Invoice Printing are fully functional (`PASS`), Day 2 Procurement is `NOT READY` because [`SupplierDashTab.tsx`](file:///F:/SMRITRretailNX/src/components/SupplierDashTab.tsx) displays 100% hardcoded mock data with no UI form to create a Supplier Master. This leaves the `suppliers` database table at 0 rows, blocking PO issuance and GRN material receipt.

## 3. Scope & Safety Constraints
- **Preserve SMRITI Single Workspace Principle**: All UI updates occur within existing tab layout.
- **No Redesign of Working Modules**: Do NOT touch working modules (`ItemMasterTab.tsx`, `CustomerMasterTab.tsx`, `PosTerminalTab.tsx`, `TaxInvoicePrintPag.tsx`).
- **Frozen Tattly Threads A4 Format**: Do NOT touch `TaxInvoiceA4.tsx` or corrected Tattly Threads invoices.
- **No Database Migrations Yet**: Utilize existing SQLAlchemy models and PostgreSQL database tables.
- **No GST/Pricing/Quantity Alterations**: Maintain exact statutory GST 5% exclusive calculation rules.

---

## 4. Blocker Breakdown & Remediation Specifications

---

### Blocker 1: Supplier Master Creation UI
- **Existing UI**: [`src/components/SupplierDashTab.tsx`](file:///F:/SMRITRretailNX/src/components/SupplierDashTab.tsx)
- **Existing API**: `POST /api/v1/purchase/suppliers` & `GET /api/v1/purchase/suppliers` in [`backend/app/api/v1/purchase.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/purchase.py)
- **Existing DB Table**: `suppliers` (SQLAlchemy `app/models/crm.py` / `app/models/tenant.py`)
- **Missing Piece**: A "Create Supplier" modal component (`CreateSupplierModal.tsx`) and wiring `SupplierDashTab.tsx` directory view to fetch live suppliers from API.
- **Minimal Implementation Required**:
  1. Add "Create Supplier" button and modal form in `SupplierDashTab.tsx` accepting Supplier Name, GSTIN, Address, State Code, Contact Details, Payment Terms.
  2. Post submission payload to `apiFetchV1("/purchase/suppliers", { method: "POST", body: ... })`.
  3. Fetch live supplier list on mount via `apiFetchV1("/purchase/suppliers")`.
- **Dependencies**: Existing FastAPI `/purchase/suppliers` endpoint.
- **Tests Required**: Pytest `test_supplier_crud.py` asserting supplier creation, GSTIN validation, and DB persistence.
- **Training-Manual Acceptance Criterion**: Day 1 Module 2 — *"User can create a supplier with name, contact details, address, GSTIN, state code, payment terms and verify the supplier record in the system."*

---

### Blocker 2: Purchase Order Workflow
- **Existing UI**: [`src/components/PurchaseStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/PurchaseStudioTab.tsx)
- **Existing API**: `POST /api/v1/purchase/orders`, `GET /api/v1/purchase/orders`, `POST /workflow/PurchaseOrder/{id}/approve`
- **Existing DB Table**: `purchase_orders` & `purchase_order_items`
- **Missing Piece**: Supplier selection dropdown in `PurchaseStudioTab.tsx` is currently empty due to 0 database suppliers.
- **Minimal Implementation Required**:
  1. Wire supplier selection search box in `PurchaseStudioTab.tsx` to `GET /api/v1/purchase/suppliers`.
  2. Wire item selection to `GET /api/v1/inventory/search`.
  3. Submit PO payload to `POST /api/v1/purchase/orders`.
  4. Trigger approval via `/workflow/PurchaseOrder/{id}/approve`.
- **Dependencies**: Blocker 1 (Supplier Master Creation).
- **Tests Required**: Pytest `t_po_flow.py` asserting PO creation, line item calculation, and approval workflow status change.
- **Training-Manual Acceptance Criterion**: Day 2 Module 1 — *"User can create a Purchase Order for a supplier, select item, specify quantity and rate, expected delivery date, save and approve PO."*

---

### Blocker 3: GRN / Material Receipt Workflow
- **Existing UI**: [`src/components/PurchaseStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/PurchaseStudioTab.tsx) (GRN sub-tab)
- **Existing API**: `POST /api/v1/purchase/receipts`, `GET /api/v1/purchase/receipts`
- **Existing DB Table**: `purchase_receipts` & `purchase_receipt_items`
- **Missing Piece**: Wiring the GRN tab in `PurchaseStudioTab.tsx` to select approved POs, record received/shortage quantities, and trigger stock ledger increments.
- **Minimal Implementation Required**:
  1. Add PO selector dropdown calling `GET /api/v1/purchase/orders?status=Approved`.
  2. Auto-populate item rows with ordered quantity; provide editable `received_qty` and `short_qty` input fields.
  3. Submit GRN via `POST /api/v1/purchase/receipts`.
  4. Record stock movement in `stock_movements` table (`PO -> GRN -> Stock +X`).
- **Dependencies**: Blocker 2 (PO Workflow).
- **Tests Required**: Pytest `t_grn_stock.py` asserting GRN receipt, shortage calculation (`Received 48, Short 2`), and available stock increment (`+48`).
- **Training-Manual Acceptance Criterion**: Day 2 Module 2 & 3 — *"User can receive goods against an approved PO, record physical quantity received, record shortage/excess, and verify stock increment in available inventory."*

---

### Blocker 4: Purchase Invoice / Supplier Bill Workflow
- **Existing UI**: [`src/components/PurchaseStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/PurchaseStudioTab.tsx) (Invoices sub-tab)
- **Existing API**: `POST /api/v1/purchase/invoices`, `GET /api/v1/purchase/invoices`
- **Existing DB Table**: `sales_invoices` (with company/tenant context) & `supplier_payments`
- **Missing Piece**: Converting confirmed GRN records into posted Supplier Purchase Bills in UI.
- **Minimal Implementation Required**:
  1. Allow selecting confirmed GRN to auto-populate Purchase Bill line items, taxable values, and GST amounts.
  2. Post purchase bill via `POST /api/v1/purchase/invoices`.
  3. Update supplier payables ledger.
- **Dependencies**: Blocker 3 (GRN Workflow).
- **Tests Required**: Pytest `t_purch_invoice.py` asserting GRN-to-Invoice conversion and supplier payables update.
- **Training-Manual Acceptance Criterion**: Day 2 Module 4 — *"User can record a supplier purchase invoice with invoice number, date, purchase value, GST, discount, and payment status."*

---

### Blocker 5: Purchase Return / Debit Note Workflow
- **Existing UI**: [`src/components/PurchaseStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/PurchaseStudioTab.tsx) (Returns tab)
- **Existing API**: `POST /api/v1/purchase/debit-notes` / `POST /api/v1/purchase/returns`
- **Existing DB Table**: `supplier_debit_notes`
- **Missing Piece**: UI modal form in `PurchaseStudioTab.tsx` for creating Debit Notes against short receipts or damaged goods.
- **Minimal Implementation Required**:
  1. Create "Issue Debit Note" modal form in `PurchaseStudioTab.tsx`.
  2. Select Supplier & GRN/Invoice reference; specify returned item, quantity, and reason (Damaged/Short/Wrong Rate).
  3. Post via API to insert into `supplier_debit_notes` and adjust stock/payables.
- **Dependencies**: Blocker 4 (Supplier Bill Workflow).
- **Tests Required**: Pytest `test_debit_note.py` asserting Debit Note creation and stock reversal.
- **Training-Manual Acceptance Criterion**: Day 2 Module 5 — *"User can process purchase returns for short receipts, damaged goods, or wrong items by creating a Debit Note through the correct business process."*

---

### Blocker 6: Sales Return / Credit Note UI
- **Existing UI**: [`src/components/SalesStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/SalesStudioTab.tsx) & [`src/components/PosTerminalTab.tsx`](file:///F:/SMRITRretailNX/src/components/PosTerminalTab.tsx)
- **Existing API**: `POST /api/v1/sales/returns/` in [`backend/app/api/v1/sales.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/sales.py)
- **Existing DB Table**: `sales_returns` & `sales_return_items`
- **Missing Piece**: A UI modal form in `SalesStudioTab.tsx` ("Process Sales Return / Credit Note") allowing the user to select a finalized invoice, choose returned items & quantities, specify return reason, and issue a Credit Note.
- **Minimal Implementation Required**:
  1. Add "Process Return" button on finalized invoice rows in `SalesStudioTab.tsx`.
  2. Open "Process Sales Return" modal displaying original items and quantities.
  3. Submit return payload to `POST /api/v1/sales/returns/`.
  4. Create `sales_returns` record, restore inventory to stock ledger, and generate Credit Note PDF.
- **Dependencies**: Existing `/sales/returns/` API.
- **Tests Required**: Pytest `t_sales_return.py` asserting Credit Note generation, inventory reinstatement, and history protection.
- **Training-Manual Acceptance Criterion**: Day 3 Module 6 — *"User can handle sales returns for wrong item, wrong quantity, or wrong rate by issuing a Credit Note through the approved business process."*

---

### Blocker 7: E-Way Bill & Dispatch Workflow UI
- **Existing UI**: [`src/components/SalesStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/SalesStudioTab.tsx) & [`src/components/TaxInvoicePrintPag.tsx`](file:///F:/SMRITRretailNX/src/components/TaxInvoicePrintPag.tsx)
- **Existing API**: `POST /api/v1/sales/eway-bills` & `dispatch_import.py`
- **Existing DB Table**: `eway_bills` & `stock_dispatches`
- **Missing Piece**: UI modal in `SalesStudioTab.tsx` for entering E-Way Bill transport details (Transporter Name/ID, LR No, Vehicle No) and updating dispatch status ("Packing", "In Transit", "Dispatched").
- **Minimal Implementation Required**:
  1. Add "Prepare Dispatch / E-Way Bill" modal in `SalesStudioTab.tsx`.
  2. Accept Transporter ID, Vehicle Number, LR Date/No, and E-Way Bill Number.
  3. Save dispatch metadata to `eway_bills` table and update invoice dispatch status.
- **Dependencies**: Existing sales invoice endpoints.
- **Tests Required**: Pytest `t_eway_dispatch.py` asserting E-Way Bill persistence and dispatch status tracking.
- **Training-Manual Acceptance Criterion**: Day 3 Module 5 — *"User can record E-Way Bill number, transport details, vehicle/LR information, and verify dispatch status."*

---

### Blocker 8: Wire/Remove All Identified Mock Business KPI Data
- **Existing UI**: [`src/components/SupplierDashTab.tsx`](file:///F:/SMRITRretailNX/src/components/SupplierDashTab.tsx), [`src/components/QuickReportsWidget.tsx`](file:///F:/SMRITRretailNX/src/components/QuickReportsWidget.tsx), [`src/components/CrmStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/CrmStudioTab.tsx)
- **Existing API**: `GET /api/v1/reports/supplier-ledger/{id}`, `GET /api/v1/reports/daily-sales`, `GET /api/v1/crm/customers`
- **Existing DB Table**: `suppliers`, `sales_invoices`, `customers`
- **Missing Piece**: Component state in `SupplierDashTab.tsx`, `QuickReportsWidget.tsx`, and `CrmStudioTab.tsx` uses hardcoded literals (`₹4,25,800`, `24 vendors`, `₹48.5L leads`).
- **Minimal Implementation Required**:
  1. Replace static KPI numbers in `SupplierDashTab.tsx` with dynamic calculations fetched from `GET /api/v1/purchase/suppliers` and `GET /api/v1/reports/stock-valuation`.
  2. Wire `QuickReportsWidget.tsx` sales trend to `GET /api/v1/reports/daily-sales`.
  3. Wire `CrmStudioTab.tsx` metrics to `GET /api/v1/crm/customers`.
- **Dependencies**: Blockers 1 & 4.
- **Tests Required**: Pytest & Vite build verifying 0 hardcoded KPI numbers on dashboard widgets.
- **Training-Manual Acceptance Criterion**: Section "No Mock / No Demo Data Rule" — *"Primary business outputs and dashboards must reflect authoritative database state without depending on hardcoded fake data."*

---

## 5. Files to be Created / Modified
- `src/components/CreateSupplierModal.tsx` **[NEW]**
- `src/components/CreateDebitNoteDlg.tsx` **[NEW]**
- `src/components/ProcessSalesReturn.tsx` **[NEW]**
- `src/components/PrepareDispatchDlg.tsx` **[NEW]**
- `src/components/SupplierDashTab.tsx` **[MODIFY]**
- `src/components/PurchaseStudioTab.tsx` **[MODIFY]**
- `src/components/SalesStudioTab.tsx` **[MODIFY]**
- `src/components/QuickReportsWidget.tsx` **[MODIFY]**
- `src/components/CrmStudioTab.tsx` **[MODIFY]**

---

## 6. Verification & Acceptance Plan
1. **Automated Pytest Battery**:
   - `test_supplier_crud.py`
   - `t_po_flow.py`
   - `t_grn_stock.py`
   - `t_purch_invoice.py`
   - `test_debit_note.py`
   - `t_sales_return.py`
   - `t_eway_dispatch.py`
2. **Frontend Production Build**: `npx vite build` (0 errors).
3. **Headless E2E Workflow Run**: Execute complete 3-day transaction journey (`Supplier -> PO 50 -> GRN 48 -> Short 2 -> Stock +48 -> POS Sale 5 -> Expected Stock 43`).
