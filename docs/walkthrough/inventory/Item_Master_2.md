<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.23.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Pricing Fields Validation & Invariant Constraints

## 1. Purpose
Enforce strict mathematical validation and integrity invariants on all pricing fields (**Buying Price**, **Cost Price**, **Selling Price**, **MRP**) across frontend UI (Grid View & Classic View), backend Pydantic schemas, database models, and service layers for standard stock/inventory items, with conditional exemptions for non-stock, service, promotional, and sample items.

## 2. Scope
- Pricing Invariants:
  1. Buying Price > 0 (Mandatory for stock items).
  2. Cost Price > 0 (Mandatory for stock items).
  3. Selling Price >= 0 (Mandatory for stock items).
  4. MRP >= Selling Price (`mrp >= price`).
  5. Cost Price <= Buying Price (`cost_price <= buying_price`).
  6. Rejection of null, blank, whitespace-only, zero (for BP & CP), negative, and invalid numeric values.
  7. Conditional Exemptions for non-stock items, services, samples, and free promotional items (`tracking_mode == "No-stock"` or `pricing_mode == "Free"`).
- Frontend UI Components: `src/components/itemMaster/ItemDetGrid.tsx`, `src/components/itemMaster/ItemMasterEntryVie.tsx`, `src/components/itemMaster/types.ts`, `src/services/unifiedFieldCatalog.ts`.
- Backend Schema & Service Layer: `backend/app/schemas/inventory.py`, `backend/app/models/inventory.py`, `backend/app/models/item_master.py`, `backend/app/services/item_master_service.py`.
- Database Migration: `backend/scripts/migr_pricing.py` across `smritisys`, `smriti001`, `smriti002`.
- Automated Test Suite: `backend/tests/t_item_val.py`.

## 3. Files Created
- `backend/scripts/migr_pricing.py` — Database migration script applying `buying_price` column and safe backfills.
- `docs/walkthrough/inventory/Item_Master_2.md` — This walkthrough document.

## 4. Files Modified
- `backend/app/models/inventory.py` — Added `buying_price = Column(Numeric(15, 2))` on `Product`.
- `backend/app/models/item_master.py` — Added `buying_price = Column(Numeric(15, 2), nullable=True)` on `Item`.
- `backend/app/schemas/inventory.py` — Added `buying_price`, numeric validators, and `@model_validator` enforcing pricing hierarchy on `ProductBase` and `ProductUpdate`.
- `backend/app/services/item_master_service.py` — Updated `create_item` with `buying_price`.
- `src/services/unifiedFieldCatalog.ts` — Added `buyingPrice` (`required: true`) and updated `costPrice` to `required: true`.
- `src/components/itemMaster/types.ts` — Included `buyingPrice` and `costPrice` in `DEFAULT_MANDATORY_FIELDS`.
- `src/components/itemMaster/ItemDetGrid.tsx` — Implemented pricing relationship validation, cell error tooltips, Classic View pricing fields and alerts, and blocked save on price violations.
- `src/components/itemMaster/ItemMasterEntryVie.tsx` — Enforced pricing hierarchy in `executeCommitItems`.
- `backend/tests/t_item_val.py` — Expanded unit and integration tests to 43 passing tests.
- `docs/walkthrough/README.md` — Appended master walkthrough index.

## 5. Architecture Decisions
1. **Commercial Pricing Hierarchy**:
   - Stock items require valid procurement economics before being indexed into the system (`Buying Price >= Cost Price > 0` and `MRP >= Selling Price >= 0`).
2. **Conditional Exemption for Services & Samples**:
   - Items with `tracking_mode == "No-stock"` or `category in ["Services", "Samples", "Promotional"]` or `pricing_mode == "Free"` are exempt from mandatory purchase pricing and can have 0.00 or null values.
3. **Database Schema & Backfill Strategy**:
   - Added `buying_price` column to `products` and `items` across all tenant databases, backfilling legacy NULLs and resolving any legacy price inversions.

## 6. Design Rationale
- Allowing `Cost Price > Buying Price` or `MRP < Selling Price` corrupts margins, discounts, POS receipts, and tax calculations.
- Enforcing these constraints at both UI and Pydantic layers prevents erroneous manual entries and malformed API payloads from ever reaching the database.

## 7. Implementation Summary
- Grid View: Table headers indicate mandatory status (`Buying Price*`, `Cost Price*`), invalid inputs display red cell borders and relationship warning tooltips, and save handlers reject invalid price records.
- Classic View: Field inputs for Buying Price, Cost Price, Selling Price, and MRP display dedicated inline validation messages and comparison alerts.
- Backend Pydantic: `@model_validator(mode="after")` validates all price conditions and string conversions.
- Database: Successfully added `buying_price` and validated tenant data planes.

## 8. Tests Executed
- `pytest backend/tests/t_item_val.py backend/tests/t_univ_item.py -v` (43/43 passed in 13.22s).
- `npm run build` (Vite production build completed with 0 errors in 26.36s).

## 9. Verification Results
- 43/43 tests passed green.
- 0 TypeScript compilation errors in production build.
- 0 database nulls or price inversions across `smritisys`, `smriti001`, `smriti002`.

## 10. Known Limitations
- None.

## 11. Future Work
- Add multi-currency price conversions when international vendor purchase orders are introduced.

## 12. Related ADRs
- `docs/architecture/ADR_008_FastAPI_Postgres_Single_Backend.md`
- `docs/architecture/ADR_014_Multi_Database_Multi_Tenant_Architecture.md`

## 13. Related RFCs
- `docs/rfc/RFC_009_Universal_Item_Master_Harmonization.md`
