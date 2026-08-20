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

# SMRITI Retail OS — Commercial Pilot Smoke Test Results

**Date:** 2026-08-20  
**Version:** v3.29.0  
**Branch:** `smritiNX`  
**Overall Verdict:** **GO** (All critical pre-flight, Tier A operational paths, and RBAC negative checks PASSED)

---

## 1. Pre-Flight Gates

| Check ID | Item | Evidence / Command | Result |
|---|---|---|---|
| PF-01 | TypeScript Compilation | `npm run lint` (`tsc --noEmit`) | **PASS** (0 errors) |
| PF-02 | Vitest Test Suite | `npx vitest run` | **PASS** (20 files, 128 tests) |
| PF-03 | Pytest Security & Backend Suite | `pytest backend/tests/...` | **PASS** (39 tests) |
| PF-04 | Database Alembic Head | `alembic current` | **PASS** (`v1338_company_isolated_barcodes (head)`) |
| PF-05 | Product Variant ID Integrity | `SELECT count(*) FROM products WHERE variant_id IS NULL;` | **PASS** (0 nulls) |
| PF-06 | Version Uniformity | `APP_VERSION = "3.29.0"` | **PASS** |

---

## 2. Tier A Operational Path Results

| Item ID | Workflow Area | Test Method | Result | Notes |
|---|---|---|---|---|
| TA-01 | Login & JWT Authentication | Automated API / Pytest | **PASS** | Valid JWT issued with tenant DB routing context. |
| TA-02 | Tenant Database Selector | Automated / Vitest | **PASS** | `CompanySelectionScreen` and `/auth/tenants` filter active DBs. |
| TA-03 | Fiori Launchpad & Workspaces | Automated / Vitest | **PASS** | 33 workspaces cataloged; deny-by-default role filtering active. |
| TA-04 | Billing Desk (POS) | Automated API / Unit | **PASS** | POS calculations, cashier shifts, tender registers. |
| TA-05 | Item Master Catalog | Automated / Vitest | **PASS** | Database-level pagination (`LIMIT/OFFSET`), deterministic ordering. |
| TA-06 | Customer Master | Automated API / Unit | **PASS** | GSTIN validation, directory lookups. |
| TA-07 | Sales Studio | Automated API / Unit | **PASS** | Sales invoices, returns, multi-tender transactions. |
| TA-08 | Create Tax Invoice (B2B) | Automated / Pytest & Vitest | **PASS** | B2B statutory invoice, Place of Supply, Indian words formatting. |
| TA-09 | Purchase Studio | Automated API / Unit | **PASS** | Vendor purchase orders, Goods Receipt Notes (GRN). |
| TA-10 | Barcode Studio & Printing | Automated API / Unit | **PASS** | Dynamic SystemConfig printer IP (no hardcoded IP), print dispatch. |
| TA-11 | Stock Movement Ledger | Automated / Vitest | **PASS** | Immutable stock movements, date filters, CSV export. |
| TA-12 | Security & Audit Logs | Automated / Vitest | **PASS** | Immutable audit logs, user login traces. |

---

## 3. RBAC Negative & Boundary Checks

| Check ID | Scenario | Expected Behavior | Result |
|---|---|---|---|
| RB-01 | Unassigned / Null / Empty Role | Deny-by-default; admin tiles (`company-setup`, `ufe`, `dev-tracker`) hidden | **PASS** |
| RB-02 | Cashier Role Access | Sees core operational tiles (`pos`, `item-master`, `stock-ledger`); admin tiles hidden | **PASS** |
| RB-03 | Cashier Negative Attempt | Cannot see or route to Company Setup or UFE | **PASS** |
| RB-04 | SysAdmin Full Catalog | All 33 workspaces visible and accessible | **PASS** |

---

## 4. Hardware & Manual Verification Watch Items

| Item ID | Target | Verification Method | Status | Notes |
|---|---|---|---|---|
| HW-01a | Barcode Printer Settings & Layout API | Automated Pytest / Router Test | **PASS** | `/api/v1/barcode/printer-settings` & `/api/v1/barcode/layouts` tenant isolation verified. |
| HW-01b | Physical Thermal Barcode Printer | Live hardware dispatch over TCP port 9100 | **REQUIRES_HUMAN** | Field watch: verify on-site with physical Zebra/TSC thermal printer. |
| HW-02a | Cash Drawer Software Trigger Hook | Automated POS receipt hook | **PASS** | POS print slip generator dispatches drawer kick ESC/POS sequence. |
| HW-02b | Physical Cash Drawer Kick Pulse | RJ11 cash drawer trigger | **REQUIRES_HUMAN** | Field watch: verify on-site with physical RJ11 drawer connected to printer. |

---

## 5. Final Sign-Off Gate

```
Pre-flight:                 PASS
Tier A Path:                PASS
RBAC Checks:                PASS
Database Head:              PASS
Hardware Software Dispatch: PASS
Hardware Physical Device:   REQUIRES_HUMAN (Field Watch on Staging/Store Station)

OVERALL PILOT VERDICT: GO_SOFTWARE (Ready for Staging / Field Hardware Pairing)
```

