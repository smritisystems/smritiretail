<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Premium UX Switcher (Regular ↔ Classic) Implementation Plan

**Document ID:** IPGP-FND-UX-SWITCHER-v1.0.0  
**Version:** 1.0.0  
**Status:** In Progress  
**Area:** Foundation, UI Configuration Engine & Shell Architecture  
**Target Release:** v6.99.9  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Objective
Implement the commercial-grade Regular ↔ Classic UX Switcher for SMRITI Retail OS based on the approved visual reference (`media_1792652237107.png`). The switcher allows users to dynamically toggle between **Regular UX** (simple, clean, guided, and spacious everyday retail experience) and **Classic UX** (traditional, dense, high-efficiency, keyboard-driven ERP experience with hierarchical tree navigation, multi-document tab strip, and high-density transaction forms) without losing unsaved form states or active POS transactions.

---

## 2. Business Motivation
Retail businesses employ diverse staff profiles:
1. **Everyday Retail Staff & Store Owners:** Prefer the modern, intuitive Regular UX with touch-friendly KPI cards, summary tiles, and simplified single-rail navigation ("Power of an Enterprise ERP, Simplicity of WhatsApp").
2. **Experienced ERP Operators & Accountants:** Demand the high-density Classic UX featuring traditional menu bars (`Master`, `Transactions`, `Inventory`, `Accounts`, `CRM`, `Reports`, `Tools`), deep accordion tree navigation, F-key function buttons (`F2`, `F3`, `F4`, `F5`, `F7`, `F8`, `F9`, `F10`), and dense 10-column transaction grids with zero wasted vertical whitespace.

A single unified business engine serving both presentation modes ensures zero compromise between simplicity and power.

---

## 3. Scope
- **In Scope:**
  - Define `UXMode` enum (`regular` | `classic`) in `LayoutPreferences`.
  - Backend persistence in `backend/app/api/v1/system.py` (`/layout/preferences` supporting `uxMode` in `preferences_json`).
  - User Menu UX Switcher panel: Profile menu integration with sub-panel / radio controls matching mockup panel 1.
  - Top Bar Quick Mode Indicator Pill matching mockup panel 2: compact clickable pill (`Regular UX` / `Classic UX`) next to Search, Notifications, and Avatar.
  - Regular UX presentation: spacious layouts, guided action tiles, modern card summaries, responsive touch-friendly elements.
  - Classic UX presentation: high-density menu bar, hierarchical sidebar tree, multi-tab workspace strip, dense transaction grids, compact F-key bars.
  - POS and Form state preservation: switching modes reactively preserves cart items, selected customers, and unsaved form states without page reload.
  - Unit and integration tests (Vitest and Pytest).
- **Out of Scope:**
  - Modifying underlying accounting rules, GST engines, or database models.
  - Altering dark/light theme presets (UX Mode is independent of Theme selection).

---

## 4. Current State
- `src/layout_engine/layout_store.tsx` manages `LayoutPreferences` (`position`, `collapsed`, `iconOnly`, `sidebarWidth`, `favorites`, `collapsedGroups`).
- `GlobalHeader.tsx` renders the top bar, search, theme picker, notifications, and user session menu.
- `NavRail.tsx` renders the left rail in `EXPANDED`, `COMPACT`, or `HIDDEN` states.
- `backend/app/api/v1/system.py` persists layout preferences to `current_user.preferences_json` under key `"layout"`.
- However, there is no global `uxMode` property or switcher allowing users to toggle between Regular and Classic ERP presentations.

---

## 5. Gap Analysis
| Capability | Current State | Target State (v6.99.9) |
|---|---|---|
| UX Mode Definition | None | `UXMode = 'regular' \| 'classic'` in `LayoutPreferences` |
| Mode Switcher in Profile Menu | None | Polished radio selector with clear descriptions |
| Top Bar Mode Indicator Pill | None | Interactive pill showing current mode with 1-click toggle |
| Regular Presentation | Default Launchpad/Dashboard | Guided action tiles, KPI cards, spacious overview |
| Classic Presentation | Standard Rail | Hierarchical tree, top menu bar, dense transaction tables |
| Backend Layout Schema | `position`, `sidebarWidth`, etc. | Extended with `uxMode: "regular" \| "classic"` |
| State Preservation | N/A | Switching preserves active POS cart & forms |

---

## 6. Architecture Impact
- **SMRITI UI Configuration Engine:** Extended to provide mode-aware density classes and structural component switching.
- **Layout Store (`layout_store.tsx`):** Exposes `uxMode`, `setUxMode()`, and `toggleUxMode()` with local storage caching (`smriti_ux_mode`) for zero-flash page reloads and API synchronization.
- **Global Header (`GlobalHeader.tsx`):** Hosts the top-bar indicator pill and profile dropdown submenu.
- **App Shell (`AppShell.tsx`):** Coordinates between single-rail navigation and hierarchical Classic tree navigation.
- **Billing / POS Workspace:** Supports dense Classic transaction view with F-key shortcuts while sharing the identical cart and calculation engine.

---

## 7. Proposed Design

### A. Switcher UI Components
1. **User Menu Flyout:**
   ```
   [User Profile Header]
   ├── Profile Dashboard
   ├── Workspace Settings
   ├── UX Mode > [ Regular UX (Active) | Classic UX ]
   ├── Theme Preset >
   ├── Keyboard Shortcuts
   └── Logout
   ```
2. **Top Bar Pill Button:**
   - Regular Mode: Blue tinted pill badge `[ Regular UX ]`
   - Classic Mode: Slate / Dark pill badge `[ Classic UX ]`
   - Accessible tooltip explaining the mode and 1-click switch.

### B. Regular vs Classic Workspace Presentation
- **Regular Mode:**
  - Modern spacious dashboard with welcome greeting, 4 KPI cards (`Today Sales`, `Bills`, `Items Sold`, `New Customers`), 4 big action tiles (`POS Billing`, `Item Master`, `Customer`, `Reports`), and recent sales table.
- **Classic Mode:**
  - Traditional ERP top menu bar (`Master`, `Transactions`, `Inventory`, `Accounts`, `CRM`, `Reports`, `Tools`, `Settings`).
  - Hierarchical blue navigation tree.
  - Tab strip (`Dashboard`, `POS Billing x`).
  - High-density transaction workspace with visible F-keys, header inputs, 10-column data grid, remarks, and financial summary box.

---

## 8. Files Created
1. `src/components/shell/UxSwitcherModal.tsx` — Reusable UX Mode switcher dialog and dropdown sub-panel.
2. `src/components/dashboard/RegularUxDashboard.tsx` — Dedicated guided Regular UX dashboard matching the approved visual reference.
3. `src/components/dashboard/ClassicUxWorkspace.tsx` — High-density Classic ERP workspace with top menu bar, hierarchical tree, tab strip, and dense POS data grid.
4. `src/tests/uxSwitcher.test.tsx` — Automated frontend test suite verifying mode switching, persistence, top bar indicator, and state preservation.
5. `backend/app/tests/test_ux_mode_preferences.py` — Automated backend test verifying `uxMode` persistence in `/layout/preferences`.
6. `docs/implementation/foundation/Premium_UX_Switcher_Regular_Classic_Plan_v1.0.0.md` — This formal IPGP plan.
7. `docs/walkthrough/foundation/Premium_UX_Switcher_Regular_Classic_Walkthrough_v1.0.0.md` — Formal WGP walkthrough document.

---

## 9. Files Modified
1. `src/layout_engine/layout_store.tsx` — Added `UXMode`, `uxMode`, `setUxMode`, `toggleUxMode`, and persistence.
2. `backend/app/api/v1/system.py` — Updated `DEFAULT_LAYOUT_PREFERENCES` and `save_layout_preferences` to persist `uxMode`.
3. `src/components/shell/GlobalHeader.tsx` — Added mode indicator pill and user dropdown UX Mode selector.
4. `src/components/shell/AppShell.tsx` — Integrated mode-aware layout container.
5. `src/components/shell/TabRenderer.tsx` — Dispatches to Regular or Classic presentation views based on active `uxMode`.
6. `docs/implementation/README.md` — Registered plan in master index.
7. `docs/walkthrough/README.md` — Registered walkthrough in master index.
8. `CHANGELOG.md` — Release notes for v6.99.9.

---

## 10. Dependencies
- React 18, Lucide React icons, Material Symbols.
- Tailwind CSS design tokens (`src/index.css`).
- FastAPI + PostgreSQL backend for preference persistence.

---

## 11. Risks & Mitigation
- **Risk:** Flash of unstyled mode during initial page load.  
  **Mitigation:** Read `localStorage.getItem("smriti_ux_mode")` synchronously on script evaluation before rendering.
- **Risk:** Loss of unsaved cart items when toggling modes in POS.  
  **Mitigation:** `SmritiBillingStudio` and cart state are maintained in shared React state; mode changes only alter presentation density and layout, never flushing cart data.

---

## 12. Rollback Strategy
If issues arise, `uxMode` defaults to `"regular"` via fallback in `DEFAULT_PREFERENCES`, ensuring zero disruption to existing workflows.

---

## 13. Verification Plan
- Verify user menu UX Mode selection toggles state.
- Verify top bar pill button toggles between Regular and Classic.
- Verify persistence across browser page refreshes.
- Verify backend API `GET /api/v1/system/layout/preferences` stores and returns `uxMode`.
- Verify POS cart remains populated when switching back and forth.

---

## 14. Test Plan
- `test_ux_switcher_renders_current_mode()`
- `test_ux_switcher_toggles_mode_and_persists()`
- `test_ux_mode_indicator_pill_in_header()`
- `test_active_pos_cart_preserved_across_ux_mode_switch()`
- `test_backend_layout_preferences_persists_ux_mode()`

---

## 15. Documentation Impact
- `docs/implementation/README.md`
- `docs/walkthrough/foundation/Premium_UX_Switcher_Regular_Classic_Walkthrough_v1.0.0.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 16. Deployment Plan
1. Development on `F:\SMRITRretailNX` (branch `smritiNX`).
2. Verification via Vitest, Pytest, and TypeScript linter.
3. Commit and push to `origin smritiNX`.
4. Pull into `F:\Smriti9` for live test host verification.

---

## 17. Status
In Progress.

---

## 18. Related ADRs
- `ARCHITECTURE_DECISIONS.md` — FastAPI + PostgreSQL System of Record.
- Universal Author Details Header Policy (UADHP-v1.0).

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Master_Backup_Restore_Engine_And_Windows_CLI_Walkthrough_v1.0.0.md`
