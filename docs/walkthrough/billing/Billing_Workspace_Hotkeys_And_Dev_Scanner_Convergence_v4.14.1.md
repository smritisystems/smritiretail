<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.14.1
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing Workspace Hotkeys, Mode-Switching & Dev-Tracker Scanner Registration Walkthrough

**Version:** `v4.14.1`  
**Status:** `Done`  
**Classification:** Enterprise Tier-1 Frontend & Governance Convergence  
**Area:** `billing`  

---

## 1. Purpose
This walkthrough documents the frontend keyboard shortcut integration (`Alt+1` Retail POS, `Alt+2` B2B Tax Invoice, `Alt+3` Wholesale Sizing Matrix) in the consolidated `BillingWorkspace.tsx`, full TypeScript compilation qualification, and the registration of the `billing-workspace` module in the comprehensive audit scanner (`backend/app/dev_tracker/scanner.py`), which elevated the Developer Health Index (DHI) to 85% (Grade B) and Development Score to 77%.

---

## 2. Scope
- **Global Hotkey Listeners**: Implementing keyboard event listeners in `BillingWorkspace.tsx` allowing cashiers and billing operators to instantly toggle between Retail POS (`Alt+1`), B2B Statutory Tax Invoice (`Alt+2`), and Wholesale Sizing Matrix (`Alt+3`).
- **Help / Cheatsheet Modal Alignment**: Synchronizing the hotkeys modal with the new shortcut combinations so operators have visual verification of active key bindings.
- **Audit Scanner Module Registration**: Formally defining the `billing-workspace` module in `MODULES_MAP` inside `backend/app/dev_tracker/scanner.py`, linking it to `BillingWorkspace.tsx`, its canonical routes (`billing`, `pos`, `sales`, `payments`, `invoices`), database tables (`sales_invoices`, `pos_transactions`, `shift_cash_transactions`, `payment_transactions`, `shifts`), and test suites.
- **Empirical Metric Progression**: Validating the jump of Billing Workspace completion from 44% (High Risk) to 76% (Low Risk), overall DHI from 84% to 85%, and Development Score from 76% to 77%.

---

## 3. Files Created
1. `docs/walkthrough/billing/Billing_Workspace_Hotkeys_And_Dev_Scanner_Convergence_v4.14.1.md`: This 13-section walkthrough document.

---

## 4. Files Modified
1. `src/components/billing/BillingWorkspace.tsx`:
   - Injected `Alt+1`, `Alt+2`, and `Alt+3` keydown handlers switching `activeMode` and resetting `auxView` to `"WORKSPACE"`.
   - Updated file metadata header to `2026-09-09`.
2. `backend/app/dev_tracker/scanner.py`:
   - Registered `billing-workspace` in `MODULES_MAP` with complete frontend, route, table, test, and doc associations.
   - Updated file metadata header to `2026-09-09`.
3. `docs/walkthrough/README.md`:
   - Appended `v4.14.1` walkthrough row to the chronological master index.

---

## 5. Architecture Decisions
1. **Ergonomic Operator Experience**:
   Cashiers in fast-paced retail and wholesale environments require sub-second mode switching without taking their hands off the physical keyboard. Dedicated `Alt+1` / `Alt+2` / `Alt+3` chords map directly to user cognitive models without conflicting with browser-level function keys.
2. **Deterministic Module Registry**:
   Rather than relying on default heuristic fallback conventions for unmapped tabs, registering enterprise modules in `MODULES_MAP` ensures precise, auditable tracking of code coverage, route wiring, database dependencies, and documentation lineage.

---

## 6. Design Rationale
- Keyboard-first navigation matches legacy ERP operator workflows (Shoper 9, Tally Prime) while running inside a modern, responsive React 18 client.
- The comprehensive audit scanner serves as the single source of metric truth across CI/CD and executive dashboards. Aligning module resources prevents phantom debt reporting.

---

## 7. Implementation Summary
- Keyboard event listener added in `src/components/billing/BillingWorkspace.tsx` lines 105–130.
- `npx tsc --noEmit` executed cleanly with 0 TypeScript compilation errors.
- `MODULES_MAP` in `backend/app/dev_tracker/scanner.py` updated to include `billing-workspace`.
- Codebase scan executed via `print_scores.py`, demonstrating empirical metric gains:
  - Overall DHI: **85%** (Grade B)
  - Overall Development Score: **77%**
  - Billing Workspace Module Score: **76%** (Risk: Low)

---

## 8. Tests Executed
1. `npx tsc --noEmit`:
   - Command: `npx tsc --noEmit`
   - Returncode: 0 (clean compilation)
2. `python -m pytest backend/tests/test_canonical_sales_writer.py -v`:
   - 5/5 passed in 5.06s
3. `python -m pytest backend/tests/t_pos_sct_fk.py -v`:
   - 4/4 passed in 2.42s
4. `python -m pytest backend/tests/t_payments.py -v`:
   - 6/6 passed in 12.07s
5. `python -m pytest backend/tests/t_univ_item.py -v`:
   - 10/10 passed in 9.84s
6. `python scripts/architecture_duplication_gate.py`:
   - CI Gate Passed (0 P0/P1 violations)
7. `python scratch/print_scores.py`:
   - Audited all 34 modules, verified 85% DHI and 76% Billing Workspace completion.

---

## 9. Verification Results
```text
=== OVERALL RELEASE SCORES ===
  dhi: 85
  developmentScore: 77
  qualityScore: 0
  releaseScore: 89
  securityScore: 100
  testCoverage: 88
  documentation: 85
  grade: B

=== MODULE COMPLETION BREAKDOWN (TOP MODULES) ===
  Sales Studio                     | Sales & POS            | 88% | Risk: Low
  Executive Hub                    | Operations             | 84% | Risk: Low
  About SMRITI                     | System                 | 84% | Risk: Low
  CRM & Loyalty                    | Sales & POS            | 80% | Risk: Low
  Billing Workspace                | Sales & POS            | 76% | Risk: Low
  Loyalty Studio                   | Sales & POS            | 72% | Risk: Low
  Report Designer                  | Workspace              | 72% | Risk: Low
  Item Master                      | Inventory & Sourcing   | 72% | Risk: Low
```

---

## 10. Known Limitations
- `qualityScore` remains at 0 in the scanner due to global count of legacy `TODO` markers in archived migration scripts; will be addressed during Phase 3 code hygiene sprints.

---

## 11. Future Work
- Step 14: Deprecate redundant quick action launchpad tiles (`sales` direct invoice generator) in favor of the unified `billing-workspace`.
- Step 15: Safe retirement of obsolete legacy billing standalone files under the 8-Point Safe Retirement Standard.

---

## 12. Related ADRs
- `ADR-POS-002`: Forward-Only Accounting & Foreign Key Governance.
- `ADR-FIN-001`: Phase 2B Canonical Financial Policy & Tax Determination.

---

## 13. Related RFCs
- `RFC-2026-09-08-01`: SMRITI Enterprise Billing Workspace Consolidation.
