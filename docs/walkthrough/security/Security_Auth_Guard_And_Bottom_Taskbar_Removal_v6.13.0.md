<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.13.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Public Data Exposure Hardening, Contextual HUD Auth Guard & Bottom Taskbar Removal

## 1. Purpose
Address security vulnerabilities where unauthenticated users could trigger the Contextual Inspector HUD (`ContextualInspectorHUD`) or Global Search (`Ctrl+K` / `GlobalSearch`) and view commercial data without logging in. Additionally, remove the bottom floating workspace taskbar (`WorkspaceTaskbar`) for an unobstructed view.

## 2. Scope
- Move `ContextRenderer`, `GlobalSearch`, `GlobalF2BrowseModal`, `ContextualInspectorHUD`, `DrillDownSidePanel`, and `ShortcutPalette` inside `<AppShell>` inside the authenticated `AppContent` session block.
- Add direct authentication token checks (`smriti_jwt_token` / `smriti_session_token`) across:
  - `ContextualInspectorHUD.tsx` (returns `null` if unauthenticated)
  - `GlobalSearch.tsx` (blocks search trigger, prewarm, and modal display without auth)
  - `GlobalF2BrowseModal.tsx` (blocks load and display without auth)
  - `ActiveFieldContext.tsx` (ignores focusin, input, and F2 events when unauthenticated)
- Remove `WorkspaceTaskbar` and `pb-13` viewport bottom padding from `src/App.tsx`.

## 3. Files Created
None.

## 4. Files Modified
- `src/App.tsx`: Moved overlays into authenticated block; removed `WorkspaceTaskbar` and `pb-13`.
- `src/components/drilldown/ContextualInspectorHUD.tsx`: Added token verification guard.
- `src/components/drilldown/GlobalSearch.tsx`: Added token verification guard to keydown and render logic.
- `src/components/drilldown/GlobalF2BrowseModal.tsx`: Added token verification guard.
- `src/context/ActiveFieldContext.tsx`: Added token verification to event listeners.
- `docs/implementation/README.md`: Registered plan in master index table.
- `docs/walkthrough/README.md`: Registered walkthrough in master index table.
- `CHANGELOG.md`: Logged release notes for version `6.13.0`.

## 5. Files Deleted
None.

## 6. Architecture Decisions
- **Strict Zero-Trust Presentation Layer**: Any assistant or contextual inspector must enforce authentication boundaries before listening to DOM events or rendering in the viewport.
- **Edge-to-Edge Workspace**: Removing the bottom taskbar maximizes screen real estate for high-density POS and ERP operations.

## 7. Implementation Summary
1. Refactored `App.tsx` so that all drill-down modals, HUD assistants, and context actions are rendered exclusively within the authenticated session boundary.
2. Injected token checks into `ContextualInspectorHUD`, `GlobalSearch`, `GlobalF2BrowseModal`, and `ActiveFieldContext`.
3. Removed `WorkspaceTaskbar` and its bottom padding.
4. Executed full test suite (37 test files, 277 tests passed) and built production bundle.
5. Rebuilt Docker container `smriti-web` and verified health.

## 8. Tests Executed
- Vitest suite: `npx vitest run` (37 files, 277 tests passed).
- Frontend production bundle: `npm run build` (built in 24.81s with 0 errors).

## 9. Verification Results
- Unauthenticated users and visitors on the Login screen see zero HUD popups, zero search overlays, and zero data.
- The bottom workspace dock is completely removed.
- Full functionality remains active and intact for logged-in operators.

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
- ADR-0016: Strict Authentication Boundaries for Contextual Intelligence and Workspace Cleanup.

## 13. Related RFCs
- RFC-2026-08-03: Elimination of Unauthenticated UI Overlays.
