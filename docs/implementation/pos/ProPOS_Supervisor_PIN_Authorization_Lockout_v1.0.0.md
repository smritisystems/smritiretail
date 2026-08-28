<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.79.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: ProPOS Real-Time Supervisor PIN Authorization & Lockout Control (v1.0.0-GA)

## 1. Objective
Establish a secure, on-screen supervisor PIN authorization and lockout control modal (`ProPosSupervisorAuthModal.tsx`) in ProPOS Studio, enforcing cryptographic manager sign-offs on negative drawer pulls, day-end shift resets, excess cash variances, line item price overrides, and high-value returns.

## 2. Business Motivation
Retail checkout cashiers cannot be allowed to withdraw cash from the till, force-reset shifts with unexplained discrepancies, or override item prices without explicit on-duty manager authorization. Enforcing a secure supervisor PIN challenge guarantees cash drawer integrity and prevents unauthorized loss.

## 3. Scope
- Supervisor PIN Authorization Modal (`ProPosSupervisorAuthModal.tsx`).
- Action types: `NEGATIVE_CASH_DRAWER`, `FORCED_SHIFT_RESET`, `PRICE_OVERRIDE`, `EXCESS_VARIANCE_EOD`, `HIGH_VALUE_RETURN`.
- Trigger context banner (Action type, variance/amount, audit description).
- Numeric virtual keypad (0-9, Clear, Backspace) + physical keyboard input.
- Supervisor credential verification against `/api/v1/auth/verify-supervisor-pin`.
- Audit trail token packaging (`SupervisorAuthResult`).

## 4. Current State
Cash drawer operations and shift closing modals were active, but lacked an integrated supervisor PIN challenge for high-risk exceptions.

## 5. Gap Analysis
- Needed dedicated visual PIN prompt for supervisor overrides on POS checkout exceptions.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: UI calls `apiFetchV1` (`/api/v1/auth/verify-supervisor-pin`) against the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────┐
│             PROPOS SUPERVISOR PIN AUTHORIZATION CHALLENGE              │
├────────────────────────────────────────────────────────────────────────┤
│  1. Exception Detected (e.g. Negative Drawer Cash Pull / High Variance)│
│  2. Supervisor PIN Modal Pops Up with Trigger Context & Amount         │
│  3. Supervisor Inputs Username + 4-6 Digit Secure PIN via Keypad       │
│  4. Backend Verifies Hash & Returns Cryptographic Audit Token          │
└────────────────────────────────────────────────────────────────────────┘
```

## 8. Files Created
- `src/components/billing/propos/ProPosSupervisorAuthModal.tsx`
- `src/tests/proposSupervisorAuth.test.ts`
- `docs/implementation/pos/ProPOS_Supervisor_PIN_Authorization_Lockout_v1.0.0.md`
- `docs/walkthrough/pos/ProPOS_Supervisor_PIN_Authorization_Lockout_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Cashier shoulder-surfing supervisor PIN.
  *Mitigation:* Masked password input and immediate supervisor session token expiration.

## 12. Rollback Strategy
Modular UI component that can be toggled without breaking basic billing.

## 13. Verification Plan
- Unit tests verifying component exports, data models, PIN verification POST, and failure handling.
- Full Vitest suite pass rate (`372/372 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update ProPOS Cashier & Supervisor Security Manual.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`372/372 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-019`: Offline-First POS Edge Synchronization Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/pos/ProPOS_Supervisor_PIN_Authorization_Lockout_v1.0.0.md`.
