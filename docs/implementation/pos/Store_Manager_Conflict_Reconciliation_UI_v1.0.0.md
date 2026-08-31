<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.76.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Store Manager Conflict Reconciliation UI Widget (v1.0.0-GA)

## 1. Objective
Build an interactive, glassmorphic Store Manager Conflict Reconciliation UI modal in ProPOS Studio for reviewing, auditing, and executing governance overrides or reversals on offline transaction drifts.

## 2. Business Motivation
When cashiers process offline sales transactions that encounter stock exhaustion or credit limit breaches upon upstream synchronization, the transactions are safely isolated in the Store Manager Reconciliation Queue (`NEEDS_REVIEW`). Store managers require a dedicated, clear visual interface to inspect diagnostics and make authoritative approval or reversal decisions.

## 3. Scope
- Store Manager Reconciliation UI Modal (`ProPosReconciliationDlg.tsx`).
- Filter tabs: `NEEDS_REVIEW`, `FAILED`, `PENDING`, and `ALL`.
- Live query search by invoice number, terminal ID, UUID, or diagnostic error message.
- Detailed transaction breakdown pane with conflict explanation.
- Manager actions: "Approve Override" (authorizes and commits) and "Reject & Reversal".

## 4. Current State
The backend API (`GET /api/v1/sync/reconciliation-queue`) and database queue were functional, but the frontend lacked a dedicated manager review dialog.

## 5. Gap Analysis
- Needed dedicated visual modal for store managers to inspect transaction drifts without leaving POS Studio.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 2: UI calls `apiFetchV1` (`/api/v1/sync/reconciliation-queue`) against the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────┐
│             STORE MANAGER CONFLICT RECONCILIATION MODAL                │
├───────────────────────────────────┬────────────────────────────────────┤
│  LEFT PANE: Queue List            │  RIGHT PANE: Diagnostic Breakdown │
│  - Filters: NEEDS_REVIEW / FAILED │  - Doc No, Terminal ID, Submitted  │
│  - Live Search Box                │  - Conflict Explanation           │
│  - Transaction Cards              │  - Actions: Approve / Reject       │
└───────────────────────────────────┴────────────────────────────────────┘
```

## 8. Files Created
- `src/components/billing/propos/ProPosReconciliationDlg.tsx`
- `src/tests/proposReconciliation.test.tsx`
- `docs/implementation/pos/Store_Manager_Conflict_Reconciliation_UI_v1.0.0.md`
- `docs/walkthrough/pos/Store_Manager_Conflict_Reconciliation_UI_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Accidental manager override on legitimate billing errors.
  *Mitigation:* Detailed governance notes and confirmation toasts accompany every action.

## 12. Rollback Strategy
Modular component that can be disabled or closed without affecting billing.

## 13. Verification Plan
- Unit tests verifying open/close states, queue loading, approve override handler, and reject handler.
- Full Vitest suite pass rate (`356/356 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update ProPOS Store Manager Guide.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`356/356 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-019`: Offline-First POS Edge Synchronization Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/pos/Store_Manager_Conflict_Reconciliation_UI_v1.0.0.md`.
