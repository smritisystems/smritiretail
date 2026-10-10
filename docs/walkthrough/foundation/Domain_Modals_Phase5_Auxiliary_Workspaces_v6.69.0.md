<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.69.0
  * Created    : 2026-10-03
  * Modified   : 2026-10-03
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough — Domain Modals Phase 5: Auxiliary Workspaces Routing & Catalog Wiring v6.69.0

## 1. Purpose
This walkthrough documents the technical implementation and verification of Phase 5 Auxiliary Workspaces Routing and Catalog Wiring in SMRITI Retail OS. Following Phase 4's complete resolution of orphaned modals (0 unreferenced modals out of 89), Phase 5 targeted the four remaining unreferenced functional workspaces (`SupplierDashTab.tsx`, `ProPosWs.tsx`, `DocStudioScreen.tsx`, and `BulkImportSection.tsx`), achieving 100% elimination of unreferenced tabs/workspaces (0 unreferenced out of 74).

## 2. Scope
- Centralized shell routing in `src/components/shell/TabRenderer.tsx` for all four auxiliary workspaces.
- Navigation integration of `BulkImportSection.tsx` into `src/components/itemMaster/ItemMasterWs.tsx` under a dedicated "Attribute Bulk Sheet" tab.
- Launchpad discovery through `src/components/launchpad/launchpadCatalog.ts` with dedicated tile definitions and role assignments.
- Test fixture synchronization in `src/tests/fioriLaunchpad.test.ts`.
- Single Source of Truth (SSOT) version bump to `6.69.0` across the frontend, backend, package manifest, and changelog.

## 3. Files Created
- `docs/implementation/foundation/Auxiliary_Workspaces_Phase5_Wiring_Plan_v6.69.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase5_Auxiliary_Workspaces_v6.69.0.md`

## 4. Files Modified
- `src/components/shell/TabRenderer.tsx`
- `src/components/itemMaster/ItemMasterWs.tsx`
- `src/components/launchpad/launchpadCatalog.ts`
- `src/components/SupplierDashTab.tsx`
- `src/components/BulkImportSection.tsx`
- `src/components/billing/propos/ProPosWs.tsx`
- `src/components/global/document/DocStudioScreen.tsx`
- `src/tests/fioriLaunchpad.test.ts`
- `package.json`
- `src/config/version.ts`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Dynamic Code Splitting via React.lazy()**: To prevent inflating the initial application bundle, `SupplierDashboardTab`, `ProPosWs`, `DocumentStudioScreen`, and `BulkImportSection` are asynchronously loaded on demand when the user accesses their respective routes.
2. **Canonical Aliasing in mapModuleId**: Multiple intuitive identifiers map to the canonical shell module ID (e.g., `supplier-dashboard`, `supplier_dashboard`, `supplier-dash` all route to `supplier-dashboard`).
3. **Dual Surface Mounting for Bulk Ingestion**: `BulkImportSection` is accessible both directly through the central shell route (`bulk-import-sheet`) and as a contextual workspace tool inside `ItemMasterWs.tsx` (`activeNav === "bulk_sheet"`).

## 6. Design Rationale
- **Supplier 360 Dashboard (`SupplierDashTab.tsx`)**: Wraps `VendorMasterWs` to serve as a high-level operational launch point with baseline supplier metrics and supplier directory views.
- **Enterprise Billing Suite (`ProPosWs.tsx`)**: Preserves classic multi-mode POS capabilities (Billing, Invoicing, EOD Z-Reports, Daily Reports, Promotions, Commission Builder) for operators accustomed to traditional tabular workflows while modern `BillingWorkspace.tsx` handles fast-paced scanning.
- **Universal Document Studio (`DocStudioScreen.tsx`)**: Provides an interactive document compiler and print layout preview for tax invoices, delivery challans, and purchase orders.
- **Attribute Bulk Sheet (`BulkImportSection.tsx`)**: Allows category managers to dynamically configure attribute groups and validate matrix rows prior to bulk committing into the SMRITI catalog.

## 7. Implementation Summary

### A. Central Shell Routing (`TabRenderer.tsx`)
```tsx
const SupplierDashboardTab = lazy(() => import("../SupplierDashTab.tsx").then(m => ({ default: m.SupplierDashboardTab })));
const ProPosWs = lazy(() => import("../billing/propos/ProPosWs.tsx").then(m => ({ default: m.ProPosWs })));
const DocumentStudioScreen = lazy(() => import("../global/document/DocStudioScreen.tsx").then(m => ({ default: m.DocumentStudioScreen })));
const BulkImportSection = lazy(() => import("../BulkImportSection.tsx").then(m => ({ default: m.BulkImportSection })));
```

### B. Module ID Mapping (`mapModuleId`)
- Added aliases for `supplier-dashboard`, `propos-workspace`, `document-studio`, and `bulk-import-sheet`.

### C. Workspace Canvas Rendering (`renderTabNode`)
- Added switch cases rendering each workspace with appropriate context props (`currentUser`, `addNotification`, `products`, `profiles`, `shifts`, `fetchSystemState`).

### D. Item Master Workspace Integration (`ItemMasterWs.tsx`)
- Added `"bulk_sheet"` to `WorkspaceNavTab`.
- Added sidebar navigation button with `FileSpreadsheet` icon.
- Mounted `<BulkImportSection />` in the main workspace canvas when `activeNav === "bulk_sheet"`.

### E. Fiori Launchpad Catalog (`launchpadCatalog.ts`)
- Added tiles for:
  - `supplier-dashboard` (Retail Operations, Manager / SysAdmin)
  - `propos-workspace` (Retail Operations, Cashier / Manager / SysAdmin)
  - `document-studio` (Master Data & Stock, Manager / SysAdmin)
  - `bulk-import-sheet` (Master Data & Stock, Manager / SysAdmin)

## 8. Tests Executed
```bash
python scripts/audit_pending_ux.py
npx tsc --noEmit
python scripts/validate_version_ssot.py
npx vitest run src/tests/fioriLaunchpad.test.ts src/tests/masterPage.test.ts
```

## 9. Verification Results

### A. UX Audit Output
```
=== MODALS / DIALOGS AUDIT ===
Total Modals/Dialogs: 89
Unreferenced Modals (Orphaned): 0
Import-Only Modals: 0

=== WORKSPACES / TABS / STUDIOS AUDIT (Total: 74) ===
Unreferenced Tabs/Workspaces: 0
```

### B. TypeScript Compilation
```
npx tsc --noEmit
Exit code: 0
```

### C. Version SSOT Validation
```
--- SMRITI Version SSOT Inspection ---
package.json          : 6.69.0
backend/core/config.py: 6.69.0
src/config/version.ts : 6.69.0
CHANGELOG.md (head)   : 6.69.0

[PASS] Version SSOT consistent across all boundaries: 6.69.0
```

### D. Vitest Test Execution
```
 ✓ src/tests/fioriLaunchpad.test.ts (11 tests) 25ms
 ✓ src/tests/masterPage.test.ts (6 tests) 8ms

 Test Files  2 passed (2)
      Tests  17 passed (17)
```

## 10. Known Limitations
- Pure client mock/in-memory modals (58 components) and referenced tabs with client-side simulation engines remain operational as designed, awaiting progressive backend persistence cutover in future feature sprints.

## 11. Future Work
- Backing simulation-only modal calculation states with PostgreSQL-backed JSON-B schema stores.
- Adding unified search quick-launch indexing for all 74 launchpad workspaces.

## 12. Related ADRs
- `ADR-001`: React 18 + Vite Frontend Client Architecture.
- `ADR-004`: Fiori Launchpad Architecture & Module Federation.

## 13. Related RFCs
- `RFC-2026-08-01`: Universal Document Studio Interface Specification.
- `RFC-2026-09-12`: Enterprise Billing Suite & Shift Settlement Lifecycle.
