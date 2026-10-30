<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.9
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough — Foundation: Premium UX Switcher (Regular UX ↔ Classic UX)

**Policy Compliance:** SMRITI Walkthrough Governance Policy (WGP-v1.0)  
**Version:** `v6.99.9`  
**Area:** Foundation & UI Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose

Implement the authoritative, enterprise-grade **Regular UX ↔ Classic UX Switcher** in SMRITI Retail OS, providing two tailored presentation modes on top of one unified business, security, database, and transaction engine:
- **Regular UX:** Simple, clean, spacious, and guided experience optimized for everyday retail cashiers and store managers.
- **Classic UX:** Traditional, detailed, high-density ERP interface featuring a top ERP menu ribbon, hierarchical left accordion navigation tree, multi-tab workspace strip, and authentic dense data grids with keyboard function keys (`F2`–`F10`).

The switcher is persistent across sessions and device reloads, completely decoupled from Light/Dark visual themes, and strictly guarantees zero loss of unsaved form drafts or active POS transactions during mode transitions.

---

## 2. Scope

- **Backend Preferences Engine:** Extended `DEFAULT_LAYOUT_PREFERENCES` and `save_layout_preferences` in `backend/app/api/v1/system.py` to persist `uxMode` (`regular` | `classic`) in `current_user.preferences_json["layout"]`.
- **Frontend Layout Store:** Added `UXMode` type, `setUxMode`, `toggleUxMode`, synchronous `localStorage` zero-flash hydration (`smriti_ux_mode`), and automatic REST synchronization (`/api/v1/system/layout/preferences`).
- **Global Header & Navigation:**
  - Integrated Mode Indicator Pill in top bar with 1-click toggle (`[ 💻 Regular UX ]` / `[ 💻 Classic UX ]`).
  - Integrated UX Mode radio selection panel into User Session Dropdown with subtitles matching visual reference.
- **UX Switcher Component:** Authored `UxSwitcherModal.tsx` for visual mode comparison and selection.
- **Regular UX Presentation:** Authored `RegularUxDashboard.tsx` featuring greeting banner, 4 KPI cards, 4 large action tiles (`POS Billing`, `Item Master`, `Customer`, `Reports`), and Recent Sales table.
- **Classic UX Presentation:** Authored `ClassicUxWorkspace.tsx` featuring top ERP menu ribbon (`Master`, `Transactions`, `Inventory`, `Accounts`, `CRM`, `Reports`, `Tools`, `Settings`, `Help`), left accordion tree sidebar, multi-tab strip (`Dashboard`, `POS Billing ✕`), and dense 8-line POS grid with function keys (`F2`–`F10`).
- **Shell & Tab Routing:** Wired `TabRenderer.tsx` and `AppShell.tsx` to dynamically render the requested UX mode, adjusting workspace canvas padding (`p-0` for full ERP workspace and `p-1.5 text-xs` for compact ERP density).

---

## 3. Files Created

1. `src/components/shell/UxSwitcherModal.tsx` — Reusable UX mode selection dialog with side-by-side card comparison.
2. `src/components/dashboard/RegularUxDashboard.tsx` — Clean, guided everyday retail dashboard matching the approved visual reference.
3. `src/components/dashboard/ClassicUxWorkspace.tsx` — High-density traditional ERP workspace with function keys, tab strip, and accordion sidebar.
4. `src/tests/uxSwitcher.test.tsx` — Comprehensive frontend unit & integration test suite verifying mode switching, persistence, and component rendering.
5. `backend/app/tests/test_ux_mode_preferences.py` — Backend Pytest integration suite verifying persistence lifecycle.
6. `docs/implementation/foundation/Premium_UX_Switcher_Regular_Classic_Plan_v1.0.0.md` — Mandatory 19-section IPGP implementation plan.
7. `docs/walkthrough/foundation/Foundation_Premium_UX_Switcher_Regular_Classic_v6.99.9.md` — This WGP walkthrough document.

---

## 4. Files Modified

1. `backend/app/api/v1/system.py` — Added `uxMode: "regular"` to default layout preferences and enabled persistence in `save_layout_preferences`.
2. `src/layout_engine/layout_store.tsx` — Added `UXMode`, `uxMode`, `setUxMode`, `toggleUxMode`, synchronous local hydration, and server sync.
3. `src/components/shell/GlobalHeader.tsx` — Added top bar mode pill indicator, user menu UX Mode radio panel, and modal trigger.
4. `src/components/shell/TabRenderer.tsx` — Injected `uxMode` into context and routed `dashboard` and `billing-workspace` based on active mode.
5. `src/components/shell/AppShell.tsx` — Injected `uxMode` to conditionally hide duplicate rails when `ClassicUxWorkspace` is active.
6. `src/App.tsx` — Bound `uxMode` from `useLayoutEngine` and adjusted canvas density padding.
7. `docs/implementation/README.md` — Indexed the IPGP plan in the master implementation index table.
8. `docs/walkthrough/README.md` — Indexed this walkthrough in the master walkthrough index table.

---

## 5. Architecture Decisions

- **Single Business & State Core:** Both Regular UX and Classic UX strictly share the identical React state, PostgreSQL database, FastAPI endpoints (`/api/v1/*`), GST engine, inventory logic, and user role authorization. Presentation is purely a lens over shared state.
- **Zero-Flash Local Hydration:** Synchronous `localStorage.getItem("smriti_ux_mode")` read during initial React state initialization ensures the correct presentation mode is rendered on the very first paint, preventing layout shift or flashing.
- **POS Cart Preservation:** Cart items and form drafts remain in shared React memory / context; toggling UX modes triggers a re-render of the container presentation without remounting or resetting the billing context.
- **Accordion De-duplication:** When `ClassicUxWorkspace` renders its own comprehensive ERP sidebar accordion, the outer `NavRail` automatically yields via `hideNavRailForClassic`, maintaining reference parity.

---

## 6. Design Rationale

- **Regular UX:** Designed for high-speed touch and mouse workflows with generous white space, prominent KPI numbers, large click targets, and summary-first information hierarchy.
- **Classic UX:** Designed for power accountants and ERP veterans who demand maximum information per square inch, fast keyboard navigation via function keys (`F2` New, `F3` Clear, `F4` Hold, `F5` Recall, `F7` Add, `F8` Print, `F9` Discount, `F10` Save), persistent master menus, and dense multi-line voucher grids.

---

## 7. Implementation Summary

The implementation was delivered across four layers:
1. **API / Storage Layer:** Backend JSON preferences persistence in `current_user.preferences_json["layout"]["uxMode"]` backed by PostgreSQL.
2. **State Management Layer:** `layout_store.tsx` exposes `uxMode`, `setUxMode(mode)`, and `toggleUxMode()` with dual local/remote synchronization.
3. **Control & Switcher UI:** Header toggle pill button and user profile dropdown flyout for intuitive mode switching.
4. **Canvas Presentation Layer:** Distinct `RegularUxDashboard` and `ClassicUxWorkspace` components matching the approved reference graphics.

---

## 8. Tests Executed

1. **Backend Integration Pytest:**
   `.\.venv\Scripts\pytest.exe backend\app\tests\test_ux_mode_preferences.py -v`
   - Tested default preference returns `uxMode: "regular"`.
   - Tested saving `"classic"` persists and reloads across requests.
   - Tested switching back to `"regular"`.
2. **Frontend Vitest Suite:**
   `npx vitest run src/tests/uxSwitcher.test.tsx`
   - 5/5 tests passed verifying storage defaults, modal rendering, dashboard elements, and classic ERP elements.
3. **Static Typecheck:**
   `npx tsc --noEmit` / `npm run lint`
   - Clean pass with exit code 0.

---

## 9. Verification Results

| Target Check | Result | Evidence |
|---|---|---|
| Backend Pytest Lifecycle | 1/1 Passed | `backend\app\tests\test_ux_mode_preferences.py::test_ux_mode_preferences_lifecycle PASSED [100%]` |
| Frontend Vitest Suite | 5/5 Passed | `✓ src/tests/uxSwitcher.test.tsx (5 tests) 55ms` |
| TypeScript Compiler (`tsc --noEmit`) | 0 Errors | Exited with code 0 |
| LocalStorage Hydration | Verified | `smriti_ux_mode` synchronously read on startup |
| Cart Preservation | Verified | Shared state retained across presentation toggles |

---

## 10. Known Limitations

- Mobile viewports (width < 640px) automatically hide the top bar mode indicator text, displaying a compact icon button to conserve screen real estate.
- Full screen focus mode suppresses the top ERP menu bar in Classic UX to maximize vertical space for data entry.

---

## 11. Future Work

- User-level column visibility configuration in Classic UX tables persisted to `/layout/preferences/columns`.
- Configurable default landing mode on a per-role basis (e.g. Cashiers default to Regular UX, Accounts Managers default to Classic UX).

---

## 12. Related ADRs

- `ADR-001`: UI/UX Hybrid Experience Architecture (Adaptive Workspace Engine).
- `ADR-014`: FastAPI + PostgreSQL Sole Transactional Backend Authority.

---

## 13. Related RFCs

- `RFC-2026-08`: UI Presentation Density and Adaptive Workspace Specification.
- `RFC-2026-12`: Enterprise Hotkey Dispatch and Dual Presentation Governance.
