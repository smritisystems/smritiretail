<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.11
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Classic UX Workspace Directory Implementation Plan

**Document ID:** IPGP-FND-CLASSIC-WS-v6.99.11  
**Version:** 6.99.11  
**Status:** Completed  
**Area:** Foundation, UI Configuration Engine & Shell Architecture  
**Target Release:** v6.99.11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Objective
Transform the SMRITI Retail OS Classic UX workspace directory from the previous card-based launchpad layout into an authentic, traditional high-density ERP interface matching the approved reference screenshot (`Classic View` with traditional ERP horizontal menu bar, hierarchical left sidebar tree, dense 9-column data table, action toolbar with F-keys, and right-side details panel).

Regular UX retains its existing modern card-based interface (`FioriLaunchpad.tsx`), spacious layout, touch-friendly cards, and operational status widgets. Both modes share the same real workspace catalog, routes, permissions, PostgreSQL APIs, and business logic without mock data.

---

## 2. Business Motivation
Experienced retail ERP operators, senior accountants, and inventory managers who transition from legacy desktop ERPs (e.g. Tally, SAP ECC, Shoper 9, Marg ERP) rely on high-density information layouts and keyboard shortcuts. Presenting them with modern consumer-style card grids reduces productivity because they can only see 6–8 modules at a glance, requires excessive scrolling, and lacks visible hierarchical structure.

By contrast, everyday retail staff and counter salespersons prefer modern, touch-friendly, spacious cards with visual icons and status summaries.

Delivering an authentic, high-density ERP workspace directory in Classic UX while preserving the spacious Launchpad in Regular UX fulfills SMRITI's core product principle: **"Power of an Enterprise ERP, Simplicity of WhatsApp"**, providing zero compromise for both user cohorts.

---

## 3. Scope
- **In Scope:**
  - Create `ClassicWorkspaceDirectory.tsx`:
    - Dense 9-column workspace table (`#`, `Select`, `Workspace Name`, `Description`, `Category`, `Icon`, `Status`, `Type`, `Actions`) with row selection, status badges (`ACTIVE`, `INACTIVE`), and row actions.
    - Hierarchical left sidebar tree (`Workspace`, `Retail Operations`, `Finance & Ledgers`, `CRM & Customers`, `Masters`, `Reports`, `Tools & Config`) with node collapse/expand and counts.
    - Top sub-header tabs strip (`Dashboard × | Workspaces ×`).
    - Action toolbar with keyboard shortcuts and F-keys (`+ New Workspace (F2)`, `Open (Enter)`, `Edit (F4)`, `Deactivate (F5)`, `View Details (F6)`, `Table/Card View` toggle).
    - Right-side 320px details panel with `Details | Shortcuts | Access` tabs, `WS-001` ID formatting, `/billing/desktop` route formatting, quick action buttons (`Open Workspace`, `Add to Favorites`, `Copy Link`, `Edit Workspace`), and metadata grid.
  - Enhance `GlobalHeader.tsx`:
    - Render `EnterpriseTopMenu` when `uxMode === 'classic'` (`Home | Master | Transactions | Inventory | Purchase | Sales | Accounts | CRM | Reports | Tools | Settings | Help`) with accessible dropdown submenus and active module highlighting.
    - Retain center Omni-Search bar (`Ctrl+K`) and Breadcrumb navigation when `uxMode === 'regular'`.
  - Update `AppShell.tsx`:
    - Suppress the outer `NavRail` for `launchpad` and `workspaces` in Classic mode, allowing `ClassicWorkspaceDirectory` to display its internal tree sidebar full-bleed.
  - Update `TabRenderer.tsx`:
    - Mount `ClassicWorkspaceDirectory` for `case "launchpad":` and `case "workspaces":` when `uxMode === 'classic'`.
    - Preserved `<FioriLaunchpad .../>` when `uxMode === 'regular'`.
  - Update `App.tsx`:
    - Remove padding and overflow (`p-0 overflow-hidden`) on the active tab canvas for Classic workspace to enable seamless full-bleed rendering without nested scrollbars.
  - Ensure zero flash and authoritative `smriti_ux_mode` precedence in `layout_store.tsx`.
  - Add comprehensive automated Vitest test cases in `src/tests/uxSwitcher.test.tsx`.
- **Out of Scope:**
  - Modifying backend PostgreSQL schemas or transactional data structures.
  - Replacing or altering Regular UX Fiori Launchpad cards.

---

## 4. Current State
- `TabRenderer.tsx` previously rendered `FioriLaunchpad` for both `launchpad` and `workspaces` regardless of `uxMode`.
- In Classic UX, opening the workspace directory displayed the modern card grid instead of the traditional dense table layout shown in the approved design specification.
- `GlobalHeader.tsx` rendered the center Omni-Search bar in all modes rather than the traditional ERP menu ribbon (`Home | Master | Transactions | Inventory | ...`).
- Outer `NavRail` occupied horizontal space even when Classic UX required its own functional tree sidebar.

---

## 5. Gap Analysis
1. **Visual Parity Gap:** The approved screenshot required a dense 9-column tabular layout, a left functional tree navigation sidebar, an ERP top menu ribbon, and a right-side details panel. The codebase rendered card tiles in both modes.
2. **Top Navigation Gap:** Classic ERP users expect top horizontal menus (`Master`, `Transactions`, `Inventory`, `Reports`, etc.) rather than a single modern Omni-Search bar.
3. **Canvas Layout Gap:** `App.tsx` wrapped all tab contents in container padding (`p-4` or `p-6`), causing double scrollbars and breaking full-bleed ERP workspace layouts.
4. **Layout Preferences Precedence Gap:** Server-stored `smriti_layout_preferences` previously overwrote locally switched `smriti_ux_mode` during initial hydration.

---

## 6. Architecture Impact
- **Decoupled Presentation Architecture:**
  - `ClassicWorkspaceDirectory.tsx` acts as the Classic UX workspace presentation engine.
  - `FioriLaunchpad.tsx` remains the Regular UX modern card presentation engine.
  - Both engines consume the exact same `LAUNCHPAD_CATALOG` (`launchpadCatalog.ts`) and `/api/v1/menus/resolved` control plane endpoints, ensuring 100% parity of workspace IDs, routes, permissions, and metadata.
- **Shell Layout Adaptation:**
  - `AppShell.tsx` dynamically hides the outer navigation rail when Classic Workspace is active, handing complete layout control to `ClassicWorkspaceDirectory`'s internal sidebar tree.
  - `GlobalHeader.tsx` adapts between Omni-Search (Regular) and Enterprise Top Menu (Classic).

---

## 7. Proposed Design
- **Top Bar Ribbon:**
  - `Home`, `Master`, `Transactions`, `Inventory`, `Purchase`, `Sales`, `Accounts`, `CRM`, `Reports`, `Tools`, `Settings`, `Help`.
  - Dropdown submenus displaying active workspaces and quick jump links.
- **Sub-header Tabs Strip:**
  - Compact tabs (`Dashboard ×`, `Workspaces ×`) with active highlight and close affordance.
- **Hierarchical Functional Area Tree (Left Sidebar - 240px):**
  - Search filter input for tree nodes.
  - Tree categories: `Workspace (All)`, `Retail Operations`, `Finance & Ledgers`, `CRM & Customers`, `Masters`, `Reports`, `Tools & Config`.
  - Node expansion toggles (`ChevronDown` / `ChevronRight`) with workspace counts.
- **Dense Workspace Data Grid (Center Canvas):**
  - Toolbar: Search input, Category filter dropdown, Status filter dropdown (`All Status`, `Active`, `Inactive`), F-key action buttons, View toggle (`Table` / `Card`).
  - Table Columns: `#`, `Select (checkbox)`, `Workspace Name` (with icon & code), `Description`, `Category` (pill badge), `Icon` (preview), `Status` (emerald/slate badge), `Type` (`System` / `Custom`), `Actions` (`Open`, `Edit`, `...`).
  - Row click sets active selection for the right details panel.
  - Row double-click or Enter opens the workspace.
- **Metadata Details Panel (Right Sidebar - 320px):**
  - Header: Selected workspace title, subtitle, and primary `Open Workspace` button.
  - Tab navigation: `Details`, `Shortcuts`, `Access`.
  - Properties grid: Workspace ID (`WS-001`), Category, Status, Route Path (`/billing/desktop`), Permission Role, Created Date, Last Modified.
  - Quick Actions: `Add to Favorites`, `Copy Link`, `Edit Workspace`.

---

## 8. Files Created
1. `src/components/launchpad/ClassicWorkspaceDirectory.tsx` — Full-featured traditional ERP workspace directory component with hierarchical tree, 9-column dense table, F-key toolbar, and details panel.
2. `docs/walkthrough/foundation/evidence/classic_ux_workspace_directory.png` — Headless browser screenshot verification of Classic UX.
3. `docs/walkthrough/foundation/evidence/regular_ux_workspace_cards.png` — Headless browser screenshot verification of Regular UX.

---

## 9. Files Modified
1. `src/components/shell/GlobalHeader.tsx` — Added horizontal `EnterpriseTopMenu` when `uxMode === 'classic'`.
2. `src/components/shell/AppShell.tsx` — Suppressed outer `NavRail` for `launchpad` and `workspaces` in Classic mode.
3. `src/components/shell/TabRenderer.tsx` — Mode-aware routing of `launchpad` and `workspaces` to `ClassicWorkspaceDirectory`.
4. `src/App.tsx` — Applied `p-0 overflow-hidden` to workspace canvas in Classic mode.
5. `src/layout_engine/layout_store.tsx` — Enforced local `smriti_ux_mode` precedence over layout preferences JSON.
6. `src/tests/uxSwitcher.test.tsx` — Added 3 unit tests verifying Classic UX directory, table columns, top menu, and Regular cards.
7. `docs/implementation/README.md` — Appended implementation plan index entry.
8. `docs/walkthrough/README.md` — Appended walkthrough index entry.
9. `CHANGELOG.md` — Recorded version 6.99.11 release details.

---

## 10. Dependencies
- React 18 & Lucide React icons.
- `src/layout_engine/layout_store.tsx` (`useLayoutEngine`).
- `src/components/launchpad/launchpadCatalog.ts` (`LAUNCHPAD_CATALOG`, `TileData`).
- `src/contexts/WorkspaceContext.tsx` (`useWorkspace`).
- `src/lib/apiFetchV1.ts`.

---

## 11. Risks
- **Risk:** Unintended layout shifts or styling collisions when toggling between Regular and Classic UX.  
  **Mitigation:** `ClassicWorkspaceDirectory` is completely encapsulated with strict Tailwind utility scoping and self-contained sizing (`h-full`, `overflow-hidden`).
- **Risk:** Stale layout preferences in PostgreSQL overwriting the active UX mode.  
  **Mitigation:** `restorePreferences` enforces `localUxMode` precedence, ensuring the user's explicit selection remains authoritative.

---

## 12. Rollback Strategy
If any issues arise, the changes can be rolled back safely via Git (`git revert`) without database migrations, since all changes are frontend presentation components backed by zero schema mutations.

---

## 13. Verification Plan
1. **TypeScript Typecheck:** Run `npx tsc --noEmit` to verify zero compile or type errors.
2. **Vitest Unit Tests:** Run `npx vitest run src/tests/uxSwitcher.test.tsx` (all 8 tests green).
3. **Launchpad Regression Tests:** Run `npx vitest run src/tests/fioriLaunchpad.test.ts` (all 11 tests green).
4. **Registry Validator:** Run `node scripts/validate-launchpad-registry.mjs` (0 errors).
5. **Headless Visual Evidence:** Capture headless Playwright screenshots of both Regular and Classic modes and verify visual fidelity against approved reference image.

---

## 14. Test Plan
- Test 1: Verify `ClassicWorkspaceDirectory` renders 9-column table (`Select`, `Workspace Name`, `Description`, `Category`, `Icon`, `Status`, `Type`, `Actions`).
- Test 2: Verify `ClassicWorkspaceDirectory` renders hierarchical sidebar tree and 320px details panel with `Open Workspace` button.
- Test 3: Verify `GlobalHeader` renders `EnterpriseTopMenu` (`Master`, `Transactions`, `Inventory`, etc.) when `uxMode === 'classic'`.
- Test 4: Verify `GlobalHeader` renders Omni-Search input when `uxMode === 'regular'`.
- Test 5: Verify `TabRenderer` renders `ClassicWorkspaceDirectory` in Classic UX and `FioriLaunchpad` in Regular UX.

---

## 15. Documentation Impact
- Implementation plan: `docs/implementation/foundation/Classic_UX_Workspace_Directory_v6.99.11.md`.
- Walkthrough: `docs/walkthrough/foundation/Classic_UX_Workspace_Directory_v6.99.11.md`.
- Indices: `docs/implementation/README.md`, `docs/walkthrough/README.md`.
- Repository Changelog: `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Commit and push changes on branch `smritiNX` in `F:\SMRITRretailNX`.
2. Sync to test environment `F:\Smriti9` via `git pull`.
3. Verify Vite bundle build passes cleanly (`npm run build`).

---

## 17. Status
**Completed** — Implemented, verified with 8/8 unit tests, 11/11 catalog tests, 0 TypeScript errors, and headless visual screenshot evidence.

---

## 18. Related ADRs
- `ADR-0042`: Dual-Presentation UX Architecture (Regular Fiori Cards vs Classic ERP Grid).
- `ADR-0043`: Single-Door Control Plane Menu Federation (`/api/v1/menus/resolved`).

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Classic_UX_Workspace_Directory_v6.99.11.md`
- `docs/walkthrough/foundation/Premium_UX_Switcher_Regular_Classic_Walkthrough_v1.0.0.md`
