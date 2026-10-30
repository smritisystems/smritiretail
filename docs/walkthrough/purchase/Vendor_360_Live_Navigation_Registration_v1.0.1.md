<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.1
  Created      : 2026-09-11
  Modified     : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Vendor 360 Workspace Live Navigation Registration & Deep-Linking Alignment Walkthrough

**Document Version:** 1.0.1  
**Status:** Completed  
**Area:** Purchase / Procurement / Master Data / Navigation  
**Implementation Plan:** [`docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md)

---

## 1. Purpose
This walkthrough documents the comprehensive audit, live navigation unification, deep-link registration, and build alignment for the **Vendor 360 Workspace** (`VendorMasterWs`). It eliminates residual references to legacy flat supplier drawers (`MasterFormDrawer` / `supplierMasterConfig`), harmonizes navigation titles and icons across all primary AppShell navigation rails, registers canonical routing aliases in `App.tsx`, and enables direct URL deep-linking (`?tab=vendor-360`).

---

## 2. Scope
- **Navigation Resolver (`src/components/shell/navigationResolver.ts`):** Unify sidebar menu items under `purchase` and `masters` contexts from legacy `"Supplier Directory"` / `"Supplier Master"` to canonical `"Vendor 360 Workspace"` with the `local_shipping` icon.
- **Context Resolution (`src/components/shell/AppShell.tsx`):** Register `'vendor-360'`, `'vendor-master'`, and `'vendors'` in the Purchase business context mapping.
- **Layout Store (`src/layout_engine/layout_store.tsx`):** Align registered workspace labels to `"Vendor 360 Workspace"` and add explicit `"vendor-360"` workspace configuration.
- **Application Router & Hoisted Normalization (`src/App.tsx`):** Hoist `mapModuleId` to top-level module scope, map all vendor and supplier aliases to `"vendor-360"`, add browser URL query parameter parsing for `?tab=vendor-360` and `?workspace=vendor-360`, and directly mount `<VendorMasterWs />`.
- **Production Asset Build (`dist/`):** Compile production assets with `npm run build` to synchronize preview and static hosting targets.

---

## 3. Files Created
- `docs/walkthrough/purchase/Vendor_360_Live_Navigation_Registration_v1.0.1.md`

---

## 4. Files Modified
1. `src/components/shell/navigationResolver.ts`
2. `src/components/shell/AppShell.tsx`
3. `src/layout_engine/layout_store.tsx`
4. `src/App.tsx`

---

## 5. Architecture Decisions
- **ADR-VEND-01 Alignment:** All supplier and vendor entry points in the client interface must route to `VendorMasterWs`. No fallback screen or master list screen may bind to legacy `supplierMasterConfig`.
- **Top-Level Pure ID Normalizer:** `mapModuleId` is hoisted out of React component lifecycle to ensure pure, deterministic mapping during initial tab state resolution before any hooks execute.
- **Query Parameter Deep-Linking:** Standardize URL inspection for `?tab=<module_id>` on application boot to enable one-click browser demonstration and direct URL bookability without mutating persisted layout engine state.

---

## 6. Design Rationale
Previously, developers or users opening the directory in an unrefreshed session or through secondary navigation paths encountered the old `MasterFormDrawer` because:
1. `SupplierDashTab.tsx` was the only component previously mounting the workspace, whereas `App.tsx` had multiple legacy alias paths.
2. The NavRail sidebar presented `"Supplier Directory"` which caused confusion with the old `Supplier & Vendor Directory` dialog.
3. Direct navigation via URL (`?tab=vendor-360`) was ignored in favor of `localStorage.lastWorkspace`.

By implementing top-level aliasing, URL deep-linking, and explicit workspace mounting, the 9-tab Vendor 360 Workspace opens deterministically across all entry modes.

---

## 7. Implementation Summary
- Replaced `"Supplier Directory"` and `"Supplier Master"` labels with `"Vendor 360 Workspace"` in `navigationResolver.ts`.
- Added `'vendor-360'`, `'vendor-master'`, and `'vendors'` to `AppShell.tsx` context resolver.
- Updated `layout_store.tsx` to register both `supplier-mgmt` and `vendor-360` with label `"Vendor 360 Workspace"`.
- Hoisted `mapModuleId` in `App.tsx` and mapped:
  - `suppliers` → `vendor-360`
  - `supplier-mgmt` → `vendor-360`
  - `vendor-360` → `vendor-360`
  - `vendor-master` → `vendor-360`
  - `vendor` → `vendor-360`
  - `vendors` → `vendor-360`
  - `supplier` → `vendor-360`
  - `supplier-directory` → `vendor-360`
  - `menu-supplier-mgmt` → `vendor-360`
  - `menu-vendor-360` → `vendor-360`
- Configured initial state resolution in `App.tsx`:
  ```tsx
  const urlTab = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("tab") || new URLSearchParams(window.location.search).get("workspace"))
    : null;
  const safeLastWorkspace = urlTab ? mapModuleId(urlTab) : (preferences.lastWorkspace === "company-setup" ? "dashboard" : preferences.lastWorkspace);
  ```
- Mounted `<VendorMasterWs />` directly for all matching tab keys in `renderTabContent`.
- Built production bundle with `npm run build` (25.41s, 0 errors).

---

## 8. Tests Executed
- `npm run lint` (`tsc --noEmit`): 0 errors.
- `npx vitest run src/tests/fioriLaunchpad.test.ts`: 10/10 passed in 365ms.
- `npx vitest run src/tests/masterPage.test.ts`: 6/6 passed in 611ms.
- `npx vitest run src/tests/menuAccess.test.ts`: 6/6 passed in 413ms.
- `npx vitest run`: 110/110 test files passed, 680/680 tests passed in 22.05s.
- `npm run architecture:check`: 10/10 checks passed, 0 P0/P1 violations.

---

## 9. Verification Results
All automated test suites, architectural governance duplication gates, and TypeScript typecheck rules passed with zero errors or warnings. Live deep-linking via `http://localhost:3000/?tab=vendor-360` resolves directly to `VendorMasterWs`.

---

## 10. Known Limitations
- The user's active browser tab may hold cached state or local storage from a prior session; hard reload (`Ctrl+F5`) or deep-linking with `?tab=vendor-360` is recommended for instantaneous demonstration.

---

## 11. Future Work
- Add keyboard shortcut indicator (`F10`) in the sidebar NavRail tooltip.
- Expand multi-currency formatting on the Vendor Payables aging buckets.

---

## 12. Related ADRs
- [`docs/architecture/decisions/ADR-VEND-01_Vendor_360_Canonical_Architecture.md`](file:///F:/SMRITRretailNX/docs/architecture/decisions/ADR-VEND-01_Vendor_360_Canonical_Architecture.md)

---

## 13. Related RFCs
- RFC-VEND-001 (Universal Party Domain Normalization)
