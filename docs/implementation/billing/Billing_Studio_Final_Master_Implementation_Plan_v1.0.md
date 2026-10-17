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
  Classification: Implementation Plan — Billing Studio Final Master Architecture
-->

# Implementation Plan — SMRITI Billing Studio Final Master Architecture

## 1. Objective
Finalize the canonical SMRITI Billing Studio (`SmritiBillingStudio.tsx`) as a single, profile-driven, production-oriented billing experience. Establish a rigid company-level Billing Profile Engine supporting exactly two profiles:
- `B2C_ONLY` — Retail POS billing.
- `B2B_ONLY` — Business and wholesale invoicing.

Guarantee automatic configuration, administrator-controlled customization, and simple cashier experience while strictly preserving existing invoice, inventory, accounting, shift, security, and statutory GST contracts.

---

## 2. Business Motivation
Retail enterprises operate under distinct commercial topologies:
1. Fast-paced high-throughput retail stores requiring walk-in speed, barcode scanning, quick quantity/rate editing, active shift reconciliation, and thermal receipts.
2. Wholesale distributors requiring business customer search, GSTIN validation, PO reference tracking, credit terms, and A4 statutory tax invoices.

Previously, disparate entry points and hardcoded demo artifacts created ambiguity. By unifying into a single canonical Billing Studio adapted strictly through company-level profiles without code alterations, SMRITI provides a predictable, compliant, and auditable solution for both retail and wholesale businesses.

---

## 3. Scope
### In Scope
1. **Billing Profile Engine**:
   - Exactly two company profiles: `B2C_ONLY` and `B2B_ONLY`.
   - Setup gate: if unconfigured, requires authorized administrator setup without silent defaulting.
   - Authorized profile migration with reason auditing and preservation of historical ledgers.
   - 4-tier configuration precedence: Company Policy > Billing Profile > Store Config > User Preferences.
2. **Profile-Based Default Configuration**:
   - `B2C_ONLY`: Fast POS, walk-in customer default, barcode scanning, cash/UPI/card tenders, Thermal receipt default, Shift Management enabled by default.
   - `B2B_ONLY`: Business customer search, GSTIN details, PO reference, credit terms & due dates, A4 tax invoice default, Shift Management disabled by default.
3. **Single Canonical Billing Studio Workflow**:
   - Customer → Items in Cart → Add Items → Bill Summary → Payment → Save / Print / Share.
   - Removal of duplicate entry points.
   - Collapsible More Details (collapsed by default).
   - Dedicated modal configuration for scan preferences and profile settings.
4. **Barcode Scanning & Cart**:
   - Scan modes: `AUTO_ADD`, `EDIT_THEN_ADD`, `CONFIRM_PRODUCT`.
   - Repeat-barcode policies: `INCREASE_QUANTITY`, `NEW_LINE`, `ASK_USER`.
   - Standard 10-column cart grid (Product, Barcode, Style, Color, Size, Qty, Rate, Discount, Amount, Salesperson).
   - Rate override permission checks.
5. **Bulk Add Items**:
   - 3-mode bulk entry: Paste Barcodes, Paste Barcode + Qty (tab/comma/footwear apparel), and Import CSV.
   - Live pre-commit validation preview grid with row numbers and actionable HREP error messages.
   - Pre-commit data correction and atomic batch addition to cart.
6. **Data Cleanliness & GST Integrity**:
   - Removal of hardcoded demo carts and demo customers from production flows.
   - Proper company branch, customer outlet, billing store, and delivery store discrimination.
   - Statutory GST calculation parity using `computeBillingTotals`.
7. **Shift Management & Transaction Boundaries**:
   - Profile defaults with administrator overrides.
   - Backend validation in `/checkout` against company shift policies.
   - Non-destructive profile changes preserving all past shifts, invoices, and stock movements.

### Out of Scope
- Direct XLSX binary parsing (prioritizing robust CSV and clipboard tab/comma paste).
- Combined hybrid profile (strictly prohibited).
- Schema alterations to PostgreSQL core ledger tables (zero-migration architecture using `company_policy_settings`).

---

## 4. Current State
- `SmritiBillingStudio.tsx` exists and serves as the single canonical UI component.
- The component currently initializes with hardcoded Reliance Retail demo data (`DEMO_RELIANCE_CUSTOMER`, `INITIAL_DEMO_CART_ITEMS`).
- Mode switching was loosely exposed via `BillingWorkspace` tri-modal buttons without authoritative company-level profile persistence.
- Scan modes exist, but repeat barcode handling defaults solely to `increment_qty` without configurable `NEW_LINE` or `ASK_USER` options.
- Bulk addition was limited to CSV import routes without a dedicated, unified 3-mode modal right beside Add Item controls.

---

## 5. Gap Analysis
| Requirement | Existing State | Required Final State |
|---|---|---|
| Profile Engine | Tri-modal UI switcher (`RETAIL_POS`, `CREDIT_BILLING`, `B2B_DISTRIBUTOR`) | Authoritative `B2C_ONLY` vs `B2B_ONLY` backed by `CompanyPolicySetting` |
| Initial Setup | Silently defaulted to Retail POS | Unconfigured gate prompting Admin setup dialog; zero silent guessing |
| Administrator Customization | In-memory scan preferences modal | Company policy overrides stored in DB with audit trail |
| Bulk Add Items | Backend `/billing/csv/validate` exists but no UI modal in studio | Unified 3-mode modal (Paste Barcodes, Paste Barcode+Qty, CSV) with preview grid |
| Repeat Barcode Policy | Only `increment_qty` | Configurable `INCREASE_QUANTITY`, `NEW_LINE`, and `ASK_USER` prompt |
| Production Clean Data | Initial state loaded with 3 demo items & demo customer | Clean empty cart on start; B2C walk-in customer default; B2B customer search |
| Shift Management Wiring | In-memory active shift check | Profile-driven default (B2C: enabled, B2B: disabled) with backend enforcement in checkout |

---

## 6. Architecture Impact
```text
React 18 + Vite Frontend (Port 3000)
    │
    ├── SmritiBillingStudio.tsx (Single Canonical Studio)
    │     ├── Initial Setup Gate (Unconfigured -> Setup Modal)
    │     ├── Profile Engine: B2C_ONLY vs B2B_ONLY
    │     ├── Bulk Add Modal (Paste Barcode, Barcode+Qty, CSV Preview Grid)
    │     ├── Scan & Repeat Policy Engine (INCREASE_QUANTITY, NEW_LINE, ASK_USER)
    │     └── Administrator Configuration Modal (Policy Overrides & Audit Log)
    │
    ▼ apiFetchV1 (/api/v1/billing/*)
FastAPI Backend (Port 1981 / 8000)
    │
    ├── /billing/profile (GET profile & effective configuration)
    ├── /billing/profile/setup (POST initial profile setup)
    ├── /billing/profile/switch (PUT authorized profile migration with audit log)
    ├── /billing/configuration (PUT administrator feature customizations)
    ├── /billing/checkout (POST atomic posting enforcing shift & profile rules)
    │
    ▼ SQLAlchemy 2.0 Async
PostgreSQL Database (zero schema migrations)
    └── company_policy_settings ("billing_profile", "billing_configuration", "billing_profile_history")
```

---

## 7. Proposed Design

### 7.1 Backend Policy Endpoints
1. `GET /api/v1/billing/profile`:
   - Checks `CompanyPolicySetting` for `billing_profile`.
   - If missing: returns `{"configured": false, "billing_profile": null}`.
   - If configured: resolves effective configuration using 4-tier precedence.
2. `POST /api/v1/billing/profile/setup`:
   - Enforces Manager/Sysadmin authorization.
   - Validates profile in `{"B2C_ONLY", "B2B_ONLY"}`.
   - Persists profile and default policy configurations.
3. `PUT /api/v1/billing/profile/switch`:
   - Authorized profile migration.
   - Appends audit entry into `billing_profile_history`.
   - Leaves past transactions, shifts, and stock movements intact.
4. `PUT /api/v1/billing/configuration`:
   - Saves feature overrides (Shift Management, PO requirement, Bulk Add, Scan mode, etc.).

### 7.2 Frontend Implementation
1. **Unconfigured Profile Setup Dialog**:
   - Blocks cashier operation if company profile is unconfigured.
   - Displays clear cards for `B2C_ONLY` (Retail POS) and `B2B_ONLY` (Wholesale).
   - Submits selection to backend setup API.
2. **Profile Adaptation**:
   - `B2C_ONLY`:
     - Initializes with `WALK_IN_CUSTOMER`.
     - Cart starts clean.
     - Shift HUD active.
     - PO reference hidden.
     - Default print: Thermal 80mm.
   - `B2B_ONLY`:
     - Requires business customer selection with GSTIN validation.
     - PO reference visible and configured (HIDDEN, OPTIONAL, or REQUIRED).
     - Shift HUD hidden/inactive unless overridden by admin.
     - Default print: A4 Tax Invoice.
3. **Bulk Add Modal**:
   - Tab 1: Paste Barcodes (1 per line).
   - Tab 2: Paste Barcode + Qty (tab or comma separated, or Article+Color+Size+Qty).
   - Tab 3: CSV Import (drag-and-drop, preview, column mapping).
   - Pre-commit preview table displaying matched products, line rate, quantities, and errors with row indices.
   - Editable before commit; safe transaction commit into cart.
4. **Repeat Barcode Policies**:
   - Handled via `scanRepeatPolicy`: `INCREASE_QUANTITY`, `NEW_LINE`, `ASK_USER`.
   - `ASK_USER` displays quick dialog: "Product already in cart. Increment quantity (Qty + 1) or Add as new line?"

---

## 8. Files Created
1. `docs/implementation/billing/Billing_Studio_Final_Master_Implementation_Plan_v1.0.md`
2. `src/components/billing/modals/BulkAddItemsModal.tsx`
3. `src/components/billing/modals/BillingProfileSetupModal.tsx`
4. `src/components/billing/modals/BillingProfileConfigModal.tsx`
5. `src/tests/billingProfileEngine.test.ts`
6. `backend/app/tests/test_billing_profile_engine.py`

---

## 9. Files Modified
1. `backend/app/api/v1/billing.py` (Add profile setup, switch, config, and profile query endpoints)
2. `backend/app/services/canonical_sales_writer.py` (Enforce profile customer and shift rules)
3. `src/components/billing/SmritiBillingStudio.tsx` (Integrate profile engine, bulk add, clean initial state, repeat policy)
4. `src/components/billing/BillingWorkspace.tsx` (Harmonize with profile engine)
5. `docs/implementation/README.md` (Update master index)
6. `docs/walkthrough/README.md` (Update master index)

---

## 10. Dependencies
- FastAPI, SQLAlchemy 2.0, asyncpg.
- Existing `CompanyPolicySetting` table and `CompanyPolicyService`.
- React 18, Lucide React, TailwindCSS, Vitest, Playwright.

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Cashier blocked on unconfigured tenant | Medium | Initial setup dialog presented automatically with clean administrator guidance |
| Race conditions in bulk barcode lookup | Low | Parallelized batch lookup with single state update commit |
| Accidental duplicate bulk imports | Medium | Button disabled with spinner during processing; pre-commit verification |
| Shift policy violation during POS checkout | High | Authoritative backend validation in `CanonicalSalesPostingWriter` |

---

## 12. Rollback Strategy
1. The profile engine utilizes key-value storage in `company_policy_settings`; no database schema changes are introduced.
2. In case of rollback, reverting frontend and backend code files restores previous behavior without data migration side effects.

---

## 13. Verification Plan
1. Unit Tests: Vitest test suite testing both profile defaults, configuration precedence, repeat barcode policies, and bulk add parsing.
2. Backend Tests: Pytest suite testing `/billing/profile`, `/billing/profile/setup`, `/billing/profile/switch`, and `/billing/configuration`.
3. TypeScript Verification: `npx tsc --noEmit` exit code 0.
4. Production Build: `npm run build` exit code 0.
5. Headless Verification: Automated Playwright script verifying B2C checkout, B2B workflow, bulk add items, and receipt generation.

---

## 14. Test Plan
- Test B2C profile defaults: walk-in customer, shift enabled, thermal format.
- Test B2B profile defaults: customer selection required, shift disabled, A4 format.
- Test unconfigured setup flow: blocks until admin selects profile.
- Test repeat barcode policy: `INCREASE_QUANTITY` vs `NEW_LINE` vs `ASK_USER`.
- Test Bulk Add:
  - Paste barcodes (single and multiple).
  - Paste barcode + quantity (tab and comma).
  - Unknown barcode rejection with actionable row message.
- Test profile switch: historical records preserved, audit log recorded.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Generate `docs/walkthrough/billing/Billing_Studio_Final_Master_Walkthrough_v1.0.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`.

---

## 16. Deployment Plan
1. Commit backend endpoints in `backend/app/api/v1/billing.py`.
2. Commit frontend components in `src/components/billing/`.
3. Run verification test suites.
4. Deploy to development environment.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-042: System Parameters & Hierarchical Configuration Precedence`
- `ADR-055: Canonical Dual-Key Write Authority & Transaction Idempotency`
- `ADR-058: Universal Barcode Resolution & Product Catalog Identity`

---

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Canonical_Billing_Studio_Replacement_v1.0.md`
- `docs/walkthrough/billing/Billing_Studio_UX_Simplification_v1.0.md`
- `docs/walkthrough/billing/Billing_Studio_Final_Master_Walkthrough_v1.0.md`
