# Implementation Plan: Classic UX Header, Submenu & Overflow Remediation

**Version:** 6.99.12  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Foundation & Presentation Architecture  
**Status:** Completed  
**Created:** 2026-10-22  
**Modified:** 2026-10-22  
**Target Release:** v6.99.12  

---

## 1. Objective
Eliminate clipped top navigation menus, hidden nested submenus, double-scrollbars, and sidebar/status bar collision in SMRITI Retail OS Classic UX mode. Ensure the global header, enterprise module menu, multi-tier portal dropdowns, left functional navigation rail, and page content render with 100% positional accuracy and zero clipping across standard desktop viewports (1600×900, 1366×768, 1280×720, 1024×768).

## 2. Business Motivation
SMRITI Retail OS offers dual user experience modes: Regular UX for touch-friendly guided retail, and Classic UX for high-speed, keyboard-driven ERP power users. Power operators working in transaction studios (Sales & Commerce Studio, Purchase Studio, Item Master) rely on immediate access to the full module hierarchy without menus being trapped inside clipped headers or overflowing off the screen.

## 3. Scope
- Global application shell header (`GlobalHeader.tsx`)
- Enterprise ERP top menu bar (`EnterpriseMenuBar.tsx`)
- Contextual navigation rail (`NavRail.tsx`)
- Main application workspace canvas wrapper (`App.tsx`)
- Multi-tier portal dropdowns and flyout submenus
- Responsive overflow handling for viewports from 1024px to 1600px
- Regression safety for Regular UX Fiori Launchpad and Omni-Search

## 4. Current State
In commit `ccae806b`, the Classic UX top menu bar was introduced inside `<nav className="... overflow-x-auto no-scrollbar ...">` within a 48px header. When a user opened a dropdown, CSS overflow rules forced vertical clipping, hiding the entire dropdown. Furthermore, nested secondary submenus were absent, and `NavRail` used `h-[calc(100vh-52px)]` inside a flex container with 32px bottom padding, causing the rail to collide with the 32px fixed `WorkspaceStatusBar`.

## 5. Gap Analysis
1. **Dropdown Clipping:** Ancestor container had `overflow-x: auto`, preventing vertical overflow.
2. **Missing Multi-Tier Hierarchies:** Menus only had single-level children without subcategory flyouts.
3. **Sidebar Viewport Collision:** `NavRail` height calculation caused 28px overflow past the fixed status bar.
4. **Canvas Double-Scrollbars:** Studio screens in Classic UX had `overflow-y-auto` wrapped around internal full-height scrolling tables.
5. **Narrow Viewport Overflow:** At 1024px, 12 top-level buttons collided with right-side controls without a responsive overflow mechanism.

## 6. Architecture Impact
- Introduction of Portal-based rendering (`createPortal(..., document.body)`) with fixed coordinates calculated via `getBoundingClientRect()`.
- Shared stacking layer: Primary dropdown at `z-index: 9999`, secondary flyout at `z-index: 10000`.
- Zero-clip responsive overflow: Dynamic `maxVisible` partition with "More ▾" menu on narrower displays.

## 7. Proposed Design
1. **Portal Anchoring:** Render dropdowns and flyouts directly to `document.body` outside all layout overflow containers.
2. **Flyout Geometry Engine:** Submenus fly out to the right, automatically flipping to the left if within 12px of the viewport edge, and clamp to viewport bottom.
3. **Sidebar Alignment:** Change `NavRail` to `h-full` to naturally fill the flex container above the status bar.
4. **Studio Canvas Pass-Through:** Set `p-0 overflow-hidden` on full-screen studios in Classic UX.

## 8. Files Created
- `src/components/shell/EnterpriseMenuBar.tsx`
- `src/tests/enterpriseMenuBar.test.tsx`
- `scripts/diagnose_classic_sales.py`
- `scripts/verify_classic_ux_headless.py`

## 9. Files Modified
- `src/components/shell/GlobalHeader.tsx`
- `src/components/shell/NavRail.tsx`
- `src/components/launchpad/FioriLaunchpad.tsx`
- `src/App.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18 `createPortal`
- Lucide React & Material Symbols
- Playwright Python test harness

## 11. Risks
- *Risk:* Portal popups orphaned on page unmount.  
  *Mitigation:* Handled via global mousedown and Escape listeners cleaning up state.

## 12. Rollback Strategy
Git revert of modified shell files restores previous flat ribbon behavior without database schema changes.

## 13. Verification Plan
- Multi-viewport headless Playwright audit (1600×900, 1366×768, 1280×720, 1024×768).
- DOM element coordinate and bounding box inspection.
- Dropdown stacking and nested submenu flyout verification.

## 14. Test Plan
- Vitest unit tests (`src/tests/enterpriseMenuBar.test.tsx`, `src/tests/uxSwitcher.test.tsx`).
- TypeScript check (`tsc --noEmit`).
- Production build check (`npm run build`).

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Update `docs/walkthrough/README.md`
- Update `CHANGELOG.md`

## 16. Deployment Plan
- Compile bundle via `npm run build`.
- Rebuild production Docker container `smriti-web` via `docker compose up -d --build smriti-web`.
- Verify live application at `http://localhost:8101`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: Dual UX Mode Decoupled Presentation Architecture
- `ADR-0045`: Single-Door Control Plane Navigation Resolver

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Classic_UX_Header_Submenu_Remediation_Walkthrough_v6.99.12.md`
- `docs/walkthrough/foundation/Classic_UX_Workspace_Directory_v6.99.11.md`
