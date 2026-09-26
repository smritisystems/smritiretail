<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.33.3
  * Created    : 2026-09-20
  * Modified   : 2026-09-20
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Supplier SLA Scorecard Live PostgreSQL Wiring & PO Print Preview De-Hardcoding

## 1. Purpose
To eliminate hardcoded supplier profile dictionaries (`SAMPLE_PROFILES`) and mock orders from `SupplierScorecardModal.tsx`, connecting the SLA compliance audit engine live to PostgreSQL database endpoints (`GET /api/v1/purchase/suppliers/` and `GET /api/v1/purchase/orders/`), mounting the SLA scorecard trigger directly inside the Purchase Order Generator (`PoGenerateTab.tsx`), and removing hardcoded mock company branding and mock article fallback items from the PO print preview modal (`POPrintPreviewModal.tsx`).

## 2. Scope
- Supplier SLA Compliance Audit Modal (`src/components/purchase/SupplierScorecardModal.tsx`).
- Purchase Order Generation Studio (`src/components/purchase/PoGenerateTab.tsx`).
- Purchase Order A4 Print Preview Modal (`src/components/purchase/POPrintPreviewModal.tsx`).
- Master Walkthrough Index & Changelog (`docs/walkthrough/README.md`, `CHANGELOG.md`).

## 3. Files Created
- [`docs/walkthrough/procurement/Procurement_Supplier_SLA_Scorecard_And_PO_Print_Dehardcoding_v3.33.3.md`](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/Procurement_Supplier_SLA_Scorecard_And_PO_Print_Dehardcoding_v3.33.3.md)

## 4. Files Modified
- [`src/components/purchase/SupplierScorecardModal.tsx`](file:///f:/SMRITRretailNX/src/components/purchase/SupplierScorecardModal.tsx)
- [`src/components/purchase/PoGenerateTab.tsx`](file:///f:/SMRITRretailNX/src/components/purchase/PoGenerateTab.tsx)
- [`src/components/purchase/POPrintPreviewModal.tsx`](file:///f:/SMRITRretailNX/src/components/purchase/POPrintPreviewModal.tsx)
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md)
- [`CHANGELOG.md`](file:///f:/SMRITRretailNX/CHANGELOG.md)

## 5. Architecture Decisions
1. **Dynamic PostgreSQL Sourcing for Vendor Compliance**: `SupplierScorecardModal.tsx` dynamically loads vendors from `/purchase/suppliers/` and confirmed purchase orders from `/purchase/orders/` via `apiFetchV1`, calculating on-time delivery %, fill rate %, quality rejections, and composite scores across live database records.
2. **Dual-Mode Benchmark Audit Model**: The demo benchmark dataset (`SAMPLE_DEMO_PROFILES` and `makeSampleDemoOrders()`) was decoupled and relegated to an explicit "Show Demo Benchmark" / "Show DB Live Data" toggle for operator auditing and SLA penalty calculation verification without polluting live operational metrics.
3. **In-Context Supplier SLA Access**: Mounted an instant "★ SLA Scorecard" trigger badge beside the Supplier dropdown in `PoGenerateTab.tsx`. Operators can inspect the compliance grade and lead time performance of the active vendor before placing a purchase order.
4. **PO Print Preview De-Hardcoding**: Removed static mock company strings (`TATTLY FOOTWEAR & LEATHER APPAREL PVT LTD`, `Apex Fabrics & Footwear Ltd`) and mock article fallbacks from `POPrintPreviewModal.tsx`, dynamically binding active vendor attributes and passing actual line items to the print engine.

## 6. Design Rationale
- Operators creating purchase orders need real-time visibility into supplier reliability (e.g. OTD %, fill rate, and previous delay penalties) directly from their procurement workspace before finalizing quantities and delivery schedules.
- Hardcoded fallback items in print previews risk generating confusing or misleading documentation when printing purchase orders that have custom or zero preliminary lines.

## 7. Implementation Summary
- Refactored `SupplierScorecardModal.tsx` with asynchronous `loadData()` calling `/purchase/suppliers/` and `/purchase/orders/`.
- Mapped database entities to `SupplierProfile` and `PurchaseOrderRecord` schemas.
- Added `initialSupplierId` prop support for deep-linking from PO Studio.
- Added interactive toggle between Live Database Sourcing and Demo SLA Benchmark.
- Added "★ SLA Scorecard" button in `PoGenerateTab.tsx` Supplier header card.
- Replaced hardcoded vendor names, addresses, and dummy mock articles in `POPrintPreviewModal.tsx` with dynamic properties from `header` and `vendor`.

## 8. Tests Executed
1. `npm run lint` (`tsc --noEmit`): Exited with code 0 (0 errors across entire repository).
2. `python scripts/architecture_duplication_gate.py`: 11/11 checks passed, 0 P0/P1 violations, 0 registered debt.
3. `npx vitest run src/tests/supplierScorecardEngine.test.ts`: 4/4 tests passed in 350ms.
4. `pytest backend/tests/t_grn_stock.py backend/tests/t_po_flow.py -v`: 2/2 tests passed in 0.77s.

## 9. Verification Results
- **TypeScript Compiler Check**: PASSED (0 errors).
- **Architecture Duplication Gate**: PASSED (11/11 checks).
- **Unit & Integration Test Suites**: 6/6 tests passed green.
- **Dynamic Sourcing**: Live vendors from PostgreSQL `suppliers` table load cleanly into the scorecard modal with calculated composite scores.

## 10. Known Limitations
- If a newly onboarded supplier has 0 historical purchase orders, their score defaults to baseline until the first order is fulfilled.

## 11. Future Work
- Direct export of vendor SLA compliance certificates to PDF.
- Supplier portal integration for vendor self-service dispute resolution on penalty accruals.

## 12. Related ADRs
- `ADR-VEND-01`: Vendor 360 Workspace & Universal Party Master Canonical Architecture.
- `ADR-PURCH-02`: Inward Landed Cost, Multi-Component Freight & SKU Allocation Ledger Engine.

## 13. Related RFCs
- `RFC-2026-VEND-01`: SMRITI Vendor SLA Compliance & Penalties Governance.
