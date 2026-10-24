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
  Classification: Menu Registry & Connected Studio UX Architecture Walkthrough (Phase 9)
-->

# Price Revision Menu Registry & Connected UX Architecture Walkthrough (v1.4.0)

## 1. Purpose
This walkthrough documents the full implementation and verification of the Price Revision module navigation integration and data-connected UX workspace. It establishes the canonical navigation registration under **Items → Price Revision** across both the database control plane and frontend application shell, and introduces the dedicated **Price Revision Studio Workspace** connected to live PostgreSQL tenant data.

## 2. Scope
- Control Plane Menu Registry (`smritisys.smriti_menus`) insertion of `menu-price-revision`.
- Backend canonical security matrix synchronization in `security_matrix.py` and test seed data in `conftest.py`.
- Frontend navigation wiring in `securityStore.ts`, `layout_store.tsx`, `AppShell.tsx`, `navigationResolver.ts`, `BreadcrumbRegistry.ts`, and `launchpadCatalog.ts` (with keyboard shortcut `F7`).
- TabRenderer route handling and dynamic lazy-loading for module IDs `menu-price-revision`, `price-revision`, `price_revision`, `price-revisions`, `pricing-revisions`.
- Complete data-connected `PriceRevisionStudioWorkspace.tsx` component implementation.
- Refactoring of `PriceRevisionStudioModal.tsx` as a reusable facade wrapper.
- End-to-end verification across TypeScript compilation, Vitest tests, Launchpad registry validation, and backend Pytest test execution.

## 3. Files Created
- `src/components/pricing/PriceRevisionStudioWorkspace.tsx`: Comprehensive, live data-connected Price Revision Studio Workspace.
- `src/tests/priceRevisionStudio.test.ts`: Dedicated Vitest suite covering statutory ceiling enforcement, margin differential calculation, bulk CSV/TSV intake, and route resolution.
- `docs/implementation/pricing/Price_Revision_Menu_Registry_And_Connected_UX_Plan_v1.4.0.md`: Formal 19-section implementation plan.
- `docs/walkthrough/pricing/Price_Revision_Menu_Registry_And_Connected_UX_v1.4.0.md`: This 13-section walkthrough document.

## 4. Files Modified
- `backend/app/core/security_matrix.py`: Added `menu-price-revision` to canonical security matrix and cashier allowlist.
- `backend/tests/conftest.py`: Added `menu-price-revision` fixture to seed menu table during tests.
- `src/services/securityStore.ts`: Mapped `menu-price-revision` to `price_revision_studio`.
- `src/layout_engine/layout_store.tsx`: Registered `price-revision` workspace under category `'Inventory & Sourcing'`.
- `src/components/shell/AppShell.tsx`: Mapped `price-revision` to inventory shell context.
- `src/components/shell/navigationResolver.ts`: Added navigation items under `inventory` and `masters` trees.
- `src/navigation/breadcrumb/BreadcrumbRegistry.ts`: Added breadcrumb parent override for `price-revision`.
- `src/components/launchpad/launchpadCatalog.ts`: Added Fiori Launchpad tile under "Master Data & Stock" with shortcut `F7`.
- `src/components/itemMaster/ItemMasterWs.tsx`: Added direct studio launcher button under Tools & Catalogs.
- `src/components/shell/TabRenderer.tsx`: Wired lazy import, module ID mapping, and render case.
- `src/components/pricing/PriceRevisionStudioModal.tsx`: Refactored to wrapper facade around workspace.
- `src/tests/menuRegistryRouting.test.ts`: Added assertion for `menu-price-revision` in canonical menu list.
- `docs/implementation/README.md`: Master index updated with Plan v1.4.0.
- `docs/walkthrough/README.md`: Master index updated with Walkthrough v1.4.0.
- `CHANGELOG.md`: Detailed v6.73.4 changelog entry added.

## 5. Architecture Decisions
1. **Database-Driven Menu Registration**: `menu-price-revision` was inserted directly into `smritisys.smriti_menus` with sequence `135` between `menu-item-master` (130) and `menu-barcode` (140) under parent `menu-inventory`. This ensures dynamic database menu hydration functions out of the box without ad-hoc client patching.
2. **Component Separation of Workspace and Modal**: Rather than duplicating UI logic or forcing modal constraints onto a tab workspace, `PriceRevisionStudioWorkspace.tsx` was created as an unconstrained, responsive workspace component. `PriceRevisionStudioModal.tsx` was refactored into a thin modal dialog wrapper hosting the workspace component.
3. **Statutory Ceiling Pre-Validation & Invariant Enforcement**: The UI actively checks `revised_selling_price <= revised_mrp` in real time, alerting the user and blocking form submission with an explicit error badge before sending the payload. The backend enforces this invariant at both the API layer (`HTTP 400 Bad Request` with HREP message) and the database schema layer (`chk_ipr_sp_le_mrp` check constraint).
4. **Fast Client-Side Filtering with Live Server Pagination**: The workspace fetches the top 300 active/recent records from `/pricing/revisions?limit=300`, enabling sub-millisecond multi-field search and status filtering while supporting pagination selector options (15, 25, 50, 100 rows per page).

## 6. Design Rationale
- **High-Velocity Barcode/SKU Resolution**: Price managers frequently scan physical barcodes or type SKUs when adjusting prices. The studio leverages `GET /api/v1/products/resolve?identifier={query}` for instant 1-scan lookup, automatically populating item name, SKU, current MRP, selling price, and buying/cost price.
- **Differential Margin Preview**: Changing a selling price or MRP directly impacts gross profit margins. The studio calculates and displays real-time price change (₹ and %) and proposed gross margin % alongside color-coded badges (positive margin in emerald green, negative margin in crimson red).
- **Scheduled vs. Immediate Activation**: Price revisions can take effect immediately or be scheduled for a future promotional date/time. The studio provides a radio toggle and datetime picker, routing immediate revisions through instant activation and future revisions through the scheduled activation queue.

## 7. Implementation Summary
- **Database Registration**: Verified presence in `smritisys.smriti_menus`:
  - `menu_id`: `'menu-price-revision'`
  - `title`: `'Price Revision'`
  - `path`: `'/price-revision'`
  - `parent_id`: `'menu-inventory'`
  - `sequence`: `135`
  - `permission`: `'ITEM.WORKSPACE.ACCESS'`
- **Security Matrix**: Updated `backend/app/core/security_matrix.py` with `"menu-price-revision": {"resource": "price_revision_studio", "view_perm": "ITEM.WORKSPACE.ACCESS", "parent_id": "menu-inventory"}` and added `"price_revision_studio"` to `CASHIER_DEFAULT_VIEW_ALLOWLIST`.
- **Frontend Navigation & Shell**: Integrated `price-revision` into `TabRenderer.tsx`, `AppShell.tsx`, `navigationResolver.ts`, `BreadcrumbRegistry.ts`, `launchpadCatalog.ts`, and `ItemMasterWs.tsx`.
- **Connected Studio Workspace**: Built `PriceRevisionStudioWorkspace.tsx` with KPI counters, 4 tabs (Timeline, New, Approvals, Bulk), live barcode search, margin preview, scheduled activation trigger (`/pricing/revisions/activate-scheduled`), approval workflow with supervisor PIN prompt, and CSV/TSV bulk intake.

## 8. Tests Executed
1. **Frontend Unit & Integration Tests (Vitest)**:
   - Command: `npx vitest run src/tests/priceRevisionStudio.test.ts src/tests/menuRegistryRouting.test.ts`
   - Output: 2 test files passed, 9/9 tests passed (3 in menu registry, 6 in price revision studio).
2. **Launchpad Registry Validation**:
   - Command: `node scripts/validate-launchpad-registry.mjs`
   - Output: PASSED (52 tiles, 52 unique IDs, 122 render cases).
3. **TypeScript Compilation**:
   - Command: `npx tsc --noEmit --skipLibCheck`
   - Output: Exit code 0, 0 errors.
4. **Backend Test Suite (Pytest)**:
   - Command: `.venv\Scripts\pytest.exe backend/tests/test_price_revisions.py`
   - Output: 37 passed, 24 warnings in 52.38s.
5. **Live API End-to-End Verification**:
   - Queried live FastAPI backend (port 1981) against tenant `COMP-001`:
     - 190 live revisions returned (118 `ACTIVE`, 32 `SCHEDULED`, 10 `PENDING_APPROVAL`).
     - Cross-tenant tampering attempt with header mismatch returned `HTTP 403 Forbidden` (`Header Tampering Forbidden`).
     - Statutory ceiling violation payload (`SP > MRP`) returned `HTTP 400 Bad Request` (`SMRITI-PRICE-001: Selling price (₹120.00) cannot exceed statutory MRP (₹100.00)`).
     - Single revision audit detail fetch returned `HTTP 200 OK`.

## 9. Verification Results
| Verification Item | Command / Mechanism | Result | Status |
|---|---|---|---|
| Menu Registry DB | SQL `SELECT * FROM smriti_menus WHERE menu_id = 'menu-price-revision'` | Present at seq 135 | Done |
| Security Matrix | Python `CANONICAL_36_MENU_MATRIX["menu-price-revision"]` | Verified | Done |
| Frontend Shell & Tab | `TabRenderer.tsx` + `launchpadCatalog.ts` + `AppShell.tsx` | Verified | Done |
| TypeScript Types | `npx tsc --noEmit --skipLibCheck` | Exit code 0, 0 errors | Done |
| Vitest Unit Tests | `npx vitest run src/tests/priceRevisionStudio.test.ts src/tests/menuRegistryRouting.test.ts` | 9/9 passed | Done |
| Launchpad Registry | `node scripts/validate-launchpad-registry.mjs` | 52/52 tiles valid | Done |
| Backend Pytest | `.venv\Scripts\pytest.exe backend/tests/test_price_revisions.py` | 37/37 passed | Done |
| Live Data E2E | Live API queries to port 1981 with `COMP-001` auth | 190 records, 403 mismatch, 400 ceiling | Done |

## 10. Known Limitations
- Revision search in the UI queries the top 300 active/recent records for sub-millisecond filtering. For catalogs with tens of thousands of historical revisions, a backend-driven server-side search input will be added in a future enhancement.
- Bulk batch intake currently supports CSV and TSV formats up to 500 rows per batch.

## 11. Future Work
- Add export to Excel/PDF for historical price revision audit logs.
- Provide automated scheduled cron job runner in production for unattended batch activation of scheduled price revisions.

## 12. Related ADRs
- `ADR-0042`: Navigation Registry & Security Matrix Canonical Synchronization.
- `ADR-0089`: Temporal Price Revision & Statutory Ceiling Invariant Enforcement.

## 13. Related RFCs
- `RFC-2026-08`: Centralized Pricing & Promotion Engine Architecture.
- `RFC-2026-10`: Multi-Tenant Security & Tenant Trust Boundary Governance.
