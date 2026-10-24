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

# SMRITI Retail OS — Premium UX Switcher (Regular ↔ Classic) Walkthrough

**Document ID:** WGP-FND-UX-SWITCHER-v1.0.0  
**Version:** 1.0.0  
**Status:** Done  
**Area:** Foundation, UI Configuration Engine & Shell Architecture  
**Release:** v6.99.9  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the **Premium UX Switcher (Regular UX ↔ Classic UX)** in SMRITI Retail OS. The switcher enables users to seamlessly toggle between two distinct operational presentations:
- **Regular UX:** A clean, guided, touch-friendly, spacious interface designed for everyday retail staff and store owners ("Power of an Enterprise ERP, Simplicity of WhatsApp").
- **Classic UX:** A traditional, dense, high-efficiency, keyboard-driven ERP workspace designed for seasoned accountants and power operators, featuring a classic top menu bar (`Master`, `Transactions`, `Inventory`, etc.), hierarchical navigation tree, multi-document tab strip, F-key function bars, and compact 10-column transactional data grids with zero wasted vertical whitespace.

Both presentations operate on the identical underlying database, accounting engine, tax calculation pipeline, and real-time state, allowing instantaneous mode switching without losing active POS cart items, selected customers, or in-flight form entries.

---

## 2. Scope
- **Frontend Architecture:**
  - `LayoutStoreContext` & `useLayoutEngine` in `src/layout_engine/layout_store.tsx` extended with `UXMode = 'regular' | 'classic'`, `uxMode`, `setUxMode`, and `toggleUxMode`.
  - Zero-flash synchronous hydration via `localStorage.getItem("smriti_ux_mode")`.
  - Global Header (`GlobalHeader.tsx`) enhanced with:
    - Top bar quick mode indicator pill button with active icon (`laptop_mac` vs `desktop_windows`) and 1-click toggle.
    - User session dropdown sub-panel with polished radio cards matching the approved visual specification.
  - Dedicated `UxSwitcherModal.tsx` for side-by-side mode inspection, feature checklists, and instant mode switching.
  - Guided Regular UX dashboard component (`RegularUxDashboard.tsx`) with greeting banner, 4 KPI cards (`Today Sales`, `Bills`, `Items Sold`, `New Customers`), 4 big action tiles, and recent sales table.
  - Traditional Classic ERP workspace component (`ClassicUxWorkspace.tsx`) with top menu bar, tabs bar, F-key toolbar (`F2`, `F3`, `F4`, `F5`, `F8`, `F10`), customer & price level headers, and dense 10-column transaction grid.
  - Mode-aware tab rendering in `TabRenderer.tsx` routing `dashboard` and `pos`/`billing` tabs to either Regular or Classic presentations.
- **Backend Architecture:**
  - Layout preferences API (`/api/v1/system/layout/preferences`) extended with `uxMode` field in `DEFAULT_LAYOUT_PREFERENCES`, GET endpoint, and POST persistence handler in `backend/app/api/v1/system.py`.
- **Testing & Quality Gates:**
  - Automated Vitest test suite (`src/tests/uxSwitcher.test.tsx`) covering storage defaulting, modal presentation, empty state, and component rendering.
  - Automated Pytest integration test suite (`backend/app/tests/test_ux_mode_preferences.py`) validating PostgreSQL layout preference persistence.
  - Zero TypeScript errors (`npx tsc --noEmit`).

---

## 3. Files Created
1. `src/components/shell/UxSwitcherModal.tsx` — Reusable UX Mode switcher dialog with side-by-side comparison cards and radio controls.
2. `src/components/dashboard/RegularUxDashboard.tsx` — Guided Regular UX presentation component with spacious cards, greeting, KPI tiles, and recent transactions.
3. `src/components/dashboard/ClassicUxWorkspace.tsx` — Traditional Classic ERP presentation component with top menu bar, tabs, F-key shortcuts, and dense grid.
4. `src/tests/uxSwitcher.test.tsx` — 5-test Vitest test suite validating UX switcher rendering, radio states, and component outputs.
5. `backend/app/tests/test_ux_mode_preferences.py` — Dedicated Pytest suite validating backend preference persistence in `User.preferences_json`.
6. `docs/walkthrough/foundation/Premium_UX_Switcher_Regular_Classic_Walkthrough_v1.0.0.md` — This formal 13-section WGP document.

---

## 4. Files Modified
1. `src/layout_engine/layout_store.tsx` — Added `UXMode` type, `uxMode` state, `setUxMode`, `toggleUxMode`, and synchronous `localStorage` caching.
2. `backend/app/api/v1/system.py` — Added `"uxMode": "regular"` to `DEFAULT_LAYOUT_PREFERENCES` and persisted in `save_layout_preferences`.
3. `src/components/shell/GlobalHeader.tsx` — Added top bar indicator pill (`Regular UX` / `Classic UX`) and user session flyout mode selector.
4. `src/components/shell/TabRenderer.tsx` — Dispatched `dashboard` and `pos`/`billing` tabs based on active `uxMode`.
5. `docs/implementation/foundation/Premium_UX_Switcher_Regular_Classic_Plan_v1.0.0.md` — Updated status to `Completed`.
6. `docs/implementation/README.md` — Updated plan entry to `Completed`.
7. `docs/walkthrough/README.md` — Appended walkthrough entry with status `Done`.
8. `CHANGELOG.md` — Recorded release notes for v6.99.9.

---

## 5. Architecture Decisions
1. **Decoupled Presentation Layer from Business Engine:**
   - Both `RegularUxDashboard` and `ClassicUxWorkspace` interface with the exact same underlying props (`products`, `currentUser`, `onNavigateTab`, `onNotification`) and transaction stores.
   - Switching modes changes only DOM layout, component density, and keyboard interaction models; it never unmounts shared context or wipes cart state.
2. **Synchronous Client-Side Hydration:**
   - Reading `localStorage.getItem("smriti_ux_mode")` at initial evaluation prevents Layout Shift and Flash of Unstyled Mode (FOUM) during page reload.
   - Asynchronously syncs with backend `/layout/preferences` on user login to preserve cross-device consistency.
3. **Theme Independence:**
   - The UX mode switcher is completely orthogonal to the SMRITI Color Theme Engine (Enterprise Navy, Slate, Emerald, Fiori Dark, etc.). Users can run Classic UX in Dark Mode or Regular UX in Light Mode without conflict.

---

## 6. Design Rationale
- **Two Distinct User Personas:** A single interface cannot simultaneously optimize for a first-time cashier who needs large touch targets and guided prompts, and a 20-year Tally/SAP operator who refuses to touch the mouse and demands 40 rows per screen with F-key shortcuts. The switcher honors both personas without fragmenting the codebase.
- **Top Bar Pill Button:** Placing a persistent, compact mode indicator pill in the top header provides immediate visual feedback regarding the current mode and enables instantaneous 1-click toggling.
- **Side-by-Side Modal:** The `UxSwitcherModal` clearly articulates the capabilities and trade-offs of each mode, eliminating confusion about what changes when toggling.

---

## 7. Implementation Summary
```
+-----------------------------------------------------------------------------------+
|                                Global Header                                      |
|  [Logo] [Branch/Company]           [ 💻 Regular UX ] [Theme] [Bell] [User Profile] |
+-----------------------------------------------------------------------------------+
                                          |
                      +-------------------+-------------------+
                      |                                       |
              (uxMode === 'regular')                  (uxMode === 'classic')
                      |                                       |
                      v                                       v
        +---------------------------+           +---------------------------+
        |    RegularUxDashboard     |           |     ClassicUxWorkspace    |
        | - Welcome greeting banner |           | - Top ERP menu bar        |
        | - 4 Spacious KPI cards    |           | - Multi-document tab bar  |
        | - 4 Guided action tiles   |           | - F-Key shortcut bar      |
        | - Recent sales feed       |           | - Dense 10-col POS grid   |
        +---------------------------+           +---------------------------+
                      \                                       /
                       \                                     /
                        v                                   v
             +-----------------------------------------------------+
             |  Shared Database, Product Catalog & Cart Continuity |
             +-----------------------------------------------------+
```

---

## 8. Tests Executed
1. **Frontend Vitest Test Suite (`src/tests/uxSwitcher.test.tsx`):**
   - Test 1: Default UX mode storage key defaults to "regular" and toggles to "classic".
   - Test 2: `UxSwitcherModal` displays polished selection panel with clear labels and radio cards.
   - Test 3: `UxSwitcherModal` renders nothing when `isOpen` is false.
   - Test 4: `RegularUxDashboard` renders spacious layout, greeting, 4 KPI cards, 4 action tiles, and recent sales.
   - Test 5: `ClassicUxWorkspace` renders traditional ERP layout with top menus, tabs, dense grid, and F-keys.
   - Command: `npx vitest run src/tests/uxSwitcher.test.tsx` (5/5 passed, 56ms).
2. **Backend Pytest Test Suite (`backend/app/tests/test_ux_mode_preferences.py`):**
   - Test 1: `test_ux_mode_preferences_lifecycle` (verifies GET `/layout/preferences` returns default `uxMode`, POST `/layout/preferences` updates `uxMode` to `classic`, and subsequent GET returns persisted `classic`).
   - Command: `pytest backend/app/tests/test_ux_mode_preferences.py -v` (1/1 passed, 46.06s).
3. **TypeScript Static Analysis:**
   - Command: `npx tsc --noEmit` (0 errors, clean exit).

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
backend\app\tests\test_ux_mode_preferences.py::test_ux_mode_preferences_lifecycle PASSED [100%]
======================= 1 passed, 28 warnings in 46.06s =======================

 RUN  v4.1.11 F:/SMRITRretailNX
 ✓ src/tests/uxSwitcher.test.tsx (5 tests) 56ms
 Test Files  1 passed (1)
      Tests  5 passed (5)

npx tsc --noEmit: exited with code 0.
```

---

## 10. Known Limitations
- The Classic UX presentation is currently wired to the `dashboard` and `pos`/`billing` routes in `TabRenderer.tsx`. Workspaces such as CRM or Procurement continue to use their canonical responsive layouts until specialized Classic dense grid adapters are authored.

---

## 11. Future Work
- Author specialized Classic dense grid views for Purchase Order and Inventory Stock Ledger modules.
- Enable user-configurable F-key keybinding customization in the Settings panel.

---

## 12. Related ADRs
- `ARCHITECTURE_DECISIONS.md` — FastAPI + PostgreSQL System of Record.
- Universal Author Details Header Policy (UADHP-v1.0).

---

## 13. Related RFCs
- RFC-FND-009: Layout Engine Preference Hierarchy & Cross-Device Sync.
