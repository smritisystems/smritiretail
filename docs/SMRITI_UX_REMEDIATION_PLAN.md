<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Remediation Log
-->

# SMRITI RETAIL OS — UX & CONNECTIVITY REMEDIATION LOG

## 1. UI / UX Change Freeze Policy
**Status**: **ACTIVE** — No visual redesigns, component rewrites, or database schema modifications permitted unless required to resolve an active, verified runtime defect.

---

## 2. Remediated & Verified Log

| Priority | Issue / Defect Description | Category | Recommended Design & Action | Four-State Status | Verified Evidence |
|---|---|---|---|---|---|
| **P0** | Taskbar displaying on Login Screen | UX / Isolation | Relocate `<WorkspaceTaskbar />` inside `AppContent` below auth check. | **`Done`** | Taskbar unmounts completely when user is unauthenticated. |
| **P0** | MetadataRegistry module registration crash | Functional | Wrap `registerModule()` in try-catch blocks and allow updating workspace entries. | **`Done`** | TypeScript build & runtime verified; no duplicate registration errors. |
| **P1** | Bundle Size Entry Chunking (> 2.6 MB) | Performance | Configure Rollup `manualChunks` in `vite.config.ts` for core vendors and heavy modules. | **`Done`** | Entry bundle reduced by ~838 KB (1.77 MB); split into 13 chunks. |
| **P1** | Hidable Bottom Taskbar capability | UX / Efficiency | Add `isCollapsed` state, collapse button (`ChevronDown`), and floating peek trigger pill tab. | **`Done`** | User can collapse bottom taskbar anytime to maximize workspace canvas. |
| **P1** | Standalone Popout Window Engine | Multi-Window | Implement `popOutExternalWindow()` with `?standalone_tab=id` URL query param & full-screen view. | **`Done`** | Opens external popup window without app shell header or dock navigation. |
| **P2** | Disable Quick Action Palette | UX / Cleanliness | Return `null` in `QuickActionsMenu.tsx` & remove `<QuickActionsMenu />` from `App.tsx`. | **`Done`** | Floating quick action button disabled app-wide. |
| **P2** | Light Baseline & Dark Compatibility Theme | Theme Engine | Add 28-token dark theme block in `index.css`, set `LIGHT` as production baseline. | **`Done`** | Full 28-token Light Baseline & Dark Alternative verified; 0 class scattering. |
| **P3** | Universal Focus Visible Ring | Accessibility | Add `*:focus-visible` 2px ring with 2px offset in `src/index.css`. | **`Done`** | All interactive controls feature accessible keyboard focus indicators. |
| **P0** | Level C Business E2E Verification | E2E Testing | Execute Playwright DOM interactions -> UI POST -> PostgreSQL exact row check for J-01..J-04. | **`Done`** | Verified exact IDs `INV-IDEM-KEY-002`, `PO-LVLC-DE3A52`, `SM-1786799770-9ab5ae`, `cust-lvlc-fcc6d5`. |
| **P2** | Login Form Accessibility Attributes | Accessibility | Add `id` and `aria-label` attributes to username and password inputs in `LoginScreen.tsx`. | **`Done`** | Inputs comply with WCAG 2.1 AA accessible name requirements. |
