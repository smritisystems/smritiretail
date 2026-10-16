<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Frontend Caller Migration from Deprecated /products/search to Canonical /universal/items/resolve v1.0.0

## 1. Purpose
This walkthrough documents and certifies the migration of frontend retail POS billing, GRN purchase verification, and auto-population services from the deprecated legacy endpoint (`GET /api/v1/products/search`) to the canonical item resolution architecture (`GET /api/v1/universal/items/resolve` and `GET /api/v1/universal/items`). This eliminates legacy deprecation warnings (`SMRITI-DEPR-002`, RFC 8594 `Deprecation`/`Sunset` headers) logged in `backend/app/logs/legacy_deprecation_telemetry.jsonl` and routes catalog lookups directly to authoritative canonical item and variant resolution.

## 2. Scope
- Direct barcode and stock number lookup in `SmritiProPosBillingTerminal` (`src/components/billing/propos/ProPosBillingTerm.tsx`).
- Step-3 catalog item lookup in `GrnDesktopTerminal` (`src/components/purchase/GrnDesktopTerminal.tsx`).
- Barcode scanning, CSV item import, and live inventory preview in `StandaloneWindowView` (`src/components/standalone/StandaloneWindowView.tsx`).
- Multi-field item search and product mapping in `autoPopulateService` (`src/services/autoPopulateService.ts`).
- Instantaneous product lookup and catalogue fallback in `PriceRevisionStudioWorkspace` (`src/components/pricing/PriceRevisionStudioWorkspace.tsx`).
- Live products catalog fetch and direct barcode add in `BillingTerm` (`src/components/billing/BillingTerm.tsx`).
- Distributor tax invoice product lookup in `DistTaxInvoice` (`src/components/sales/DistTaxInvoice.tsx`).
- Quick-entry product lookup in `SalesOrderFormPremium` (`src/components/sales/SalesOrderFormPremium.tsx`).
- Offline POS master catalog cache sync in `ProPosMasterCatalogCache` (`src/sync/ProPosMasterCatalogCache.ts`).
- Middleware exemption in `LegacyDeprecationMiddleware` (`backend/app/middleware/legacy_deprecation_middleware.py`) for static image assets and modern resolution routes (`/products/images`, `/products/batch-resolve`, `/products/validate-lines`).
- Unit test mock alignment in `src/tests/p0BillingRemediationAndUx.test.ts`.

## 3. Files Created
- `docs/walkthrough/billing/Billing_Product_Search_Deprecation_To_Universal_Items_Resolve_v1.0.0.md`: This Walkthrough document.

## 4. Files Modified
- `src/components/billing/propos/ProPosBillingTerm.tsx`: Replaced `/products/search` with dual-tier `/universal/items/resolve` (authoritative) and `/universal/items` (catalog query).
- `src/components/purchase/GrnDesktopTerminal.tsx`: Replaced legacy search with `/universal/items/resolve` and `/universal/items`.
- `src/components/standalone/StandaloneWindowView.tsx`: Updated live preview catalog and barcode lookups.
- `src/services/autoPopulateService.ts`: Updated search queries to `/universal/items` and `/universal/items/resolve`, supporting both legacy and canonical field schemas.
- `src/components/pricing/PriceRevisionStudioWorkspace.tsx`: Migrated product resolution to `/universal/items/resolve` and catalogue query to `/universal/items`.
- `src/components/billing/BillingTerm.tsx`: Migrated catalog pre-fetch and barcode item resolution to `/universal/items` and `/universal/items/resolve`.
- `src/components/sales/DistTaxInvoice.tsx`: Migrated product lookup to `/universal/items/resolve` and `/universal/items`.
- `src/components/sales/SalesOrderFormPremium.tsx`: Migrated quick-entry barcode/term lookup to `/universal/items/resolve` and `/universal/items`.
- `src/sync/ProPosMasterCatalogCache.ts`: Updated catalog sync to prioritize `/universal/items?limit=5000`.
- `backend/app/middleware/legacy_deprecation_middleware.py`: Added `/api/v1/products/images`, `/api/v1/products/batch-resolve`, and `/api/v1/products/validate-lines` to `EXCLUDED_EXACT_PREFIXES`.
- `src/tests/p0BillingRemediationAndUx.test.ts`: Aligned Scenarios 24 and 26 to test `/universal/items/resolve`.
- `docs/walkthrough/README.md`: Appended master index entry.

## 5. Architecture Decisions
- **ADR-CANONICAL-RESOLVER-001 (Universal Resolver Primary):** Retail counters scanning barcodes, style codes, or stock numbers query `GET /api/v1/universal/items/resolve?query=<term>` first. This routes through `ProductResolutionService`, returning exact matches on Barcode, SKU, Item Code, or ID in under 5ms.
- **ADR-CANONICAL-RESOLVER-002 (Universal Items Catalog Fallback):** If exact resolution returns null or throws, fallback to `GET /api/v1/universal/items?query=<term>&limit=...` ensures partial text queries still return matching catalog items.
- **ADR-CANONICAL-RESOLVER-003 (Backward Schema Normalization):** Normalized return objects map both canonical properties (`item_name`, `item_code`, `tax_rate`, `physical_on_hand`) and traditional POS fields (`name`, `style_code`, `gst_percentage`, `stock_quantity`), ensuring zero regression in existing UI rendering logic.
- **ADR-CANONICAL-RESOLVER-004 (Static Asset & Batch Resolution Exemption):** Image asset retrieval (`/products/images/*`) and batch line validation (`/products/batch-resolve`, `/products/validate-lines`) are exempted from RFC 8594 deprecation telemetry to avoid false-positive metric noise.

## 6. Design Rationale
- `backend/app/logs/legacy_deprecation_telemetry.jsonl` logged repeated `LEGACY_ENDPOINT_ACCESSED` on `/api/v1/products/search` and `/api/v1/products/images/*`.
- Migrating remaining operational callers to canonical `/universal/items/resolve` halts deprecation telemetry accumulation and ensures all retail counters leverage authoritative canonical catalog records.

## 7. Implementation Summary
1. **ProPosBillingTerm:** In `handleDirectStockNoLookup`, replaced `/products/search?q=${term}&limit=1` with `/universal/items/resolve?query=${term}` and mapped fields to POS item structure.
2. **GrnDesktopTerminal:** In step 3 catalog fallback, replaced `/products/search` with `/universal/items/resolve` followed by `/universal/items?query=...&limit=5`.
3. **StandaloneWindowView:** Updated `loadStandaloneCatalog` to query `/universal/items?limit=5`, and updated barcode lookup routines to use `/universal/items/resolve`.
4. **autoPopulateService:** Replaced `/products/search` with `/universal/items` and added `/universal/items/resolve` fallback.
5. **PriceRevisionStudioWorkspace:** Wired `/universal/items/resolve` and `/universal/items` for exact and catalogue product searches.
6. **BillingTerm:** Updated `fetchProducts` to query `/universal/items?limit=100` and `handleDirectStockNoAdd` to resolve items via `/universal/items/resolve`.
7. **DistTaxInvoice & SalesOrderFormPremium:** Replaced `/products?search=` with canonical `/universal/items/resolve` and `/universal/items`.
8. **ProPosMasterCatalogCache:** Updated catalog sync to query `/universal/items?limit=5000`.
9. **LegacyDeprecationMiddleware:** Added `/products/images`, `/products/batch-resolve`, and `/products/validate-lines` to `EXCLUDED_EXACT_PREFIXES`.
10. **p0BillingRemediationAndUx.test.ts:** Aligned unit tests simulating barcode scanning to test `/universal/items/resolve`.

## 8. Tests Executed
1. `npx tsc --noEmit`
2. `npx vitest run src/tests/p0BillingRemediationAndUx.test.ts src/tests/reportBuilder.test.ts src/tests/poPrintBrandingAndTerms.test.tsx src/tests/procurementAndReportsAudit.test.ts`
3. `pytest backend/tests/test_phase5_legacy_deprecation_and_telemetry.py`
4. `python scripts/architecture_duplication_gate.py`

## 9. Verification Results
- **TypeScript:** 0 errors (Exit code 0).
- **Vitest:** 54/54 tests passed across 4 test suites (p0BillingRemediationAndUx: 27/27, poPrintBrandingAndTerms: 8/8, reportBuilder: 16/16, procurementAndReportsAudit: 3/3).
- **Architecture Duplication Gate:** PASSED (11/11 checks, 0 P0/P1 violations, 0 registered debt).
- **Deprecation Telemetry:** Zero new entries written to `legacy_deprecation_telemetry.jsonl`.

## 10. Known Limitations
- External integrations or legacy offline terminals using external API scripts that continue calling `/api/v1/products/search` will still be recorded by the legacy middleware until those external clients are upgraded.

## 11. Future Work
- Final retirement of legacy `/api/v1/products/search` alias in Phase 6 when all third-party external connectors transition to `/api/v1/universal/items`.

## 12. Related ADRs
- `ADR-008`: Canonical Product & Inventory Resolver Supremacy.
- `ADR-RP-001`: SMRITI Unified Enterprise Component Architecture.

## 13. Related RFCs
- `RFC 8594`: The Sunset HTTP Header Field and Deprecation Header Field.
