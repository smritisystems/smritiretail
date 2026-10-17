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

# Implementation Plan — Auxiliary Workspaces Phase 5 Wiring & Catalog Routing v6.69.0

## 1. Objective
Achieve 100% elimination of unreferenced and unreachable tabs, workspaces, and studios across the entire SMRITI Retail OS repository by wiring all four remaining auxiliary workspaces (`SupplierDashTab.tsx`, `ProPosWs.tsx`, `DocStudioScreen.tsx`, `BulkImportSection.tsx`) into central shell routing (`TabRenderer.tsx`), workspace navigation (`ItemMasterWs.tsx`), and the enterprise Fiori Launchpad catalog (`launchpadCatalog.ts`).

## 2. Business Motivation
SMRITI Retail OS comprises extensive operational capabilities including vendor management, enterprise POS billing, multi-mode commercial document compilation, and attribute-driven spreadsheet catalog intake. Prior to this phase, four critical auxiliary components existed in the codebase without formal entry points in the centralized tab renderer or launchpad catalog. Resolving these pathways ensures total discoverability, prevents stranded engineering assets, and guarantees unified navigational parity for retail cashiers, department managers, and system administrators.

## 3. Scope
- **Central Shell Routing (`src/components/shell/TabRenderer.tsx`)**:
  - Lazy import and route `SupplierDashboardTab` (`supplier-dashboard`, `supplier_dashboard`, `supplier-dash`).
  - Lazy import and route `ProPosWs` (`propos-workspace`, `propos-ws`, `propos`, `enterprise-billing-suite`).
  - Lazy import and route `DocumentStudioScreen` (`document-studio`, `doc-studio`, `universal-doc-studio`).
  - Lazy import and route `BulkImportSection` (`bulk-import-sheet`, `bulk-import`, `attribute-import-sheet`).
- **Item Master Workspace Integration (`src/components/itemMaster/ItemMasterWs.tsx`)**:
  - Integrate `BulkImportSection` as a first-class navigation tab (`bulk_sheet` / "Attribute Bulk Sheet") with sidebar button.
- **Enterprise Fiori Launchpad Catalog (`src/components/launchpad/launchpadCatalog.ts`)**:
  - Register canonical catalog tiles for `supplier-dashboard`, `propos-workspace`, `document-studio`, and `bulk-import-sheet`.
- **Fiori Launchpad Routing Verification (`src/tests/fioriLaunchpad.test.ts`)**:
  - Synchronize `REGISTERED_APP_TABS` test fixture to include new auxiliary workspace tab IDs.
- **Version SSOT Synchronization**:
  - Advance system version to `6.69.0` across `package.json`, `src/config/version.ts`, `backend/app/core/config.py`, and `CHANGELOG.md`.

## 4. Current State
- `python scripts/audit_pending_ux.py` identified four unreferenced tabs/workspaces:
  1. `src/components/BulkImportSection.tsx`
  2. `src/components/SupplierDashTab.tsx`
  3. `src/components/billing/propos/ProPosWs.tsx`
  4. `src/components/global/document/DocStudioScreen.tsx`
- Orphaned modals and dialogs were previously reduced to 0 in Phase 4 (v6.68.0).
- Unreferenced tabs/workspaces stood at 4.

## 5. Gap Analysis
1. `SupplierDashTab.tsx` exported `SupplierDashboardTab` (wrapping `VendorMasterWs`) but lacked a mapped route in `TabRenderer.tsx` and a tile in `LAUNCHPAD_CATALOG`.
2. `ProPosWs.tsx` provided the classic Enterprise Billing Suite interface (daily reports, Z-reports, commissions) but was not directly addressable via shell tab switching.
3. `DocStudioScreen.tsx` provided universal multi-mode document generation (`SALES_INVOICE`, `PURCHASE_ORDER`) but was not registered in `TabRenderer.tsx`.
4. `BulkImportSection.tsx` provided attribute-aware bulk spreadsheet intake but was superseded in item master without an accessible fallback tab.

## 6. Architecture Impact
- **Decoupled Asynchronous Code Splitting**: All four workspaces are loaded via React `lazy()` in `TabRenderer.tsx`, preserving sub-second initial shell bundle load times.
- **Unified Navigation Parity**: All 74 tabs, workspaces, and studios in SMRITI Retail OS are now formally imported, rendered, and addressable via shell IDs or launchpad tiles.
- **Zero Orphan Guarantee**: Eliminates all unreachable workspace components repository-wide.

## 7. Proposed Design
```
User / Shell Navigator
   │
   ├── Launchpad Tile / Shell Tab ID
   │     ├── "supplier-dashboard" ────► SupplierDashboardTab (VendorMasterWs)
   │     ├── "propos-workspace"   ────► ProPosWs (Enterprise Billing Suite)
   │     ├── "document-studio"    ────► DocumentStudioScreen (Universal Document Compiler)
   │     └── "bulk-import-sheet"  ────► BulkImportSection (Attribute Bulk CSV Engine)
   │
   └── Item Master Workspace Sidebar
         └── "bulk_sheet" Nav Item ────► BulkImportSection
```

## 8. Files Created
- `docs/implementation/foundation/Auxiliary_Workspaces_Phase5_Wiring_Plan_v6.69.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase5_Auxiliary_Workspaces_v6.69.0.md`

## 9. Files Modified
- `src/components/shell/TabRenderer.tsx` (Lazy imports, module mapping, render nodes)
- `src/components/itemMaster/ItemMasterWs.tsx` (Nav tab, sidebar button, canvas render)
- `src/components/launchpad/launchpadCatalog.ts` (Catalog tiles for 4 workspaces)
- `src/components/SupplierDashTab.tsx` (Version & author header update)
- `src/components/BulkImportSection.tsx` (Version & author header update)
- `src/components/billing/propos/ProPosWs.tsx` (Version & author header update)
- `src/components/global/document/DocStudioScreen.tsx` (Version & author header update)
- `src/tests/fioriLaunchpad.test.ts` (Registered app tabs fixture update)
- `package.json` (Bumped to v6.69.0)
- `src/config/version.ts` (Bumped to v6.69.0)
- `backend/app/core/config.py` (Bumped to v6.69.0)
- `CHANGELOG.md` (Added v6.69.0 section)
- `docs/implementation/README.md` (Master index updated)
- `docs/walkthrough/README.md` (Master index updated)

## 10. Dependencies
- React 18 Suspense & lazy loading primitives.
- Existing SMRITI API contracts (`/api/v1/invoices`, `/api/v1/attributes/*`, `/api/v1/parties`).
- Lucide React icon set (`Storefront`, `PointOfSale`, `Description`, `FileSpreadsheet`).

## 11. Risks
- **Bundle Bloat Risk**: Mitigated by utilizing `React.lazy()` chunking for all four workspaces.
- **Route Namespace Collision**: Verified that tab IDs (`supplier-dashboard`, `propos-workspace`, `document-studio`, `bulk-import-sheet`) do not collide with existing route names.

## 12. Rollback Strategy
Git revert of commit on branch `smritiNX` restoring previous `TabRenderer.tsx`, `ItemMasterWs.tsx`, and `launchpadCatalog.ts` states.

## 13. Verification Plan
1. Run `python scripts/audit_pending_ux.py` -> verify `Unreferenced Tabs/Workspaces: 0`.
2. Run `npx tsc --noEmit` -> verify exit code 0 (zero compiler errors).
3. Run `python scripts/validate_version_ssot.py` -> verify exit code 0 (all 4 files match `6.69.0`).
4. Run `npx vitest run src/tests/fioriLaunchpad.test.ts src/tests/masterPage.test.ts` -> verify all tests pass.

## 14. Test Plan
- Unit test coverage in `src/tests/fioriLaunchpad.test.ts` asserting all launchpad tile IDs resolve to valid shell tabs.
- Full type-safety verification via TypeScript compiler.

## 15. Documentation Impact
- Formal implementation plan in `docs/implementation/foundation/`.
- Technical walkthrough in `docs/walkthrough/foundation/`.
- Entry added to `CHANGELOG.md` and master indices.

## 16. Deployment Plan
- Single-phase deployment via standard Git branch push to `origin/smritiNX`.
- No database migrations or schema adjustments required.

## 17. Status
**Completed** — Fully implemented, validated, and verified with zero compiler and audit errors.

## 18. Related ADRs
- `ADR-001`: React 18 + Vite Frontend Architecture.
- `ADR-004`: Fiori Launchpad Design System & Dynamic Tile Routing.
- `ADR-019`: Unified Item Master & Attribute Engine Specification.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Domain_Modals_Phase4_Comprehensive_Wiring_v6.68.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase5_Auxiliary_Workspaces_v6.69.0.md`
