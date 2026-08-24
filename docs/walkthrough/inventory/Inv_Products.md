<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.15.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Inventory & Products Migration to FastAPI & Postgres (v3.15.0)

## 1. Purpose
Migrated the Inventory/Products module (Tier 2 of strangler-fig migration) from memory-based caches (`db_store.json`) to the FastAPI + Postgres core backend. Retired legacy Node/Express-side products CRUD endpoints and mapping keys to establish Postgres as the single source of truth for inventory.

## 2. Scope
- Created PostgreSQL table `stock_movements` for database persistence.
- Implemented product update (PUT), soft delete (DELETE), secondary barcode management, and tenant-scoped stock ledger movements endpoints in FastAPI.
- Connected the legacy Express `recordStockMovement` helper to FastAPI over HTTP, preserving transactional integrity for unmigrated modules.
- Refactored frontend registry tabs (`ItemMasterTab`, `StockLedgerTab`, `BarcodeMappingSection`, `InventoryForecastWidget`, `App.tsx`) to pull/commit records via `apiFetchV1` to the FastAPI backend.
- Cleaned up Express route mapping controllers.

## 3. Files Created
- `backend/alembic/versions/94d408c3ba68_add_stock_movements_table.py`

## 4. Files Modified
- `backend/app/models/inventory.py`
- `backend/app/models/__init__.py`
- `backend/app/api/v1/inventory.py`
- `backend/app/schemas/inventory.py`
- `backend/alembic/env.py`
- `src/lib/helpers.ts`
- `src/state/store.ts`
- `src/routes/inventory.ts`
- `server.ts`
- `src/App.tsx`
- `src/components/ItemMasterTab.tsx`
- `src/components/StockLedgerTab.tsx`
- `src/components/BarcodeMappingSection.tsx`
- `src/components/InventoryForecastWidget.tsx`

## 5. Architecture Decisions
- **HTTP POST Proxying for Legacy Modules:** To resolve dual-writer database anomalies, the Express `recordStockMovement` helper issues HTTP POST queries to FastAPI's trusted `POST /api/v1/inventory/stock-movements` route. FastAPI remains the sole database writer.
- **Client-Side Transpilation:** Integrated property transformers mapping FastAPI's snake_case schema results to the camelCase variables expected by the frontend.

## 6. Design Rationale
- Removing schema-level default overrides in the `StockMovement` table prevents silent attribution to default/mock locations.
- Restricting table autogeneration in `env.py` protects existing database structures.

## 7. Implementation Summary
- **FastAPI Endpoints:**
  - `POST /api/v1/inventory/stock-movements`: Trusted endpoint (no JWT required) for ledger logs.
  - `GET /api/v1/inventory/ledger`: Tenant-scoped stock ledger retrieval.
  - `PUT /api/v1/inventory/{product_id}`: Update products.
  - `DELETE /api/v1/inventory/{product_id}`: Soft delete products (`is_deleted = True`).
- **Express Backend:**
  - Removed `products.ts` route file and imports in `server.ts`.
  - Discarded serialization properties in `store.ts`.

## 8. Tests Executed
- Executed full Vitest validation suite (`npx vitest run`). All 27 checks passed successfully.
- Ran type validation compilation (`npx tsc --noEmit`). Completed with 0 warnings/errors.
- Executed production bundle builder (`npm run build`). Built successfully.

## 9. Verification Results
- Database health status check:
  ```json
  {"status":"healthy","database":"connected","service":"operational"}
  ```
- Vitest results:
  ```text
  Test Files  4 passed (4)
        Tests  27 passed (27)
     Duration  7.19s
  ```

## 10. Known Limitations
None.

## 11. Future Work
- Proceed with Tier 3 of the strangler-fig migration (Auth module).

## 12. Related ADRs
- ADR-016: Strangler-Fig Migration to FastAPI + PostgreSQL.

## 13. Related RFCs
None.
