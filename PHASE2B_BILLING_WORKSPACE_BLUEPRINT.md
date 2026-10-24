<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-09-08
  Modified     : 2026-09-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Policy Specification (Phase 2B)
-->

# Phase 2B — SMRITI Workspace Consolidation Blueprint & Canonical Financial Contract

**Document ID:** SMRITI-SPEC-ARCH-2026-09-2B  
**Version:** 1.0.0  
**Status:** ESTABLISHED (Phase 2B Baseline)  
**Classification:** Canonical Architecture Specification  
**Dependencies:** `PHASE2A_POS_CONTRACT.md`, `PHASE2B_FINANCIAL_POLICY.md`, `PHASE2B_CANONICAL_POSTING_CONTRACT.md`  

---

## 1. Executive Summary & Core Architectural Principle

Empirical audit of the repository confirmed **widespread, systemic duplication** across both the frontend client and backend services:
- **56 duplicated frontend UI components/studios** (2.2 MB, 35,632 lines).
- **57 duplicated backend services and API router modules** (1.24 MB, 26,629 lines).
- Totaling **113 files, 3.45 MB, and over 62,200 lines of competing code**.

The primary fracture point is **Billing**: the platform currently exposes three separate top-level launchpad workspaces (**Billing Desk / POS**, **Sales Studio**, and **Create Tax Invoice**), backed by 5 competing billing UI screens and 4 competing backend sales invoice writers.

### Core Architectural Principle: One Workspace Per Business Domain

```text
                                  SMRITI RETAIL OS
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  BILLING WORKSPACE              PURCHASE WORKSPACE               INVENTORY WORKSPACE
  (Consolidate First)             (Subsequent Phase)               (Subsequent Phase)
        │
        └── NEW SALE (Single Transaction Entry Surface)
              │
              ├── [Policy Context: Retail POS]       (Speed barcode scanning, shift/cashier context, MRP-inclusive)
              ├── [Policy Context: B2B / GST]        (Customer GSTIN, reverse charge, interstate IGST, A4 Tax Invoice)
              ├── [Policy Context: Credit Customer]  (Credit limit check, payment terms net-30, ledger debit)
              └── [Order Source Context]             (Customer PO, Sales Order, Omnichannel / E-com reservation)
                    │
                    ▼
      CANONICAL SALES/BILLING POSTING CONTRACT
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
  Physical Stock  Payments     Unified GL
     (WMS)        Engine        Ledger
```

**Architectural Law:** POS Bill, Tax Invoice, and Credit Invoice are **not separate modules or workspaces**. They are **transaction policies/contexts within ONE Billing Workspace**.

Similarly, a Customer PO, Sales Order, or E-commerce Order is a **source/upstream context** feeding into the same canonical billing transaction authority.

---

## PART A — Billing Workspace Blueprint

### A.1 Capability Characterization of Existing Implementations

We characterize the 8 existing components that currently share or compete for billing responsibilities:
1. `ProPosBillingTerm` (`src/components/billing/propos/ProPosBillingTerm.tsx`, 80 KB, 1,814 lines)
2. `BillingTerm` (`src/components/billing/BillingTerm.tsx`, 136 KB, 2,887 lines)
3. `DistTaxInvoice` (`src/components/sales/DistTaxInvoice.tsx`, 50 KB, 1,092 lines)
4. `SalesStudioTab` (`src/components/SalesStudioTab.tsx`, 231 KB, 4,056 lines)
5. `SalesOrderFormPremium` (`src/components/sales/SalesOrderFormPremium.tsx`, 87 KB, 1,936 lines)
6. `AdvancedBillingEng` (`src/components/AdvancedBillingEng.tsx`, 1.8 KB, 64 lines)
7. `ProPosWs` (`src/components/billing/propos/ProPosWs.tsx`, 9.5 KB, 233 lines)
8. `launchpadCatalog` (`src/components/launchpad/launchpadCatalog.ts`, 15.5 KB, 492 lines)

#### Classification Taxonomy:
- **A** = Canonical Billing Workspace capability (must exist in the consolidated workspace)
- **B** = POS-specific context (applies when cashier/shift/counter is active)
- **C** = B2B/GST-specific policy/context (applies when billing registered parties or wholesale)
- **D** = Sales Order lifecycle capability (belongs to Sales Order management, not direct billing)
- **E** = Legacy/duplicate behavior (redundant code to be deprecated via adapter)
- **F** = Unresolved business policy (`NEEDS_APPROVAL`)

```
┌────────────────────────────────────────┬─────────┬──────────────────────────────────────────┬──────────────┐
│ Capability Description                 │ Class   │ Source Component(s)                      │ Target State │
├────────────────────────────────────────┼─────────┼──────────────────────────────────────────┼──────────────┤
│ Barcode Scanning & Instant Entry       │ A       │ ProPosBillingTerm, BillingTerm           │ Canonical    │
│ Product Typeahead Search & Lookup      │ A       │ ProPosBillingTerm, DistTaxInvoice        │ Canonical    │
│ Customer Search & Identity Resolution  │ A       │ ProPosBillingTerm, BillingTerm, DistTax  │ Canonical    │
│ Walk-in / Cash Customer Default        │ A, B    │ ProPosBillingTerm                        │ Canonical    │
│ Line-level Qty, Rate & Discount Entry  │ A       │ All 5 billing screens                    │ Canonical    │
│ Multi-tender Payment Settlement        │ A       │ ProPosBillingTerm, BillingTerm           │ Canonical    │
│ Split Tenders (Cash + Card + UPI)      │ A       │ ProPosBillingTerm, BillingTerm           │ Canonical    │
│ Thermal Receipt Generation (3"/2")     │ B       │ ProPosBillingTerm, PrintStudio           │ Canonical    │
│ Cashier Shift & Register Association   │ B       │ ProPosBillingTerm, ProPosWs              │ Contextual   │
│ Cash Drawer Kick & Opening/Closing     │ B       │ ProPosBillingTerm, ProPosCashMovesDlg    │ Contextual   │
│ Hold & Recall Cart / Layaway           │ B       │ ProPosBillingTerm (ProPosRecallDlg)      │ Contextual   │
│ Supervisor Price/Discount Override     │ B       │ ProPosBillingTerm, ProPosSupervisorAuth  │ Contextual   │
│ Registered B2B Customer GSTIN Binding  │ C       │ DistTaxInvoice, BillingTerm              │ Contextual   │
│ Statutory Interstate IGST / CGST+SGST  │ C       │ DistTaxInvoice, BillingTerm, core/gst    │ Canonical    │
│ Reverse Charge Mechanism (RCM) Toggle  │ C       │ DistTaxInvoice                           │ Contextual   │
│ E-Way Bill / Transport Distance Inputs │ C       │ DistTaxInvoice, BillingTerm              │ Contextual   │
│ Statutory A4 Tax Invoice PDF Print     │ C       │ DistTaxInvoice, TaxInvoicePrintPage      │ Canonical    │
│ Sizing Matrix Grid Entry (Size x Color)│ C       │ BillingTerm, SalesOrderMatrixEntry       │ Contextual   │
│ Excel / CSV Paste Inward for Lines     │ C       │ BillingTerm, BulkImportSection           │ Contextual   │
│ Customer Credit Limit Validation & Hold│ C       │ BillingTerm, SalesService                │ Canonical    │
│ Customer PO Direct Conversion to Bill  │ A, C    │ CustomerPOService, BillingTerm           │ Canonical    │
│ Sales Order Fulfillment & Backorders   │ D       │ SalesOrderFormPremium, SalesStudioTab    │ Sales Order  │
│ Quotation / Proforma Invoice Lifecycle │ D       │ SalesStudioTab                           │ Sales Order  │
│ Multi-branch Order Routing             │ D       │ SalesStudioTab                           │ Distribution │
│ Competing In-tab Invoicing Switcher    │ E       │ ProPosWs (tabs: BILLING vs INVOICING)    │ Deprecate    │
│ Competing Launchpad Tiles (3 tiles)    │ E       │ launchpadCatalog (pos, sales, create-tax)│ Deprecate    │
│ Monolithic Sales Grid (4,056 lines)    │ E       │ SalesStudioTab                           │ Deprecate    │
│ Standalone Return Modals (3 modals)    │ E       │ ProcessSalesReturn, SalesReturnModal     │ Deprecate    │
│ Unvalidated Cash Customer Phone Over   │ F       │ ProPosBillingTerm                        │ NEEDS_APPR.  │
│ Negative Stock Override Privilege      │ F       │ ProPosBillingTerm, SalesService          │ NEEDS_APPR.  │
└────────────────────────────────────────┴─────────┴──────────────────────────────────────────┴──────────────┘
```

---

### A.2 Target Specification: The Single Billing Workspace

The consolidated **Billing Workspace** (`src/components/billing/BillingWorkspace.tsx`) is a unified, adaptive operational surface. It provides the following sub-systems:

#### 1. Workspace Navigation & Mode Adapters
- Accessible from a single Launchpad tile: **`Billing Workspace`** (Shortcut: `F1`).
- Replaces the 3 redundant launchpad tiles (`pos`, `sales`, `create-tax-invoice`).
- **Context Selector Header:** Allows one-click switching or hotkey toggling between:
  - **Retail POS Mode (`Alt+1`):** Optimized for touch/barcode speed, compact line rows, immediate multi-tender popup, thermal slip printer.
  - **B2B Tax Invoice Mode (`Alt+2`):** Optimized for registered entities, HSN display, tax breakdowns, transport details, statutory A4 PDF preview.
  - **Wholesale Matrix Mode (`Alt+3`):** Sizing matrix grid entry (apparel/footwear), bulk carton paste, credit payment terms.

#### 2. Transaction Header & Customer Resolution
- **Universal Customer Input:** Single typeahead field resolving customer identity via `CustomerIdentityService`.
- **Automatic Context Adaptation:**
  - If Walk-in / Cash: Defaults to Retail B2C context, MRP-inclusive tax.
  - If Registered Business with GSTIN: Automatically prompts to switch to B2B Tax Invoice context, validates state code vs. branch state code to configure CGST+SGST vs. IGST.
  - If Credit Customer: Displays available credit limit, unbilled balance, and terms (e.g., Net 30).

#### 3. Item Entry & Matrix Engine
- Unified barcode scanner listener + typeahead search.
- Supports single SKU addition and apparel Size x Color matrix addition.
- Displays stock on hand (SOH) across active branch warehouses.

#### 4. Pricing, Discounts & Tax Calculation
- Enforces the **Phase 2B Canonical Financial Policy**:
  - Retail Context: MRP-inclusive calculation (`calculate_line_item_tax` with `is_tax_inclusive=True`).
  - B2B Context: Base-rate tax-exclusive calculation.
  - Line discounts reduce the taxable base before GST calculation per CGST Act Section 15(3)(a).
  - Document-level discount distributed proportionally across lines.

#### 5. Shift, Cash Drawer & Cashier Tracking
- Preserves full POS shift context: `shift_id`, `pos_profile_id`, `terminal_id`, `cashier_user_id`.
- Shift active indicator in the top status bar.
- Shift closeout (Z-Report / Day-End) accessible directly from the workspace utility menu.

#### 6. Upstream Order & Source References
- Direct intake drawer for upstream documents:
  - **Customer PO:** Pull PO lines directly into the tax invoice without intermediate conversion.
  - **Sales Order:** Pull approved sales order lines with automated fulfillment tracking.
  - **Omnichannel / E-Commerce:** Pull reserve order with delivery token.

#### 7. Payment & Credit Settlement
- Universal Settlement Sheet (`BillingSettlementModal`):
  - Multi-tender splits: Cash, Credit/Debit Card, UPI / QR, Credit Ledger, Gift Voucher, Loyalty Points.
  - If Credit tender is used: Validates available credit limit; triggers supervisor approval override if limit is exceeded.
  - Change calculation for cash tender.

#### 8. Document Generation & Statutory Output
- On posting: Calls the **Canonical Sales/Billing Authority** endpoint.
- Output actions:
  - Print Thermal Receipt (2" or 3" ESC/POS via QZ Tray or raw print).
  - Print Statutory A4 Tax Invoice (PDF).
  - Send digital receipt via SMS / WhatsApp / Email (via Communicator Engine).
  - Generate IRN / E-Invoice QR (B2B registered transactions).

#### 9. Keyboard & Terminal Ergonomics
- `F1`: Billing Workspace Default
- `F2`: Item Lookup / Scanner Focus
- `F3`: Customer Lookup
- `F4`: Line Discount / Item Edit
- `F5`: Hold / Park Current Bill
- `F6`: Recall Parked Bill
- `F8`: Sizing Matrix Entry Mode
- `F9`: B2B Statutory Details Drawer
- `F10` / `Enter`: Tender & Settlement Dialog
- `F12`: Print Last Invoice / Fast Cash Checkout
- `Esc`: Clear / Cancel Active Input

---

## PART B — Backend Authority Matrix

To prevent the creation of a "god service", backend responsibilities are partitioned strictly across domain-driven authorities:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               BACKEND AUTHORITY DOMAIN BOUNDARIES                                │
├──────────────────────────────────────┬───────────────────────────────────────────────────────────┤
│ Domain Authority                     │ Canonical Service & Target Responsibility                 │
├──────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ Sales / Billing Posting Authority    │ Canonical Sales Transaction Writer (Single Writer)        │
│ Physical Stock & Batches Authority   │ InventoryWmsService (Physical Stock Mutations Only)       │
│ Payment Transactions Authority       │ PaymentsEngine (Payment Splits, Vouchers, Gateways)       │
│ General Ledger Accounting Authority  │ UnifiedAccountingLedgerService (Asynchronous Ledger Sink) │
│ Statutory Tax Authority              │ backend/app/core/gst_engine.py (Single Tax Math Engine)   │
│ Customer Identity & Credit Authority │ CustomerIdentityService & Credit Enforcement Gate         │
│ Documents & PDF Authority            │ DocumentsEngine & InvoicePdfService                       │
│ Event Publishing Boundary            │ OutboxWorker & Canonical Event Envelope                   │
└──────────────────────────────────────┴───────────────────────────────────────────────────────────┘
```

### Detailed Mapping Table:

```
┌───────────────────────────────┬──────────────────────┬──────────────────────┬────────────────────────┬─────────────────────────┬─────────┐
│ Service / Engine              │ Current Authority    │ Target Authority     │ Adapter Role           │ Duplicate Behavior      │ Phase   │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ POSService                    │ Competing Writer     │ Ingress Adapter      │ Maps POS cashier shift │ Calculates tax, writes  │ Phase 2C│
│ (backend/app/services/pos.py) │ Writes invoice, tax, │ Only. Calls          │ context, tenders, and  │ sales_invoices, mutates │         │
│                               │ stock, outbox        │ Canonical Writer.    │ drawer into contract.  │ stock independently.    │         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ SalesService                  │ Competing Writer     │ Ingress Adapter      │ Maps B2B wholesale,    │ Writes sales_invoices,  │ Phase 2C│
│ (backend/app/services/sales.py│ B2B invoice writer,  │ Only. Calls          │ customer PO, transport,│ credit checks, duplicate│         │
│                               │ credit checks        │ Canonical Writer.    │ and HSNs into contract.│ tax math logic.         │         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ UnifiedSalesLedgerService     │ Competing Writer     │ DEPRECATED /         │ Legacy compatibility   │ Parallel invoice post   │ Phase 2C│
│ (sales_ledger_svc.py)         │ Secondary ledger     │ RETIRED              │ bridge during Phase 2C.│ with inconsistent taxes.│         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ DistributionService           │ Competing Writer     │ Ingress Adapter      │ Translates dispatch/DC │ Directly creates invoices│ Phase 2C│
│ (distribution_svc.py)         │ Direct billing writer│ Only. Calls Canonical│ orders into billing.   │ in distribution flows.  │         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ CustomerPOService             │ Billing Orchestrator │ Upstream Source      │ Adapts approved PO     │ Previously lacked direct│ Phase 2C│
│ (customer_po.py)              │ Prepares PO lines    │ Adapter Only.        │ lines into contract.   │ billing adapter.        │         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ PaymentsEngine                │ Fragmented Writer    │ Sole Payment         │ Authorizes cards, UPI, │ POS writes payments     │ Phase 2C│
│ (payments_engine.py)          │ Partial payment auth │ Authority            │ gift cards, validates  │ directly; ledger writes │         │
│                               │                      │                      │ credit limit balance.  │ payments separately.    │         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ InventoryWmsService           │ Physical Stock       │ Sole Physical Stock  │ Executes FIFO/FEFO     │ POS decrements stock    │ Phase 2C│
│ (inventory_wms.py)            │ Authority            │ Writer               │ allocations, moves, and│ directly without WMS    │         │
│                               │                      │                      │ serial/batch reserves. │ ledger movement tracking│         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ GST Engine                    │ Statutory Math       │ Sole Statutory Tax   │ Exposes canonical line │ Inline math formulas in │ Phase 2B│
│ (core/gst_engine.py)          │ Implementation       │ Authority            │ calculation methods.   │ POS & sales services.   │ (Done)  │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ UnifiedAccountingLedgerService│ Accounting Engine    │ Sole GL Authority    │ Consumes committed     │ POS and sales services  │ Phase 2C│
│ (unified_ledger.py)           │ Double-entry poster  │ (Async Outbox Sink)  │ `InvoicePostedEvent`.  │ create ad-hoc vouchers. │         │
├───────────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼─────────┤
│ OutboxWorker & EventEnvelope  │ Event Pipeline       │ Sole Transaction     │ Guarantees at-least-   │ Ad-hoc outbox payload   │ Phase 2C│
│ (outbox_service.py)           │ Async dispatcher     │ Integration Boundary │ once publishing.       │ formats across writers. │         │
└───────────────────────────────┴──────────────────────┴──────────────────────┴────────────────────────┴─────────────────────────┴─────────┘
```

---

## PART C — Canonical Financial Policy Resolution

This section synthesizes and formalizes all 17 financial decisions established in `PHASE2B_FINANCIAL_POLICY.md` and `PHASE2B_CANONICAL_POSTING_CONTRACT.md`. Any decision lacking definitive codebase grounding is labeled `NEEDS_APPROVAL`.

```
┌─────┬───────────────────────────────┬───────────────────────────┬────────────────────────────────────────────────────────────┐
│ No. │ Financial Dimension           │ Resolution Status         │ Canonical Rule / Enforcement Mechanism                     │
├─────┼───────────────────────────────┼───────────────────────────┼────────────────────────────────────────────────────────────┤
│ 1   │ Statutory Tax Calculation     │ RESOLVED                  │ core/gst_engine.py: calculate_line_item_tax()              │
│ 2   │ Tax Determination             │ RESOLVED                  │ Retail POS: MRP-inclusive; B2B Wholesale: Base exclusive   │
│ 3   │ Discount Interaction          │ RESOLVED                  │ Discount reduces taxable value before GST (CGST Sec 15(3)) │
│ 4   │ Currency Rounding             │ RESOLVED                  │ Half-Up to 2 decimal places per line; round-off line header│
│ 5   │ Variant Identity Resolution   │ RESOLVED                  │ (item_id, variant_id) composite key; variant mandatory if  │
│     │                               │                           │ item has variants. Barcode maps to exact variant.          │
│ 6   │ Inventory Mutation Authority  │ RESOLVED                  │ InventoryWmsService.create_movement() sole writer.         │
│ 7   │ Inventory Allocation (FEFO)   │ RESOLVED                  │ Oldest unexpired batch selected first where batch enabled. │
│ 8   │ Stock Movement Cardinality    │ RESOLVED                  │ Exactly 1 movement record per invoice line.                │
│ 9   │ Stock Movement Sign           │ RESOLVED                  │ Positive quantity, movement_type='SALE_DISPATCH' / 'OUT'   │
│ 10  │ Negative Stock Policy         │ NEEDS_APPROVAL            │ POS currently permits negative stock; B2B blocks it.       │
│     │                               │                           │ Proposed: Governed store policy flag (ALLOW_NEGATIVE_STOCK)│
│ 11  │ Invoice Numbering Authority   │ RESOLVED                  │ NumberingEngine (Company DB sequence + FY series prefix).  │
│ 12  │ Idempotency Enforcement       │ RESOLVED                  │ Canonical idempotency_key unique constraint on invoice.    │
│ 13  │ Customer Identity Validation  │ RESOLVED                  │ Validated against Company DB parties table.                │
│ 14  │ Customer Credit Enforcement   │ RESOLVED                  │ PaymentsEngine: total_outstanding + bill_amount <= limit.  │
│ 15  │ Unapproved Credit Override    │ NEEDS_APPROVAL            │ Whether cashier role can override credit limits with pin.  │
│ 16  │ Payment Transaction Atomicity │ RESOLVED                  │ Payment splits committed within the invoice DB transaction.│
│ 17  │ Tenant / Branch Boundary      │ RESOLVED                  │ Caller-controlled Session strictly bounded to Company DB.  │
│ 18  │ POS Shift Invariance          │ RESOLVED                  │ If shift_id provided, must be in OPEN state in Company DB. │
│ 19  │ Accounting Ledger Integration │ RESOLVED                  │ Outbox event: asynchronous double-entry journal creation.  │
│ 20  │ Transaction Ownership         │ RESOLVED                  │ Caller creates, commits, or rolls back the session.        │
└─────┴───────────────────────────────┴───────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## PART D — Frontend Duplication & Migration Strategy

Duplicate UI files must **never be deleted prematurely**. They remain in place until all capabilities are absorbed and all route traffic is safely re-routed.

```
┌───────────────────────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┬─────────────────────────────────────┐
│ Current Component                     │ Target Destination   │ Capability Retained  │ Capability Absorbed  │ Adapter Required     │ Safe Retirement Condition           │
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ ProPosBillingTerm.tsx                 │ BillingWorkspace.tsx │ Barcode scanning,    │ Shift management,    │ POS View Mode        │ 1. All hotkeys supported in unified │
│ (80 KB, 1,814 lines)                  │                      │ fast tenders, UI     │ cash drawer moves,   │ Adapter              │ 2. Shift open/close verified        │
│                                       │                      │ speed, sound alerts. │ hold/recall drawers. │                      │ 3. 100% test parity on POS flows.   │
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ BillingTerm.tsx                       │ BillingWorkspace.tsx │ Matrix grid entry,   │ Customer credit bar, │ Wholesale View Mode  │ 1. Matrix grid entry operational    │
│ (136 KB, 2,887 lines)                 │                      │ carton paste, credit │ transport details,   │ Adapter              │ 2. Credit check parity proven       │
│                                       │                      │ limits, HSN column.  │ A4 PDF print.        │                      │ 3. Distributor invoices match 100%. │
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ DistTaxInvoice.tsx                    │ BillingWorkspace.tsx │ Statutory GST, RCM,  │ Interstate tax math, │ Statutory B2B View   │ 1. Statutory A4 print validated     │
│ (50 KB, 1,092 lines)                  │                      │ transport distance,  │ billing/shipping     │ Mode Adapter         │ 2. E-invoice QR generation verified │
│                                       │                      │ vehicle numbers.     │ party selection.     │                      │ 3. B2B route redirects tested.      │
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ SalesStudioTab.tsx                    │ Split between:       │ Sales order register │ Direct invoicing and │ None (Direct         │ 1. Invoice register moved to reports│
│ (231 KB, 4,056 lines)                 │ 1. BillingWorkspace  │ and quotation        │ quotation generator  │ redirection of tabs) │ 2. Quotations moved to Sales Orders │
│                                       │ 2. SalesOrderTab     │ management.          │ absorbed.            │                      │ 3. Direct sales button calls Billing│
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ SalesOrderFormPremium.tsx             │ SalesOrderWorkspace  │ Advanced sales order │ Invoicing logic      │ Sales Order to       │ 1. Order-to-Invoice conversion      │
│ (87 KB, 1,936 lines)                  │                      │ matrix & fulfillment │ routed to Billing.   │ Billing Adapter      │    verified via canonical contract. │
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ AdvancedBillingEng.tsx                │ DEPRECATE            │ None (stub wrapper)  │ Absorbed.            │ Redirect to Billing  │ Immediate safe retirement.          │
│ (1.8 KB, 64 lines)                    │                      │                      │                      │                      │                                     │
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ ProPosWs.tsx                          │ BillingWorkspace.tsx │ Top workspace shell  │ Competing tab strip  │ Unified Workspace    │ Absorbed into the new               │
│ (9.5 KB, 233 lines)                   │                      │                      │ removed.             │ Container            │ BillingWorkspace root.              │
├───────────────────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────────────────┤
│ launchpadCatalog.ts                   │ Consolidated Tile    │ Quick Action 'F1'    │ Merges 'pos',        │ Launchpad Route      │ All 3 launchpad IDs map to          │
│ (3 competing tiles)                   │                      │                      │ 'sales', 'create-tax'│ Aliases              │ activeTab="billing-workspace".      │
└───────────────────────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┴─────────────────────────────────────┘
```

---

## PART E — Global SMRITI Workspace Consolidation Roadmap

The Single Workspace Principle will be replicated across all 11 business domains in planned future phases:

```
┌─────┬───────────────────────────┬────────────────────────────────┬──────────────────────────────┬───────────────────────────────┐
│ No. │ Business Domain           │ Canonical Single Workspace     │ Canonical Backend Authority  │ Competing Components Absorbed │
├─────┼───────────────────────────┼────────────────────────────────┼──────────────────────────────┼───────────────────────────────┤
│ 1   │ Billing & POS             │ BillingWorkspace.tsx           │ Canonical Sales Authority    │ 5 screens, 4 backend writers  │
│ 2   │ Sales Returns & Refunds   │ SalesReturnWorkspace.tsx       │ SalesReturnPolicyService     │ 3 return modals, 2 adapters   │
│ 3   │ Customer & CRM            │ Customer360Workspace.tsx       │ CustomerIdentityService      │ CustMasterWs, CrmStudioTab,   │
│     │                           │                                │ & CrmService                 │ LoyaltyStudioTab (11 files)   │
│ 4   │ Inventory & WMS           │ InventoryWmsWorkspace.tsx      │ InventoryWmsService          │ WmsStudioTab, PhysicalStockTab│
│     │                           │                                │                              │ WavePicking, StockTransfer    │
│ 5   │ Purchase & Procurement    │ ProcurementWorkspace.tsx       │ PurchaseService              │ PoGenerateTab, AutoPOModal,   │
│     │                           │                                │                              │ 3-Way Match, VendorReturn (9) │
│ 6   │ Item Master & Catalog     │ ItemMasterWorkspace.tsx        │ UniversalItemMasterService   │ item_master_service.py vs     │
│     │                           │                                │ (item_master_svc.py)         │ item_master_svc.py, 2 grids   │
│ 7   │ Party Master (Vend/Cust)  │ UniversalPartyWorkspace.tsx    │ UniversalPartyService        │ party_service.py vs           │
│     │                           │                                │ (univ_party_svc.py)          │ party_master_svc.py           │
│ 8   │ Barcodes & Label Print    │ BarcodeStudioWorkspace.tsx     │ BarcodesEngine               │ TagLabelPrintingTa, LabelPrint│
│     │                           │                                │ (router: /api/v1/barcodes)   │ /barcode vs /barcodes routers │
│ 9   │ Reports & Analytics       │ SmritiAnalyticsWorkspace.tsx   │ ReportingDistributionService │ ReportDesignerTab (250 KB),   │
│     │                           │                                │ (services/reports.py)        │ QuickReportsWidget, 6 routers │
│ 10  │ Menu, Security & Admin    │ SecurityAdminWorkspace.tsx     │ SecurityService & MenuEngine │ AdminMenuMgmtDlg, SecManageDlg│
│     │                           │                                │                              │ MenuManagerStudioTab          │
│ 11  │ Staff & Commissions       │ StaffCommissionWorkspace.tsx   │ StaffService & SpifService   │ CommissionStudioModal vs      │
│     │                           │                                │                              │ ShiftCommissionStudioModal    │
└─────┴───────────────────────────┴────────────────────────────────┴──────────────────────────────┴───────────────────────────────┘
```

---

## PART F — The 8-Point Safe Retirement & Deletion Standard

No file, component, service, or router may be deleted simply because it was identified as a duplicate. Deletion is permitted **only** when all 8 gates are satisfied:

```
[ ] Gate 1: Capability Parity
    Every unique feature, field, hotkey, and validation in the legacy file is proven
    to exist and function in the canonical workspace.
[ ] Gate 2: Call-Site Exhaustion
    All route definitions, launchpad tiles, menu items, shortcuts, and component imports
    have been redirected to the canonical workspace. Zero incoming references remain.
[ ] Gate 3: Backend Contract Parity
    Transactions originating from the adapted frontend produce identical database records,
    tax lines, stock movements, and ledger vouchers to the legacy implementation.
[ ] Gate 4: Automated Test Verification
    Test suites covering both happy paths and edge cases pass with literal console output.
[ ] Gate 5: Writer Disarmament
    The legacy backend writer is disabled or converted to a pass-through adapter calling
    the canonical authority. No direct parallel database writes occur.
[ ] Gate 6: RBAC & Permission Invariance
    Operator permissions, supervisor overrides, and security roles function identically
    in the new workspace.
[ ] Gate 7: Rollback Safety
    A configuration feature flag allows immediate fallback to the legacy screen if unexpected
    edge cases occur in production.
[ ] Gate 8: Historical Data & Read Compatibility
    Historical invoices, shifts, and reports created by the legacy implementation remain
    fully readable and printable in the canonical workspace.
```

---

## PART G — Phase 2C Implementation Plan

The implementation of the Canonical Billing Authority and Workspace Consolidation will proceed in 15 strictly gated steps:

```text
 1. CANONICAL FINANCIAL CONTRACT IMPLEMENTATION
    Implement `backend/app/schemas/canonical_posting.py` defining the immutable posting request/response.

 2. CANONICAL SALES TRANSACTION WRITER
    Implement `backend/app/services/canonical_sales_writer.py` enforcing line tax, discounting,
    variant identity, and caller-controlled session management.

 3. WMS & PHYSICAL STOCK ADAPTER
    Wire `canonical_sales_writer` to `InventoryWmsService.create_movement()`.

 4. PAYMENTS ENGINE INTEGRATION
    Wire payment splits and credit limit checks through `PaymentsEngine`.

 5. OUTBOX EVENT EMISSION
    Emit `CanonicalSalesInvoicePostedEvent` with full financial payload inside the same DB transaction.

 6. CHARACTERIZATION TEST SUITE
    Execute comprehensive multi-tender, tax-inclusive, tax-exclusive, and credit limit tests.

 7. POS INGRESS ADAPTER
    Rewire `POSService.pos_checkout` to map shift context and tenders into the canonical writer.

 8. STANDARD SALES INGRESS ADAPTER
    Rewire `SalesService.create_sales_invoice` to delegate to the canonical writer.

 9. CUSTOMER PO DIRECT BILLING ADAPTER
    Wire `CustomerPOService.bill()` directly into the canonical posting contract.

10. SALES ORDER BILLING ADAPTER
    Wire approved Sales Orders into the canonical posting contract.

11. OFFLINE & OMNICHANNEL ADAPTERS
    Wire sync and e-commerce reservations into the canonical posting contract.

12. UNIFIED GL ACCOUNTING CONSUMPTION
    `UnifiedAccountingLedgerService` consumes outbox events to post double-entry vouchers.

13. FRONTEND BILLING WORKSPACE CONVERGENCE
    Construct `src/components/billing/BillingWorkspace.tsx` incorporating Retail POS, B2B Tax Invoice,
    and Wholesale Matrix entry modes.

14. LAUNCHPAD & ROUTE CONVERGENCE
    Update `launchpadCatalog.ts` and `src/App.tsx` to point all billing traffic to `BillingWorkspace`.

15. LEGACY WRITER & COMPONENT RETIREMENT
    Apply the 8-Point Safe Retirement Standard to safely decommission legacy duplicate files.
```

---

## Final Result & Phase Assessment

- **Target Workspace Architecture:** FULLY SPECIFIED.
- **Canonical Backend Authority Matrix:** FULLY SPECIFIED (No god service).
- **Canonical Financial Contract:** FULLY SPECIFIED.
- **Unresolved Business Decisions:** Explicitly isolated and marked `NEEDS_APPROVAL` (Negative Stock Policy, Unapproved Credit Override Privilege).
- **Codebase Modification Status:** ZERO production code, schemas, or migrations altered. Pure documentation and architectural governance.

**PHASE 2B RESULT:** **PASS (READY FOR STAKEHOLDER APPROVAL BEFORE PHASE 2C)**
