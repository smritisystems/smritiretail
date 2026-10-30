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

# Consolidated Walkthroughs

This ledger contains full walkthrough entries for implementation changes.

---

<a id="shell-premium-context-responsive-navigation-workspace-style"></a>
## [2026-10-24] v6.99.1 - Premium Shell Context, Responsive Navigation, and Workspace Style Accessibility

*Area: ui | Version: v6.99.1 | Status: Partially Verified*
*Original File: [SMRITI_Shell_Consistency_and_Accessibility_Walkthrough_v6.99.1.md](./ui/SMRITI_Shell_Consistency_and_Accessibility_Walkthrough_v6.99.1.md)*

---

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
- Keep browser network availability separate from application or session connectivity.

## 6. Design Rationale

The header had competing actions and sample values. Shared context and one workspace style entry point reduce mode differences. Mobile controls keep search and navigation reachable, while Classic overflow now responds to the space beside the brand and account controls. Generic empty states avoid implying a signed-in identity or selected company that the app has not supplied.

## 7. Implementation Summary

Removed the sample operator, company profile, and contact fallbacks, seeded notifications, default READY state, and shift number. Added shared company selection, mobile search and drawer behavior, actual-container Classic overflow, navigation names, and keyboard focus handling in the workspace style dialog. Regular and Classic menus now use the same backend-resolved allowed-module IDs; the status bar reports application connectivity only after an authenticated `/auth/me` request succeeds. Session-only activity is labeled as such, and branch IDs are not presented as branch codes.

## 8. Tests Executed

No automated tests or live browser interaction checks were run. The repository TypeScript linter was run as a static validation step; see Verification Results.

## 9. Verification Results

Partially Verified

- `npm run lint` (`tsc --noEmit`): exited with code 0 and no TypeScript diagnostics.
- `git diff --check`: result recorded in the final verification report.
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


---
<a id="crm-parent-child-customer-creation-link"></a>
## [2026-10-24] v1.0.1 - CRM Parent-Child Customer Creation Link

*Area: crm | Original File: [CRM_Parent_Child_Customer_Creation_Link_Walkthrough_v1.0.1.md](./crm/CRM_Parent_Child_Customer_Creation_Link_Walkthrough_v1.0.1.md)*

# CRM Parent–Child Customer Creation Link Walkthrough v1.0.1

## 1. Purpose
Correct Customer Master so **Add Child Customer** creates a child account linked to its selected parent.

## 2. Scope
The flow passes the parent’s canonical internal customer ID, validates tenant scope, persists a Child relationship, and returns parent identity for the child record, Parent–Child section, and paginated Customer Directory.

## 3. Files Created
- `docs/implementation/crm/CRM_Parent_Child_Customer_Creation_Link_Plan_v1.0.1.md`
- This walkthrough.

## 4. Files Modified
- `CustMasterWs.tsx` captures the selected parent and clears it for ordinary customer creation.
- `CreateCustomerModal.tsx` displays parent context and includes the parent ID in the create request.
- `CrmService.create_customer` validates the parent and writes the customer and relationship atomically.
- CRM schemas and repository load and return parent details and child customer codes.
- Enterprise Customer Master displays returned child codes and avoids a fabricated parent name.
- `types.ts` and the Directory row display carry and show the parent customer identity.
- Regression tests cover child creation and reload, independent creation, edits, invalid tenant references, modal context, and Parent–Child display.

## 5. Architecture Decisions
Use the existing `customer_relationships` table and parent/child internal IDs. No parallel hierarchy model or migration was introduced.

## 6. Design Rationale
The Add Child action already identifies the parent in context. Carrying its persisted ID through the request avoids ambiguity from mutable customer codes or names.

## 7. Implementation Summary
The workspace passes selected parent metadata to the modal. The create endpoint receives `parent_customer_id`; the service checks the same company and branch and active account state. It marks the child as dependent and inserts a `relation="Child"` relationship before a single transaction commit. API response mapping supplies parent ID/name/code and dependant code for reload and navigation. Directory query results now include the child flag and parent identity. Editing a linked child cannot clear its dependent flag; the existing relationship endpoint applies the same role gate and branch-scoped cycle checks.

## 8. Tests Executed
1. `npm test -- src/tests/customerMasterLifecycle.test.tsx src/tests/enterpriseCustomerMasterView.test.tsx` — 35 passed.
2. `npm run lint` — passed (`tsc --noEmit`).
3. `.venv\Scripts\python.exe -m pytest backend/tests/test_customer_lifecycle_e2e.py::test_add_child_customer_persists_parent_and_directory_relationship -q` — 1 passed against the configured isolated test database.
4. `.venv\Scripts\python.exe -m pytest backend/tests/test_customer_master_ux_contract.py backend/tests/test_customer_lifecycle_security.py -q` — 10 passed.

## 9. Verification Results
**Status: Partially Verified.** Focused UI, TypeScript, backend contract/security, and database-backed integration checks passed. The integration test selected the persisted `CustomerRelationship`, reloaded the child response, verified the parent’s child-list response, and checked the paginated Directory parent fields. The test used configured isolated database `smriti_test_phase2c`; the remote production database and existing production accounts were not accessed.

## 10. Known Limitations
Existing standalone accounts created before this fix are not automatically attached to a parent. They require a separate, reviewed data correction. Remote production behavior has not been verified from this workspace.

## 11. Future Work
Consider a one-time audit for child accounts previously created as independent parent accounts; do not change existing production data without a reviewed reconciliation.

## 12. Related ADRs
Existing CRM customer hierarchy architecture; no new ADR.

## 13. Related RFCs
No related RFC identified.
