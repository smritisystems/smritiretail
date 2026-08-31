<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.82.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Real-Time Store Terminal Broadcast Hub & Alerts (v1.0.0-GA)

## 1. Objective
Establish an edge-to-edge WebSocket/Event broadcast hub (`StoreTerminalBroadcastHub.ts`) and live notification banner (`StoreBroadcastNotificationBanner.tsx`) in SMRITI Retail OS, providing sub-second event distribution across all active store terminals for supervisor authorization requests, price updates, stock-out alerts, system lockouts, and emergency announcements.

## 2. Business Motivation
In busy retail environments, cashiers requesting supervisor overrides, emergency inventory changes, or day-end shift closures require instant store-wide signaling without having to walk across the sales floor or make manual phone calls.

## 3. Scope
- Store Terminal Broadcast Hub (`StoreTerminalBroadcastHub.ts`).
- Interactive Live Notification Toast Banner (`StoreBroadcastNotificationBanner.tsx`).
- Event types: `MANAGER_OVERRIDE_REQUEST`, `PRICE_UPDATE_BROADCAST`, `STOCK_OUT_ALERT`, `SYSTEM_LOCKOUT_NOTICE`, `EMERGENCY_ANNOUNCEMENT`.
- Channel targeting: Universal store-wide broadcasts vs terminal-specific targeted messages.
- Resilient local fallback bus for offline / unit test execution.

## 4. Current State
Terminals operated in isolation without real-time peer-to-peer event notification capabilities.

## 5. Gap Analysis
- Needed lightweight edge broadcast engine to notify managers when cashiers trigger overrides.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: Hub connects to canonical WebSocket gateway `/api/v1/ws/store-terminals/{branch_id}/{terminal_id}` on FastAPI backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────┐
│             STORE TERMINAL REAL-TIME BROADCAST BUS                     │
├───────────────────────────────────┬────────────────────────────────────┤
│  POS REGISTER 01 (Cashier)        │  MANAGER CONSOLE (Supervisor)      │
│  - Triggers Override Request      │  - Receives Instant Banner Overlay │
│  - Broadcasts to Branch Bus ────► │  - 1-Click "Review Override" Action│
└───────────────────────────────────┴────────────────────────────────────┘
```

## 8. Files Created
- `src/sync/StoreTerminalBroadcastHub.ts`
- `src/components/global/StoreBroadcastNotificationBanner.tsx`
- `src/tests/storeTerminalBroadcast.test.ts`
- `docs/implementation/pos/Store_Terminal_Realtime_Broadcast_Hub_v1.0.0.md`
- `docs/walkthrough/pos/Store_Terminal_Realtime_Broadcast_Hub_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Flooding terminal screens during high sales velocity.
  *Mitigation:* Non-critical notices automatically auto-dismiss after 8 seconds; only actionable supervisor challenges persist.

## 12. Rollback Strategy
Modular singleton broadcast bus that operates unobtrusively in background.

## 13. Verification Plan
- Unit tests verifying singleton initialization, event subscriptions, broadcast delivery, and targeted terminal message filtering.
- Full Vitest suite pass rate (`384/384 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update SMRITI Store Operations & Terminal Management Manual.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`384/384 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-019`: Offline-First POS Edge Synchronization Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/pos/Store_Terminal_Realtime_Broadcast_Hub_v1.0.0.md`.
