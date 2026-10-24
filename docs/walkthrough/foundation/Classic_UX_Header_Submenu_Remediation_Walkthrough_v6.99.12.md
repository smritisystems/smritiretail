# Walkthrough: SMRITI Retail OS — Classic UX Header, Submenu & Overflow Remediation

**Version:** 6.99.12  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Foundation & Presentation Layer  
**Date:** 2026-10-22  
**Status:** Done  

---

## 1. Purpose
This walkthrough documents the root-cause diagnosis, architecture redesign, and verification of the Classic UX navigation shell in SMRITI Retail OS. It resolves clipped top navigation menus, hidden nested submenus, double-scrollbars on transaction studios, and sidebar overflow collisions with the application status bar.

## 2. Scope
- Application shell navigation (`GlobalHeader.tsx`, `EnterpriseMenuBar.tsx`)
- Multi-tier portal dropdown menus and flyout secondary submenus
- Functional navigation rail (`NavRail.tsx`)
- Main application workspace canvas wrapper (`App.tsx`, `TabRenderer.tsx`)
- Headless verification across 4 desktop viewports (1600×900, 1366×768, 1280×720, 1024×768)
- Regression protection for Regular UX mode

## 3. Files Created
1. `src/components/shell/EnterpriseMenuBar.tsx`: Enterprise top menu ribbon with portal-anchored primary dropdowns, nested flyouts, and responsive "More ▾" overflow handling.
2. `src/tests/enterpriseMenuBar.test.tsx`: Unit tests verifying menu item definitions, active state highlighting, ARIA semantics, and multi-tier submenus.
3. `scripts/diagnose_classic_sales.py`: Diagnostic automation script for DOM hierarchy inspection.
4. `scripts/verify_classic_ux_headless.py`: Comprehensive headless Playwright multi-viewport verification suite.

## 5. Files Modified
1. `src/components/shell/GlobalHeader.tsx`: Integrated `EnterpriseMenuBar`, restored missing imports (`useTheme`, `useLayoutEngine`, `UxSwitcherModal`), updated UADHP version to 6.99.12.
2. `src/components/shell/NavRail.tsx`: Updated height calculation from `h-[calc(100vh-52px)]` to `h-full`, added dark mode classes to footer collapse container, updated UADHP version to 6.99.12.
3. `src/components/launchpad/FioriLaunchpad.tsx`: Added `uxMode?: "regular" | "classic"` prop definition to `FioriLaunchpadProps`, resolved TS2322 lint error, updated UADHP version to 6.99.12.
4. `src/App.tsx`: Updated canvas wrapper condition so full-screen studios (`sales`, `purchase`, `item-master`, etc.) receive `p-0 overflow-hidden` in Classic UX, preventing double scrollbars.
5. `docs/implementation/README.md`: Appended chronological implementation index entry.
6. `docs/walkthrough/README.md`: Appended chronological walkthrough index entry.
7. `CHANGELOG.md`: Added release notes for v6.99.12.

## 5. Architecture Decisions
- **Portal Rendering (`createPortal`):** Menus are detached from `header` and `nav` DOM hierarchy and rendered directly into `document.body`. This guarantees that ancestor CSS properties (`overflow: hidden`, `overflow-x: auto`, `transform`) cannot clip or trap dropdowns.
- **Shared Stacking Engine:** Primary dropdowns render at `z-index: 9999`; nested secondary flyout submenus render at `z-index: 10000`, ensuring menus always float completely above page canvas, cards, and tables.
- **Responsive Dynamic Partitioning:** When viewport width drops below 1080px (e.g. 1024×768), the menu bar cleanly displays 7–8 primary buttons plus an automated "More ▾" menu, avoiding horizontal scrollbars or clipping right-hand shell controls.

## 6. Design Rationale
- Traditional ERP operators demand high information density, direct keyboard navigation, and reliable multi-level module categorization (Master -> Items & Catalog -> Item Master).
- Hardcoding pixel offsets across individual studio pages creates brittle regressions. By resolving the layout at the shell and canvas wrapper levels (`AppShell`, `NavRail`, `App.tsx`), all modules automatically inherit clean alignment.

## 7. Implementation Summary
- Diagnosed root cause of clipped menus: Ancestor `<nav>` had `overflow-x: auto`, which forced vertical clipping of all absolute child menus inside a 48px header.
- Extracted and modularized `EnterpriseMenuBar.tsx` with coordinate calculation (`getBoundingClientRect()`) and right/bottom viewport boundary clamping.
- Realigned `NavRail` to `h-full`, eliminating the 28px bottom collision with `WorkspaceStatusBar`.
- Validated TypeScript typing with zero errors (`tsc --noEmit`).
- Rebuilt and verified production preview Docker container `smriti-web` at `localhost:8101`.

## 8. Tests Executed
1. `vitest run src/tests/enterpriseMenuBar.test.tsx` (5/5 tests passed).
2. `vitest run src/tests/uxSwitcher.test.tsx` (8/8 tests passed).
3. `tsc --noEmit` (0 errors).
4. `python scripts/verify_classic_ux_headless.py` (4/4 viewports verified, 0 errors).

## 9. Verification Results
- **1600×900:** 12 top-level modules rendered, Master dropdown opens at `z-index: 9999`, Items & Catalog flyout opens at `z-index: 10000`, zero clipping, 0 horizontal scrollbars.
- **1366×768:** 12 top-level modules rendered, all dropdowns and submenus fully visible above page content, zero clipping.
- **1280×720:** 12 top-level modules rendered, flyout submenus clamp to viewport bottom, zero clipping.
- **1024×768:** 8 modules rendered + "More ▾" overflow menu, zero horizontal scrollbar, all 5 overflow modules accessible.
- **Sidebar Alignment:** `asideBottom: 742, footerTop: 742, sidebarStatusOverlap: false` across all viewports.
- **Escape Key:** `menus_after_escape: 0` verified.
- **Theme Toggles:** Dark and Light themes verified and captured in screenshots.
- **Regular UX:** Omni-Search and modern Fiori Launchpad verified completely intact.

## 10. Known Limitations
None observed for desktop and laptop viewport sizes >= 1024px.

## 11. Future Work
Add touch-swipe support for mobile ERP tablets (< 768px).

## 12. Related ADRs
- `ADR-0042`: Dual UX Mode Presentation Architecture

## 13. Related RFCs
- `RFC-2026-08`: Classic ERP Navigation Parity Standard
