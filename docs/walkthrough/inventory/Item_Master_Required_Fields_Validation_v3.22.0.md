<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Required Fields & Strict Non-Blank Validation

## 1. Purpose
Enforce strict validation across frontend UI (Grid View & Classic View), backend Pydantic schemas, database models, and service layers so that all 7 required core fields cannot be left blank, empty, or whitespace-only, preventing data corruption and guaranteeing catalog data integrity.

## 2. Scope
- Frontend Catalog Definitions: `src/services/unifiedFieldCatalog.ts` and `src/components/itemMaster/types.ts`.
- Frontend UI Components: `src/components/itemMaster/SmritiItemDetailsGrid.tsx` and `src/components/itemMaster/ItemMasterEntryView.tsx`.
- Backend Pydantic Schemas: `backend/app/schemas/inventory.py` (`ProductBase`, `ProductCreate`, `ProductUpdate`).
- Backend Service Layer: `backend/app/services/item_master_service.py` and `backend/app/services/inventory.py`.
- Database Migration: Safe legacy NULL backfill and `NOT NULL` constraints on `mrp`, `gst_percentage`, `hsn_code` across tenant databases (`smritisys`, `smriti001`, `smriti002`).
- Automated Test Suites: `backend/tests/test_item_master_required_validation.py`.

## 3. Files Created
- `backend/scripts/migrate_item_master_not_null.py` — Database migration script applying `NOT NULL` and defaults.
- `backend/tests/test_item_master_required_validation.py` — 31 test cases verifying blank, whitespace, invalid numeric, duplicate SKU/barcode, and valid records.
- `docs/walkthrough/inventory/Item_Master_Required_Fields_Validation_v3.22.0.md` — This walkthrough document.

## 4. Files Modified
- `src/services/unifiedFieldCatalog.ts` — Updated `sellingPrice`, `productTax`, `hsnCode` to `required: true`.
- `src/components/itemMaster/types.ts` — Marked all 7 core fields as `isMandatory: true` in `DEFAULT_MANDATORY_FIELDS` and `ALL_AVAILABLE_ITEM_FIELDS`.
- `src/components/itemMaster/SmritiItemDetailsGrid.tsx` — Added red asterisks to required headers, error cell styling, Classic View inline validation messages, string trimming, and blocked save on empty/whitespace rows.
- `src/components/itemMaster/ItemMasterEntryView.tsx` — Enforced non-blank validation before API submission in `executeCommitItems`.
- `backend/app/schemas/inventory.py` — Implemented `@field_validator` on `ProductBase` and `ProductUpdate` for non-blank string trimming and required positive numerics.
- `backend/app/services/item_master_service.py` — Provided default `hsn_code: str = "64041990"` on `UniversalItemMasterService.create_item`.
- `backend/tests/test_universal_item_master.py` — Updated fixture to clean targeted test codes.
- `docs/walkthrough/README.md` — Appended master walkthrough index.

## 5. Architecture Decisions
1. **7 Core Required Fields Specification:**
   - Stock No / SKU (`code` / `sku`)
   - Barcode (`barcode`)
   - Product Name / Title (`name`)
   - MRP (`mrp`)
   - Selling Price (`price` / `sellingPrice`)
   - GST Tax Rate (`gst_percentage` / `tax_rate`)
   - HSN Code (`hsn_code`)
2. **String Trimming Before Validation:** All input values are sanitized with `.strip()` / `.trim()` on both frontend and backend before validation checks.
3. **Database NOT NULL Safety:** Legacy NULL values in `smriti001` (149 rows for `mrp`, 184 rows for `hsn_code`) were backfilled (`COALESCE(mrp, price, 0.00)`, `COALESCE(hsn_code, '64041990')`) before setting `NOT NULL` column constraints.

## 6. Design Rationale
- Allowing blank, empty, or whitespace-only SKU, barcode, price, tax rate, or HSN code leads to severe downstream compliance failures during E-Invoice, E-Way Bill generation, GST filing, and point-of-sale checkout.
- Enforcing non-blank rules symmetrically across UI and Pydantic prevents API bypass while providing clear visual feedback in the UI.

## 7. Implementation Summary
- Marked required columns with red `*` indicators in Grid table headers and Classic View form labels.
- Added real-time red outline highlight and tooltip messages on invalid grid cells.
- Displayed explicit inline error messages beneath missing fields in Classic View.
- Updated Pydantic validators on `ProductBase` and `ProductUpdate` to reject empty/whitespace strings and null/negative numbers.
- Verified database constraints in PostgreSQL with `information_schema.columns` showing `is_nullable = 'NO'`.

## 8. Tests Executed
- `pytest backend/tests/test_item_master_required_validation.py backend/tests/test_universal_item_master.py -v` (34/34 passed).
- `npm run build` (Vite production build completed with 0 errors).

## 9. Verification Results
- 34/34 tests passed green in 17.50s.
- 0 TypeScript compilation errors in production build.
- 0 database NULLs across `products` table in `smritisys`, `smriti001`, `smriti002`.

## 10. Known Limitations
- Optional custom attributes (A1..A9), brand, style code, and primary image filename remain optional as intended.

## 11. Future Work
- Add bulk CSV import validator adhering to the exact 7 required non-blank rules.

## 12. Related ADRs
- `docs/architecture/ADR_008_FastAPI_Postgres_Single_Backend.md`
- `docs/architecture/ADR_014_Multi_Database_Multi_Tenant_Architecture.md`

## 13. Related RFCs
- `docs/rfc/RFC_009_Universal_Item_Master_Harmonization.md`
