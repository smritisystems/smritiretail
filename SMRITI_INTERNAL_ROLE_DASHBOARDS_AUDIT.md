<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.1
  * Created    : 2026-07-10
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS - Internal Role-Based Dashboards Audit Report

**Date:** 2026-07-10  
**Authors:** Chief Technology Officer, Retail Operations Consultant, Product Manager, UX Expert & ERP Solution Architect  
**Objective:** Perform a complete business operations and technical audit of internal role-based dashboards within SMRITI Retail OS to ensure high-velocity retail operations, inventory-first precision, and zero statutory accounting duplication.

---

## Executive Summary & Product Guardrails

SMRITI Retail OS is designed as an **Inventory-First Retail Operations Platform**. In alignment with our product philosophy, SMRITI acts as the absolute operational source of truth, while **TallyPrime** remains the statutory financial book of record. 

This audit evaluates the system's dashboard layer strictly through a **business-first lens**, examining how different internal store and head-office personas consume data, perform tasks, and resolve daily operational bottlenecks. We have evaluated each internal role against the **"Dumb User Test"**, retail speed (reducing click counts), and tactical automation opportunities.

### Our Audit Methodology
Every recommendation has been challenged with three questions:
1. *Does this solve a real-world, high-frequency retail business problem?*
2. *Does this minimize manual data entry and maximize barcode/scanner-driven operations?*
3. *Does this keep our focus on inventory velocity, and avoid rebuilding advanced financial ledgers?*

---

## Detailed Audit of Internal Roles

### 1. Role: Shop Owner (Director / Franchise Owner)
*The Owner needs high-level operational visibility, daily sales numbers, branch cash reconciliations, stock aging summaries, and critical event highlights to protect store margins and direct strategic replenishment.*

* **Current Dashboard Status:** Currently has access to the main generic Dashboard Tab displaying high-level metrics like Outlet Health Score, Weeks of Cover, Dead Stock %, and Live Sales Value.
* **Keep:** 
  - **Weeks of Cover (WOC) Metric:** Highly critical for cash-flow planning. Tells the owner how long current capital remains liquid within inventory.
  - **Dead Stock % Display:** Critical warning system to highlight non-moving stock.
* **Improve:** 
  - **Live Sales Metric:** Transition from a simple sum value to a multi-branch comparison chart, enabling comparison across multiple stores instantly.
  - **Outlet Health Score:** Should break down more clearly into "Stock Accuracy" and "Shrinkage Rate".
* **Remove:** 
  - **Channel Capital (PSV) locked metric:** Move this deeper into the third-party inventory section, as general store owners find it distracting on their daily sales landing card.
* **Merge:** 
  - **Rule 10 Audit Ledger:** Merge this technical-looking table into a high-level "Critical Alerts Widget" which flags operational exceptions (e.g., negative stock occurrences, unauthorized price changes).
* **Add:** 
  - **End-of-Day (EOD) Settlement Widget:** A cash-drawer reconciliation dashboard showing Cash Expected vs. Cash Declared per terminal.
  - **Quick Action: "Approve High-Value Credit Limits"** to enable the Owner to override a customer's credit block in real time.
* **Business Reason:** Owners are not software developers. They need to know two things in 10 seconds: "Is my cash secure?" and "Do I have inventory bottlenecks?"
* **Priority:** Critical
* **Estimated Effort:** Low (Visual updates to existing dashboard components).
* **Acceptance Criteria:** Owner dashboard opens to reveal aggregate daily sales, cash reconciliations, active dead stock flags, and real-time terminal sync alerts.
* **Production Readiness Score:** **78/100**

---

### 2. Role: Admin (System & Configuration Manager)
*The Admin is responsible for system configurations, document series setup, print formats, approval thresholds, user rights, and backup controls.*

* **Current Dashboard Status:** Shares the same dashboard as the owner but is distracted by operational sales metrics they do not need.
* **Keep:** 
  - **Rule 10 Audit Ledger / Compliance Log:** Highly useful for tracking staff activity and system edits.
* **Improve:** 
  - **Audit Logs View:** Needs advanced filter capabilities by module and action type to search for unauthorized changes.
* **Remove:** 
  - **Weeks of Cover & Dead Stock charts:** System admins do not manage inventory; these metrics pollute their screen real estate.
* **Merge:** 
  - **System Settings Modules:** Merge layout shortcuts for "Document Series", "Print Studio", and "Formulas" directly into the Admin control panel widget.
* **Add:** 
  - **System Health Monitor:** Displays active dev server state, TallyPrime export queues, background sync success rates, and offline local cache status.
  - **Quick Action: "Trigger Manual Backup"** and **"Force Local Cache Purge"**.
* **Business Reason:** The Admin needs to make sure the software is running at 100% uptime and that other staff have correct permissions. They shouldn't be looking at revenue charts.
* **Priority:** High
* **Estimated Effort:** Low.
* **Acceptance Criteria:** Admin dashboard focuses on database health, Tally synchronization status, failed exports, and user activity logs with zero retail metrics.
* **Production Readiness Score:** **85/100**

---

### 3. Role: Branch / Store Manager
*The Store Manager runs the daily floor operations, manages sales targets, validates inventory levels, handles high-value customer disputes, and conducts floor stock reconciliations.*

* **Current Dashboard Status:** Currently forced to navigate multiple sub-tabs to understand basic daily targets and floor performance.
* **Keep:** 
  - **Low Stock warning count:** Critical for prompting immediate local store replenishment.
  - **Live Sales Value tracker:** Keeps the team aligned with daily sales quotas.
* **Improve:** 
  - **Inventory Forecast Widget:** Needs to show forecast per local storage zone (bins/shelves) rather than just warehouse-wide totals.
* **Remove:** 
  - **PSV / Channel Capital metrics:** Branch managers do not handle franchise partner consolidations; this is a distraction.
* **Merge:** 
  - **Staff Attendance & Activity:** Merge staff management logs with a simplified shift overview card.
* **Add:** 
  - **Cash Till Status Widget:** Real-time cash balance per cashier terminal. Alert pops up if any cash drawer exceeds the threshold (promoting "Cash Drops").
  - **Quick Action: "Initiate Physical Stock Take"** to freeze specific category stock and execute barcode-driven reconciliation.
* **Business Reason:** The manager needs to walk around the store, not sit at a computer. Their dashboard must be touch-friendly, optimized for mobile tablets, and action-focused.
* **Priority:** Critical
* **Estimated Effort:** Medium.
* **Acceptance Criteria:** Manager dashboard lists active cash till balances, pending physical inventory take tasks, and quick buttons to authorize high-value discounts.
* **Production Readiness Score:** **65/100**

---

### 4. Role: Sales Executive (Floor Staff)
*The Floor Salesperson deals directly with customers, shows inventory options, creates quotations, checks product availability, and tracks their sales commissions.*

* **Current Dashboard Status:** Does not have a dedicated dashboard, leading to slow customer response times.
* **Keep:** None.
* **Improve:** None.
* **Remove:** None.
* **Merge:** None.
* **Add:** 
  - **Product Finder Widget:** Instant search by name, barcode, or attribute (e.g., size, color, material) displaying real-time stock levels across bins and branches.
  - **Quick Action: "Create Quotation/Sales Order"** and **"Check Alternative Sizes"**.
  - **My Daily Performance Card:** Tracks personal sales units, commission earned, and achievement against daily target.
* **Business Reason:** Sales executives need to answer customer questions instantly on the retail floor. If they can't find stock availability in 5 seconds, the customer walks away.
* **Priority:** High
* **Estimated Effort:** Medium.
* **Acceptance Criteria:** An ultra-light, mobile-responsive dashboard designed for mobile-screen usage that focuses on quick product lookup and commission progress.
* **Production Readiness Score:** **40/100 (Major Gap)**

---

### 5. Role: Purchase Executive
*The Purchase Executive negotiates with suppliers, tracks lead times, creates Purchase Orders (PO), and ensures optimal stock levels without tying up too much capital.*

* **Current Dashboard Status:** Currently views low stock indicators, but must manually look up supplier directories and past purchase prices.
* **Keep:** 
  - **Reorder triggers / Low Stock counts:** Highly important for identifying purchase requirements.
* **Improve:** 
  - **Reorder List:** Should show past buying prices and default vendor automatically.
* **Remove:** 
  - **Live Sales Value:** Daily POS retail revenue is less relevant to purchase forecasting than bulk category trends.
* **Merge:** 
  - **Supplier directory and past GRNs:** Merge into a "Supplier Performance Dashboard" showing average lead time and invoice accuracy.
* **Add:** 
  - **AI Reorder Predictor:** Suggests PO quantities based on 30-day velocity, current weeks of cover, and supplier lead times.
  - **Quick Action: "Generate PO from Low-Stock List"** (Creates standard purchase drafts with 1 click).
* **Business Reason:** Eliminates manual calculation of buy requirements. Prevents both stockouts (lost sales) and overstocking (dead capital).
* **Priority:** High
* **Estimated Effort:** Medium.
* **Acceptance Criteria:** Dashboard highlights critical reorder lines, suggests order sizes based on velocity, and matches each line with its preferred vendor.
* **Production Readiness Score:** **72/100**

---

### 6. Role: Warehouse Manager
*The Warehouse Manager is responsible for bulk storage operations, receiving incoming goods, picking orders, packing shipments, and executing branch stock transfers.*

* **Current Dashboard Status:** No dedicated dashboard. Exposing complex retail sales charts to warehouse floor staff creates confusion and reduces productivity.
* **Keep:** None.
* **Improve:** None.
* **Remove:** All retail sales metrics, customer balances, and pricing data (warehouse staff do not need to see margins).
* **Merge:** 
  - **Incoming GRNs & Transfers:** Merge into a "Receiving Zone Dashboard" that prioritizes incoming trucks.
* **Add:** 
  - **Pending Pick List Widget:** Lists order lines grouped by shelf location for faster walk routes.
  - **Quick Action: "Receive Bulk GRN"** (Supports camera-based barcode scanning).
  - **Warehouse Capacity Utilization Chart:** Visual indicator of filled space vs empty shelves.
* **Business Reason:** Warehouse efficiency is measured in seconds. Staff need a distraction-free, clear, and high-contrast dashboard showing exactly what to receive and what to ship next.
* **Priority:** Critical
* **Estimated Effort:** Medium-High.
* **Acceptance Criteria:** Zero pricing data displayed. The screen only shows inventory units, bin locations, barcodes to scan, and transit status.
* **Production Readiness Score:** **55/100**

---

### 7. Role: Inventory Controller
*The Inventory Controller manages the stock ledger, checks reconciliation files, identifies shrinkage, processes stock write-offs, and verifies batch expirations.*

* **Current Dashboard Status:** Must go to the "Stock Ledger" tab and manually search through entries.
* **Keep:** 
  - **Stock Ledger table:** Highly detailed, immutable transaction history.
* **Improve:** 
  - **Ledger Filters:** Allow instant filtering by Batch, Serial Number, User, and Branch.
* **Remove:** None.
* **Merge:** 
  - **Adjustments & Variance Reporting:** Merge manual stock write-offs with Physical Count Reconciliation.
* **Add:** 
  - **Stock Drift Alert:** Flags items where physical count variances exceed 2% over time.
  - **Batch Expiry Tracker:** Red-amber-green alerts indicating batches expiring within 30/60/90 days.
  - **Quick Action: "Initiate Batch Recall / Block Batch"** (Instantly disables the sales barcode for an expired or recalled batch).
* **Business Reason:** Preserves stock accuracy and prevents selling expired or defective products to retail customers.
* **Priority:** High
* **Estimated Effort:** Medium.
* **Acceptance Criteria:** Real-time visibility into stock drift, expired batch alerts, and immediate block controls over specific inventory lines.
* **Production Readiness Score:** **80/100**

---

### 8. Role: Accounts Operator (Operational Accounts)
*This operator manages customer credit accounts, tracks due balances, receives vendor invoices, flags discrepancies between PO prices and GRN invoice prices, and synchronizes transactions to TallyPrime.*

* **Current Dashboard Status:** Uses the "Accounting Sync" and "Business Ledger" tabs.
* **Keep:** 
  - **Business Ledger Table:** Clear display of Outstanding, last payments, and credit limits.
  - **Sync Queue Monitor:** Shows pending exports to Tally XML.
* **Improve:** 
  - **XML Export Preview:** Show mapping errors (e.g., unmatched tax ledgers) before exporting to avoid failures in TallyPrime.
* **Remove:** None.
* **Merge:** None.
* **Add:** 
  - **PO vs. GRN Invoice Variance Tracker:** Alert flags showing if a supplier invoice price is higher than the original Purchase Order price.
  - **Date & Period Locking Control:** Prevents staff from recording transactions in closed operational months.
  - **Quick Action: "Sync All Pending to Tally"**.
* **Business Reason:** Eliminates manual billing mistakes and prevents financial leakage by flagging price changes from suppliers before bills are recorded.
* **Priority:** Critical
* **Estimated Effort:** Medium.
* **Acceptance Criteria:** Real-time mapping checks, explicit PO-vs-Invoice price validation, and clear error logs for failed Tally syncs.
* **Production Readiness Score:** **88/100**

---

### 9. Role: POS Cashier
*The Cashier operates the cash drawer, scans customer barcodes, takes payment, processes refunds, applies coupons, and prints retail slips under high-pressure, fast-paced queues.*

* **Current Dashboard Status:** Uses the main "POS" tab which is quite functional but still exposes visual sidebars.
* **Keep:** 
  - **Touch-friendly layout** for common items.
  - **Multi-payment modes (Cash/UPI)**.
* **Improve:** 
  - **Keyboard-Only Operation:** Cashiers should never have to touch a mouse. Needs a visual overlay of keyboard shortcuts (e.g., press `Space` to pay).
* **Remove:** 
  - Sidebar navigation and header bar settings during active terminal shifts (Cashier Lock-in).
* **Merge:** 
  - **Refund and Return Workflow:** Merge invoice search and item returns into the primary POS checkout screen to handle exchanges in one transaction.
* **Add:** 
  - **Hold / Park Invoice Button:** Keeps current cart state on hold for a secondary terminal buffer.
  - **Offline Status Flag:** Explicit indicator showing if local sales are being written to local indexedDB due to network drop.
* **Business Reason:** Retail speed. A cashier must be able to complete a transaction in under 10 seconds. Every click saved translates to happier customers and shorter checkout lines.
* **Priority:** Critical
* **Estimated Effort:** Medium-High.
* **Acceptance Criteria:** Cashier screen locks out unnecessary settings, highlights clear hotkeys, supports one-key park/unpark, and displays an offline status bar.
* **Production Readiness Score:** **82/100**

---

### 10. Role: Dispatch / Delivery Staff
*The delivery coordinator manages rider assignments, tracks delivery confirmation status, handles cash-on-delivery (COD) collections, and processes customer returns.*

* **Current Dashboard Status:** No dedicated dashboard or view. Forced to look through generic sales orders.
* **Keep:** None.
* **Improve:** None.
* **Remove:** All financial margin reporting, cost formulas, and vendor settings.
* **Merge:** None.
* **Add:** 
  - **Delivery Progress Queue:** Shows "Packed" vs "Dispatched" vs "Delivered".
  - **COD Cash Tracker:** Cash collection log showing what each rider owes the cash office upon daily return.
  - **Quick Action: "Mark Delivered"** and **"Register COD Payment"**.
* **Business Reason:** Logistics visibility. Keeps customer delivery schedules accurate and ensures cash collections from riders are 100% reconciled daily.
* **Priority:** Medium
* **Estimated Effort:** Medium.
* **Acceptance Criteria:** A lightweight dashboard listing active dispatches, destination details, COD amounts, and payment verification inputs.
* **Production Readiness Score:** **35/100 (Major Gap)**

---

### 11. Role: HR & Customer Support
*These back-office roles manage store staff shifts, performance metrics, and handle customer complaints, warranty status checks, or product replacement overrides.*

* **Current Dashboard Status:** Uses standard configuration pages or has no view.
* **Keep:** 
  - **Staff Management list:** Useful for general staff profiles.
* **Improve:** None.
* **Remove:** All high-level financial revenue metrics and Tally sync panels.
* **Merge:** None.
* **Add:** 
  - **Warranty Tracker:** Look up product serial numbers to verify original buy dates and remaining warranty coverage.
  - **Shift Rosters Widget:** Shows active cashiers and warehouse staff on shift today.
* **Business Reason:** Back-office support must resolve issues quickly. Exposing general store financial statistics to HR or junior customer support operators poses a security risk.
* **Priority:** Low
* **Estimated Effort:** Low.
* **Acceptance Criteria:** Restricted back-office panel optimized for warranty lookup and staff attendance tracking with no corporate financial exposure.
* **Production Readiness Score:** **60/100**

---

### 12. Role: Production (if enabled)
*For retail businesses that manufacture or bundle their own products (e.g., assembling gift baskets, repacking wholesale bags into retail boxes).*

* **Current Dashboard Status:** None.
* **Keep:** None.
* **Improve:** None.
* **Remove:** None.
* **Merge:** None.
* **Add:** 
  - **Bill of Materials (BOM) Planner:** Select "Gift Box" -> Auto-deduct 1 Basket, 1 Ribbon, 1 Chocolate Bar -> Auto-add 1 Gift Box item.
  - **Pending Assembly Line Queue:** Shows what bundles need to be made today based on order velocity.
* **Business Reason:** Keeps raw material inventory and finished retail items perfectly synchronized without manual double-counting.
* **Priority:** Medium
* **Estimated Effort:** Medium.
* **Acceptance Criteria:** Support for basic product bundling/unbundling event flows that trigger stock out-events for raw components and stock in-events for finished products.
* **Production Readiness Score:** **20/100**

---

## Action Plan to Achieve 100% Production Readiness

To push our overall SMRITI Retail OS dashboard layer to 100% production-readiness, we must execute the following targeted, low-risk refinements:

### Phase 1: Navigation Cleanup & Role Isolation (Quick Win)
- **Action:** Move "Document Series", "Print Studio", "Approval Matrix", and "Formula Registry" under a single nested dropdown category named **"Admin Settings"**.
- **Action:** Restrict sidebar tabs dynamically based on user role (e.g., a cashier login hides everything except POS and CRM; warehouse login hides all pricing, margins, and Tally syncs).

### Phase 2: Barcode & Speed Optimization in POS
- **Action:** Add global keyboard event listeners in `PosTerminalTab` to handle mouse-free transactions.
- **Action:** Add "Hold / Park Bill" local memory buffer.

### Phase 3: Operations Event-Driven Balances in Business Ledger
- **Action:** Wire POS credit orders and GRN supplier invoice entries to post events that increment or decrement outstanding balances dynamically inside `BusinessLedgerTab`.

---

## Summary of Production Readiness Scores

| Module / Role | Current Score | Gap to 100% | Priority |
| :--- | :--- | :--- | :--- |
| **Owner Dashboard** | 78% | Needs End-of-Day cash till reconciliation and exception alerts. | High |
| **Admin Dashboard** | 85% | Needs live server/sync monitor and forced backup hooks. | Medium |
| **Branch Manager** | 65% | Needs touch-friendly stock counts and cashier drawer thresholds. | Critical |
| **Sales Executive** | 40% | Missing visual item inventory finder and performance scorecard. | High |
| **Purchase Executive** | 72% | Needs automated supplier lead times and single-click PO generation. | Medium |
| **Warehouse Manager** | 55% | Exposing margin info. Needs pure bin-picking lists and mobile scan layouts. | Critical |
| **Inventory Controller** | 80% | Needs expired batch warnings and immediate inventory locking controls. | High |
| **Accounts Operator** | 88% | Needs PO-vs-Invoice cost mismatch flags and Tally mapping checks. | Critical |
| **POS Cashier** | 82% | Needs mouse-free hotkeys, parking buffers, and offline cash tags. | Critical |
| **Logistics / Dispatch** | 35% | Missing dispatch progress queues and cash-on-delivery reconciliations. | Medium |
| **HR / Back-office** | 60% | Needs serial-level warranty search and active cashier shift rosters. | Low |
| **Production / Bundles** | 20% | Lacks Bill of Material (BOM) triggers for assembled gift items. | Low |

**Audit Recommendation:** Focus development resources first on **POS Speed**, **Warehouse Bin Picking**, and **Accounts Verification**. By isolating configurations from the retail floor and prioritizing scanner interactions over keyboards, SMRITI Retail OS will deliver unmatched operational speed and inventory fidelity.
