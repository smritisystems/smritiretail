<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.0.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS v5.0 — Enterprise Billing Terminal Framework Architecture Specification

## 1. Objective
Completely refactor the existing Billing module into a modern, standalone Enterprise Billing Terminal Framework. Decouple POS and Tax Invoice terminals from Sales Studio, providing fullscreen scanner-optimized layouts, keyboard-first navigation, and extensibility interfaces for future document terminals.

## 2. Design Principles
The Billing Terminal Framework shall adhere to the following principles:
- **Keyboard First:** 100% keyboard operable without requiring a mouse for standard checkout.
- **Barcode First:** Instant scanner focus, continuous scanning support, and automatic item addition.
- **Offline First:** Fallback to local queue storage (IndexedDB) during network disconnects.
- **Configuration Driven:** Grid columns, keyboard shortcuts, print receipt structures, and button visibilities are customizable.
- **Plugin Extensible:** Support pluggable payment, barcode, pricing, and hardware adapters.
- **High Performance:** Sub-150ms scan addition and sub-100ms UI response limits.
- **Minimal Clicks:** Streamlined workflows to minimize operations required per sale.
- **Enterprise Security:** Granular cashier role overrides and permission scopes.
- **Multi-Tenant Scopes:** Native support for Multi-Company, Multi-Branch, Multi-Warehouse, and Multi-Terminal cashier desks.

## 3. Supported Billing Modes
The framework shall architecturally support the following modes:
- Retail POS
- Tax Invoice (GST B2B)
- Cash Sale
- Credit Sale
- Sales Return (Reference-linked)
- Return Without Reference
- Exchange / Mixed Billing
- Quotation Terminal (Future)
- Sales Order Terminal (Future)
- Delivery Challan Terminal (Future)
- Proforma Invoice (Future)
- Layaway / Installment Billing (Future)
- Advance Receipt & Adjustment (Future)
- Gift Voucher Billing
- Service & Repair Billing (Future)

## 4. Cashier Workflow
Standard operational pipeline:
```text
Login ➔ Open Shift (Float Cash) ➔ Open POS Terminal ➔ Scan Items ➔ Apply Customer ➔ Payment ➔ Print Receipt ➔ Next Bill ➔ Close Shift (Drawer Settle) ➔ Settle Logs ➔ Logout
```

## 5. Shift Management & Drawer Lifecycle
- **Shift Lifecycle:**
  ```text
  Open Shift ➔ Cash Float ➔ Billing ➔ Cash Drop ➔ Payout ➔ Settlement ➔ Close Shift ➔ Approval
  ```
- **Drawer Controls:** Track "Cash In" (deposits) and "Cash Out" (drops/refunds) and reconcile cash drawer kicks.
- **Close Shift & Settle:** Calculate expected cash (Opening + Cash Sales - Drops - Cash Returns) against declared physical cash, logging discrepancies.

## 6. Price Resolution Engine
Pricing resolves through the following precedence sequence:
```text
Customer Contract Price ➔ Customer Price List ➔ Active Promotion Price ➔ Seasonal Scheme Offer ➔ Branch Default Price ➔ Item MRP ➔ Manual Price Override (Permission Dependent) ➔ Manager Approval PIN Workflow
```

## 7. Discount Resolution
Discount resolutions cascade in the following precedence hierarchy:
```text
Line Item Discount ➔ Invoice/Bill-level Flat/Percent Discount ➔ Coupon Code Deductions ➔ Loyalty Points Redemption ➔ Manager Approval PIN Override
```

## 8. Universal Search Framework
A unified search helper service supporting queries across multiple domains:
- **Customer:** Code, Name, Mobile, GSTIN, or Membership ID.
- **Product:** Barcode, SKU, Item Code, Alias, or Supplier Code.
- **Document / Batch:** Invoices, Quotations, Sales Orders, Batches, Serials, or Gift Vouchers.
- **Salesperson:** Code, name, or employee ID.

## 9. Hardware Abstraction Layer (HAL)
Standardized peripheral adapter interface:
```text
Billing Terminal Interface
           ↓
Hardware Abstraction Layer (HAL)
 ├── Barcode Scanner Adapter
 ├── ESC/POS Printer Adapter
 ├── Cash Drawer Trigger Adapter (RJ11)
 ├── Electronic Weighing Scale Adapter
 ├── Customer Display / Pole Adapter
 └── Customer-Facing Display Integration (HDMI/Web Socket)
```

## 10. Configuration Engine
Administrators can customize terminal features without changing source code:
- Toolbar button options
- Keyboard shortcut mappings
- Table grid columns and order
- Receipt printing templates (A4 vs 80mm thermal)
- Payment mode availability
- Barcode duplicate scanner timeouts
- Salesperson assignment modes (Disabled, Single, Line-level, Mandatory, Optional)

## 11. Salesperson & Commission Engine
The billing terminal shall support configurable salesperson assignment to ensure commission calculations and targets are tracked at the individual employee level:
- **Assignment Modes:**
  - **Disabled:** No salesperson tracking.
  - **Single Salesperson per Invoice:** One salesperson credited with the entire bill.
  - **Line-level Salesperson:** Different salesperson assigned per item row in the grid.
  - **Auto Assign:** Default to the currently logged-in cashier.
- **Capabilities:**
  - Lookup by Employee code or name.
  - Integration with Incentive/Target calculation modules.
  - Shift and Attendance Mapping validation.
- **B2B wholesaling support:** Mappings for Sales Executives, Account Managers, and Territory Managers.

## 12. Security & Approval Integration
Supervisor/Manager PIN approvals are required for the following operations:
- Price Overrides
- Discounts exceeding standard Cashier Limits
- Returns without reference documents
- Credit sales exceeding Customer Credit Limits
- Manual Cash Drawer openings (Non-sale drawer kicks)
- Voiding Invoices
- Deleting cart lines after payment selection has started

## 13. Document Lifecycle
Every invoice or return follows a strict state machine:
- **Invoicing:**
  ```text
  Draft ➔ Scanning ➔ Validated ➔ Payment ➔ Printed ➔ Completed ➔ Synced ➔ Posted
  ```
- **Returns:**
  ```text
  Invoice ➔ Return Requested ➔ Approved (Optional) ➔ Credit Note Issued ➔ Posted
  ```

## 14. Multi-Terminal Synchronization
Maintains transaction ordering across multiple counters using local sync queues and PostgreSQL integrations:
```text
Terminal A / B / C ➔ Local Offline Queue (IndexedDB) ➔ FastAPI Conflict Resolver (Sequence Checks) ➔ Stock/Inventory Ledger updates ➔ Financial Accounts Posting
```

## 15. Session Recovery & Availability
Expected terminal recovery behavior:
- **Browser Refresh / Power Loss:** Auto-save transaction drafts locally in IndexedDB to resume checkout instantly on recovery.
- **Network Loss:** Seamless switch to Offline mode, caching committed invoices to local sync queue.
- **Hardware Disconnect:** Cache print files locally and retry once scanner/printer reconnects.

## 16. Non-Functional Requirements (NFR)
- **Latency:** Item scanner addition < 150ms. UI render loop < 100ms.
- **Scale:** Maintain stable 60 FPS scrolling and zero memory leaks for 1000+ line invoices and 500+ consecutive sessions.
- **Recoverability:** Local draft state remains intact after browser refreshes or connectivity dropouts.

## 17. Out of Scope (v5.0)
- Self-Checkout Terminal UI
- AI-Vision Product Billing
- Voice-Command Invoice Entry
- Mobile POS App
- Kitchen Display Systems (KDS)
- Restaurant Table Management
- Fuel Pump Dispenser Integration

---

> **Architecture Freeze:** The Billing Terminal Framework architecture is frozen under v5.0. Subsequent changes must be proposed through Architecture Decision Records (ADRs) to preserve architectural consistency while allowing controlled evolution.
