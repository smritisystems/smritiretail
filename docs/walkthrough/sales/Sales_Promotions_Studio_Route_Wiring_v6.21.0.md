<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.21.0
  Created      : 2026-09-14
  Modified     : 2026-09-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Sales Promotions Studio End-to-End Route Wiring & PostgreSQL Synchronisation

**Version:** 6.21.0  
**Date:** 2026-09-14  
**Area:** Sales & POS / Commercial Growth Engine  
**Topic:** Sales Promotions Studio Route Wiring & Scheme Sync API  
**Status:** Completed

---

## 1. Purpose
This implementation eliminates the routing and navigation disconnect between the Sales Promotions route, the Control-Plane menu resolution hierarchy, the POS billing terminal modals, and the standalone `SmritiSalesPromotionsStudio` screen. It also implements the missing `/api/v1/promotions/schemes` FastAPI backend endpoints, establishing two-way persistence between local client storage and PostgreSQL tables (`promotion_campaigns` and `promotion_rules`).

---

## 2. Scope
- Control-Plane Menu Matrix expansion (`CANONICAL_36_MENU_MATRIX` to include `menu-sales-promotions`).
- Database seeding via Alembic migration `v1453_seed_sales_promotions_menu.py` into `smritisys.smriti_menus` and `smriti_legacy_menu_map`.
- Centralized Layout Store registration in `src/layout_engine/layout_store.tsx` (`registeredWorkspaces`).
- Frontend navigation mapping in `src/App.tsx` (`mapModuleId` mapping `"menu-sales-promotions"`).
- POS and F6 modal bridging: Direct "Studio Workspace" buttons inside `SmritiDefineSalesPromotionsModal.tsx` and `SmritiF6PromotionalDiscountsModal.tsx` dispatching `smriti_navigate_module`.
- FastAPI backend endpoints: `GET /api/v1/promotions/schemes`, `POST /api/v1/promotions/schemes`, and `DELETE /api/v1/promotions/schemes/{id}` in `backend/app/api/v1/promotions.py`.

---

## 3. Files Created
- [`backend/alembic/versions/v1453_seed_sales_promotions_menu.py`](file:///f:/SMRITRretailNX/backend/alembic/versions/v1453_seed_sales_promotions_menu.py): Alembic migration seeding `menu-sales-promotions` into `smriti_menus` and mapping Shoper 9 option `600/608`.
- [`backend/tests/test_promotions_schemes_api.py`](file:///f:/SMRITRretailNX/backend/tests/test_promotions_schemes_api.py): Integration test suite verifying GET, POST, and DELETE for `/api/v1/promotions/schemes`.
- [`docs/walkthrough/sales/Sales_Promotions_Studio_Route_Wiring_v6.21.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/sales/Sales_Promotions_Studio_Route_Wiring_v6.21.0.md): This walkthrough document.

---

## 4. Files Modified
- [`backend/app/core/security_matrix.py`](file:///f:/SMRITRretailNX/backend/app/core/security_matrix.py): Registered `menu-sales-promotions` under `menu-pos` with permission `PROMOTIONS.WORKSPACE.ACCESS` and updated `CASHIER_DEFAULT_VIEW_ALLOWLIST`.
- [`backend/app/api/v1/promotions.py`](file:///f:/SMRITRretailNX/backend/app/api/v1/promotions.py): Added `GET`, `POST`, and `DELETE` endpoints for `/schemes` mapping `PromotionCampaign` and `PromotionRule`.
- [`src/App.tsx`](file:///f:/SMRITRretailNX/src/App.tsx): Added `"menu-sales-promotions": "sales-promotions"` to `mapModuleId`.
- [`src/layout_engine/layout_store.tsx`](file:///f:/SMRITRretailNX/src/layout_engine/layout_store.tsx): Added `sales-promotions` workspace definition to initial `registeredWorkspaces`.
- [`src/components/billing/SmritiDefineSalesPromotionsModal.tsx`](file:///f:/SMRITRretailNX/src/components/billing/SmritiDefineSalesPromotionsModal.tsx): Added "Full Studio Workspace" navigation button.
- [`src/components/billing/SmritiF6PromotionalDiscountsModal.tsx`](file:///f:/SMRITRretailNX/src/components/billing/SmritiF6PromotionalDiscountsModal.tsx): Added "Studio Workspace" navigation button.
- [`CHANGELOG.md`](file:///f:/SMRITRretailNX/CHANGELOG.md): Documented version 6.21.0 release notes.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md): Appended walkthrough index.

---

## 5. Architecture Decisions
1. **Harmonized 37-Menu Canonical Contract:** Added `menu-sales-promotions` as a first-class child of `menu-pos` in `CANONICAL_36_MENU_MATRIX`. This ensures `GET /api/v1/menus/resolved` emits the item, preventing the layout engine from dropping the Promotions Studio from `registeredWorkspaces`.
2. **Synchronous Local POS Cache + Asynchronous DB Flush:** In `SmritiSalesPromotionService`, retail operations continue uninterrupted at sub-millisecond speeds using `localStorage`, while the backend `/schemes` endpoints guarantee multi-store and server-side persistence.
3. **Decoupled POS Modal vs. Full Studio Screen:** Kept `SmritiDefineSalesPromotionsModal` for rapid in-checkout adjustments while providing 1-click seamless transition to `SmritiSalesPromotionsStudio` via `smriti_navigate_module` event dispatch.

---

## 6. Design Rationale
Retail cashiers at checkout counters need lightweight, modal-based promotion toggles (F6 and Alt+P) that do not disrupt the active sale. Store managers and merchandisers, however, require the full visual rule wizard, natural language rule sentences, and cart sandbox simulator provided by `SmritiSalesPromotionsStudio`. Providing deep links and event-driven navigation between both satisfies both operational workflows.

---

## 7. Implementation Summary
- **Control Plane & Security:** Extended `CANONICAL_36_MENU_MATRIX` to map `menu-sales-promotions` -> `promotions_studio`.
- **Database Migration:** Applied `v1453` to `smritisys` and `smriti001`.
- **FastAPI Endpoints:** Created REST handlers for `/api/v1/promotions/schemes` translating statutory scheme DTOs into `PromotionCampaign` and `PromotionRule` entities.
- **Frontend Bridging:** Added navigation buttons to both POS modals (`Alt+P` and `F6`) and updated `mapModuleId` in `App.tsx`.

---

## 8. Tests Executed
1. **Backend Integration Tests:**
   ```powershell
   $env:JWT_SECRET_KEY="..."; pytest backend/tests/test_promotions_schemes_api.py -v
   ```
   *Result:* 1 passed in 16.63s.
2. **Frontend Vitest Suites:**
   ```powershell
   npx vitest run src/tests/smritiSalesPromotionsStudio.test.ts src/tests/smritiSalesPromotionEngine.test.ts
   ```
   *Result:* 2 passed, 26 passed in 968ms.
3. **TypeScript Typecheck:**
   ```powershell
   npx tsc --noEmit
   ```
   *Result:* 0 errors.

---

## 9. Verification Results
- `GET /api/v1/promotions/schemes`: 200 OK.
- `POST /api/v1/promotions/schemes`: 200 OK, persists and returns scheme DTO.
- `DELETE /api/v1/promotions/schemes/{id}`: 200 OK, confirms removal.
- `smriti_menus` in `smritisys`: Confirmed presence of `menu-sales-promotions` row with parent `menu-pos`.

---

## 10. Known Limitations
- Deleting a promotion scheme completely removes the campaign and cascades to rules; historical redemption records preserve snapshots independently.

---

## 11. Future Work
- Scheduled promotional campaign activation worker via Redis / Celery / PG_CRON for time-bound promotions.

---

## 12. Related ADRs
- `ADR-0036`: Control Plane Centralized Menu Resolution & Security Matrix.
- `ADR-0044`: Commercial Growth Engine & Unified Promotion Evaluation.

---

## 13. Related RFCs
- `RFC-0082`: Human-First Sales Promotions Visual Rule Studio & Cart Sandbox.
