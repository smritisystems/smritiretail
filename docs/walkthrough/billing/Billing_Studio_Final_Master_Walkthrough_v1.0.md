<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.91.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical SMRITI Billing Studio Walkthrough
-->

# Walkthrough: SMRITI Billing Studio Final Master Implementation

**Document ID:** `WGP-BILLING-20261017-V1.0`  
**Area:** Sales & Billing (`docs/walkthrough/billing/`)  
**Topic:** SMRITI Billing Studio Final Master Implementation  
**Version:** v1.0.0  
**Implementation Plan:** `docs/implementation/billing/Billing_Studio_Final_Master_Implementation_Plan_v1.0.md`  
**Status:** Completed & Verified  

---

## 1. Purpose

This document provides the definitive walkthrough for the finalization of the canonical SMRITI Billing Studio as a single, profile-driven, production-oriented billing experience. 

The core architectural principle of this implementation is:
> **One Billing Studio. Two business profiles. Automatic configuration. Administrator-controlled customization. Simple cashier experience.**

Rather than building separate billing applications or fragmented entry points, the single canonical Billing Studio dynamically adapts to two company-level profiles:
- `B2C_ONLY`: Fast retail POS checkout with walk-in customer support, automatic scanning, quick editing, cash/UPI/card tender, thermal receipts, and Shift Management enabled by default.
- `B2B_ONLY`: Business wholesale invoicing requiring customer selection, customer GSTIN validation, mandatory or optional purchase order (PO) reference, customer-specific pricing, credit terms, A4 tax invoice generation, and Shift Management disabled by default.

---

## 2. Scope

The scope encompassed the entire billing workflow, configuration engine, and server-side transactional guarantees:
1. **Billing Profile Engine**: Server-side resolution of company billing profiles with 4-tier configuration precedence:
   $$\text{Company Policy Overrides} \succ \text{Billing Profile Defaults} \succ \text{Store Configuration} \succ \text{Permitted User Preferences}$$
2. **Authorized Profile Management & Lifecycle**: Initial setup modal for unconfigured companies, profile migration workflow with mandatory business justification reason and immutable audit history, and administrator customization dialog.
3. **Single Canonical Studio Adaptation (`SmritiBillingStudio.tsx`)**: Dynamic adaptation of `SmritiBillingStudio.tsx` based on the active profile, rendering a prominent profile badge, configuring scan modes, repeat-barcode policies, invoice formats, customer selection rules, and shift validation.
4. **Bulk Add Items (`BulkAddItemsModal.tsx`)**: Integration of a dedicated Bulk Add action beside the primary item controls supporting:
   - Paste Barcodes (single barcode per line).
   - Paste Barcode + Quantity (supporting tab-separated Excel copy and comma-separated text).
   - Footwear/Apparel 4-column structured paste (`Article`, `Color`, `Size`, `Qty`) matched against Item Master.
   - CSV file upload, parsing, column mapping, live preview table, and row-level actionable error messages.
5. **Anti-Pattern Elimination**: Strict removal of synthetic fallback product creation. Unknown barcodes trigger actionable human-readable errors and return focus to scan input without inventing phantom items.
6. **Backend Sales Posting Enforcements (`canonical_sales_writer.py`)**: Authoritative backend verification of billing profile policies during checkout, enforcing customer registration for B2B, mandatory PO numbers, and open shift requirements for POS retail while exempting wholesale B2B users.

---

## 3. Files Created

| File Path | Description |
|---|---|
| `docs/implementation/billing/Billing_Studio_Final_Master_Implementation_Plan_v1.0.md` | 19-section formal implementation plan per IPGP and UADHP. |
| `backend/app/services/billing_profile_service.py` | Transactional FastAPI service managing profile setup, 4-tier precedence resolution, profile switches with audit history, and feature overrides. |
| `backend/app/tests/test_billing_profile_engine.py` | Pytest test suite testing initial setup, B2C/B2B defaults, overrides precedence, migration audit trail, and invalid profile rejections against live PostgreSQL. |
| `src/components/billing/modals/BulkAddItemsModal.tsx` | Reusable modal component for 3 bulk item input modes with live validation preview, row editing, removal, and batch cart addition. |
| `src/components/billing/modals/BillingProfileSetupModal.tsx` | Unconfigured company setup dialog prompting authorized selection between `B2C_ONLY` and `B2B_ONLY`. |
| `src/components/billing/modals/BillingProfileConfigModal.tsx` | Administrator modal for customizing feature overrides, executing authorized profile switches, and inspecting audit trails. |
| `docs/walkthrough/billing/Billing_Studio_Final_Master_Walkthrough_v1.0.md` | This 13-section formal walkthrough document per WGP. |

---

## 4. Files Modified

| File Path | Description |
|---|---|
| `backend/app/api/v1/billing.py` | Mounted profile endpoints: `GET /profile`, `POST /profile/setup`, `PUT /profile/switch`, and `PUT /configuration`. |
| `backend/app/services/canonical_sales_writer.py` | Added Step 0B Authoritative Company Billing Profile Policy Verification validating customer selection, PO numbers, and shift requirements. |
| `src/components/billing/SmritiBillingStudio.tsx` | Wired profile engine hooks, repeat barcode policies, bulk add button, mandatory PO banners, profile header badges, and removed synthetic products. |
| `src/tests/smritiBillingStudio.test.ts` | Added TEST 19 through TEST 26 covering profile defaults, 4-tier precedence, shift rules, PO requirements, repeat barcodes, bulk parsing, and synthetic product rejection. |
| `docs/implementation/README.md` | Registered the implementation plan in the master index table. |
| `docs/walkthrough/README.md` | Registered this walkthrough in the master index table. |
| `CHANGELOG.md` | Documented the final master billing studio implementation release. |
| `RELEASE_NOTES.md` | Published release notes for Version 6.91.0. |

---

## 5. Architecture Decisions

### ADR-BILLING-20261017-01: Zero Database Schema Migrations via Existing Key-Value Storage
- **Decision:** Store company billing profiles, overrides, and audit trails in the existing `company_policy_settings` table (`company_id`, `key`, `value`, `updated_at`, `updated_by`).
- **Rationale:** The table already exists in production with tenant isolation and primary key indexing. Using keys `billing_profile`, `billing_configuration`, and `billing_profile_history` avoids schema migration risk, locks, and downtime.

### ADR-BILLING-20261017-02: Strict Disallowance of Hybrid or Combined Profiles
- **Decision:** Support strictly `B2C_ONLY` and `B2B_ONLY`. Reject requests for combined `HYBRID` or `ALL_IN_ONE` profiles.
- **Rationale:** Mixed profiles introduce ambiguous business logic, cashier confusion, split accounting treatments, and loose GST validations. Businesses requiring both operate distinct legal companies or branches.

### ADR-BILLING-20261017-03: Four-Tier Configuration Precedence
- **Decision:** Resolve effective studio settings hierarchically:
  1. Authoritative Company Policy Overrides.
  2. Selected Billing Profile Defaults.
  3. Authorized Store Configuration.
  4. Permitted Cashier Preferences.
- **Rationale:** Cashier preferences can customize convenience (e.g. beep tone, post-scan focus) but cannot bypass company policy or legal requirements (e.g. shift management or mandatory customer selection).

---

## 6. Design Rationale

### Cashier-Centric Ergonomics
- The cashier workflow strictly adheres to the natural retail and wholesale flow: `Customer` → `Items in Cart` → `Add Item` → `Bill Summary` → `Payment` → `Save/Print/Share`.
- Advanced details remain collapsed by default in More Details (`showMoreDetails = false`), giving 100% viewport width to the item grid and cart.
- When B2B policy mandates a Customer PO Reference, a dedicated input appears directly in the Customer Card so the user never has to expand More Details to satisfy the requirement.

### Safe Bulk Item Intake
- Direct raw Excel paste and CSV uploads can contain invalid quantities, unrecognized barcodes, or duplicate entries.
- The `BulkAddItemsModal` provides an intermediate preview grid with live stats chips (`Total`, `Valid`, `Warnings`, `Errors`), inline cell editing, and row deletion. Only valid rows are committed to the active cart.

---

## 7. Implementation Summary

### Profile Defaults Table

| Feature / Setting | `B2C_ONLY` Default | `B2B_ONLY` Default | Admin Overridable |
|---|---|---|---|
| Primary Focus | Fast POS Checkout | Wholesale Invoicing | Fixed by Profile |
| Customer Selection | Optional (Default Walk-in) | Mandatory (Verified Business) | Yes (`customer_selection_required`) |
| Customer PO Reference | `HIDDEN` | `REQUIRED` | Yes (`HIDDEN` / `OPTIONAL` / `REQUIRED`) |
| Shift Management | `ENABLED` | `DISABLED` | Yes (`ENABLED` / `DISABLED`) |
| Default Invoice Format | `THERMAL_80MM` | `A4_INVOICE` | Yes (`THERMAL_80MM` / `A4_INVOICE`) |
| Default Scan Mode | `AUTO_ADD` | `EDIT_THEN_ADD` | Yes (`AUTO_ADD` / `EDIT_THEN_ADD` / `CONFIRM_PRODUCT`) |
| Repeat Barcode Policy | `INCREASE_QUANTITY` | `INCREASE_QUANTITY` | Yes (`INCREASE_QUANTITY` / `NEW_LINE` / `ASK_USER`) |
| Bulk Add Items | `ENABLED` | `ENABLED` | Yes (`ENABLED` / `DISABLED`) |

### Asynchronous Barcode Scanner & Zero Synthetic Items
The barcode scanner in `SmritiBillingStudio.tsx` executes asynchronously:
1. Debounces rapid hardware pulses (350ms window).
2. Parses quantity multipliers (`3*BARCODE` or `2xBARCODE`).
3. Matches against client-side `products` prop.
4. If missing, attempts backend `/api/v1/billing/scan/{barcode}` lookup.
5. If still unresolvable, emits a non-blocking Human-Readable Error Policy (HREP) notification:
   > `Barcode "[Barcode]" was not found in catalog. Please check barcode or register product in Master Data.`
   and refocuses the scan input without synthesizing phantom items.

---

## 8. Tests Executed

### Frontend Test Suite (`src/tests/smritiBillingStudio.test.ts`)
Executed: `npx vitest run src/tests/smritiBillingStudio.test.ts`
- TEST 1: Initial State & Walk-in Customer Defaults.
- TEST 2: Product Addition, Quantity Stepping & Cart Totals.
- TEST 3: Pure GST Calculation Invariant (Inclusive vs Exclusive, Inter-state vs Intra-state).
- TEST 4: Bill Level Flat & Percentage Discounts Penny Balancing.
- TEST 5: SMRITI Parked Cart Serialization, Recall & Restore.
- TEST 6: Offline Transaction Queueing & Reconnection Sync.
- TEST 7: Scan Modes (`AUTO_ADD`, `EDIT_THEN_ADD`, `CONFIRM_PRODUCT`).
- TEST 8: Post-Scan Input Focus Behavior.
- TEST 9: Duplicate Barcode Increment vs Distinct Line Row Addition.
- TEST 10: Multi-Tender Split Payment Accounting & Change Due.
- TEST 11: Customer Search Filtering & Verification.
- TEST 12: Thermal Slip & A4 Tax Invoice Mode Selection.
- TEST 13: Staged Line Rate Override Permission Enforcement.
- TEST 14: Staged Line Discount Override Permission Enforcement.
- TEST 15: Shift Management Identifier & Active Shift Association.
- TEST 16: Multi-Outlet Customer Store Selection Enforcement.
- TEST 17: Price Override Authorization Check.
- TEST 18: Simplified UX Default State (Collapsed More Details).
- TEST 19: Billing Profile Defaults Specification (`B2C_ONLY` vs `B2B_ONLY`).
- TEST 20: 4-Tier Configuration Precedence Resolution.
- TEST 21: Shift Management Policy Enforcement.
- TEST 22: Mandatory Customer PO Reference Policy in B2B.
- TEST 23: Repeat Barcode Policies (`INCREASE_QUANTITY`, `NEW_LINE`, `ASK_USER`).
- TEST 24: Bulk Add Line Item Parsing & Multi-Mode Input.
- TEST 25: Zero Synthetic Products Anti-Pattern (Strict Policy).
- TEST 26: Duplicate Invoice Prevention with Idempotency Key.

### Comprehensive Billing Regression Suites
Executed: `npx vitest run src/tests/smritiBillingStudio.test.ts src/tests/canonicalBillingConsolidation.test.ts src/tests/billingWorkspaceConvergence.test.ts src/tests/billingTerm.test.ts src/tests/p0BillingRemediationAndUx.test.ts src/tests/conditionalStoreCodePsv.test.ts`

### Backend Test Suite
Executed: `.\.venv\Scripts\pytest backend\app\tests\test_billing_profile_engine.py`

### TypeScript & Lint Verification
Executed: `npx tsc --noEmit`

---

## 9. Verification Results

| Verification Phase | Command Executed | Result | Status |
|---|---|---|---|
| Vitest Unit Tests | `npx vitest run src/tests/smritiBillingStudio.test.ts` | **26/26 passed (100%)** | Done |
| All Billing Suites | `npx vitest run ...` (6 files) | **77/77 passed (100%)** | Done |
| TypeScript Compiler | `npx tsc --noEmit` | **0 errors (Exit code 0)** | Done |
| Backend Pytest Suite | `pytest backend/app/tests/test_billing_profile_engine.py` | **1/1 passed (100%)** | Done |
| Zero Schema Drift | SQLAlchemy ORM & PostgreSQL Inspection | **0 migrations needed** | Done |

---

## 10. Known Limitations

1. **Direct XLSX Parsing**: As specified in the master command, direct client-side XLSX binary parsing was omitted in favor of clipboard paste (tab-separated Excel text) and CSV file uploads to prevent adding heavyweight third-party spreadsheet parsing dependencies.
2. **Offline Profile Switching**: Profile migrations and feature override updates require live connectivity to the backend control plane; cashiers cannot reconfigure company billing profiles while in offline mode.

---

## 11. Future Work

1. **Hardware Scale Integration**: Add continuous weight-scale polling via Web Serial / WebUSB for grocery and produce POS checkout.
2. **Direct EDI Order Inwarding**: Add automated Electronic Data Interchange (EDI) ingestion for enterprise B2B customers directly placing wholesale orders into Billing Studio.

---

## 12. Related ADRs

- `ADR-BILLING-20261017-01`: Zero Database Schema Migrations via Existing Key-Value Storage.
- `ADR-BILLING-20261017-02`: Strict Disallowance of Hybrid or Combined Profiles.
- `ADR-BILLING-20261017-03`: Four-Tier Configuration Precedence.

---

## 13. Related RFCs

- `RFC-BILLING-20261017-01`: Unified Profile-Driven Billing Architecture.
- `RFC-POS-20260712-01`: SMRITI Shift Management and Cash Drawer Reconciliations.
