/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.1
 * Created      : 2026-09-12
 * Modified     : 2026-09-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

# Walkthrough: Vendor 360 Workspace Infinite Loop Prevention & 404 Recovery Hardening

**Document ID:** WT-PROC-VEND-6.16.1  
**Area:** Procurement / Vendor 360 Workspace  
**Status:** Completed  
**Version:** 6.16.1  
**Date:** 2026-09-12  

---

## 1. Purpose
Remediates a critical frontend deadlock and infinite network spamming loop in `VendorMasterWs.tsx`:
- Symptoms: `Warning: Maximum update depth exceeded` and rapid repetitive 404 GET requests to `/api/v1/purchase/vendors/{vendor_id}` (e.g., `pty_7cb0b1e755d8`).
- Root cause: An unmemoized notification callback in `App.tsx` combined with callback dependency tracking in `VendorMasterWs.tsx` created an active effect cascade. When a 404 was encountered, error notification dispatch updated notification state in `App.tsx`, triggering a top-level re-render that passed a newly instantiated callback reference into `VendorMasterWs`, causing the fetch effect to re-run and re-request the 404 ID in a tight loop.

---

## 2. Scope
- Frontend root notification callback memoization in `src/App.tsx`.
- Ref-based notification decoupling, failed vendor ID caching, and directory selection fallback in `src/components/vendor/VendorMasterWs.tsx`.
- Automated test coverage in `src/tests/vendorMasterWsLoopGuard.test.ts`.

---

## 3. Files Created
1. `src/tests/vendorMasterWsLoopGuard.test.ts` — Automated test suite verifying directory fallback resolution, 404 network call suppression, and user interaction re-attempt handling.

---

## 4. Files Modified
1. `src/App.tsx` — Wrapped `addNotification` in `useCallback(..., [])` and imported `useCallback` from React.
2. `src/components/vendor/VendorMasterWs.tsx` — Decoupled notification delivery via `onNotificationRef`, implemented `failedVendorIdsRef`, added automatic directory selection fallback on 404, and decoupled effect dependencies.
3. `docs/walkthrough/README.md` — Appended walkthrough record to master registry.

---

## 5. Architecture Decisions
- **ADR-LOOP-01: Decoupled Callback Execution via Refs:** Workspace lifecycle effects must never depend directly on unmemoized UI notification or toast handlers. Notification handlers must be referenced via mutable ref (`useRef`) to avoid triggering re-fetches upon notification state updates.
- **ADR-LOOP-02: 404 Poison-Pill Suppression Set:** When an entity ID returns 404 Not Found, the ID must be recorded in an in-memory failed set (`failedVendorIdsRef`). Automatic renders or effect evaluations must abort immediately without dispatching duplicate HTTP requests.
- **ADR-LOOP-03: Directory Selection Automatic Fallback:** If `selectedVendorId` is invalid, deleted, or missing from the directory, the component must automatically fall back to the first available directory entry rather than remaining pinned to an invalid ID.

---

## 6. Design Rationale
In high-throughput retail terminals, stale or ephemeral entity IDs can remain in client state (e.g., deleted during background compaction or testing). Under React 18 concurrent rendering, any `setState` inside an effect that updates parent state can create a render cascade if callbacks are recreated on render. The ref pattern and 404 poison-pill set completely eliminate the possibility of infinite loops while maintaining 100% notification fidelity for legitimate error reporting.

---

## 7. Implementation Summary
1. **Root `addNotification` Memoization:**
   ```typescript
   const addNotification = useCallback((title: string, message: string, type: ...) => {
     // Functional state update ensures zero outer scope dependencies
     setNotifications((prev) => [...prev, { id, title, message, type }]);
     ...
   }, []);
   ```
2. **`VendorMasterWs` Ref Shield & Guard:**
   ```typescript
   const onNotificationRef = useRef(onNotification);
   useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);

   const failedVendorIdsRef = useRef<Set<string>>(new Set());

   // Auto-fallback in loadVendors
   setSelectedVendorId((currentId) => {
     if (list.length === 0) return null;
     if (!currentId || !list.some((v) => v.id === currentId)) {
       return list[0].id;
     }
     return currentId;
   });
   ```

---

## 8. Tests Executed
1. `npx vitest run src/tests/vendorMasterWsLoopGuard.test.ts` (3/3 tests passed).
2. `npm test` (115/115 test files, 724/724 tests passed).
3. `npm run lint` (`tsc --noEmit` clean, 0 errors).
4. `npm run build` (Production Vite bundle compiled clean in 37.65s).
5. `pytest tests/test_vendor_service.py tests/test_vendor_code_governance_e2e.py` (7/7 passed).

---

## 9. Verification Results
- All tests green.
- Zero infinite re-render warnings (`Maximum update depth exceeded` eliminated).
- Stale 404 vendor IDs automatically suppressed and redirected to valid directory vendors.

---

## 10. Known Limitations
- If all vendors in the directory fail (e.g. backend completely down), `selectedVendorId` is set to `null` and directory shows standard empty state; user can refresh when service recovers.

---

## 11. Future Work
- Audit other primary workspaces (`CustMasterWs.tsx`, `StaffMasterWs.tsx`) to ensure uniform adoption of the `onNotificationRef` shield.

---

## 12. Related ADRs
- ADR-VEND-01: Canonical Vendor 360 & Universal Party Master
- ADR-LOOP-01: Decoupled Callback Execution via Refs

---

## 13. Related RFCs
- RFC-UI-STABILITY-01: Terminal Workspace Render Isolation & Guard Standards
