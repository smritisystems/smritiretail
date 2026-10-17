<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.91.0
  Created      : 2026-10-13
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Release Notes

## Release v6.98.0 (2026-10-17)

### Foundation & Governance — Global Actual-Data Enforcement Across SMRITI Retail OS

#### Overview
SMRITI Retail OS v6.98.0 enforces the global mandate that every production screen, KPI, chart, report, table, dropdown, dashboard, search result, document preview, and operational workflow strictly use actual persisted business data from the authoritative PostgreSQL database or an explicitly identified authoritative service. All mock-data fallbacks, synthetic variant generators, fake gateway credentials in catch blocks, and hardcoded baseline numbers have been permanently eliminated from production code paths. The update introduces a standardized triple-state UI architecture (Loading skeleton/spinner, Error state with retry trigger, and Truthful empty state with domain guidance) across all affected modules, guaranteeing accounting integrity and transparent statutory compliance.

#### Key Highlights
- **100% Authoritative Database Telemetry**: Connected Visual Reports Dashboard KPIs, Category Stock Positions, and stream tables directly to live PostgreSQL tables (`stock_movements`, `sales_order_reservations`, `sales_orders`, `companies`).
- **Elimination of Fake Gateway Credentials**: In `ComplianceDispatchModal.tsx`, fake IRN, Ack No, Signed QR payload, and E-Way Bill numbers in catch blocks were completely removed, replacing them with truthful error toasts propagating the real NIC portal failure reason.
- **Dispatch Invoicing Truthfulness**: Completely removed `sampleComplianceInvoice` ("TT/26-27/0001") from `DispatchInvoicingStudioTab.tsx`. Toolbar actions inspect actual batch generation results and display an actionable warning when no dispatch invoices exist.
- **Bulk Price Revision Hardening**: Deleted `generateMockSandals()` (124 synthetic variants) and mock fallback searches in `BulkPriceRevisionWorkflow.tsx`. Searches query live catalog items or display clean, honest empty states.
- **POS Loyalty & Reconciliation Truthfulness**: Eliminated `MOCK_LOYALTY_CUSTOMERS` in `ProPosLoyaltyLooku.tsx`, connecting directly to `/crm/customers/search`. Removed `posq_mock_01/02` from `ProPosReconciliationDlg.tsx`, adding an explicit network error card with retry trigger.
- **POS Barcode Integrity**: Scanned barcodes in `SmritiBillingStudio.tsx` strictly match database products or report "Barcode Not Found", eliminating silent demo-cart matching.
- **Smart Replenishment & Vendor Scorecard**: Wired live `/inventory` stock threshold evaluation in `SmartReplenishmentModal.tsx` and eliminated automatic fallback to demo suppliers in `SupplierScorecardModal.tsx`.
- **Automated Verification**: Certified with 69/69 Vitest tests green, 2/2 Pytest tests green, 0 `tsc --noEmit` errors, 98/98 form components verified (`validate-registry`), 55 launchpad tiles verified, 11/11 architecture checks passed, and clean production Vite build.

## Release v6.97.0 (2026-10-17)

### Procurement & Visual Analytics — Procurement Visual Reports Actual Database Derivation & Zero Mock Data Policy

#### Overview
SMRITI Retail OS v6.97.0 enforces a strict Zero Mock / Placeholder Data Policy on the Procurement Visual Reports Dashboard. Every KPI, multi-series spend trend line, 4-stage pipeline conversion indicator, supplier spend ranking, reorder alert, and 12-column active procurement stream table now derives directly and authoritatively from PostgreSQL database tables (`purchase_orders`, `purchase_receipts`, `purchase_bills`, `suppliers`, `products`, `stock_movements`). Hardcoded vendor names (Metro Footwear, Bharat Traders), placeholder SKUs (SHOE-41), and fabricated counts (36 POs, 86 stream items, 42.8 Lakh spend) have been completely removed. Where historical data lacks required fields (such as promised delivery dates for on-time delivery scoring), metrics are transparently displayed as `N/A (Untracked)` rather than manufactured. Strict UI states are introduced: an animated loading skeleton, an error card with retry actions on API/database failure, and a truthful empty state for zero-record companies or filters.

#### Key Highlights
- **100% Database Telemetry**: Connected all 6 KPI cards, spend trend series, stage progress indicators, supplier rankings, and stream tables to authoritative PostgreSQL tables.
- **COMP-001 Reconciliation**: Correctly reflects 28 statutory purchase orders, 28 inward Goods Receipt Notes (23,064 pairs, 100% fulfilled), ₹ 9,888,228 commercial liability across 28 bills, and 9 verified footwear suppliers.
- **Strict Error & Empty State Handling**: Explicit error state with retry action on database/network disconnect, and truthful zero-record empty state for companies/filters without records.
- **Transparent Untracked Metrics**: Supplier On-Time Delivery is cleanly rendered as `N/A` rather than synthetic percentages when historical promised delivery dates were not recorded.
- **Preserved Dashboard Configuration**: Full customization via the right-side configuration drawer remains operational with PostgreSQL and `localStorage` persistence.
- **Automated Verification**: Pytest 2/2 tests green, Vitest 6/6 tests green, `tsc --noEmit` clean, and Vite production bundle clean.

## Release v6.96.0 (2026-10-17)

### Sales & Billing — SMRITI Billing Studio Preloaded SKU Root-Cause Fix & Fresh Session Governance

#### Overview
SMRITI Retail OS v6.96.0 permanently resolves the critical UX issue where opening Billing Studio in Counter POS (`RETAIL_POS`) loaded six pre-populated demo SKUs without cashier scan or selection. The release enforces fresh session governance: Counter POS always starts with an empty cart (`[]`), zero totals, Walk-in customer default, and immediate autofocus on the barcode scanner input. The update introduces a clean, informative empty-cart view equipped with keyboard shortcuts and an explicit `Load Sample Items` button for demonstration or layout testing on demand, eliminating silent auto-loading. In addition, workflow transitions across Counter POS, Credit Billing, and B2B Distributor modes are isolated with distinct React component keys, preventing cross-mode state leakage while preserving legitimate F12 draft parking/resumption and B2B packing slip consolidation workflows.

#### Key Highlights
- **Permanent Root-Cause Fix**: Removed hardcoded `INITIAL_DEMO_CART_ITEMS` from `useState` initialization in `SmritiBillingStudio.tsx`. Fresh billing sessions begin with `cartItems = []`.
- **Zero Totals Guarantee**: Added early-return logic in `computeBillingTotals` ensuring all 10 summary attributes equal 0 when the cart is empty, avoiding phantom discounts.
- **Immediate Barcode Scanner Autofocus**: Cashiers can scan immediately on page mount without having to click or tab into the input.
- **Informative Empty-Cart UI with Explicit Demo Loading**: Clean empty state table view displaying quick action shortcut buttons (`F1`, `F2`) and an explicit `Load Sample Items` button.
- **Multi-Mode Workflow Isolation**: Conditionally rendered modes in `BillingWorkspace.tsx` use explicit React keys, preventing state bleeding across retail and wholesale billing modes.
- **Preserved Legitimate Workflows**: F12 Park & Recall cart persistence, draft restoration, Sales Order / Packing Slip processing, GST tax calculations, and payment settlements remain 100% operational.
- **Verification**: 34/34 tests green in `src/tests/smritiBillingStudio.test.ts`, 16/16 tests green in `b2bPackingConsolidatedBilling.test.ts`, 11/11 architecture checks passed, and clean production build.

## Release v6.95.0 (2026-10-17)

### Procurement & Visual Analytics — SMRITI Retail OS Procurement Visual Reports Implementation

#### Overview
SMRITI Retail OS v6.95.0 delivers the approved, pixel-perfect Procurement Visual Reports Dashboard for comprehensive visual telemetry over retail procurement operations, purchase spend velocity, multi-stage approval and receipt pipelines, supplier performance, low-stock reorder thresholds, and active fulfillment streams. The dashboard features 6 horizontal KPI cards, multi-series spend trend charts (Line, Area, Bar) with dual value/quantity metrics, a 4-stage purchase-to-receipt progress pipeline, top supplier rankings, a purchase order status donut chart, a low-stock reorder alert table, a supplier performance combo chart (on-time delivery vs lead time), open POs tracking, and a 12-column Active Procurement Stream table with category tabs and document preview modals. It includes an interactive sliding Dashboard Configuration drawer with domain scope switching and dual-tier persistence (local caching + PostgreSQL synchronization).

#### Key Highlights
- **Exact Visual Reference Parity**:
  - Dark-navy header (`#0d1e3a`) with breadcrumbs (`Procurement > Visual Reports`), global search bar with keyboard shortcut `/` badge, notification counter (5), help circle, user profile badge (`JR`, Jawahar / Company Admin), and drawer toggle.
  - Global filter strip with Company, Store/Location, Date range, and quick preset pills (`Today`, `Last 7 Days`, `MTD`, `Custom`).
- **Horizontal KPI Cards**:
  - Purchase Orders (36, Open: 18 | Closed: 18, ▲ 12%).
  - Purchase Spend (₹ 42,80,000, MTD, ▲ 18%).
  - Pending Approvals (6, Value: ₹ 6,20,000, ▲ 50%).
  - Pending Receipts (12, Qty: 2,480 pairs, ▲ 20%).
  - Received vs Ordered (78%, Progress bar: 3,120 / 4,000 pairs).
  - Supplier Outstanding (₹ 18,50,000, Suppliers: 9, ▼ 8%).
- **Primary Analytics Row**:
  - Purchase Spend Trend Recharts multi-series chart with Value vs Quantity view toggle, Monthly/Weekly/Daily period selector, and Line/Area/Bar chart type selection. Multi-axis layout: ₹ Lakh on left (0-50) and PO Count bars on right (22, 28, 26, 36, 32, 30).
  - Purchase-to-Receipt Progress 4-stage workflow pipeline (`Purchase Orders 36 (100%)` → `Approved 30 (83%)` → `Goods Receipts 28 (78%)` → `Supplier Invoices 24 (67%)`) with circular icons, percentage ratios, progress bars, and detail link.
- **Secondary Analytics Rows**:
  - Top Suppliers by Spend (MTD) with colored horizontal progress bars and formatted INR values.
  - Purchase Order Status donut chart with centered total count (`36 / Purchase Orders`) and color-coded status legend.
  - Reorder Alert (Low Stock) 5-column table with SKU, Product Name, On-Hand, Reorder Level, and Suggested PO Qty.
  - Supplier Performance (Last 6 Months) dual-axis combo chart with On-Time Delivery % bars and Lead Time (Days) line.
  - Open POs & Pending Receipts 8-column table with status pills.
- **Active Procurement Stream**:
  - Wide 12-column transaction stream with 4 category tabs (`All (86)`, `Purchase Orders (36)`, `Goods Receipts (28)`, `Supplier Invoices (24)`), instant search debounce, and interactive document detail modal.
- **Sliding Dashboard Configuration Drawer**:
  - Domain scope switcher: `Inventory`, `Procurement`, `Fulfillment`, `Billing`.
  - Individual widget visibility checkboxes with Select All support.
  - Chart type selectors for each chart widget.
  - Layout Mode switch: `Standard (3 Deck)` vs `Compact (2 Deck)`.
  - Data display defaults, default tab, and rows per page settings.
  - Color Theme selector: `Use System Theme` vs `Custom` palette dots.
  - Action buttons: `Reset to Default` and `Apply`.
- **Dual-Tier Configuration Persistence**:
  - Immediate `localStorage` cache for instantaneous paint and server-side transactional synchronization via PostgreSQL `Dashboard` entity.
- **Automated Verification**:
  - 5/5 Vitest tests green in `src/tests/procurementVisualReports.test.ts`.
  - 0 errors in `tsc --noEmit`.
  - 98/98 form components verified in `npm run validate-registry`.
  - 55/55 launchpad tiles verified in `npm run validate-launchpad`.
  - 11/11 architecture duplication checks passed in `npm run architecture:check`.
  - Clean production Vite build (`npm run build`).

## Release v6.94.0 (2026-10-17)

### Reports & Visual Analytics — SMRITI Retail OS Visual Reports Dashboard Implementation

#### Overview
SMRITI Retail OS v6.94.0 delivers the approved, pixel-perfect Visual Reports Dashboard for comprehensive visual telemetry over retail inventory, sales order intake, packing slip fulfillment, dispatch pipelines, and billing conversion. The dashboard incorporates 6 horizontal KPI cards, multi-type stock flow timeline charts (Line, Area, Bar), a 4-stage order-to-invoice progress tracker, category reservation progress matrices, top reserved SKU rankings, packing status donut charts, dispatch/invoice summary metrics, and a 12-column Active Fulfillment Stream table with live search and document previews. It includes an interactive sliding Dashboard Configuration drawer with full local and server-side PostgreSQL persistence.

#### Key Highlights
- **Exact Visual Reference Parity**:
  - Dark-navy header (`#0d1e3a`) with breadcrumb (`Inventory, Orders, Packing, Dispatch & Billing > Visual Reports`), global search bar with keyboard `/` shortcut badge, notification counter, and drawer toggle.
  - Global filter strip with Company, Store/Location, Date range, and quick preset pills (`Today`, `Last 7 Days`, `MTD`, `Custom`).
- **Horizontal KPI Cards**:
  - On-Hand Stock (12,580 pairs, ▲ 2.3%).
  - Reserved Stock (3,240 pairs, ▼ 8.1%).
  - Available Stock (9,240 pairs, ▲ 1.5%, mathematically reconciled).
  - Sales Orders (48, Open: 26 | Closed: 4, ▲ 12%).
  - Packing Slips (62, Pending: 18 | Packed: 32, ▲ 7%).
  - Dispatches (28, Today: 6 | This Week: 18, ▲ 5%).
- **Primary Analytics Row**:
  - Stock Flow (Last 14 Days) Recharts multi-series chart with Quantity vs Value view toggle and Line/Area/Bar chart type selection.
  - Order to Invoice Progress 4-stage workflow pipeline (`Sales Orders` → `Packing Slips` → `Dispatched` → `Invoices`) with individual stage counts, percentage ratios, and progress bars.
- **Secondary Analytics Row**:
  - Stock Position by Category with visual reservation % bars.
  - Top 10 SKUs by Reserved Quantity with ranking badges and reservation bars.
  - Packing Slip Status donut chart with centered total count (`62 / Packing Slips`) and color-coded status breakdown.
  - Dispatch & Invoice Summary table with daily, weekly, monthly counts and formatted INR financial valuation.
- **Active Fulfillment Stream**:
  - Wide 12-column transaction stream with 5 category tabs (`All (162)`, `Sales Orders (48)`, `Packing (62)`, `Dispatched (28)`, `Invoices (24)`), instant search debounce, and interactive document detail modal.
- **Sliding Dashboard Configuration Drawer**:
  - Layout mode selection: `Standard (3 Deck)` vs `Focused (2 Deck)`.
  - Individual widget visibility checkboxes for all charts and tables.
  - Stock flow chart type selector (`Line Chart`, `Area Chart`, `Bar Chart`).
  - Table defaults, default tab, and rows per page settings.
  - Color Theme selector: `Use System Theme` vs `Custom` palette dots.
  - Action buttons: `Reset to Default` and `Apply`.
- **Dual-Tier Configuration Persistence**:
  - Immediate `localStorage` cache for instantaneous paint and server-side transactional synchronization via PostgreSQL `Dashboard` entity.
- **Automated Verification**:
  - 5/5 Vitest tests green in `src/tests/visualReportsDashboard.test.ts`.
  - 0 errors in `tsc --noEmit`.
  - 98/98 form components verified in `npm run validate-registry`.
  - 54/54 launchpad tiles verified in `npm run validate-launchpad`.
  - 11/11 architecture duplication checks passed in `npm run architecture:check`.
  - Clean production Vite build (`npm run build`).

## Release v6.93.0 (2026-10-17)

### Sales & Billing — B2B Packing-First Consolidated Billing & Approved UX Integration

#### Overview
SMRITI Retail OS v6.93.0 integrates a configurable B2B Packing-First → Consolidated Billing workflow into the canonical **SMRITI Billing Studio** (`SmritiBillingStudio.tsx`) and unified master workspace (`BillingWorkspace.tsx`). The integration delivers an end-to-end B2B packing and multi-slip consolidated invoicing solution while strictly preserving the approved visual specification (2-column upper layout, compact customer card, 13-column read-only cart grid, right-side Bill Summary & Payment panels, single-line bottom scanner bar) and ensuring zero regression to the B2C Counter POS workflow.

#### Key Highlights
- **Subheader B2B Action Access**:
  - Direct access to `Packing Slips` and `Consolidated Billing` management dialogs directly from the subheader navigation bar.
- **B2B Packing Slip Management Dialog (`PackingSlipManagementModal.tsx`)**:
  - Lists historical and active packing slips with real-time status badges (`PACKED`, `BILLED`).
  - Create Packing Slips from sales orders with configurable quantity prefill (`ORDERED_QTY`, `REMAINING_UNPACKED_QTY`, `MANUAL_ZERO`).
  - Enforces `allow_partial_packing` company policies and permission-controlled quantity overrides (`canEditQty`).
  - Integrated thermal/A4 Packing Slip receipt printing.
- **Consolidated Billing Reconciliation Dialog (`ConsolidatedBillingModal.tsx`)**:
  - Multi-slip picker with dedicated barcode scanner input (`PS-...`).
  - Validates customer account compatibility, tenant isolation, and billing status.
  - Multi-slip reconciliation table reconciling 6 quantities (`Ordered Qty`, `Packed Qty`, `Previously Invoiced Qty`, `Remaining Eligible Qty`, `Current Invoice Qty`, `Dispatched Qty`).
  - Prevents overbilling and duplicate invoicing across multiple slips.
  - One-click transfer into Billing Studio cart for preview, GST computation, and posting.
- **Direct Packing Slip Barcode Scanning in Billing Studio**:
  - Scans starting with `PS-` in B2B mode automatically resolve packing slips, check customer compatibility, reject duplicates, and append items without auto-posting or auto-charging.
  - B2C mode safely rejects packing slip scans with clear guidance to switch to B2B mode (`Alt+3`).
- **Configuration Engine Integration**:
  - `BillingProfileConfigModal.tsx` provides full admin configuration for all 6 B2B packing and invoice policies.
- **Automated Verification**:
  - 16/16 Vitest tests green in `src/tests/b2bPackingConsolidatedBilling.test.ts`.
  - 26/26 Vitest tests green in `src/tests/smritiBillingStudio.test.ts`.
  - 98/98 form components passed in `npm run validate-registry`.
  - 0 errors in `tsc --noEmit`.
  - Clean production Vite build (`npm run build`).

## Release v6.92.0 (2026-10-17)

### Sales & Billing — SMRITI Billing Studio Approved UX Freeze & Exact Integration

#### Overview
SMRITI Retail OS v6.92.0 incorporates the approved, frozen SMRITI Billing Studio visual layout and interaction specification into the canonical **SMRITI Billing Studio** (`SmritiBillingStudio.tsx`) and unified master workspace (`BillingWorkspace.tsx`). The integration delivers an exact match to the frozen reference with zero regression to transactional billing, GST, accounting, inventory, or security rules.

#### Key Highlights
- **Subheader Navigation Bar**:
  - Left actions: Counter POS (active in dark navy with Alt+1 badge), Credit (Alt+2), B2B / Tax Invoice (Alt+3), Packing Slips, Consolidated Billing.
  - Right tools: Reports toggle, More dropdown, Shift HUD pill (`REG-01 · Shift Active` with pulsing green indicator), 2-line real-time clock, and Settings gear icon.
- **Left Column Customer & Cart Workspace**:
  - **Customer Card**: Compact, single-row card hosting customer search input with F1 badge, customer details (`Reliance Retail Limited · 9876543210`), green GST badge (`GST: 27AABCR1234F1Z5`), store outlet dropdown (`Reliance - Malad (MAL)`), and action buttons (`New Customer`, `⇄ Change`).
  - **13-Column Read-Only Cart Table**: Columns include `#`, `Product Name` (with product-category specific inline SVG thumbnail: Chappal, Sneaker, Running Shoe, Polo, Jeans, Heels), `Barcode ▽`, `Style ▽`, `Color ▽` (with color dot), `Size`, `Qty`, `Rate (₹)`, `Disc %`, `Disc Amt (₹)`, `Tax %`, `Amount (₹)`, `Salesperson`.
- **Right Column Bill Summary & Settlement**:
  - **Bill Summary Card**: Items count & gross total (`₹ 16,305.25`), Item Discount (`- ₹ 744.65`), Bill Discount with pencil edit button (`- ₹ 50.00`), Subtotal (`₹ 15,560.60`), GST 5% (`₹ 775.53`), and prominent dark-navy Payable Amount container (`₹ 16,286.13`).
  - **Payment Method & Settlement Card**: 4 tender buttons in a 4-column grid (Cash active in dark navy, UPI, Card, Credit), Received amount input (`16286.13`) with clear button, Change Due box (`₹ 0.00`), Save & Print (`F7`), and Settle & Save (`F8`).
- **Bottom-Anchored Single-Line Scanner Bar**:
  - Flexible scanner input with F1 badge -> Qty stepper (`-` / `qty` / `+`) -> Rate (₹) -> Disc % -> Disc Amt (₹) -> Salesperson selector -> Add to Cart primary button.
- **Registry Validation Compliance**:
  - Added `data-field-key="barcode"` and `data-field-key="qty"` to `BulkAddItemsModal.tsx`, passing `npm run validate-registry` with 0 warnings across all 96 form components.
- **Verification Metrics**:
  - 171/171 Vitest test suites green (1,813/1,813 tests passed).
  - 0 TypeScript compiler errors (`tsc --noEmit`).
  - Production bundle compilation successful (`vite build` in 45.66s).

## Release v6.91.0 (2026-10-17)

### Sales & Billing — SMRITI Billing Studio Final Master Implementation

#### Overview
SMRITI Retail OS v6.91.0 finalizes the canonical **SMRITI Billing Studio** (`SmritiBillingStudio.tsx`) as a single, profile-driven, production-ready billing engine. Grounded in the architectural principle: **"One Billing Studio. Two business profiles. Automatic configuration. Administrator-controlled customization. Simple cashier experience."** The studio supports exactly two company-level profiles: `B2C_ONLY` (Retail POS) and `B2B_ONLY` (Business Wholesale Invoicing), disallowing confusing hybrid profiles while providing administrator overrides and safe profile migrations without database schema drift.

#### Key Highlights
- **Company Billing Profile Engine (`B2C_ONLY` vs `B2B_ONLY`)**:
  - `B2C_ONLY`: Fast retail POS checkout with walk-in default, automatic barcode scanning, quick line editing, multi-tender settlement, thermal receipt default, and Shift Management enabled by default.
  - `B2B_ONLY`: Business wholesale invoicing with verified customer selection, GSTIN checking, customer purchase order (PO) reference, customer-specific pricing, credit terms, A4 tax invoice default, and Shift Management disabled by default.
- **4-Tier Configuration Precedence**:
  - Evaluates settings hierarchically: Company Policy Overrides > Selected Profile Defaults > Authorized Store Configuration > Permitted User Preferences.
- **Authorized Profile Setup & Switch**:
  - `BillingProfileSetupModal.tsx` provides an intuitive setup dialog for unconfigured companies, requiring Administrator or Manager authorization.
  - `BillingProfileConfigModal.tsx` facilitates permitted feature overrides, authorized profile switching with mandatory business justification reason, and an immutable audit trail.
- **Bulk Add Items (3 Modes + Footwear Paste)**:
  - `BulkAddItemsModal.tsx` mounted beside Add Item controls supporting:
    1. Paste Barcodes (one barcode per line).
    2. Paste Barcode + Quantity (supporting tab-separated Excel copy and comma-separated input).
    3. Footwear / Apparel 4-column structured paste (`Article`, `Color`, `Size`, `Qty`) matched against Item Master.
    4. CSV file upload, preview, column mapping, and row-level error validation.
- **Repeat Barcode Policies**:
  - Configurable duplicate scan handling: `INCREASE_QUANTITY`, `NEW_LINE`, or `ASK_USER` (prompts cashier with clear decision dialog).
- **Zero Synthetic Products Anti-Pattern (Strict Policy)**:
  - Completely eliminated synthetic fallback product generation. Unrecognized barcodes emit actionable Human-Readable Error Policy (HREP) notifications and reset focus to the scan field.
- **Backend Sales Posting Enforcements (`canonical_sales_writer.py`)**:
  - Authoritatively enforces business customer selection, mandatory PO numbers, and open shift requirements for POS retail while exempting wholesale B2B users.
- **Automated Verification**:
  - 26/26 tests green in `src/tests/smritiBillingStudio.test.ts`.
  - 77/77 tests green across all 6 billing test suites.
  - 1/1 Pytest suite green against PostgreSQL in `test_billing_profile_engine.py`.
  - 0 TypeScript compiler errors (`npx tsc --noEmit`).
  - 0 database schema migrations required.

## Release v6.89.1 (2026-10-17)

### Sales & Billing — SMRITI Billing Studio UX Simplification & Ergonomic Workflow Hardening

#### Overview
SMRITI Retail OS v6.89.1 delivers a streamlined, simplified cashier-facing interface for the canonical **SMRITI Billing Studio** (`SmritiBillingStudio.tsx`). It reduces operational clutter at the checkout counter, provides maximum horizontal grid area by collapsing secondary inspection panels by default, encapsulates scanner configurations into a dedicated modal dialog, hardens barcode scanning against double-scans, prevents unauthorized cashier price overrides, cleans up redundant cart columns, and enforces pure mathematical integrity without hardcoded calculation offsets.

#### Key Highlights
- **100% Viewport Cashier Counter (Collapsible More Details)**:
  - Collapsed the secondary right-hand "More Details" panel by default (`showMoreDetails = false`), providing full viewport width for high-speed scanning and line-item review.
  - Eliminated duplicate entry points (such as the redundant `More Details >` button in the cart table footer).
- **Encapsulated Scan & Add Settings Modal**:
  - Replaced the permanently visible red-bordered settings panel with a dedicated "Billing & Scan Preferences" modal dialog triggered via the top header action bar.
- **Enhanced Barcode Scanning & Hardware Bounce Debounce**:
  - Tri-modal scan operational modes (`AUTO_ADD`, `EDIT_THEN_ADD`, `CONFIRM_PRODUCT`).
  - Implemented 350ms hardware barcode scanner bounce debounce (`lastScanRef.current`), eliminating duplicate entries from laser trigger bounces.
  - Supported multiplier prefix syntax (`3*BARCODE` or `5XBARCODE`) for rapid multi-unit entry.
  - Automatically resets cursor focus to the barcode scanner field (`F1`) following each item addition.
- **Cashier Rate Lock Protection**:
  - Enforced `canOverridePrice` permission check. Cashiers without rate override privileges have unit rates rendered read-only with a lock icon.
- **Cleaned Default Cart Columns**:
  - Default grid shows `#`, thumbnail, Product Name, Barcode (configurable visibility), Style, Color, Size, Qty, Rate, Discount, Amount, and Salesperson.
  - Redundant SKU and Variant columns are omitted by default while preserving custom column visibility presets.
- **Mandatory Corporate Outlet Selection**:
  - Distinguishes company/branch, customer outlet, billing store, and shipping store.
  - Enforces mandatory store/outlet selection (`*`) for multi-outlet corporate accounts.
- **Mathematical Calculation Integrity**:
  - Pure `computeBillingTotals` calculation engine supporting tax-inclusive and tax-exclusive items with exact penny rounding, eliminating legacy arbitrary offsets.
- **Automated Verification**:
  - 18/18 Vitest assertions passed in `src/tests/smritiBillingStudio.test.ts`.
  - 69/69 billing regression tests passed across 6 test suites.
  - 0 TypeScript compiler errors (`tsc --noEmit`).
  - Production build verified (`npm run build`).
  - Form registry (93 components) and field governance (0 errors) validated.
  - 10/10 checks green in headless Playwright E2E verification with PostgreSQL transaction settlement.

## Release v6.84.1 (2026-10-16)

### Procurement & PO Print — Tattly Threads Branding, 120-Day Terms, Official Image Placeholder & Sizewise Matrix Grouping

#### Overview
SMRITI Retail OS v6.84.1 delivers full visual, statutory, and presentation parity for Purchase Order previews, printouts, and PDF exports. It eliminates duplicate rows for identical Article No. + Color combinations in sizewise displays, applies authentic Tattly Threads corporate branding and watermark, standardizes 120-day vendor payment terms across the stack, integrates the official client image placeholder graphic, and computes dynamic statutory 5% GST.

#### Key Highlights
- **Sizewise Item Grouping by Article No. + Color**:
  - Automatically merges duplicate per-size lines into a single consolidated row per unique Article No. + Color.
  - Correctly populates horizontal EU size columns 36–44 and sums Total Qty.
  - Strictly preserves separate rows for different colorways (e.g. `CH-25-G GOLD` vs `CH-25-G BLACK`) and different article codes.
  - Protects the underlying PostgreSQL system-of-record (`purchase_orders`, `purchase_order_lines`), keeping SKU-level line items untouched for warehouse GRN scanning.
- **Tattly Threads Corporate Branding & Watermark**:
  - Replaced generic "SMRITI Retail OS" Bengaluru coordinates with official Tattly Threads logo (`tattlyLogoBlack`), registered office address (Mumbai 400003), GSTIN (`27AAACT1234A1Z5`), and PAN.
  - Added a subtle -28° diagonal background watermark ("TATTLY THREADS") across all PO print sheets.
- **Statutory 120 Days Payment Terms**:
  - Set default payment terms to `120 Days` across backend Pydantic schemas, FastAPI services, frontend workspaces, and live supplier database records.
- **Official Image Placeholder Pipeline**:
  - Mounted the official SMRITI camera graphic (`image_not_available_placeholder.png`) with automatic `onError` DOM fallbacks for missing footwear photos across all print templates and UI preview modals.
- **Dynamic 5% Footwear GST Calculation**:
  - Replaced hardcoded 18% tax labels in order summaries with dynamic calculation (`GST (5%)`), matching statutory Indian footwear taxation rates.
- **Automated Verification**:
  - Certified with 9/9 automated Vitest unit tests green (`src/tests/poPrintBrandingAndTerms.test.tsx` and `src/tests/poSizewiseGrouping.test.tsx`).
  - 0 TypeScript compiler errors (`tsc --noEmit`).

## Release v6.84.0 (2026-10-16)

### Procurement & Live Sync — Live Supplier Sync, Purchase Orders & Physical GRN Ingestion

#### Overview
SMRITI Retail OS v6.84.0 executes complete, verified live ingestion of commercial supplier purchase orders, goods receipt notes (GRN), and vendor bills into `https://tattlythreads.smritisys.com/` for initial stock inwarding.

#### Key Highlights
- **Live Supplier Directory Sync**:
  - Updated all 20 supplier profiles via `PUT /api/v1/purchase/suppliers/{id}` with authentic addresses, contact phones, GSTINs, and default 120-day credit terms.
- **Pre-August 12, 2026 Inward Stocking**:
  - Inwarded 23,064 pairs across 9 footwear suppliers, 28 Purchase Orders, 28 Goods Received Notes, and 28 Purchase Bills, strictly timestamped prior to August 12, 2026.
- **Idempotent Ingestion Engine**:
  - Scripted resilient ingestion in `scripts/ingest_live_purchase_orders_grn.py` with multi-tenant token authorization and retry handling.

## Release v6.75.1 (2026-10-14)

### Procurement & Item Master — Purchase Variant Disambiguation & Legacy Vendor On-Demand Auto-Bridge

#### Overview
SMRITI Retail OS v6.75.1 remediates two critical runtime defects blocking Purchase Studio PO workflows and catalog evaluation: (1) HTTP 422 Unprocessable Entity during batch catalog evaluation (`POST /api/v1/purchase/evaluate-products`) in `PurchBrowseDlg` caused by legacy suppliers not yet pre-provisioned in Vendor 360, and (2) HTTP 400 Bad Request (`AMBIGUOUS_ITEM_VARIANT`) on `POST /api/v1/purchase/orders/` when ordering specific variant SKUs (e.g. `CH-533-CREAM-36`).

#### Key Highlights
- **Legacy Vendor On-Demand Auto-Convergence**:
  - Remediated HTTP 422 Unprocessable Entity in `VendorProductAssignmentService.resolve_vendor_party_id` by auto-converging legacy suppliers on-demand into canonical `Party` records (`pty_...`).
  - Stamped idempotent `VendorIdentityMigration` records with `migration_status="COMPLETED"` and `migration_reason="AUTO_ON_DEMAND_CONVERGENCE"`, guaranteeing forward auditability and zero workflow interruption.
- **Purchase Order Variant Disambiguation**:
  - Resolved `po_variant_id` from item line inputs, catalog `item_variant_id`, and `ProductRegistry` variant references prior to evaluating multi-variant generic style ambiguity in `PurchaseService.create_purchase_order`.
  - Added SKU equality matching against active variants before triggering the ambiguity guard, preventing false-positive blocks when a specific variant SKU is specified.
  - Preserved ADR-001 fail-fast ambiguity safety when a generic style code with multiple variants is submitted without specific variant identity.
  - Mirrored hardened variant pre-resolution and SKU matching logic to Goods Receipt Notes (`create_goods_receipt`).
  - Passed `variant_id` to `TransactionLineItemInput` in `create_purchase_order`.
- **Frontend Payload Hardening**:
  - Ensured `variant_id` and `item_id` are explicitly populated in PO line item payloads across standard item view, size-matrix unpivoted views, and sizewise tabs in `PoGenerateTab.tsx` and `PoSizewiseTab.tsx`.
- **Automated Verification**:
  - Certified with 3/3 tests passing in `backend/tests/test_purchase_variant_and_vendor_autobridge.py` (legacy vendor auto-bridge, specific variant SKU order, and generic style fail-fast ambiguity guard).
  - 53/53 tests passing in `backend/tests/test_po_vendor_product_control.py`.
  - 0 TypeScript compilation errors (`tsc --noEmit`).

## Release v6.75.0 (2026-10-14)

### Inventory & Finance — Cost Integrity, Landed Cost Vouchers & Historical Return Lineage

#### Overview
SMRITI Retail OS v6.75.0 delivers the completed Batch 2.4 costing and return lineage architecture, providing enterprise data integrity across inventory valuation, receipt allocation, and sales-return tracking without introducing secondary accounting subsystems. This release eliminates commercial ambiguity in sales returns, guarantees mathematical balance and idempotency in landed cost vouchers, logs explicit FIFO fallback events, and ensures non-destructive schema convergence across diverse tenant environments.

#### Key Highlights
- **Exact-Line Sales Return Lineage & Commercial Defense**:
  - Persisted `sales_invoice_item_id` foreign key on `SalesReturnItem` model, backed by an indexed column and schema alias normalization (`invoice_item_id`, `original_invoice_item_id`).
  - Added strict line validation in `sales.py`: cross-product line mismatches are rejected with HTTP 422.
  - Implemented anti-arbitrage ambiguity defense: returns with omitted line references are rejected with HTTP 422 whenever the SKU appears on multiple original invoice lines with differing commercial terms (prices, tax rates, or historical costs).
  - Enforced cumulative return quantity limits per invoice line and across all invoice lines for that product.
- **Ind AS 2 Rolling WAC & Inward Valuation**:
  - Goods Receipt Notes (GRN) automatically update perpetual rolling WAC via `CostManagementEngine.process_inward_valuation`.
  - Landed cost components (freight, handling, customs, insurance) are apportioned directly into inward line item valuation and persisted in `ProductCostValuation`.
  - Added explicit warning log when inventory costing falls back to FIFO queue.
  - Purged selling price fallbacks in `sales_stock_authority.py`.
- **Provisional Cost Quarantine**:
  - Invoices and returns with provisional or estimated costs (`is_provisional=True`) are quarantined from finalized gross profit and contribution KPI calculations until authoritative reconciliation.
- **Balanced & Idempotent Landed Cost Adjustment Vouchers**:
  - Implemented `post_landed_cost_adjustment_voucher` in `unified_ledger.py` with strict debit/credit equality check ($\sum \text{Debits} == \sum \text{Credits}$), rejecting unbalanced vouchers.
  - Added duplicate-posting protection: subsequent calls with the same reference return the existing voucher without mutating balances.
  - Preserved dock-stage unbilled GRN clearing entry (Account 1045).
  - Added `TallyService = TallyPrimeService` compatibility alias in `tally_service.py`.
- **Safe Schema & Migration Convergence**:
  - Registered all cost management models in `alembic/env.py` target metadata.
  - Authored migration `v1532_cost_management_engine_foundations.py` with PostgreSQL catalog checks to safely converge on existing or fresh schemas.
  - Downgrade prevents catastrophic data loss by aborting rollback on non-empty tables.
- **Automated Verification**:
  - 34/34 tests green (100% pass rate) across `test_migration_v1532_lifecycle.py`, `test_cost_valuation_batch2.py`, and `test_cost_accounting_batch1.py`.

## Release v6.74.0 (2026-10-14)

### Foundation & Finance — Cost Management & Cost Truth Engine Architecture

#### Overview
SMRITI Retail OS v6.74.0 delivers the production-grade **Cost Management Engine & Cost Truth Reporting Architecture**, providing business owners and financial controllers with an authoritative, explainable view of procurement costs, landed cost allocations, Indian GST and Section 17(5)(h) Input Tax Credit (ITC) treatments, perpetual inventory stock valuation under Ind AS 2 / AS 2 (Rolling Weighted Average Cost), historical Sales COGS snapshot immutability, gross margin waterfalls, and real-time Inventory-to-General-Ledger reconciliation.

#### Key Highlights
- **Authoritative Cost Hierarchy**:
  - Implemented rolling Weighted Average Cost (WAC) formula in `CostManagementEngine` respecting Ind AS 2 / AS 2.
  - Landed unit cost apportionment factoring freight, handling, customs, and insurance into inventory valuation.
  - Replacement cost tracking and permanent historical Sales COGS snapshots (`TransactionCostSnapshot`).
  - Zero retrospective mutation of posted invoices, stock movements, or accounting vouchers.
- **Double-Entry GR/IR Clearing Account (1045)**:
  - Eliminated duplicate inventory debits by routing Goods Receipt Note (GRN) accrued liabilities to Account `1045 (Unbilled GRN / GR-IR Clearing)`.
  - Matched Purchase Bills debit Account `1045` and credit Account `2010 (Accounts Payable)`.
  - Added statutory GST Section 17(5)(h) blocked/reversed ITC accounting to Account `5045`.
- **Cost Truth Reporting & REST API Endpoints (`/api/v1/cost/*`)**:
  - Live Inventory-to-GL reconciliation comparing physical stock valuation against General Ledger Account `1040 (Inventory Asset)`.
  - High-level KPI dashboard delivery (Inventory Value, COGS, Gross Profit, Unallocated Landed Cost, Pending ITC, Material Cost Variances).
  - 6 dedicated reporting engines for Purchase Variance, Landed Cost Breakdown, ITC Reconciliation, Stock Valuation, COGS Profitability, and Cost Exceptions.
- **Interactive UI (`CostTruthDashboardTab.tsx`)**:
  - Integrated rich dashboard into UI shell (`TabRenderer.tsx`), complete with live reconciliation meters, interactive report tabs, search, and CSV export.
- **Automated Verification**:
  - 6/6 Pytest integration tests green in `test_cost_management_engine.py` (23.15s) against isolated test database `smriti_test_cost_engine`.
  - 0 TypeScript compiler errors (`tsc --noEmit`).

## Release v6.73.5 (2026-10-13)

### Pricing & Merchandising — Bulk Price Revision Studio 4-Step Architecture

#### Overview
SMRITI Retail OS v6.73.5 delivers the comprehensive **Bulk Price Revision Studio** workflow (`BulkPriceRevisionWorkflow.tsx`), providing enterprise merchandising and pricing operations teams with a high-velocity 4-step wizard to execute mass price adjustments across large item catalogs with strict statutory compliance, distributor pricing rules, permanent Cost Price read-only protection, and zero database mutations during preview.

#### Key Highlights
- **4-Step Merchandising Wizard (`BulkPriceRevisionWorkflow.tsx`)**:
  - **Step 1 (Select Items):** Multi-facet filtering across Style Code, Article No, Brand, Category, Color, Size, Supplier, and Status, plus instant toggle to CSV/TSV clipboard import with header alias normalization and UTF-8 BOM stripping.
  - **Step 2 (Configure Revision):** Revision target selection (Selling Price, MRP, Distributor Price editable; Cost Price permanently locked with advisory tooltip), adjustment method (Percentage 5% default increase, Amount, Fixed Price), effective date, and reason code.
  - **Step 3 (Preview & Validate):** Live comparison table detailing current vs. proposed prices, percentage/absolute deltas, status badges (`VALID`, `WARNING`, `ERROR`), search filter, rejected row export (`[Export Rejected Rows]`), and 50-row pagination. Strictly zero database mutations occur in preview.
  - **Step 4 (Confirm & Submit):** Batch KPI summary review with dual-action submission (`[Save as Draft]`, `[Submit for Approval]`).
- **Statutory & Business Invariant Enforcement**:
  - Enforced statutory ceiling: Selling Price $\le$ MRP (`SMRITI-PRICE-001`, `chk_ipr_sp_le_mrp`).
  - Enforced distributor pricing rule: Distributor Price $\le$ Selling Price (`SMRITI-PRICE-002`).
  - Commercial below-cost warning: Flags revisions where Selling Price falls below inward Cost Price.
  - Cost Price permanently read-only and stripped from all revision payloads.
- **Backend API & Service Enhancements**:
  - Catalog filtering endpoints: `POST /api/v1/pricing/revisions/filter-items` and `GET /api/v1/pricing/revisions/filter-items` with search alias mapping.
  - Resolved route shadowing by declaring static filter routes before parameterized `{revision_id}` routes.
  - Batch creation enhancements in `PriceRevisionService` supporting `revised_distributor_price` and recording distributor price history in `metadata_json`.
- **Zero-Defect Verification**:
  - 16/16 Vitest tests green (`src/tests/priceRevisionStudio.test.ts`).
  - 40/40 Pytest tests green (`backend/tests/test_price_revisions.py`).
  - `npx tsc --noEmit --skipLibCheck` exited 0.

## Release v6.73.4 (2026-10-13)

### Pricing & UX — Price Revision Menu Registry & Connected UX Architecture

#### Overview
SMRITI Retail OS v6.73.4 delivers complete navigation harmonization, control-plane database menu registration, SAP Fiori Launchpad integration, and the full data-connected Price Revision Studio Workspace (`PriceRevisionStudioWorkspace.tsx`).

#### Key Highlights
- **Control-Plane Menu Registration**: Registered `menu-price-revision` into `smritisys.smriti_menus` (seq 135) under `menu-inventory`.
- **Backend Security Matrix Parity**: Added `"menu-price-revision"` and `"price_revision_studio"` into `CANONICAL_36_MENU_MATRIX`, `CANONICAL_40_MENU_MATRIX`, and `CASHIER_DEFAULT_VIEW_ALLOWLIST`.
- **Fiori Launchpad Integration**: Added "Price Revision Studio" launchpad tile in Master Data & Stock with `F7` shortcut.
- **Data-Connected Studio Workspace**:
  - Live KPI counters for Total, Active, Scheduled, and Pending Approval revisions.
  - Multi-field search, status filtering, reason code filtering, and customizable pagination (15/25/50/100).
  - High-velocity product resolution via `/api/v1/products/resolve` (exact Barcode/SKU scan) and `/api/v1/products`.
  - Real-time margin differential preview with statutory ceiling invariant detection (`revised_selling_price <= revised_mrp`).
  - Dual-track activation: Immediate vs. Scheduled with datetime picker.
  - Approval queue with supervisor PIN prompt and rejection justification modal.
  - Scheduled batch activation trigger (`POST /api/v1/pricing/revisions/activate-scheduled`).
  - Bulk CSV/TSV intake parser with client-side syntax pre-validation and row-level diagnostic badges.
  - Immutable audit trail drawer displaying complete system metadata, approver ID, timestamp, and batch tracking.
- **Multi-Tenant Database Parity**: Applied Alembic migrations `v1530` and `v1531` across all tenant schemas (`smriti001`–`smriti004`).
- **Restored Canonical Price Books**: Re-established `pb_cd3f422761ef` (`DEFAULT-COMP-001`) and 559 price book entries in `smriti001`.
- **Zero-Defect Verification**:
  - 9/9 Vitest tests green (`priceRevisionStudio.test.ts`, `menuRegistryRouting.test.ts`).
  - 37/37 Pytest tests green (`test_price_revisions.py`).
  - 52/52 Launchpad tiles valid with 122 app render cases.
  - 0 TypeScript compilation errors (`tsc --noEmit`).

## Release v6.73.1 (2026-10-13)

### Pricing & Billing — Price Revision Security Hardening & Multi-Tenant Verification

#### Overview
SMRITI Retail OS v6.73.1 delivers enterprise security hardening, fail-closed POS billing protection, server-side customer tier authorization, deterministic price book specificity tie-breaking, and authoritative transaction timestamp validation for the Price Revision Module.

#### Key Highlights
- **Strict Multi-Tenant Isolation**: Scoped all Price Book and Customer Price Tier lookups in `PricingEngine` to the authenticated company (`resolved_company_id`). Foreign-tenant identifiers are safely rejected.
- **Server-Side Tier Authorization**: `HeadlessBillingCore` resolves customer price tiers exclusively from server-side `CustomerPriceAssignment` records joined with active `CustomerPriceTier` models. Discards client-injected tiers for walk-in and unassigned customers.
- **Fail-Closed Billing**: Enforces checkout failure with structured error `SMRITI-PRICE-RESOLVE-FAILED` if authoritative price or MRP resolution fails for normal merchandise.
- **Deterministic Price Book Precedence**: Guarantees variant-specific Price Book entries win over generic item-level entries on volume break ties (`order_by(min_quantity.desc(), variant_id.isnot(None).desc())`).
- **Authoritative Posting Timestamps**: Added `posting_date` on `CanonicalPostingContext` with UTC normalization for temporal evaluation of backdated, live, and offline-synchronized transactions.
- **Segregation of Duties**: Enforced that store managers and non-administrative creators cannot self-approve their own price revisions (`SMRITI-PERM-002`).
- **Cost Reference Immutability**: Verified that updating variant buying cost references preserves historical posted sales invoices, COGS, and stock valuation ledgers intact.
- **Automated Verification**: Certified with 28/28 Pytest tests green in `test_price_revisions.py`, 5/5 Vitest offline cache tests green in `proposCatalogCache.test.ts`, and 0 TypeScript compilation errors.

## Release v6.73.0 (2026-10-13)

### Pricing & Catalog — MRP & Selling Price Revision Architecture

#### Overview
SMRITI Retail OS v6.73.0 introduces an immutable, auditable, temporal price revision architecture that governs revisions of Maximum Retail Price (MRP), Selling Price, and Cost Price with exact timezone-aware effective timestamps.

#### Key Highlights
- **Statutory Ceiling Compliance**: Database check constraints (`revised_selling_price <= revised_mrp`) and API validators enforce that Selling Price never exceeds MRP.
- **Temporal Integrity & Future Scheduling**: Revisions can be scheduled for future activation. Future revisions remain quarantined in `SCHEDULED` status and never leak into active checkout billing prematurely.
- **Historical Reconstruction**: Point-in-time price replay allows reconstructing exact item rates for any past transaction timestamp.
- **Configurable Approvals**: Price alterations exceeding configured thresholds (10%) or submitted by store roles require supervisor approval or supervisor PIN authorization.
- **Invoice Snapshot Immutability**: Historical submitted sales invoices and billing line snapshots remain 100% immutable upon item price updates.
- **Price Revision Studio**: Modern visual UI modal providing single revision entry, margin calculation, approval queue review, revision timeline, and bulk CSV intake.
- **POS & Billing Protection**: `HeadlessBillingCore` actively validates submitted line rates against authoritative backend rates, blocking cashier price tampering without supervisor PIN override.
