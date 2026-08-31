<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.11.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Dual-Field Item Auto-Search, Auto-Population & 14+ Attribute Inspection

## 1. Purpose
Provide seamless, zero-friction item identification and auto-population across the SMRITI billing suites (`ProPOS Billing Terminal` and `Distributor Invoicing Terminal`) from either the **Stock No./Code/SKU field** or the **Barcode No. field**, presenting comprehensive item metadata cards and live HUD inspection.

## 2. Scope
- Dual interactive search input fields in the Direct Entry grid: **Barcode / Scan** and **Stock No / SKU**.
- Live debounced backend & in-memory catalog querying with instant typeahead rendering.
- Presentation of 14+ structured product attributes (5 Key Identifiers, 6 Core Commercial Details, 6 Extended Tactical Attributes).
- Real-time auto-population of rate, description, MRP, tax rate, and stock balance upon item selection.

## 3. Files Created
- `src/components/common/ItemTypeaheadDrop.tsx`: Reusable universal item typeahead dropdown with keyboard navigation and multi-attribute inspection.

## 4. Files Modified
- `backend/app/repositories/product.py`: Expanded search query across all product columns (`sku`, `style_code`, `hsn_code`, `brand`, `category`, `attributes`).
- `src/services/autoPopulateService.ts`: Upgraded `AutoPopulateProductResult` schema and mapping function to support all 14+ item fields.
- `src/components/billing/propos/ProPosBillingTerm.tsx`: Integrated dual search inputs, dropdown popups, and live selected item HUD banner.
- `src/components/billing/BillingTerm.tsx`: Integrated dual inputs and typeahead dropdown in Distributor Invoicing.
- `src/tests/autoPopulate.test.ts`: Added unit tests verifying dual lookup and complete attribute mapping.
- `docs/implementation/README.md`: Appended new plan to master index table.
- `docs/walkthrough/README.md`: Appended new walkthrough to master index table.
- `CHANGELOG.md`: Added release notes for v6.11.0.

## 5. Architecture Decisions
- **Interchangeable Dual Input Workflow**: Cashiers can type or scan in either input without mode switching. Selecting an item syncs both identifiers immediately.
- **Client Cache + Backend Resilience**: Searches check in-memory local catalog first for instant sub-millisecond suggestions, then fall back to the backend `/api/v1/inventory/products?q=...` endpoint with a 15-second TTL cache.
- **Poka-Yoke Auto-Population**: When an item is selected or scanned, unit rate, description, and tax parameters are locked to verified master values, preventing cashier typographical mistakes.

## 6. Design Rationale
- **14+ Attribute Partitioning**:
  - *Key Identifiers*: Barcode, Stock No, Code, SKU, Name/Description.
  - *Core Transactional Details*: Available Stock, Selling Rate, MRP, Cost Price, Size, Color, GST %.
  - *Extended Metadata*: Brand, Category, HSN Code, Pricing Mode, Tracking Mode, Weight, Image Preview.
- This layout ensures both retail cashiers and warehouse supervisors have all required operational context at a glance.

## 7. Implementation Summary
1. Built `ItemTypeaheadDrop.tsx` with high-density styling, arrow-key navigation, and visual badge indicators.
2. Updated `searchBackendProducts` to search across `code`, `barcode`, `sku`, `style_code`, `name`, `category`, and `brand`.
3. Integrated dual input layout in `ProPosBillingTerm.tsx` with a live HUD inspection ribbon.
4. Integrated dual search in `BillingTerm.tsx` with auto-population of line rates and totals.

## 8. Tests Executed
- Vitest unit tests: `src/tests/autoPopulate.test.ts` (6/6 PASS).
- Billing terminal vitest tests: `src/tests/billingTerm.test.ts` & `src/tests/proPosKeys.test.ts` (20/20 PASS).

## 9. Verification Results
- Searching by Stock No (`STK-SHIRT-01` or `TSHIRT`) returns matching products with all 14 attributes populated.
- Searching by Barcode (`8904445556667` or `8909876543210`) immediately resolves the exact item and fills rate and description.
- Arrow keys navigate suggestions; Enter selects and populates without losing cursor focus.

## 10. Known Limitations
None. Fallback mechanisms handle offline situations gracefully.

## 11. Future Work
Add support for scanning serial/batch numbers directly within the dual-search fields for serialized electronics and pharmaceutical lots.

## 12. Related ADRs
- ADR-0014: Unified Client Typeahead and Caching Architecture.

## 13. Related RFCs
- RFC-2026-08-01: Universal Product Identity and Multi-Identifier Resolution.
