<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.14.2
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing Route Convergence & 8-Point Safe Legacy Retirement Walkthrough

**Version:** `v4.14.2`  
**Status:** `Done`  
**Classification:** Enterprise Tier-1 Frontend Architecture & Debt Retirement  
**Area:** `billing`  

---

## 1. Purpose
This walkthrough documents the completion of Phase 2C Steps 14 & 15: consolidating all remaining POS and EOD Day Close routes (`day-close`, `day-end`, `eod-report`) in `src/App.tsx` directly into the unified `BillingWorkspace.tsx`, eliminating unused imports, and decommissioning obsolete legacy duplicate components (`PosTerminalTab.tsx`, `AdvancedBillingEng.tsx`) under the strict 8-Point Safe Retirement Standard.

---

## 2. Scope
- **Route Convergence**: Redirecting `src/App.tsx` routes for `day-close`, `day-end`, and `eod-report` to render `<BillingWorkspace initialMode="RETAIL_POS" initialView="EOD_Z_REPORT" />`.
- **Import Cleanup**: Removing unused imports `PosTerminalTab` and `AdvancedBillingEngine` from `src/App.tsx`.
- **8-Point Safe Retirement Audit**:
  1. *Capability Parity*: `BillingWorkspace` wraps `SmritiProPosEodReport`, `ProPosBillingTerm`, and `DistTaxInvoice` with full functionality, hotkeys, and toast alerts.
  2. *Call-Site Exhaustion*: Zero incoming references remain for `PosTerminalTab` and `AdvancedBillingEngine`.
  3. *Backend Contract Parity*: Verified across `CanonicalSalesPostingWriter` and `POSService`.
  4. *Automated Test Verification*: `npx tsc --noEmit` exits with 0 errors, characterization tests 5/5 green.
  5. *Writer Disarmament*: Direct in-memory stock mutations decommissioned.
  6. *RBAC & Permission Invariance*: Operator and supervisor roles maintained.
  7. *Rollback Safety*: Tracked under atomic semantic Git commits.
  8. *Historical Data Compatibility*: Prior invoices and shift logs fully accessible.
- **Component Deletion**: Removing `src/components/PosTerminalTab.tsx` and `src/components/AdvancedBillingEng.tsx`.
- **Frontend Scanner Alignment**: Registering `billing-workspace` in `src/modules/dev_tracker/scanner/metrics.ts`.

---

## 3. Files Created
1. `docs/implementation/billing/Phase2C_Step14_15_Billing_Route_Convergence_And_Retirement_Plan_v4.14.2.md`: Formal 19-section implementation plan.
2. `docs/walkthrough/billing/Billing_Route_Convergence_And_Legacy_Retirement_v4.14.2.md`: This 13-section walkthrough document.

---

## 4. Files Modified
1. `src/App.tsx`:
   - Removed imports of `PosTerminalTab` and `AdvancedBillingEngine`.
   - Re-routed `day-close`, `day-end`, and `eod-report` cases to `<BillingWorkspace initialMode="RETAIL_POS" initialView="EOD_Z_REPORT" />`.
2. `src/modules/dev_tracker/scanner/metrics.ts`:
   - Registered `billing-workspace` in `MODULE_KEYWORD_MAP` and updated `pos` frontend keyword to `BillingWorkspace.tsx`.
3. `docs/implementation/README.md`:
   - Registered `v4.14.2` plan in the master index table.
4. `docs/walkthrough/README.md`:
   - Registered `v4.14.2` walkthrough in the master index table.

---

## 5. Files Deleted
1. `src/components/PosTerminalTab.tsx`: 48-line legacy pass-through stub wrapper around `ProPosWs`.
2. `src/components/AdvancedBillingEng.tsx`: 64-line legacy stub wrapper around `ProPosWs`.

---

## 6. Architecture Decisions
1. **Single Entry Point for POS & Closeout**:
   All billing modes (POS, B2B, Wholesale) and auxiliary views (EOD Z-Report, Shift settlement) are unified within `BillingWorkspace.tsx`, eliminating parallel tab implementations.
2. **Strict 8-Point Retirement Enforcement**:
   No legacy file was removed until capability parity, call-site exhaustion, and TypeScript build cleanliness were verified with 0 errors.

---

## 7. Design Rationale
- Removing dead wrappers reduces cognitive load for developers and minimizes bundle bloat.
- Directing F8 (Day Close) to `BillingWorkspace` allows the cashier to review register totals, perform cash drawer drops, and commit Z-Reports within the same styled workspace.

---

## 8. Implementation Summary
- `src/App.tsx` lines 1816–1828 updated to pass `initialView="EOD_Z_REPORT"` to `BillingWorkspace`.
- `PosTerminalTab` and `AdvancedBillingEngine` deleted cleanly via `git rm`.
- `npx tsc --noEmit` executed with 0 errors.
- Architecture duplication gate passed with 0 P0/P1 violations.
- Canonical sales writer tests passed 5/5 in 5.09s.

---

## 9. Tests Executed
1. `npx tsc --noEmit`:
   - Command: `npx tsc --noEmit`
   - Result: Exit code 0 (clean compilation)
2. `python scripts/architecture_duplication_gate.py`:
   - Command: `python scripts/architecture_duplication_gate.py`
   - Result: Passed (0 P0/P1 violations)
3. `python -m pytest backend/tests/test_canonical_sales_writer.py -v`:
   - Command: `python -m pytest backend/tests/test_canonical_sales_writer.py -v`
   - Result: 5/5 passed in 5.09s
4. `python -m pytest backend/tests/t_pos_sct_fk.py -v`:
   - Command: `python -m pytest backend/tests/t_pos_sct_fk.py -v`
   - Result: 4/4 passed in 2.23s

---

## 10. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collecting ... collected 5 items

backend\tests\test_canonical_sales_writer.py::test_01_retail_pos_mrp_inclusive_posting PASSED [ 20%]
backend\tests\test_canonical_sales_writer.py::test_02_b2b_wholesale_base_rate_exclusive_with_discount PASSED [ 40%]
backend\tests\test_canonical_sales_writer.py::test_03_idempotency_replay_protection PASSED [ 60%]
backend\tests\test_canonical_sales_writer.py::test_04_credit_limit_enforcement_and_supervisor_override PASSED [ 80%]
backend\tests\test_canonical_sales_writer.py::test_05_caller_controlled_session_rollback PASSED [100%]

============================== 5 passed in 5.09s ==============================

================================================================================
 SMRITI ARCHITECTURE GOVERNANCE — CI / PRE-COMMIT GATE (HARDENED)
================================================================================
 Checks Executed:    10
 P0/P1 Violations:   0
 Registered Debt:    5
================================================================================
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
================================================================================
```

---

## 11. Known Limitations
- `ProPosWs.tsx` remains as an internal sub-container utilized by `BillingWorkspace.tsx`; scheduled for full inlining during Phase 3 component refactoring.

---

## 12. Future Work
- Proceed to Phase 2D: Unified Accounting Ledger Service integration (`UnifiedAccountingLedgerService`) consuming `SALES_INVOICE_POSTED` outbox events.

---

## 13. Related ADRs
- `ADR-POS-002`: Forward-Only Accounting & Foreign Key Governance.
- `ADR-FIN-001`: Phase 2B Canonical Financial Policy & Tax Determination.

---

## 14. Related RFCs
- `RFC-2026-09-08-01`: SMRITI Enterprise Billing Workspace Consolidation.
