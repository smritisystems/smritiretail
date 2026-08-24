<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Audit Document
-->

# SMRITI RETAIL OS — SCREEN INVENTORY

## 1. Authentication & System Screens
- **`LoginScreen`** (`src/components/LoginScreen.tsx`)
  - **Purpose**: Authenticate user credentials.
  - **Forms**: Username/Email, Password, Store/Counter selector.
  - **Primary Action**: Login -> POST `/api/v1/auth/token`.
  - **Taskbar Isolation**: Taskbar unmounts completely on this screen.
- **`PasswordResetScreen`** (`src/components/PasswordResetScree.tsx`)
  - **Purpose**: Password recovery & reset.
  - **Forms**: User email, OTP verification, New password input.
  - **Primary Action**: Reset Password -> POST `/api/v1/auth/reset-password`.

## 2. Core Operational Workspaces
- **`PosTerminalTab` & `AdvancedBillingEngine`** (`src/components/PosTerminalTab.tsx`, `AdvancedBillingEng.tsx`)
  - **Purpose**: Rapid billing & POS checkout desk.
  - **Primary Actions**: Item barcode scan, cart line item qty edit, customer lookup, apply discount, tender payment, print invoice.
  - **Modals**: Process Sales Return (`ProcessSalesReturn.tsx`), Print Preview (`PrintPreviewModal.tsx`).
- **`SalesStudioTab`** (`src/components/SalesStudioTab.tsx`)
  - **Purpose**: Sales order management, quotation, delivery challans, credit notes.
  - **Primary Actions**: Create Sales Order, Convert Quote to Invoice, Dispatch Order (`PrepareDispatchDlg.tsx`).
  - **Tables**: Filterable sales documents with status badges (Draft, Confirmed, Invoiced, Cancelled).
- **`PurchaseStudioTab`** (`src/components/PurchaseStudioTab.tsx`)
  - **Purpose**: Procurement, GRN, vendor invoice entry, debit notes.
  - **Primary Actions**: Create Purchase Order, Receive GRN, Record Supplier Invoice, Create Debit Note (`CreateDebitNoteDlg.tsx`).
  - **Tables**: Purchase documents list, vendor selection modal (`CreateSupplierModal.tsx`).
- **`ItemMasterTab`** (`src/components/ItemMasterTab.tsx`)
  - **Purpose**: SKU catalog, price list, variant matrix, HSN mapping.
  - **Primary Actions**: New Item Entry, Excel Grid Batch Entry (`ExcelGridEntrySec.tsx`), Variant Template Generator (`VariantTemplateSec.tsx`), Barcode Mapping (`BarcodeMappingSec.tsx`).

## 3. Administrative & Financial Workspaces
- **`CustomerMasterTab` & `CrmStudioTab`** (`src/components/CustomerMasterTab.tsx`, `CrmStudioTab.tsx`)
  - **Purpose**: Customer database, credit limits, interaction history.
  - **Primary Actions**: Add Customer, Assign Price List, View Order History.
- **`BusinessLedgerTab` & `StockLedgerTab`** (`src/components/BusinessLedgerTab.tsx`, `StockLedgerTab.tsx`)
  - **Purpose**: Accounting vouchers, trial balance, real-time stock ledger logs.
  - **Primary Actions**: Voucher Entry, Stock Adjustment, Reconciliation.
- **`ReportDesignerTab`** (`src/components/ReportDesignerTab.tsx`)
  - **Purpose**: Custom reporting & business intelligence.
  - **Primary Actions**: Execute SQL Query, Save Report Template, Export to Excel/PDF.
- **`DataExchangeTab` & `AccountingSyncTab`** (`src/components/DataExchangeTab.tsx`, `AccountingSyncTab.tsx`)
  - **Purpose**: Data import/export & Tally integration.
  - **Primary Actions**: Bulk Excel Upload (`BulkImportSection.tsx`), Sync Ledgers.

## 4. Standalone Popout Window Workspace
- **`StandaloneWindowView`** (`src/App.tsx` lines 580-627)
  - **Purpose**: Full-screen standalone popup view outside main application shell when opened via `?standalone_tab=<module_id>`.
  - **Primary Actions**: Full-screen module interaction, Dock Back, Close Window.
