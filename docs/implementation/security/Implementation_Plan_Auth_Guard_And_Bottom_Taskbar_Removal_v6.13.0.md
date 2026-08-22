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

# Implementation Plan: Public Data Exposure Hardening, Contextual HUD Auth Guard & Bottom Workspace Taskbar Removal

## 1. Objective
1. **Prevent Unauthenticated Data Exposure & Public Access**: Enforce strict session token guards on `ContextualInspectorHUD`, `GlobalSearch`, `GlobalF2BrowseModal`, and `ActiveFieldContext` so that zero master data, historical invoices, or HUD popups can ever be viewed or triggered without authenticating.
2. **Remove Bottom Workspace Taskbar**: Remove `WorkspaceTaskbar` and its associated viewport padding (`pb-13`) from `App.tsx` to give operators an unobstructed, full-height workspace view.

## 2. Business Motivation
- **Security & Privacy**: When users landed on public views (like the Login page), global input event listeners previously detected focused elements and rendered the `ContextualInspectorHUD` ("Invoice / Document Field"), which permitted launching Global Search (`Ctrl+K`) and inspecting sensitive commercial data without authentication.
- **Clean Operator Canvas**: The bottom floating workspace taskbar added unnecessary clutter and reduced the usable vertical screen estate.

## 3. Scope
- Move all contextual overlays (`ContextRenderer`, `GlobalSearch`, `GlobalF2BrowseModal`, `ContextualInspectorHUD`, `DrillDownSidePanel`, `ShortcutPalette`) from the unauthenticated root level in `<App />` to inside `<AppShell>` within the authenticated `AppContent` session block.
- Add strict token authentication guards inside `ContextualInspectorHUD.tsx`, `GlobalSearch.tsx`, `GlobalF2BrowseModal.tsx`, and `ActiveFieldContext.tsx`.
- Remove `WorkspaceTaskbar` and `pb-13` padding from `src/App.tsx`.
- Validate zero regressions via full test suite and Docker build.

## 4. Current State
- `ContextualInspectorHUD` was mounted at the top-level `App` component outside auth boundaries.
- `WorkspaceTaskbar` was rendered at the bottom of `AppContent`.

## 5. Gap Analysis
- Unauthenticated visitors could trigger `ContextualInspectorHUD` and open `GlobalSearch` or `GlobalF2BrowseModal`.
- Floating bottom taskbar overlapped content and created unnecessary padding.

## 6. Architecture Impact
- **Security Layer**: Zero data leaks or modal popups prior to valid JWT/session authentication.
- **Layout Streamlining**: Direct, edge-to-edge application canvas.

## 7. Proposed Design
- All drilldown and contextual assistant modals are rendered conditionally only after successful login and company context resolution.

## 8. Files Created
None.

## 9. Files Modified
- `src/App.tsx`
- `src/components/drilldown/ContextualInspectorHUD.tsx`
- `src/components/drilldown/GlobalSearch.tsx`
- `src/components/drilldown/GlobalF2BrowseModal.tsx`
- `src/context/ActiveFieldContext.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18, Vite, Vitest.

## 11. Risks
- None. Authenticated users retain full access to F2 Browse, Ctrl+K Global Search, and HUD within their authenticated workspace.

## 12. Rollback Strategy
Git revert if needed.

## 13. Verification Plan
- Run `npx vitest run` (all 37 files pass).
- Run `npm run build` (production bundle clean).
- Check running Docker containers.

## 14. Test Plan
- Verify that unauthenticated focus events do not trigger HUD.
- Verify that Ctrl+K and F2 shortcuts are ignored when not logged in.

## 15. Documentation Impact
- Updated Walkthrough and Implementation Plan indices.

## 16. Deployment Plan
Build Docker image `smriti-web` and deploy.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0016: Strict Authentication Boundaries for Contextual Intelligence and Workspace Cleanup.

## 19. Related Walkthroughs
- `docs/walkthrough/security/Security_Auth_Guard_And_Bottom_Taskbar_Removal_v6.13.0.md`.
