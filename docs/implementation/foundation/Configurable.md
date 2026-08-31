<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Configurable Unique Attributes & Variants with Direct Excel / Product / Brand Master Entry

## 1. Objective
Provide a configurable, multi-dimensional attribute and variant management engine supporting cross-attribute uniqueness validation and dual entry workflows (Direct Excel Grid Entry vs Product Master/Brand Master).

## 2. Business Motivation
Retail businesses across apparel, footwear, pharma, and hardware need fast matrix item creation. Mandatory pre-creation of Brands, Categories, and Attributes in separate admin screens creates friction. Allowing inline registration directly inside the Excel Grid Entry or Product Master accelerates inventory setup while preventing duplicate SKUs/barcodes.

## 3. Scope
- Backend APIs: `backend/app/api/v1/attributes.py` (`/quick-register`, `/verify-uniqueness`)
- Frontend Components: `ExcelGridEntrySec.tsx`, `ItemMasterTab.tsx`, `AttrManagerSec.tsx`
- Types: `src/types.ts`

## 4. Current State
System has basic `AttributeDefinition`, `AttributeGroup`, `VariantTemplate`, and static `ExcelGridEntrySec.tsx`.

## 5. Gap Analysis
- Lacks inline auto-registration for missing Brands/Categories/Attributes during Excel or Product Master entry.
- Real-time cross-attribute and SKU/barcode uniqueness verification before saving is missing.

## 6. Architecture Impact
- Extends FastAPI `attributes.py` router with 2 new endpoints.
- Extends frontend components with 1-click Quick Register drawer and real-time uniqueness validation hooks.

## 7. Proposed Design
- **Option A (Direct Excel Grid)**: Users type matrix data. Unrecognized Brands/Categories trigger a 1-click Quick-Register drawer.
- **Option B (Product/Brand Master)**: Structured form entry in `ItemMasterTab.tsx` with dynamic attribute inputs and inline Brand Master registration.
- **Uniqueness Guard**: Backend validates tenant-wide uniqueness on SKUs, barcodes, and specified attribute combinations.

## 8. Files Created
- `docs/implementation/foundation/Configurable.md`

## 9. Files Modified
- `backend/app/api/v1/attributes.py`
- `backend/app/services/attributes.py`
- `src/types.ts`
- `src/components/ExcelGridEntrySec.tsx`
- `src/components/AttrManagerSec.tsx`
- `src/components/ItemMasterTab.tsx`

## 10. Dependencies
FastAPI, PostgreSQL JSONB GIN index, React 18, Vite.

## 11. Risks
None. Fully backward compatible.

## 12. Rollback Strategy
Revert modified files via `git checkout`.

## 13. Verification Plan
- Unit tests via `pytest` and `vitest`.
- Type checking via `npx tsc --noEmit`.
- Build verification via `npm run build`.

## 14. Test Plan
- Run `pytest backend/app/tests/test_attributes.py`
- Run `npx tsc --noEmit`
- Run `npm run build`

## 15. Documentation Impact
Update User Guide, Developer Guide, and create Walkthrough upon implementation.

## 16. Deployment Plan
Standard FastAPI reload and Vite production build.

## 17. Status
Draft (Awaiting User Review)

## 18. Related ADRs
ADR-014 (Postgres Transactional System-of-Record)

## 19. Related Walkthroughs
`docs/walkthrough/foundation/Attribute_Manager_v1.0.md`
