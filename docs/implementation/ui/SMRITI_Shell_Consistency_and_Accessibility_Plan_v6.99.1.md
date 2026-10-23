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

# SMRITI Shell Consistency and Accessibility Implementation Plan

### 1. Objective

Make the shared shell calmer and more predictable across Regular and Classic workspace styles while removing sample values and improving responsive and keyboard behavior.

### 2. Business Motivation

The shell showed duplicate style controls, sample notifications and shift details, inconsistent company context, and header actions that disappeared or competed for space on narrow screens. These behaviors can obscure active context and reduce trust in the displayed information.

### 3. Scope

Update the global header, tenant selector, contextual rail, Classic menu, mobile navigation, style chooser, notifications, and status bar. Preserve the existing module routing and backend contracts.

### 4. Current State

The shell separates global and contextual navigation, but Classic and Regular navigation definitions are separate. The header had fabricated identity and notification fallbacks, company selection differed by style, and Classic menu visibility used viewport assumptions.

### 5. Gap Analysis

- Sample identity, shift, notification, and context values need to be removed or backed by real session data.
- Company and branch context needs consistent availability across styles.
- Small screens need a search affordance and a mobile navigation drawer.
- Classic menu overflow needs to use the available header container width.
- Workspace style selection needs keyboard focus management and a truthful state-preservation claim.
- Browser network state must not be described as application connectivity.

### 6. Architecture Impact

Changes are limited to React shell components and the in-memory notification context. No API, database schema, authentication flow, or routing contract is changed. `AppShell` owns viewport and drawer state; `GlobalHeader` owns shared actions; `EnterpriseMenuBar` measures its own available width.

### 7. Proposed Design

Use one workspace style dialog entry point, keep company and branch selection in both styles, show notifications only from provider state, remove fabricated identity and status fallbacks, use a measured Classic overflow menu, and expose mobile search plus a drawer. Keep the selected module in the existing app tree while changing presentation style.

### 8. Files Created

- `docs/implementation/ui/SMRITI_Shell_Consistency_and_Accessibility_Plan_v6.99.1.md`
- `docs/walkthrough/ui/SMRITI_Shell_Consistency_and_Accessibility_Walkthrough_v6.99.1.md`
- `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md`

### 9. Files Modified

- `src/App.tsx`
- `src/components/layout/CompanySelector.tsx`
- `src/components/shell/AppShell.tsx`
- `src/components/shell/EnterpriseMenuBar.tsx`
- `src/components/shell/GlobalHeader.tsx`
- `src/components/shell/NavRail.tsx`
- `src/components/shell/UxSwitcherModal.tsx`
- `src/components/shell/WorkspaceStatusBar.tsx`
- `src/components/shell/navigationResolver.ts`
- `src/notifications/notification_store.tsx`
- `CHANGELOG.md`
- `docs/HOME.md`
- `docs/user_guide/USER_GUIDE.md`
- `docs/developer_guide/DEVELOPER_GUIDE.md`
- `docs/troubleshooting/TROUBLESHOOTING.md`
- Walkthrough and implementation indexes and consolidated ledgers.

### 10. Dependencies

No package or service dependency is added. The responsive Classic menu uses the browser `ResizeObserver` API with a window-resize fallback.

### 11. Risks

- The Classic and contextual menus remain separate and are not proven permission-equivalent.
- Notification state remains in-memory and session-scoped.
- `navigator.onLine` does not prove that the application or user session is available.
- Browser interaction behavior has not been exercised in this environment.

### 12. Rollback Strategy

Revert the listed source changes and corresponding documentation changes in one reviewed change. No database migration or server-side rollback is required.

### 13. Verification Plan

Run the repository TypeScript linter. Then review the shell in both styles, check keyboard focus and Escape dismissal, and inspect narrow, medium, and wide viewport behavior in a browser.

### 14. Test Plan

No automated tests were requested or run for this task. If testing is later requested, cover company selector availability in both styles, empty notification state, Classic overflow measurement, mobile search and drawer, and style-dialog focus behavior.

### 15. Documentation Impact

The repository's `docs/documentation_registry.yml` is absent. Based on the repository governance rules, update the user guide, developer guide, troubleshooting guide, knowledge-base home, changelog, implementation index/ledger, and walkthrough index/ledger.

### 16. Deployment Plan

No deployment is performed. Apply through the normal reviewed repository workflow after code and documentation review.

### 17. Status

Partially Verified

The implementation is applied and TypeScript lint passed with exit code 0. Browser interaction and automated test results remain unverified.

### 18. Related ADRs

No related ADR was identified for this shell update.

### 19. Related Walkthroughs

- [SMRITI Shell Consistency and Accessibility Walkthrough](../../walkthrough/ui/SMRITI_Shell_Consistency_and_Accessibility_Walkthrough_v6.99.1.md)
