<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders
  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com
  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  Websites     : aitdl.com | erpnbook.com | smritibooks.com
  Version      : 6.45.4
  Created      : 2026-09-26
  Modified     : 2026-09-26
  Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Enterprise 15-Minute Session Inactivity Auto-Logout Subsystem v6.45.4

## 1. Purpose
To protect retail POS terminals, billing workstations, inventory stores, and executive reports from unauthorized access on unattended screens by implementing an authoritative, automated session logout mechanism that terminates user sessions after precisely 15 minutes (900,000 ms) of user inactivity.

## 2. Scope
- User input activity tracking across discrete user interactions (`mousedown`, `keydown`, `touchstart`, `click`) and throttled high-frequency events (`mousemove`, `touchmove`, `scroll`, `wheel`).
- Cross-tab coordination: multi-tab synchronization via `localStorage` events ensuring active cashiers working in Tab A are not abruptly logged out in Tab B.
- Machine sleep/wake & background tab recovery: immediate calculation of elapsed time upon `visibilitychange` or `focus` without waiting for interval ticks.
- Pre-timeout visual warning modal (`InactivityWarningModal.tsx`) with real-time digital countdown (60s -> 0s) and immediate "Stay Logged In" session extension.
- Clean session invalidation (`clearAuthSession("inactivity_timeout")`), backend token revocation dispatch (`POST /api/v1/auth/logout`), state reset, and user-friendly session timeout banner on `LoginScreen.tsx`.

## 3. Files Created
1. `src/hooks/useInactivityTimeout.ts` — Authoritative React Hook & standalone TypeScript `InactivityTimeoutController` for timing, cross-tab sync, and sleep recovery.
2. `src/components/auth/InactivityWarningModal.tsx` — Enterprise modal dialog with digital countdown, visual progress bar, and "Stay Logged In" / "Logout Now" actions.
3. `src/tests/inactivityTimeout.test.ts` — Comprehensive Vitest suite covering 10 distinct timing, event, throttling, cross-tab, sleep/wake, and session purge behaviors.

## 4. Files Modified
1. `src/lib/apiFetchV1.ts` — Registered `smriti_last_activity` in `AUTH_STORAGE_KEYS` to ensure complete session purge on logout.
2. `src/components/LoginScreen.tsx` — Added `sessionNotice` and `onClearSessionNotice` props, Lucide `Clock` icon, and dismissible session termination alert banner.
3. `src/App.tsx` — Integrated `useInactivityTimeout`, wired `handleAutoLogout`, registered `smriti_auth_session_cleared` listener, mounted `InactivityWarningModal`, and passed session notice to `LoginScreen`.
4. `docs/walkthrough/README.md` — Appended walkthrough entry to master index.

## 5. Architecture Decisions
- **Decoupled Controller Architecture:** Separated timing, event listeners, and cross-tab storage logic into `InactivityTimeoutController` (pure TypeScript class) wrapped by the React hook `useInactivityTimeout`. This allows 100% testability in standard Node/Vitest environments without heavy DOM renderer dependencies.
- **Throttled Activity Recording:** High-frequency events (`mousemove`, `scroll`, `wheel`) are throttled to 1,000ms before touching `localStorage` to avoid I/O bottlenecks while maintaining 100% responsiveness for user presence.
- **Cross-Tab Synchronization via Web Storage Events:** Using `localStorage.setItem("smriti_last_activity", String(Date.now()))` and listening to `window.addEventListener("storage", ...)` guarantees that activity in any open store tab instantly resets the timeout in all other tabs.
- **Sleep & Tab Switch Fast-Path:** Listening to `document.addEventListener("visibilitychange")` and `window.addEventListener("focus")` immediately computes `Date.now() - effectiveLastActivity`. If a user locks their screen or closes their laptop for >= 15 minutes, the session is invalidated the instant the lid is opened, preventing stale transactional display.

## 6. Design Rationale
Retail terminals are frequently shared in high-traffic store environments. When operators step away from the cash counter or sales desk, leaving terminals unlocked exposes financial data and allows unauthorized transactions. The 15-minute standard adheres to PCI-DSS and enterprise security baselines, while the 60-second warning countdown ensures active operators sitting near the terminal can extend their session with a single keystroke or click.

## 7. Implementation Summary
- Standard timeout: `DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000` (15 minutes).
- Warning threshold: `DEFAULT_WARNING_DURATION_MS = 60 * 1000` (60 seconds, starting at minute 14).
- Activity triggers: `mousedown`, `keydown`, `touchstart`, `click`, `mousemove` (throttled).
- Warning Modal: Amber/rose security theme, digital monospace clock (`mm:ss`), percentage progress bar, "Stay Logged In" (Primary) and "Logout Now" (Secondary).
- Natural dismiss: Any keystroke or mouse movement during the warning window automatically dismisses the warning and resets the 15-minute countdown.

## 8. Tests Executed
- `npx vitest run src/tests/inactivityTimeout.test.ts` (10/10 passed green)
- `npm test` (155/155 test files passed, 1,091/1,091 tests passed green)
- `npm run lint` (`tsc --noEmit`, exit code 0)

## 9. Verification Results
```text
✓ should have authoritative 15-minute defaults (900,000ms timeout and 60,000ms warning)
✓ should initialize with current timestamp and sync to localStorage on start
✓ should record user activity on discrete events and reset warning state
✓ should throttle high-frequency events (e.g. mousemove) to avoid storage write flooding
✓ should synchronize activity from other open browser tabs via StorageEvent
✓ should trigger warning countdown at 14 minutes of inactivity (60s before 15m timeout)
✓ should reset timer and dismiss warning when resetTimer() is invoked
✓ should automatically terminate session and trigger onTimeout when 15 minutes elapse
✓ should trigger immediate logout upon laptop wake / tab switch if 15 minutes elapsed during sleep
✓ should purge smriti_last_activity when clearAuthSession is called
```

## 10. Known Limitations
- Browsers in ultra-aggressive battery saver mode may throttle background JavaScript execution down to 1-minute intervals. The system mitigates this completely via `visibilitychange` fast-path evaluation on wake.

## 11. Future Work
- Integration with store system parameters table (`P_SESSION_INACTIVITY_TIMEOUT_MINUTES`) for per-tenant customization via the Security Settings workspace.

## 12. Related ADRs
- `ADR-001`: SMRITI Platform Architecture & Communication Layer
- `ADR-005`: Canonical Table & Master Invalidation Architecture

## 13. Related RFCs
- `RFC-2026-AUTH-001`: SMRITI Terminal Security & Session Management Standard
