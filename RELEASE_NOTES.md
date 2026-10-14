<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.75.1
  Created      : 2026-10-13
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Release Notes

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
