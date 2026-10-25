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

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Author     : Jawahar Ramkripal Mallah
  * Designation: Chief Systems Architect & Creator
  * Email      : support@smritibooks.com
  * Version    : 6.99.13
  * Created    : 2026-10-25
  * Modified   : 2026-10-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
  * License    : Proprietary Commercial Software
  * Classification: Technical Walkthrough & Architecture Record
-->

# Walkthrough: Persistent Global Navigation with Contextual Submenus

**Walkthrough ID:** `WGP-FOUNDATION-NAV-6.99.13`  
**Area:** Foundation & Navigation Architecture  
**Release Target:** v6.99.13  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose
The purpose of this engineering implementation was to refactor the navigation model of SMRITI Retail OS so that opening a transaction or document (such as a Sales Invoice, Credit Bill, or Purchase Order) **never** replaces, hides, or destroys the persistent global application navigation.

Previously, when a user opened an invoice (e.g. `INV-2026-00125`), the smart navigation resolver discarded all global categories and workspaces, replacing the entire sidebar rail with only 7 transaction actions. This forced users to exit their active transaction or click back to Launchpad just to inspect inventory, run reports, or switch workspaces.

This implementation decouples the persistent global navigation from document-specific contextual submenus. Contextual actions are nested under their active workspace/module, lifecycle-driven actions are enabled/disabled according to transaction state, backend RBAC is strictly enforced across tenants, and navigation remains stable across Regular UX, Classic UX, and touch/compact layouts.

---

## 2. Scope
The scope of this implementation encompasses:
- Decoupling global module navigation (`globalCategories`) from active transaction action sets (`contextualSubmenu`).
- Nesting contextual document actions (`doc-overview`, `doc-items`, `doc-stock`, `doc-verify`, `doc-dispatch`, `doc-print`, `doc-activity`) directly under the active workspace in both `NavRail.tsx` and `NavRenderer.tsx`.
- Dynamic lifecycle state filtering:
  - In `DRAFT`: `doc-dispatch` disabled ("Dispatch unavailable. Missing verified invoice & E-Way Bill").
  - In `POSTED`: `doc-verify` disabled ("Already posted to General Ledger").
  - `doc-items` and `doc-verify` prioritized via `isNextBestAction` indicators.
- Backend RBAC enforcement:
  - Cashier roles excluded from `doc-dispatch` (`DISPATCH` action on `b2b_dispatch`).
  - Cashier default permissions explicitly granting `PRINT` on `sales_billing` and `print_studio`.
  - Authoritative `GET /api/v1/menus/contextual` endpoint checking permissions against `security_matrix.py`.
- Presentation parity:
  - Regular UX left/right dock sidebars.
  - Classic UX horizontal ribbon and tree navigation directory.
  - Top dock horizontal dropdown menu and mobile bottom dock.
- State preservation: Expanding/collapsing other modules or workspaces does not clear active document draft context.

---

## 3. Files Created
1. `src/tests/persistentGlobalNavigationContextualSubmenus.test.tsx`:
   - 10-test unit and integration test suite verifying persistent global navigation, nested submenus, lifecycle enablement/disablement, RBAC role filtering, layout store state, and custom event contracts.
2. `docs/implementation/foundation/Persistent_Global_Navigation_Contextual_Submenus_Plan_v1.0.0.md`:
   - 19-section formal Implementation Plan per SMRITI Implementation Plan Governance Policy (IPGP).

---

## 4. Files Modified
1. `src/components/shell/navigationResolver.ts`:
   - Decoupled `globalCategories` and `contextualSubmenu` in `resolveNavigation`.
   - Enhanced `buildDocumentContextualSubmenu` to nest actions beneath parent workspace (`submenus`).
   - Added `isActionPermittedForRole` helper and case-insensitive role normalization.
   - Filtered unauthorized categories (e.g. `system`) for Cashier roles.
2. `src/components/shell/NavRail.tsx`:
   - Added nested rendering of `item.submenus` with document badge and lifecycle indicators.
   - Added "Other Global Modules" accordion section keeping all authorized main-menu categories available.
   - Dispatched `smriti_contextual_action_selected` custom events on action click.
3. `src/layout_engine/layout_store.tsx`:
   - Added `activeDocument: ActiveDocumentContext | null` and `activeSubmenuId: string | null` to state.
   - Exposed `setActiveDocument`, `setActiveSubmenuId`, and `getContextualSubmenu(workspaceId)`.
4. `src/layout_engine/NavRenderer.tsx`:
   - Destructured `activeDocument`, `activeSubmenuId`, `getContextualSubmenu`, and `setActiveSubmenuId`.
   - Rendered nested contextual submenu under active workspace in left/right sidebar navigation.
   - Added active document contextual action strip in top dock navigation.
5. `backend/app/schemas/menu.py`:
   - Added `ContextualActionResponse` Pydantic schema for contextual actions.
6. `backend/app/core/security_matrix.py`:
   - Granted `PRINT` action on `sales_billing` and `print_studio` for Cashier default roles.
7. `backend/app/api/v1/menus.py`:
   - Implemented `GET /api/v1/menus/contextual` with RBAC authorization and document lifecycle validation.
8. `backend/tests/t_menu_registry.py`:
   - Added `test_contextual_actions_sales_invoice_lifecycle` test and calibrated menu count assertion.
9. `docs/implementation/README.md`:
   - Appended plan entry to master implementation index.
10. `docs/walkthrough/README.md`:
    - Appended walkthrough entry to master walkthrough index.

---

## 5. Architecture Decisions
1. **Decoupled 4-Part Navigation Model:**
   Separated navigation state into:
   - *Global Navigation:* Static/authorized catalog of modules across all 7 categories (`launchpad`, `sales`, `purchase`, `inventory`, `masters`, `reports`, `system`).
   - *Contextual Submenu:* Document-specific lifecycle actions (`doc-overview`, `doc-items`, `doc-stock`, `doc-verify`, `doc-dispatch`, `doc-print`, `doc-activity`).
   - *Active Selection:* Current workspace (`activeTab` / `activeModuleId`) and active action (`activeSubmenuId`).
   - *Lifecycle State:* Current state (`DRAFT`, `SUBMITTED`, `FINALIZED`, `POSTED`, `DISPATCHED`, `CANCELLED`).
2. **Submenu Nesting Contract:**
   Instead of flattening document actions into top-level items, `ContextualMenuItem.submenus?: ContextualMenuItem[]` nests actions directly under the workspace row that owns the active document.
3. **Backend Authorization as Source of Truth:**
   UI hiding is strictly ergonomic; all contextual actions map to backend `(resource, action)` pairs verified by `evaluate_action_permission` in `backend/app/core/security_matrix.py`.

---

## 6. Design Rationale
- **Predictable Ergonomics:** Retail users working on large sales invoices often need to check stock ledger impact or run an inventory inquiry. Forcing them to close the invoice or navigate away caused cognitive friction and risk of abandoned carts.
- **Max-7 Actions Principle:** The contextual submenu is strictly limited to 7 high-impact actions (`doc-overview`, `doc-items`, `doc-stock`, `doc-verify`, `doc-dispatch`, `doc-print`, `doc-activity`), preserving SMRITI UX standards.
- **Zero Layout Reset:** Navigation state changes do not reset user preferences (dock position, collapsed groups, favorites, or dark/light theme).

---

## 7. Implementation Summary
- **Backend Service Layer:**
  `GET /api/v1/menus/contextual?document_type=SALES_INVOICE&transaction_state=DRAFT` returns the authorized list of contextual actions with `enabled`, `is_next_best_action`, and `disabled_reason` fields evaluated in real time.
- **Frontend State Integration:**
  `LayoutEngineProvider` maintains `activeDocument` and computes `getContextualSubmenu()` memoized by workspace ID.
- **Component Renderers:**
  Both `NavRail.tsx` (collapsible rail) and `NavRenderer.tsx` (multi-dock layout engine) display the nested submenus with distinct styling, hover effects, accessibility titles, and keyboard focus states.

---

## 8. Tests Executed

### Backend Pytest Suite
```bash
.venv\Scripts\pytest backend\tests\t_menu_registry.py
```
- Tested canonical menu catalog counts (`smriti_menus`).
- Tested SysAdmin full access to all 40 menus.
- Tested Cashier role isolation and menu access restrictions.
- Tested Sales Invoice contextual lifecycle actions across `DRAFT` and `POSTED` states.

### Frontend Vitest Suite
```bash
npx vitest run src/tests/persistentGlobalNavigationContextualSubmenus.test.tsx src/tests/canonicalBillingConsolidation.test.ts src/tests/fioriLaunchpad.test.ts src/tests/procurementAndReportsAudit.test.ts src/tests/uxSwitcher.test.tsx
```
- Tested 10/10 persistent global navigation and contextual submenus specifications.
- Tested 10/10 canonical billing consolidation tests.
- Tested 12/12 Fiori launchpad catalog tests.
- Tested 3/3 procurement and reports audit tests.
- Tested 8/8 UX switcher tests.

### TypeScript Compilation Check
```bash
npx tsc --noEmit
```
- Clean compilation across all TypeScript and TSX files (0 errors).

---

## 9. Verification Results
- **Status:** **Done**
- **Evidence Level:** A (Literal git diffs, full console execution logs, zero compilation errors).
- **Backend Pytest:** 7/7 tests passed.
- **Frontend Vitest:** 43/43 tests passed across 5 test suites.
- **TypeScript:** 0 errors.

---

## 10. Known Limitations
- When docked in "Bottom" mode on mobile viewports (< 640px), contextual submenus are rendered within the "More ▾" slide-up drawer rather than inline to prevent horizontal screen overflow.

---

## 11. Future Work
- Add keyboard hotkeys (e.g. `Alt+1` through `Alt+7`) for direct shortcut access to contextual document submenus.
- Expand contextual submenu models for Purchase Orders (`PO-` series) with automated Vendor ASN reconciliation.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Navigation Resolver and Decoupled Presentation Architecture.
- `ADR-0056`: Multi-Tenant RBAC Security Matrix and Role Invariants.

---

## 13. Related RFCs
- `RFC-2026-NAV-01`: Persistent Global Navigation with Contextual Submenus.
- `RFC-2026-UX-09`: Retail Cashier Ergonomics & Max-7 Action Principles.
