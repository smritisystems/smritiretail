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
  Classification: Internal Journey Analysis
-->

# SMRITI RETAIL OS — USER JOURNEY MAP & EFFICIENCY BENCHMARKS

## Journey 1: POS Retail Checkout Flow (Cashier Workflow)
```text
Open POS Desk ➔ Select/Scan Items ➔ Set Quantities ➔ Tender Payment ➔ Print Invoice
```
- **Current Clicks**: 3 clicks (Scan item, click Pay, click Confirm).
- **Target Clicks**: 2 clicks (Scan barcode auto-inserts item; single click Payment & Print).
- **Fields Required**: 0 (Auto-defaults to Walk-in Customer & Cash tender).
- **Estimated Task Time**: **< 12 seconds per transaction**.
- **Friction Points Eliminated**: No manual customer phone requirement for walk-in cash sales; keyboard shortcuts (`F2` focus search, `F8` tender payment, `Ctrl+P` print).

---

## Journey 2: New Item Onboarding (Inventory Manager Workflow)
```text
Open Item Master ➔ Click New Item ➔ Enter Product Details ➔ Set HSN & Tax ➔ Save SKU
```
- **Current Clicks**: 4 clicks.
- **Fields Required**: Item Name, Brand, MRP, Selling Price, Tax % (HSN default populated).
- **Estimated Task Time**: **< 30 seconds per item**.
- **Batch Alternative**: Excel Grid Entry allows batch importing 1,000+ SKUs in a single file upload.

---

## Journey 3: Procurement & GRN Goods Receipt (Purchase Officer Workflow)
```text
Open Purchase Studio ➔ Select Supplier ➔ Select PO ➔ Verify Received Qty ➔ Save GRN
```
- **Current Clicks**: 4 clicks.
- **Estimated Task Time**: **< 45 seconds per GRN receipt**.
- **Ledger Connectivity**: Inventory stock ledger automatically incremented upon GRN posting.

---

## Journey 4: Sales Quotation to Billing (Sales Executive Workflow)
```text
Open Sales Studio ➔ Create Quote ➔ Send to Customer ➔ Convert to Invoice ➔ Process Payment
```
- **Current Clicks**: 3 clicks (Create Quote -> Convert to Invoice -> Record Payment).
- **Single Workspace Principle**: Single unified Sales Studio avoids duplicate screen switching.
