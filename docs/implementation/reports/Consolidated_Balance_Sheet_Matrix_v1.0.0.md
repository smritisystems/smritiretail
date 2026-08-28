<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.83.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Enterprise Multi-Store Consolidated Financial Balance Sheet Matrix (v1.0.0-GA)

## 1. Objective
Establish an Enterprise Multi-Store Consolidated Financial Balance Sheet Matrix modal (`ConsolidatedBalanceSheetModal.tsx`) in SMRITI Retail OS, delivering cross-branch financial statement consolidation with automated inter-company eliminations, live accounting equation verification (`Assets == Liabilities + Equity`), and statutory financial exports.

## 2. Business Motivation
Multi-store retail enterprises operate across several retail branches and centralized warehouses. Generating a unified group financial balance sheet requires eliminating inter-branch transfers and receivables to determine true group net worth and gearing ratios.

## 3. Scope
- Consolidated Financial Balance Sheet Matrix Modal (`ConsolidatedBalanceSheetModal.tsx`).
- Live Accounting Invariant Check (`Assets == Liabilities + Equity`).
- Automatic Inter-Company Eliminations for cross-branch receivables and payables.
- Multi-currency support and export integration (XLSX, PDF, CSV).
- Certification Vitest suite (`src/tests/consolidatedBalanceSheet.test.ts`).

## 4. Current State
Financial reports were available individually per company/branch without automated multi-branch matrix consolidation.

## 5. Gap Analysis
- Needed universal multi-column branch view with side-by-side branch comparisons and elimination adjustments.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: Financial structures map to double-entry general ledger accounts in FastAPI/PostgreSQL backend (`backend/app/models/accounting.py`).

## 7. Proposed Design
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│          ENTERPRISE MULTI-BRANCH CONSOLIDATED BALANCE SHEET MATRIX          │
├───────────────────┬──────────────┬──────────────┬─────────────┬─────────────┤
│ Line Item         │ Branch 1     │ Branch 2     │ Inter-Co    │ Group Total │
├───────────────────┼──────────────┼──────────────┼─────────────┼─────────────┤
│ 1. Current Assets │ ₹5,855,000   │ ₹2,980,000   │ -₹80,000    │ ₹8,755,000  │
│ 2. Liabilities    │ ₹3,640,000   │ ₹1,560,000   │ -₹80,000    │ ₹5,120,000  │
│ 3. Group Equity   │ ₹2,215,000   │ ₹1,420,000   │ ₹0          │ ₹3,635,000  │
└───────────────────┴──────────────┴──────────────┴─────────────┴─────────────┘
```

## 8. Files Created
- `src/components/reports/ConsolidatedBalanceSheetModal.tsx`
- `src/tests/consolidatedBalanceSheet.test.ts`
- `docs/implementation/reports/Consolidated_Balance_Sheet_Matrix_v1.0.0.md`
- `docs/walkthrough/reports/Consolidated_Balance_Sheet_Matrix_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Rounding drift across foreign currency conversions.
  *Mitigation:* Decimal arithmetic enforces sub-paise balance tolerance threshold.

## 12. Rollback Strategy
Non-destructive standalone modal component with dedicated test suite.

## 13. Verification Plan
- Unit tests verifying balance sheet line models, multi-branch aggregation, inter-company elimination math, and accounting balance invariants.
- Full Vitest suite pass rate (`388/388 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update SMRITI Financial Accounting & Group Consolidation Manual.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`388/388 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-012`: Double-Entry Unified General Ledger Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Consolidated_Balance_Sheet_Matrix_v1.0.0.md`.
