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

# Implementation Plan: Dual-Field Item Auto-Search, Auto-Population & 14+ Attribute Inspection

## 1. Objective
Enable high-throughput retail cashiers, distributors, and store operators to search, inspect, and auto-populate catalog items interchangeably from either the **Stock No./Code/SKU field** or the **Barcode No. field** in real time, presenting 5–7 core transactional attributes and 5–7 extended tactical metadata items in a unified typeahead overlay and HUD ribbon.

## 2. Business Motivation
In retail POS and wholesale operations, cashiers encounter different workflows: some scan barcode labels with handheld optical scanners, while others enter style numbers, item codes, or SKU aliases manually. Operators must not be forced to switch tabs or click distinct search buttons. Real-time debounced auto-complete with comprehensive multi-attribute inspection eliminates lookup friction and guarantees zero data entry errors.

## 3. Scope
- **Backend Product Search Expansion**: `ProductRepository.search` extended across `name`, `code`, `barcode`, `sku`, `style_code`, `brand`, `category`, `hsn_code`, and `attributes`.
- **Frontend Universal Auto-Populate Service**: `searchBackendProducts` enriched to map 14+ item attributes into `AutoPopulateProductResult`.
- **Universal Reusable Inspection Component**: Created `SmritiItemTypeaheadDropdown` featuring keyboard navigation (Up/Down, Enter, Esc), visual preview images, stock status, tax tags, and extended metadata.
- **ProPOS Billing Terminal Integration**: Dual inputs for `Barcode / Scan` and `Stock No / SKU` in `SmritiProPosBillingTerminal.tsx` with live inspection ribbon and instant auto-population.
- **Distributor Invoicing Integration**: Dual inputs in `SmritiBillingTerminal.tsx` with live typeahead and automatic field binding.
- **Automated Test Coverage**: Vitest unit suite covering dual-field lookup and 14+ attribute extraction.

## 4. Current State
Previously, item lookups were primarily triggered upon manual Enter in the Stock No input without interactive multi-attribute preview cards or dual barcode/stock-no synchronization.

## 5. Gap Analysis
- Missing dedicated dual-search inputs with synchronized auto-population.
- Typeahead suggestions lacked full visibility of MRP vs. Rate, Cost Price, Size/Color, GST%, Brand, Category, HSN, and Tracking Mode.
- Repository search was limited to `name`, `code`, and `barcode`, omitting `sku`, `style_code`, and `hsn_code`.

## 6. Architecture Impact
- **Zero Schema Migrations Required**: Leverages existing PostgreSQL `products` and `product_variants` columns and JSONB attribute store.
- **Client-Side Debouncing**: 120ms–150ms debounced queries prevent backend request flooding while keeping UI response immediate.

## 7. Proposed Design
- Real-time event listener on both `Barcode No` and `Stock No / SKU` inputs.
- Keyboard navigation (Arrow Up/Down, Enter, Esc) with scroll-into-view.
- Interactive multi-attribute cards partitioned into:
  - **Key Identifiers**: Barcode, Stock No, Code, SKU, Name/Description.
  - **Core Details**: MRP, Rate, Cost Price, Available Stock, Size, Color, GST %.
  - **Extended Metadata**: Brand, Category, HSN Code, Pricing Mode, Tracking Mode, Weight, Image Preview.

## 8. Files Created
- `src/components/common/SmritiItemTypeaheadDropdown.tsx`: Reusable universal item search dropdown and inspection HUD.

## 9. Files Modified
- `backend/app/repositories/product.py`: Expanded `ProductRepository.search` filter criteria.
- `src/services/autoPopulateService.ts`: Enriched `AutoPopulateProductResult` and `mapToProductResult`.
- `src/components/billing/propos/SmritiProPosBillingTerminal.tsx`: Integrated dual search fields and live HUD ribbon.
- `src/components/billing/SmritiBillingTerminal.tsx`: Integrated dual search fields and typeahead in Distributor Invoicing.
- `src/tests/autoPopulateService.test.ts`: Added unit tests for dual lookup and attribute mapping.

## 10. Dependencies
- React 18, Lucide React icons, TailwindCSS, Vitest, FastAPI, SQLAlchemy, PostgreSQL.

## 11. Risks
- Fast barcode scanners might emit rapid keystrokes followed by carriage returns; addressed with exact-match auto-select and auto-commit logic.

## 12. Rollback Strategy
Revert frontend terminal inputs to previous single-input layout if necessary; backend repository search remains strictly backward-compatible.

## 13. Verification Plan
- Vitest unit tests on `autoPopulateService`.
- Terminal UI tests with mock products and barcode scans.
- Verification of 14+ fields in dropdown inspect card.

## 14. Test Plan
- Run `npx vitest run src/tests/autoPopulateService.test.ts`.
- Run `npx vitest run src/tests/smritiBillingTerminal.test.ts src/tests/proPosKeyboardShortcuts.test.ts`.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create walkthrough under `docs/walkthrough/pos/`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
Sync via Git commit to Development workspace and pull into test environment.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0014: High-Performance In-Memory Client Caching with PostgreSQL Sync.

## 19. Related Walkthroughs
- `docs/walkthrough/pos/POS_Dual_Field_Item_AutoSearch_And_Attribute_Inspector_v6.11.0.md`.
