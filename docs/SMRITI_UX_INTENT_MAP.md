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
  Classification: Internal Intent Audit Map
-->

# SMRITI RETAIL OS — USER INTENT MAPPING

| Module | User Intent | Target Screen | User Action | System Execution | Expected Result |
|---|---|---|---|---|---|
| **POS Billing** | Rapid checkout | `PosTerminalTab` | Scan barcode or type SKU | Item search & cart insertion | Line item added with price & tax calculated |
| **POS Billing** | Customer identification | `PosTerminalTab` | Type customer phone or name | Auto-lookup in customer store | Customer selected, credit balance loaded |
| **POS Billing** | Take payment | `PosTerminalTab` | Click Tender & select cash/card/UPI | Post to `/api/v1/pos/bill` | Invoice saved, stock deducted, receipt printed |
| **Sales Studio** | Create sales quotation | `SalesStudioTab` | Click New Quotation, select customer & items | Save document | Quotation saved with document number assigned |
| **Sales Studio** | Convert quote to invoice | `SalesStudioTab` | Click Convert to Invoice | Post to `/api/v1/sales/convert` | Sales invoice generated, status updated |
| **Item Master** | Onboard new product | `ItemMasterTab` | Click New Item, enter name/brand/MRP/tax | Save SKU details | Product saved in database, barcode mapped |
| **Item Master** | Batch product upload | `ItemMasterTab` | Upload Excel file | Parse file via `ExcelGridEntrySection` | Batch items created with validation report |
| **Purchase** | Create purchase order | `PurchaseStudioTab` | Click New PO, select vendor & items | Save PO document | Purchase order issued to supplier |
| **Purchase** | Receive GRN goods | `PurchaseStudioTab` | Click Receive GRN against PO | Post to `/api/v1/purchase/grn` | Inventory updated in stock ledger |
| **Inventory** | Audit stock ledger | `StockLedgerTab` | Filter by SKU / Warehouse / Date | Query `/api/v1/inventory/ledger` | Real-time stock movement ledger displayed |
| **Reporting** | Generate P&L report | `ReportDesignerTab` | Select date range & run report | Query `/api/v1/reports/financial` | P&L statement generated with export options |
