<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Commercial Pilot Smoke Test Checklist

**Target Version:** v3.29.0  
**Branch:** `smritiNX`  
**Deployment Target:** Commercial Pilot / Staging & Production  

---

## 1. Pre-Flight Verification Gates

| # | Check Item | Verification Command / Target | Expected Criteria | Status |
|---|---|---|---|---|
| PF-01 | Node / TS Lint | `npm run lint` (`tsc --noEmit`) | Clean compilation, 0 TypeScript errors | PASS |
| PF-02 | Vitest Test Suite | `npx vitest run` | All test files pass (128/128 tests) | PASS |
| PF-03 | Pytest Security Suite | `pytest backend/tests/test_e2e_tenant_security_and_routing.py backend/app/tests/test_ecom_connectors.py backend/tests/test_company_control_center_security.py` | 20/20 multi-tenant security tests pass | PASS |
| PF-04 | Database Schema Migration | `cd backend && alembic upgrade head` | Database migrated through `v1337_backfill_variant_id` / head | PASS |
| PF-05 | Version Uniformity | `src/config/version.ts`, `package.json`, UI headers | Uniform `3.29.0` version display across all screens | PASS |

---

## 2. Tier A Operational Path Verification

| # | Workflow Area | Target Endpoint / Screen | Operational Acceptance Criteria | Test Mode | Status |
|---|---|---|---|---|---|
| TA-01 | **Login & Auth** | `POST /api/v1/auth/login` | Valid JWT issued with user identity, roles, and assigned company database mapping. | AUTOMATED | PASS |
| TA-02 | **Tenant Selector** | `GET /api/v1/auth/tenants`, `CompanySelectionScreen` | Filtered list of authorized companies; selecting company sets active tenant context. | AUTOMATED | PASS |
| TA-03 | **Fiori Launchpad** | `FioriLaunchpad.tsx`, `getVisibleLaunchpadTiles` | Tiles filtered strictly by role (deny-by-default for unassigned roles; no SYSADMIN auto-elevation). | AUTOMATED | PASS |
| TA-04 | **Billing Desk (POS)** | `/api/v1/pos/`, `/api/v1/sales/` | Barcode scan resolution, line addition, price calculation, tender posting, cash drawer sync. | AUTOMATED | PASS |
| TA-05 | **Item Master** | `/api/v1/products/` | Database server-side pagination (`LIMIT/OFFSET`), deterministic ordering, multi-field `ILIKE` search. | AUTOMATED | PASS |
| TA-06 | **Customer Master** | `/api/v1/crm/` | Customer directory, GSTIN format validation, credit limit checking. | AUTOMATED | PASS |
| TA-07 | **Sales Studio** | `/api/v1/sales/` | Sales invoice register, return processing, multi-tender transactions. | AUTOMATED | PASS |
| TA-08 | **Create Tax Invoice** | `/api/v1/sales/invoices`, `TaxInvoiceA4.tsx` | B2B statutory invoice, customer GSTIN verification, Place of Supply, Indian words amount, printable A4 format. | AUTOMATED | PASS |
| TA-09 | **Purchase Studio** | `/api/v1/purchase/` | Vendor purchase orders, Goods Receipt Notes (GRN), inventory batch receiving. | AUTOMATED | PASS |
| TA-10 | **Barcode Studio** | `/api/v1/barcode/`, `LabelPrintingSection.tsx` | Label layout selection, dynamic printer IP from SystemConfig (no hardcoded IP), print dispatch. | AUTOMATED | PASS |
| TA-11 | **Stock Movement Ledger** | `/api/v1/inventory/ledger`, `LedgerScreen.tsx` | Immutable stock movement ledger, date filtering, movement type breakdown, CSV export. | AUTOMATED | PASS |
| TA-12 | **Security & Audit Logs** | `/api/v1/audit-logs`, `LedgerScreen.tsx` | Immutable user audit logs, login events, CRUD traces. | AUTOMATED | PASS |

---

## 3. Role-Based Access Control (RBAC) & Negative Checks

| # | Role | Test Action | Expected Result | Status |
|---|---|---|---|---|
| RB-01 | **Unassigned / Blank Role** | Access Launchpad with `role: null` or `role: ""` | Deny-by-default: only unrestricted tiles visible; admin tiles (`company-setup`, `ufe`, `dev-tracker`, `staff-management`) HIDDEN. | PASS |
| RB-02 | **Cashier** | Access Launchpad with `role: "CASHIER"` | Core operational tiles visible (`pos`, `item-master`, `stock-ledger`, `create-tax-invoice`); admin tiles HIDDEN. | PASS |
| RB-03 | **Cashier Negative** | Attempt direct access to Company Setup or UFE | Navigation rejected / Tile not present in catalog. | PASS |
| RB-04 | **SysAdmin** | Access Launchpad with `role: "SYSADMIN"` | Full catalog (all 33 workspaces) accessible. | PASS |

---

## 4. Pilot Readiness Sign-Off Gate

- [x] Pre-flight verification gates passed
- [x] Tier A operational path verified
- [x] RBAC deny-by-default negative checks passed
- [x] Database migrations verified through alembic head
- [x] Zero hardcoded demo credentials in repository

**Final Decision:** **GO** for Commercial Pilot Deployment (v3.29.0)
