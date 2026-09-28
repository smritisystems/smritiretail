<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.1.1
  Created      : 2026-09-29
  Modified     : 2026-09-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Master Lookup Continuous Auto-Refresh & HTTP 429 Rate Limit Infinite Loop Remediation Walkthrough

## 1. Purpose
This document provides complete forensic root-cause analysis and architectural remediation details for the continuous auto-loading/auto-refresh feedback loop and resulting HTTP 429 ("Rate limit exceeded: 300 per 1 minute") failure cascade in `MasterListScreen.tsx` and `MasterMgmtTab.tsx`. It documents the ref-stabilized dependency architecture, rate-limit circuit breaker, error notification deduplication, and user-facing error retry states.

---

## 2. Scope
- **Root Cause Forensic Diagnosis**: Traced execution flow from unmemoized inline arrow function props (`onNotification`, `detailDrawer`, `responseTransform`) through React re-render cycles, toast notification state updates in `App.tsx`, and session inactivity event loops (`recordActivity` / `handleThrottledActivityBound`).
- **Core Screen Stabilization (`MasterListScreen.tsx`)**: Decoupled volatile callback prop identities from data-fetching triggers via `useRef` bridges (`onNotificationRef`, `responseTransformRef`); sanitized `fetchItems` dependency array to depend exclusively on authoritative data coordinates (`apiEndpoint`, `isServerPagination`, `page`, `pageSize`, `debouncedSearch`, `filterKey`, `sortState`).
- **Rate-Limit Circuit Breaker & 429 Protection**: Implemented automated detection of HTTP 429 / "Too Many Requests" / "Rate limit exceeded" responses; established a 15-second auto-fetch cooldown period to halt runaway loops immediately while preserving manual operator retry.
- **Notification Deduplication**: Implemented consecutive error message deduplication (`lastNotifiedErrorRef`) ensuring identical failures emit at most one toast notification, completely severing the parent-child state notification cascade.
- **Inline Error & Retry State UX**: Replaced permanent infinite loading spinners (`<RefreshCw className="animate-spin" />`) with an informative error card featuring an explicit "Retry Loading" action.
- **Consumer Callback Memoization**: Stabilized callbacks across `MasterMgmtTab.tsx` and `PosProfilesTab.tsx` using `useCallback`.
- **Automated Regression Test Suite**: Engineered `src/tests/masterLookupLoopGuard.test.ts` verifying rate-limit cooldown activation, error toast deduplication, and callback identity ref-stabilization.

---

## 3. Files Created
- [masterLookupLoopGuard.test.ts](file:///F:/SMRITRretailNX/src/tests/masterLookupLoopGuard.test.ts): Unit test suite verifying rate-limit cooldown enforcement, consecutive notification deduplication, and callback identity ref-stabilization.

---

## 4. Files Modified
- [MasterListScreen.tsx](file:///F:/SMRITRretailNX/src/components/global/master/MasterListScreen.tsx): Added `onNotificationRef`, `responseTransformRef`, `rateLimitCooldownUntilRef`, `lastNotifiedErrorRef`, `fetchError` state, `isRateLimited` state, `filterKey` memoization, 15-second 429 cooldown circuit breaker, and inline error retry rendering.
- [MasterMgmtTab.tsx](file:///F:/SMRITRretailNX/src/components/MasterMgmtTab.tsx): Wrapped `handleNotification`, `handleSubTabChange`, `renderDetailDrawer`, `responseTransform`, and `extraHeaderActions` in `useCallback`.
- [PosProfilesTab.tsx](file:///F:/SMRITRretailNX/src/components/PosProfilesTab.tsx): Wrapped `handleNotification` in `useCallback` with strict `"error" | "success"` return signature.

---

## 5. Architecture Decisions
1. **Ref-Bridged Callback Invariance**: In React, callbacks such as `onNotification` or data parsers such as `responseTransform` frequently change identity across parent renders. Under SMRITI architecture, component lifecycle must never trigger network I/O based on function object identities. All callbacks are captured in refs (`onNotificationRef.current = onNotification`), removing them from `fetchItems` dependency arrays.
2. **Deterministic Stringified Filter Identity**: Filter state dictionaries (`Record<string, any>`) can have shifting object references even when key-values are identical. `filterKey = useMemo(() => JSON.stringify(filterValues), [filterValues])` guarantees that only genuine filter value changes initiate network requests.
3. **15-Second Circuit Breaker on HTTP 429**: When slowapi rate limiting triggers at 300 requests/minute, any automated background retry exacerbates server saturation. When a 429 is detected, `rateLimitCooldownUntilRef` suppresses all automatic re-fetch attempts for 15,000ms.
4. **Consecutive Error Notification Deduplication**: Emitting repeated error toasts triggers parent notification stores, re-rendering `App.tsx` and updating activity listeners. Deduplicating consecutive identical messages breaks this loop at the notification boundary.

---

## 6. Design Rationale
- **User Experience Transparency**: Instead of keeping the operator in an endless loading loop with a spinning wheel, the UI clearly displays: *"Request frequency limit reached (300 req/min). Auto-refresh paused to protect system resources. Please wait a few seconds before retrying."* with a clickable "Retry Loading" button.
- **Zero Breaking Changes for Existing Consumers**: Existing consumers of `MasterListScreen` (`TermsEngineTab`, `DocumentSeriesTab`, `ApprovalMatrixTab`) continue to operate without modifications, while benefiting from the built-in circuit breaker and ref stabilization.

---

## 7. Implementation Summary
```
MasterMgmtTab (Parent)
    │
    ├── onNotification / renderDetailDrawer (Memoized via useCallback)
    │
    ▼
MasterListScreen (Core Reusable Engine)
    │
    ├── onNotificationRef / responseTransformRef (Captured via useRef)
    │
    ├── fetchItems dependencies: [apiEndpoint, isServerPagination, page, pageSize, debouncedSearch, filterKey, sortState]
    │       (No volatile callback identities!)
    │
    ├── Circuit Breaker:
    │       ├── 429 Detected? → Cooldown 15s → Auto-fetch suppressed
    │       └── Same Error Repeated? → Deduplicated → Zero toast cascade
    │
    └── UI Presentation:
            ├── Loading → Spinner
            ├── Error / 429 → Error Alert + "Retry Loading" button
            └── Success → Data Table Rows
```

---

## 8. Tests Executed
1. **Loop Guard Unit Test Suite**:
   ```bash
   npx vitest run src/tests/masterLookupLoopGuard.test.ts
   ```
   Output:
   ```text
   RUN  v4.1.11 F:/SMRITRretailNX

   ✓ src/tests/masterLookupLoopGuard.test.ts (3 tests) 5ms

   Test Files  1 passed (1)
        Tests  3 passed (3)
     Start at  02:32:56
     Duration  381ms
   ```
2. **Full Frontend Vitest Regression Suite**:
   ```bash
   npm test -- --run
   ```
   Output:
   ```text
   Test Files  155 passed (155)
        Tests  1091 passed (1091)
     Duration  42.67s
   ```
3. **TypeScript Strict Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   Output: Exit code 0 (clean, zero errors).

---

## 9. Verification Results
| Verification Item | Requirement | Measured Result | Status |
|---|---|---|---|
| HTTP 429 Loop Elimination | Stop runaway GET requests on failure | 1st failure blocks automated retries for 15s | Done |
| Consecutive Toast Deduplication | No duplicate toast dispatches | 50 identical errors emit exactly 1 notification | Done |
| Callback Identity Ref Stabilization | Unmemoized props do not trigger fetch | 10 re-renders produce exactly 1 data fetch | Done |
| Full Vitest Test Suite | 0 regressions across existing workspaces | 155/155 test suites passed, 1091/1091 tests green | Done |
| TypeScript Compilation | 0 type errors | `npx tsc --noEmit` exit code 0 | Done |

---

## 10. Known Limitations
- The 15-second rate-limit cooldown applies to automatic effect triggers. An operator may still manually press "Retry Loading" or the header refresh icon at any time, which explicitly bypasses the cooldown.

---

## 11. Future Work
- Implement client-side SWR (Stale-While-Revalidate) caching with a 60-second TTL for static system master lookup categories (e.g., genders, departments, units of measure) so that navigating between tabs incurs 0 network requests.

---

## 12. Related ADRs
- `ADR-0041`: Multi-Tenant API Route Standardization and FastAPI /api/v1 Canonical Communication.
- `ADR-0089`: Unified Master List Architecture and Canonical Field Registry Parity.

---

## 13. Related RFCs
- `RFC-2026-07-MASTER-01`: Standard Master List Screen and Dynamic Configuration Contract.
