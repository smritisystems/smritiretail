<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.4
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Menu Registry & Connected Studio UX Architecture (Phase 9)
-->

# SMRITI Price Revision Menu Registry & Connected UX Architecture Plan (v1.4.0)

## 1. Objective
Complete the end-to-end integration of the SMRITI Price Revision Module across the control-plane Menu Registry (`smritisys.smriti_menus`), the backend canonical security matrix (`security_matrix.py`), the SAP Fiori Launchpad catalog, the global navigation shell (`AppShell.tsx`, `TabRenderer.tsx`, `navigationResolver.ts`), and deliver a complete, highly-responsive, data-connected **Price Revision Studio Workspace** (`PriceRevisionStudioWorkspace.tsx`). The workspace connects directly to live tenant databases via authenticated FastAPI endpoints (`/api/v1/pricing/revisions*`, `/api/v1/products/resolve`), enforces the statutory ceiling invariant (`Selling Price <= MRP`), provides audit trails, scheduled activation triggers, and supports bulk CSV/TSV intake.

## 2. Business Motivation
Prior to this implementation, Price Revision existed only as a modal and backend service without canonical placement in the application navigation registry. Store managers, inventory controllers, and pricing administrators could not discover or access the revision studio through the standard **Items → Price Revision** menu or the Fiori Launchpad. Furthermore, price changes require real-time margin visibility, immediate statutory ceiling validation, and dual-track activation (immediate vs. future-scheduled) to prevent retail billing non-compliance under the Legal Metrology Act.

## 3. Scope
- **Control Plane Menu Registry**: Register `menu-price-revision` into `smritisys.smriti_menus` under `parent_id = 'menu-inventory'` at sequence `135` with route `'/price-revision'` and permission `'ITEM.WORKSPACE.ACCESS'`.
- **Backend Security Matrix**: Register `"menu-price-revision"` and resource `"price_revision_studio"` in `CANONICAL_36_MENU_MATRIX`, `CANONICAL_40_MENU_MATRIX`, and `CASHIER_DEFAULT_VIEW_ALLOWLIST`.
- **Frontend Navigation & Shell**: Register menu mapping in `securityStore.ts`, `layout_store.tsx`, `AppShell.tsx`, `navigationResolver.ts`, `BreadcrumbRegistry.ts`, and `launchpadCatalog.ts` (shortcut `F7`).
- **Tab & Route Orchestration**: Wire `menu-price-revision`, `price-revision`, and aliases in `TabRenderer.tsx` with lazy-loading of the dedicated workspace.
- **Data-Connected UX Studio**: Implement `PriceRevisionStudioWorkspace.tsx` and refactor `PriceRevisionStudioModal.tsx` as a clean facade wrapper.
- **Live Data Connectivity**: Connect directly to `/api/v1/pricing/revisions` (live 190 records in `COMP-001`), `/api/v1/products/resolve`, and `/api/v1/pricing/revisions/activate-scheduled`.
- **Quality Gates**: Pass TypeScript compilation (`tsc --noEmit`), Vitest suite, Launchpad catalog validation, and backend Pytest test suite.

## 4. Current State
- The backend Temporal Price Revision engine (`PriceRevisionService`), Alembic migrations (`v1530`, `v1531`), and REST endpoints in `pricing.py` are fully functional and pass 37/37 Pytest tests.
- Live tenant database `smriti001` contains 190 authentic revision records (118 `ACTIVE`, 32 `SCHEDULED`, 10 `PENDING_APPROVAL`).
- Navigation had no formal `menu-price-revision` entry in `smritisys.smriti_menus` or `TabRenderer.tsx`, creating a disconnected route.

## 5. Gap Analysis
1. **Menu Registry Gap**: `smritisys.smriti_menus` lacked the `menu-price-revision` row, preventing dynamic database menu hydration.
2. **Security Matrix Gap**: `backend/app/core/security_matrix.py` lacked `"menu-price-revision"` and `"price_revision_studio"` mappings.
3. **Tab Rendering Gap**: `TabRenderer.tsx` did not handle the `price-revision` module ID, leading to blank or unrendered screens when navigated.
4. **Studio Workspace UX Gap**: The UI lacked a full-page workspace with KPI metrics, status filters, live search, product auto-hydration, real-time margin differential calculation, and scheduled activation execution.

## 6. Architecture Impact
- **Control Plane DB**: Exact sequence `135` in `smriti_menus` maintains order between `menu-item-master` (130) and `menu-barcode` (140).
- **Client Architecture**: Clean separation between full-tab workspace (`PriceRevisionStudioWorkspace.tsx`) and popup dialog (`PriceRevisionStudioModal.tsx`).
- **Security & Multi-Tenancy**: Unconditional preservation of server-side tenant validation; client requests carry Bearer tokens and `X-Company-Id` verified against tenant database schemas.

## 7. Proposed Design
1. **Navigation Registration**: Insert canonical record into `smriti_menus` and configure all 7 frontend navigation registries (`securityStore`, `layout_store`, `AppShell`, `navigationResolver`, `BreadcrumbRegistry`, `launchpadCatalog`, `ItemMasterWs`).
2. **Workspace Component**: Build `PriceRevisionStudioWorkspace.tsx` featuring:
   - 4-tab interface: Revision Timeline, New Revision, Approvals Queue, Bulk Batch Import.
   - Header KPI counters: Total Revisions, Active, Scheduled, Pending Approval.
   - Live barcode/SKU resolution with auto-filling of current MRP, Selling Price, and Cost Price.
   - Margin & price differential visual preview with color-coded badges.
   - Statutory ceiling enforcement rejecting `revised_selling_price > revised_mrp`.
   - Supervisor PIN and role-based approval dialogs.
   - Inspector drawer for immutable revision audit log inspection.
3. **Modal Alignment**: Adapt `PriceRevisionStudioModal.tsx` to render `PriceRevisionStudioWorkspace` inside a high-visibility modal wrapper.

## 8. Files Created
- `src/components/pricing/PriceRevisionStudioWorkspace.tsx`: Full-featured data-connected Price Revision Studio Workspace.
- `src/tests/priceRevisionStudio.test.ts`: Dedicated Vitest suite verifying business logic, ceiling invariant, bulk parsing, and route mapping.
- `docs/implementation/pricing/Price_Revision_Menu_Registry_And_Connected_UX_Plan_v1.4.0.md`: This implementation plan.
- `docs/walkthrough/pricing/Price_Revision_Menu_Registry_And_Connected_UX_v1.4.0.md`: Accompanying walkthrough.

## 9. Files Modified
- `backend/app/core/security_matrix.py`: Added `menu-price-revision` to canonical security matrix and cashier allowlist.
- `backend/tests/conftest.py`: Added `menu-price-revision` to test seed menu fixtures.
- `src/services/securityStore.ts`: Added permission mapping in `MENU_PERMISSION_RESOURCES`.
- `src/layout_engine/layout_store.tsx`: Added `price-revision` workspace to default registered workspaces.
- `src/components/shell/AppShell.tsx`: Mapped `price-revision` to inventory context.
- `src/components/shell/navigationResolver.ts`: Added navigation items under `inventory` and `masters`.
- `src/navigation/breadcrumb/BreadcrumbRegistry.ts`: Added parent override.
- `src/components/launchpad/launchpadCatalog.ts`: Added Launchpad tile with shortcut `F7`.
- `src/components/itemMaster/ItemMasterWs.tsx`: Added navigation action button under Tools & Catalogs.
- `src/components/shell/TabRenderer.tsx`: Wired lazy import, module ID mapping, and render case.
- `src/components/pricing/PriceRevisionStudioModal.tsx`: Refactored to wrapper facade around workspace.
- `src/tests/menuRegistryRouting.test.ts`: Added `menu-price-revision` assertion to canonical menu suite.
- `docs/implementation/README.md`: Master index updated.
- `docs/walkthrough/README.md`: Master index updated.
- `CHANGELOG.md`: Detailed changelog entry added.

## 10. Dependencies
- FastAPI backend on port 1981 running `backend/app/api/v1/pricing.py`.
- PostgreSQL cluster on port 2781 with `smritisys` and `smriti001`.
- `src/lib/apiFetchV1.ts` communication layer.
- Lucide React icon library.

## 11. Risks
- **Risk**: Stale cache in local storage preventing menu from displaying.
  - **Mitigation**: Navigation resolver and layout store provide static defaults; TabRenderer maps both canonical menu ID and slug aliases.
- **Risk**: Performance degradation when fetching large revision datasets.
  - **Mitigation**: API pagination supported (`limit`, `offset`); studio queries top 300 active/recent records for instant in-browser filtering and pagination.

## 12. Rollback Strategy
1. Remove `menu-price-revision` from `smritisys.smriti_menus` (`DELETE FROM smriti_menus WHERE menu_id = 'menu-price-revision'`).
2. Revert modifications to `security_matrix.py`, `TabRenderer.tsx`, and navigation configuration files via Git checkout.

## 13. Verification Plan
1. Check database presence: Verify `menu-price-revision` exists in `smritisys.smriti_menus` under `menu-inventory`.
2. Check frontend compilation: `npx tsc --noEmit --skipLibCheck` with 0 errors.
3. Check test suites: `npx vitest run` and `pytest backend/tests/test_price_revisions.py`.
4. Check live API: Verify live responses from `GET /api/v1/pricing/revisions` under `COMP-001`.
5. Check Launchpad validation: `node scripts/validate-launchpad-registry.mjs` exits with code 0.

## 14. Test Plan
- Unit tests: Invariant enforcement, margin math, bulk CSV parsing (`src/tests/priceRevisionStudio.test.ts`).
- Integration tests: Canonical menu routing (`src/tests/menuRegistryRouting.test.ts`).
- Backend regression tests: 37 tests in `backend/tests/test_price_revisions.py`.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with Plan entry v1.4.0.
- Update `docs/walkthrough/README.md` with Walkthrough entry v1.4.0.
- Update `CHANGELOG.md` with v6.73.4 release notes.

## 16. Deployment Plan
- Changes are purely additive in the database (`INSERT INTO smriti_menus`) and backwards-compatible across frontend and backend code.
- Safe to deploy alongside standard application bundle.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: Canonical Navigation Registry & Security Matrix Synchronization.
- `ADR-0089`: Temporal Price Revision & Statutory Ceiling Invariant Enforcement.

## 19. Related Walkthroughs
- `docs/walkthrough/pricing/Price_Revision_Menu_Registry_And_Connected_UX_v1.4.0.md`
- `docs/walkthrough/pricing/MRP_And_Selling_Price_Revision_Engine_v1.0.0.md`
