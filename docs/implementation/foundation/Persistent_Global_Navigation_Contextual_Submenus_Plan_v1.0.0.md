<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.13
  Created      : 2026-10-25
  Modified     : 2026-10-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Persistent Global Navigation with Contextual Submenus Plan

**Plan Version:** v1.0.0  
**Target Release:** v6.99.13  
**Status:** Approved  
**Lifecycle Status:** In Progress  

---

## 1. Objective
Refactor the SMRITI Smart Navigation architecture so opening an active document or transaction (e.g., Sales Invoice `INV-00125`, Purchase Order, or GRN) preserves the global navigation sidebar while nesting context-specific document actions as dedicated submenus under the active workspace, keeping all other authorized main menus accessible.

## 2. Business Motivation
In high-velocity retail operations, operators frequently need to reference customer profiles, inventory stock ledgers, or purchase orders while drafting or inspecting an invoice. The previous behavior, which replaced the entire sidebar with document actions upon opening a transaction, created friction and disoriented users by hiding other authorized modules. Preserving global navigation alongside structured contextual submenus improves productivity and aligns with desktop ERP usability standards.

## 3. Scope
- Update `src/components/shell/navigationResolver.ts` to separate global categories from contextual document submenus.
- Update `src/layout_engine/NavRenderer.tsx` to render nested contextual submenus under active workspaces and preserve other expanded/collapsed categories.
- Update `src/layout_engine/layout_store.tsx` to maintain active document context and contextual submenu actions safely.
- Update `src/components/shell/NavRail.tsx` to support nested contextual actions and preserve access to global contexts.
- Update `backend/app/api/v1/menus.py` to provide `/menus/contextual` evaluation endpoint for fine-grained action permission and lifecycle verification.
- Update `backend/app/core/security_matrix.py` to ensure action permissions for contextual operations are recognized.
- Add comprehensive frontend Vitest and backend Pytest test suites covering persistence, nesting, RBAC filtering, and lifecycle transitions.

## 4. Current State
- `navigationResolver.ts` returns an `items` array that, when `query.documentId` is provided, completely discards all workspace and module links, replacing them with a flat list of 7 document actions (`doc-overview`, `doc-items`, `doc-stock`, `doc-verify`, `doc-dispatch`, `doc-print`, `doc-activity`) and `LAUNCHPAD_ITEM`.
- `NavRail.tsx` renders this flat list with no representation of other global modules or categories.
- `NavRenderer.tsx` only renders top-level workspace categories and has no awareness of active document submenus.
- `layout_store.tsx` has no formal representation of an active document context or active contextual submenu.

## 5. Gap Analysis
1. **Global Menu Destruction on Transaction Open:** Global navigation is obliterated when a document is opened.
2. **Missing Submenu Hierarchy:** Submenus are not nested beneath their parent workspace.
3. **No Dynamic Action Lifecycle Verification:** Contextual action permissions are not verified via backend RBAC.
4. **Context Switching Vulnerability:** Navigating between sidebar groups could inadvertently drop or desynchronize active document draft states.

## 6. Architecture Impact
The navigation model is cleanly decoupled into 4 orthogonal concerns:
1. **Global Navigation:** Authoritative list of authorized modules across Dashboard, Sales, Purchase, Inventory, Masters, Reports, and System.
2. **Contextual Submenu:** Action hierarchy specific to the active document or workspace (Overview, Items & Totals, Stock Impact, Verification & Audit, Prepare Dispatch).
3. **Active Selection:** The currently selected workspace and active contextual submenu action.
4. **Lifecycle State:** Document lifecycle status (`DRAFT`, `SUBMITTED`, `POSTED`, `FINALIZED`, `DISPATCHED`, `CANCELLED`) determining action availability and disablement reasons.

## 7. Proposed Design
1. **Navigation Resolver Enhancement:**
   - `NavigationQuery` accepts `documentId`, `documentType`, `transactionState`, `activeActionId`.
   - `ResolvedNavigation` exposes `globalCategories`, `items` (with nested `submenus`), and `contextualSubmenu`.
   - Opening a document enriches the active workspace item with nested `submenus` instead of wiping out the entire array.
2. **NavRenderer Contextual Integration:**
   - Under the active workspace item, if `activeDocument` exists, render the indented contextual actions with state indicators.
   - Expanding other accordion categories does not change the active document context.
3. **Layout Store State Extension:**
   - Add `activeDocument: ActiveDocumentContext | null` and `setActiveDocument` to `LayoutStoreContextType`.
   - Add `activeSubmenuId: string | null` and `setActiveSubmenuId`.
4. **Backend RBAC & Lifecycle Endpoint:**
   - Add `GET /api/v1/menus/contextual` in `backend/app/api/v1/menus.py` to evaluate `evaluate_action_permission` for each contextual action.

## 8. Files Created
- `docs/implementation/foundation/Persistent_Global_Navigation_Contextual_Submenus_Plan_v1.0.0.md`
- `src/tests/persistentGlobalNavigationContextualSubmenus.test.ts`
- `docs/walkthrough/foundation/Persistent_Global_Navigation_Contextual_Submenus_Walkthrough_v6.99.13.md`

## 9. Files Modified
- `src/components/shell/navigationResolver.ts`
- `src/components/shell/NavRail.tsx`
- `src/layout_engine/NavRenderer.tsx`
- `src/layout_engine/layout_store.tsx`
- `backend/app/api/v1/menus.py`
- `backend/app/core/security_matrix.py`
- `backend/tests/t_menu_registry.py`

## 10. Dependencies
- FastAPI `evaluate_action_permission` and `TenantContext`
- React Context & Lucide icons / Material Symbols

## 11. Risks
- Risk: Breaking existing tests expecting legacy flat `nav.items` when `documentId` was passed.
  - Mitigation: Ensure `nav.items` continues to include standard navigation, and expose `nav.contextualSubmenu` explicitly while nesting under active workspace.
- Risk: Over-nesting on compact screens or mobile viewports.
  - Mitigation: In compact mode, submenus display as a popover/flyout or expand smoothly within the mobile drawer.

## 12. Rollback Strategy
Git revert of modified files restoring previous `navigationResolver.ts` flat document replacement behavior.

## 13. Verification Plan
- Unit tests asserting `resolveNavigation` with `documentId` retains global categories.
- Lifecycle state tests verifying `DRAFT` disables dispatch and `POSTED` disables verify.
- RBAC permission tests verifying unauthorized actions are omitted.
- Visual inspection of `NavRenderer` and `NavRail` across Regular and Classic modes.

## 14. Test Plan
- Run `npx vitest run src/tests/persistentGlobalNavigationContextualSubmenus.test.ts`
- Run `npx vitest run src/tests/canonicalBillingConsolidation.test.ts src/tests/fioriLaunchpad.test.ts src/tests/procurementAndReportsAudit.test.ts`
- Run `.venv\Scripts\pytest backend\tests\t_sec_menu.py backend\tests\t_menu_gov.py backend\tests\t_menu_registry.py`

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create walkthrough in `docs/walkthrough/foundation/`.
- Update `docs/walkthrough/README.md` master index.

## 16. Deployment Plan
Standard CI/CD build via Vite and FastAPI migration verification.

## 17. Status
In Progress

## 18. Related ADRs
- `ADR-NAV-001`: Authoritative Single-Door Control Plane Menu Architecture
- `ADR-RP-002`: 3-State Panel Architecture & Focus Mode

## 19. Related Walkthroughs
- `Classic_UX_Header_Submenu_Remediation_Walkthrough_v6.99.12.md`
- `Classic_UX_Workspace_Directory_v6.99.11.md`
