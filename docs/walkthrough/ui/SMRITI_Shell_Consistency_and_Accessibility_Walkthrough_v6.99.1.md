<!--
  Project       : SMRITI Retail OS
  Author        : Jawahar Ramkripal Mallah
  Designation   : Chief Systems Architect & Creator
  Email         : support@smritibooks.com
  Websites      : smritibooks.com | erpnbook.com | aitdl.com
  Version       : 6.99.1
  Created       : 2026-10-24
  Modified      : 2026-10-24
  Copyright     : © SMRITIBooks.com. All Rights Reserved.
  License       : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Shell Consistency and Accessibility Walkthrough

## 1. Purpose

Record the shell changes that remove sample identity values, make company and branch context consistent, improve responsive navigation, and make workspace style selection accessible.

## 2. Scope

The change covers the global header, company selector, contextual rail, Classic menu overflow, mobile drawer, workspace style dialog, notification display, and status bar. Both navigation styles now filter modules using the authenticated `/menus/resolved` response, and the status bar checks `/auth/me` before reporting an application connection.

## 3. Files Created

- This versioned walkthrough.
- `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md`.
- `docs/implementation/ui/SMRITI_Shell_Consistency_and_Accessibility_Plan_v6.99.1.md`.

## 4. Files Modified

- `src/App.tsx`
- `src/components/layout/CompanySelector.tsx`
- `src/components/shell/AppShell.tsx`
- `src/components/shell/EnterpriseMenuBar.tsx`
- `src/components/shell/GlobalHeader.tsx`
- `src/components/shell/NavRail.tsx`
- `src/components/shell/UxSwitcherModal.tsx`
- `src/components/shell/WorkspaceStatusBar.tsx`
- `src/components/shell/navigationResolver.ts`
- `src/components/shell/navigationAccess.ts`
- `src/layout_engine/layout_store.tsx`
- `src/lib/apiFetchV1.ts`
- `src/notifications/notification_store.tsx`
- User, developer, troubleshooting, home, changelog, and documentation index/ledger files listed in the documentation impact report.

## 5. Architecture Decisions

- Keep the shell as the owner of presentation and navigation controls.
- Read user identity from the authenticated app state and use a generic account label when it is unavailable.
- Display notification counts only from notifications added to the active notification provider session.
- Measure the Classic menu container with `ResizeObserver`; use the measured widths of menu items and the More trigger to determine overflow.
- Keep company and branch context visible in both workspace styles and refresh it when the application emits tenant-context events.
- Use the same backend-resolved allowed-module IDs for navigation visibility in both workspace styles.
- Check the authenticated `/auth/me` route for application/session connectivity; keep the indicator's claim limited to that successful request.

## 6. Design Rationale

The header had competing actions and sample values. Shared context and one workspace style entry point reduce mode differences. Mobile controls keep search and navigation reachable, while Classic overflow now responds to the space beside the brand and account controls. Generic empty states avoid implying a signed-in identity or selected company that the app has not supplied.

## 7. Implementation Summary

Removed the sample operator, company profile, and contact fallbacks, seeded notifications, default READY state, and shift number. Added shared company selection, mobile search and drawer behavior, actual-container Classic overflow, navigation names, and keyboard focus handling in the workspace style dialog. Regular and Classic menus now use the same backend-resolved allowed-module IDs; the status bar reports application connectivity only after an authenticated `/auth/me` request succeeds. Session-only activity is labeled as such, and branch IDs are not presented as branch codes.

## 8. Tests Executed

No automated tests or live browser interaction checks were run. The repository TypeScript linter was run as a static validation step; see Verification Results.

## 9. Verification Results

Partially Verified

- `npm run lint` (`tsc --noEmit`): exited with code 0 and no TypeScript diagnostics.
- `git diff --check`: exited with code 0 and no whitespace diagnostics.
- Live responsive and keyboard interaction checks remain unverified in a browser.

## 10. Known Limitations

- Navigation labels and grouping remain separate presentation definitions, but both are filtered by the same backend-resolved permission list.
- Notifications are session-scoped in the current provider. No persistent in-app notification feed endpoint is available to this shell.
- The connection indicator confirms a successful authenticated `/auth/me` request; it does not represent health for every backend service.
- Company and branch labels use the application's persisted tenant context and context events; no new live context service was added.

## 11. Future Work

- Add a persistent notification feed if the backend exposes one for the shell.
- Consolidate the labels and grouping metadata if a single navigation catalog is needed across presentations.
- Perform live keyboard and responsive checks at narrow and wide viewport sizes.

## 12. Related ADRs

No related ADR was identified for this shell update.

## 13. Related RFCs

No related RFC was identified for this shell update.
