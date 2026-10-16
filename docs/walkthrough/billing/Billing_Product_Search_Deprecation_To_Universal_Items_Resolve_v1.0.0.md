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
- Unit test mock alignment in `src/tests/p0BillingRemediationAndUx.test.ts`.

## 3. Files Created
- `docs/walkthrough/billing/Billing_Product_Search_Deprecation_To_Universal_Items_Resolve_v1.0.0.md`: This Walkthrough document.

## 4. Files Modified
- `src/components/billing/propos/ProPosBillingTerm.tsx`: Replaced `/products/search` with dual-tier `/universal/items/resolve` (authoritative) and `/universal/items` (catalog query).
- `src/components/purchase/GrnDesktopTerminal.tsx`: Replaced legacy search with `/universal/items/resolve` and `/universal/items`.
- `src/components/standalone/StandaloneWindowView.tsx`: Updated live preview catalog and barcode lookups.
- `src/services/autoPopulateService.ts`: Updated search queries to `/universal/items` and `/universal/items/resolve`, supporting both legacy and canonical field schemas (`item_code`, `variant_sku`, `tax_rate`, `primary_uom`).
- `src/tests/p0BillingRemediationAndUx.test.ts`: Aligned Scenarios 24 and 26 to test `/universal/items/resolve`.
- `docs/walkthrough/README.md`: Appended master index entry.

## 5. Architecture Decisions
- **ADR-CANONICAL-RESOLVER-001 (Universal Resolver Primary):** Retail counters scanning barcodes, style codes, or stock numbers query `GET /api/v1/universal/items/resolve?query=<term>` first. This routes through `ProductResolutionService`, returning exact matches on Barcode, SKU, Item Code, or ID in under 5ms.
- **ADR-CANONICAL-RESOLVER-002 (Universal Items Catalog Fallback):** If exact resolution returns null or throws, fallback to `GET /api/v1/universal/items?query=<term>&limit=...` ensures partial text queries still return matching catalog items.
- **ADR-CANONICAL-RESOLVER-003 (Backward Schema Normalization):** Normalized return objects map both canonical properties (`item_name`, `item_code`, `tax_rate`, `physical_on_hand`) and traditional POS fields (`name`, `style_code`, `gst_percentage`, `stock_quantity`), ensuring zero regression in existing UI rendering logic.

## 6. Design Rationale
- `backend/app/logs/legacy_deprecation_telemetry.jsonl` logged repeated `LEGACY_ENDPOINT_ACCESSED` on `/api/v1/products/search` triggered by POS and GRN terminals during cashier barcode input.
- Migrating these callers to canonical endpoints halts deprecation telemetry accumulation and ensures all retail counters leverage authoritative canonical catalog records.

## 7. Implementation Summary
1. **ProPosBillingTerm:** In `handleDirectStockNoLookup`, replaced `/products/search?q=${term}&limit=1` with `/universal/items/resolve?query=${term}` and mapped fields to POS item structure.
2. **GrnDesktopTerminal:** In step 3 catalog fallback, replaced `/products/search` with `/universal/items/resolve` followed by `/universal/items?query=...&limit=5`.
3. **StandaloneWindowView:** Updated `loadStandaloneCatalog` to query `/universal/items?limit=5`, and updated barcode lookup routines to use `/universal/items/resolve`.
4. **autoPopulateService:** Replaced `/products/search` with `/universal/items` and added `/universal/items/resolve` fallback. Expanded `mapToProductResult` to extract `item_name`, `item_code`, `variant_sku`, `physical_on_hand`, `tax_rate`, and `primary_uom`.
5. **p0BillingRemediationAndUx.test.ts:** Updated unit tests simulating barcode scanning to test `/universal/items/resolve`.

## 8. Tests Executed
1. `npx tsc --noEmit`
2. `npx vitest run src/tests/p0BillingRemediationAndUx.test.ts src/tests/reportBuilder.test.ts src/tests/poPrintBrandingAndTerms.test.tsx`
3. `npx vitest run src/tests/procurementAndReportsAudit.test.ts`
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
