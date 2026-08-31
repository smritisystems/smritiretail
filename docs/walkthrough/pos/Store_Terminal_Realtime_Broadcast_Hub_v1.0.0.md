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

# Walkthrough: SMRITI Real-Time Store Terminal Broadcast Hub & Alerts (v1.0.0-GA)

## 1. Purpose
Documents the implementation and testing of the Store Terminal Real-Time Broadcast Hub and Banner, facilitating edge-to-edge messaging across active store registers, supervisor consoles, and customer desks for operational alerts and override workflows.

## 2. Scope
- Store Terminal Broadcast Hub (`StoreTerminalBroadcastHub.ts`).
- Interactive Live Notification Toast Banner (`StoreBroadcastNotificationBanner.tsx`).
- Event types: `MANAGER_OVERRIDE_REQUEST`, `PRICE_UPDATE_BROADCAST`, `STOCK_OUT_ALERT`, `SYSTEM_LOCKOUT_NOTICE`, `EMERGENCY_ANNOUNCEMENT`.
- Channel targeting: Universal store-wide broadcasts vs terminal-specific targeted messages.
- Resilient local fallback bus for offline / unit test execution.

## 3. Files Created
- `src/sync/StoreTerminalBroadcastHub.ts`
- `src/components/global/StoreBroadcastNotificationBanner.tsx`
- `src/tests/storeTerminalBroadcast.test.ts`
- `docs/implementation/pos/Store_Terminal_Realtime_Broadcast_Hub_v1.0.0.md`
- `docs/walkthrough/pos/Store_Terminal_Realtime_Broadcast_Hub_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Singleton Edge Broadcast Bus:** Maintains unified pub/sub subscription state for all listening UI components.
2. **Targeted vs Branch-Wide Routing:** Allows selective point-to-point dispatch (e.g., Cashier to Manager) or store-wide announcements.
3. **Resilient Local Bus Fallback:** Falls back to internal memory message dispatch during network drops or test runs.

## 6. Design Rationale
Improves store checkout speed by eliminating delays when cashiers need immediate manager authorizations.

## 7. Implementation Summary
- `init`: Configures terminal and branch identity.
- `broadcast`: Dispatches event over WebSocket and local subscriber bus.
- `subscribe`: Registers event listener and returns unsubscription hook.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **Frontend Test Suite:** 53/53 test files passed (384/384 tests green).
- **Production Build:** Vite production bundle built in 28.73s with 0 errors.

## 10. Known Limitations
- Background audio chimes require browser user interaction gesture before playing.

## 11. Future Work
- Bluetooth Beacon peer discovery for zero-config terminal auto-pairing.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-019`: Offline-First POS Edge Synchronization Architecture.

## 13. Related RFCs
- `RFC-085`: Edge-to-Edge Store Terminal Real-Time Broadcast Standard.
