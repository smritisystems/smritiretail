<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.0.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Product Image Framework (SPIF) v1.0

## 1. Objective
Implement the SMRITI Product Image Framework (SPIF) v1.0: a centralized service, database model, API suite, and reusable UI components that handle primary product images, multiple gallery media assets, responsive display configurations, and offline caching across all transaction and inventory consoles.

## 2. Business Motivation
Align SMRITI Retail OS with enterprise standards (matching SAP, Dynamics, NetSuite). Displaying item images during checkout, physical verification, and order entry directly reduces operator selection errors, speeds up processing time, and enhances overall usability.

## 3. Scope
- **Data Models:** Add database columns for primary images, galleries, and barcodes/QR mapping to the PostgreSQL schema and TypeScript types.
- **REST APIs:** Develop FastAPI endpoints for image upload, optimization (WEBP format), local storage, and retrieval.
- **Offline / Caching:** Integrate Cache Storage API to store image blobs locally for offline-first resilience.
- **UI Components:** Create a reusable `<ProductImage />` component with thumbnail, preview panel, gallery carousel, and hover-to-zoom support.
- **Display Policies:** Allow configurable display toggles (e.g. POS: Medium, Purchase Order: Small, Reports: None) at the user/company settings level.
- **Transactions Integration:** Integrate images in POS billing, Sales Orders, Purchase Orders, and Stock Ledgers.

## 4. Current State
Products in SMRITI currently lack image fields. Core transaction screens (POS, Sales, Purchase) display only SKU, name, code, barcode, stock, and pricing parameters.

## 5. Gap Analysis
- No image storage metadata or path definition in the database models.
- No media upload/optimization endpoints on the backend API.
- No standardized React image component to ensure clean, lazy-loaded, offline-compatible image rendering.
- No transactional layout configurations to toggle images on/off per screen density.

## 6. Architecture Impact
SPIF adheres to SMRITI PAL inward dependency rules. The image upload service handles file verification and standardizes formats (converting JPG/PNG to Optimized WEBP).
```text
UI Grids (POS, Sales, etc.) ──> Reusable <ProductImage /> Component
                                         │ (Uses Cache Storage offline fallback)
                                         ▼
                                  FastAPI SPIF API
                                         │ (Writes metadata to Postgres)
                                         ▼
                                  PostgreSQL Database
```

## 7. Proposed Design

### A. Database Model Additions
Modify the `products` SQL table to include:
- `primary_image_url`: `VARCHAR(512)`
- `gallery_images`: `JSONB` (Stores array of objects: `{ url: string, is_variant: boolean, color?: string }`)

### B. Reusable React Component: `<ProductImage />`
Located at `src/components/common/ProductImage.tsx`:
- Props: `productId: string, imageUrl: string, size: 'small' | 'medium' | 'large' | 'original', hoverZoom: boolean`
- Implementation details: Uses browser's native lazy loading (`loading="lazy"`) and has an `onError` fallback to a clean placeholder. Falls back to Service Worker cache offline.

### C. Offline Caching
Integrated inside service workers / local caching layers using Cache Storage:
```javascript
caches.open('spif-images-v1').then(cache => cache.add(imageUrl))
```

### D. Settings Policy
Store transaction specific preferences in the configuration payload:
```typescript
export interface ImageDisplaySettings {
  posBilling: { enabled: boolean; size: 'medium'; hover: boolean };
  salesOrder: { enabled: boolean; size: 'small'; hover: boolean };
  purchaseOrder: { enabled: boolean; size: 'small'; hover: boolean };
  stockEntry: { enabled: boolean; size: 'small'; hover: boolean };
}
```

## 8. Files Created
- `backend/app/services/spif.py` (Backend upload, optimization, and crop handler)
- `src/components/common/ProductImage.tsx` (Decoupled image component)
- `src/components/common/ImageDisplayPolicyModal.tsx` (Settings config panel)

## 9. Files Modified
- `src/types.ts` (Extend `Product` with `primaryImageUrl` and `galleryImages`)
- `backend/app/models/inventory.py` (Add SQLAlchemy columns)
- `backend/app/schemas/inventory.py` (Extend Pydantic Product models)
- `backend/app/api/v1/inventory.py` (Add upload and delete image endpoints)
- `src/components/ItemMasterTab.tsx` (Add upload and media manager fields)
- `src/components/SalesStudioTab.tsx` (Render thumbnails inside sales list)
- `src/components/PurchaseStudioTab.tsx` (Render thumbnails in purchase list)

## 10. Dependencies
- **Pillow** (Python image processing library for optimization and WEBP generation)
- **FastAPI / python-multipart** (For multipart/form-data upload streams)

## 11. Risks
- Large unoptimized images degrades performance. **Mitigation:** Server-side auto-resizing and conversion to WebP format.
- Database size bloat. **Mitigation:** Keep images in disk storage (e.g. `/static/uploads/`) and save only URL paths in PostgreSQL.

## 12. Rollback Strategy
Remove the newly created SPIF endpoints, drop the newly added columns via Alembic migration scripts, and revert UI changes.

## 13. Verification Plan
- Verify image upload formats (JPG, PNG, WEBP, SVG) via API test suites.
- Verify image files size optimization constraints.
- Confirm UI rendering checks in POS billing grids under mock network offline states.

## 14. Test Plan
Write unit tests under `backend/app/tests/test_spif.py` and `src/tests/spif.test.ts` to exercise metadata validation.

## 15. Documentation Impact
Update Wiki architecture guide and add a section in the User Manual for image management.

## 16. Deployment Plan
Add Alembic migrations for DB column updates, deploy updated API, and launch updated SPA bundles.

## 17. Status
Completed

## 18. Related ADRs
None.

## 19. Related Walkthroughs
* [Foundation_SPIF_v1.0_Walkthrough](../walkthrough/foundation/Foundation_SPIF_v1.0_Walkthrough.md)
