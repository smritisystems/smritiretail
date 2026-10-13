<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.0
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Release Notes

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
