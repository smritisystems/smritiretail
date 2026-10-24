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

  * Version    : 1.0.0
  * Created    : 2026-10-15
  * Modified   : 2026-10-15
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Purchase Order Print Format Visual Audit & Production Template Implementation

## 1. Objective
Deliver a production-ready, pixel-perfect, reusable Purchase Order print template for SMRITI Retail OS matching the approved visual reference across both **Sizewise (Pivot on Size)** and **Standard (Barcode-wise)** operational procurement workflows. The solution integrates seamlessly into the existing print engine and preview modals without altering database schemas, mutating authoritative financial calculations, or duplicating print infrastructure.

## 2. Business Motivation
In modern retail and footwear procurement, purchase orders serve as statutory, legal, and operational contracts between the retailer and manufacturer. The previous print layouts in SMRITI Retail OS were either oriented toward European export norms (`FootwearPurchaseOrderA4` with hardcoded TARIC codes and carton ratios) or basic unformatted matrix listings (`SizePivotMatrixA4`), lacking:
1. Executive corporate branding with company GSTIN, PAN, and address metadata.
2. Clean, dedicated supplier contract cards with complete contact and tax identifiers.
3. Clean compact horizontal size assortment tables highlighting the dynamic size chart (e.g., EU 36–44).
4. High-fidelity **Item Reference (Images)** cards rendered as 2 large cards per row with footwear technical attributes (Heels, Upper Material, Outsole, Color) decoupled from the compact matrix.
5. Authoritative side-by-side Commercial Terms and Financial Summary blocks preserving discount, GST, and net order totals.
6. Statutory signature authorizations (Prepared By, Checked By, Authorized Signatory) and pagination footers.

## 3. Scope
- **Phase 1 Audit & Gap Analysis**: Full verification of models, services, APIs, fields, and workflows.
- **Unified Print Template Component (`PurchaseOrderPrintA4.tsx`)**: Reusable A4 template supporting:
  - `mode="sizewise"` (horizontal size pivot matching approved visual).
  - `mode="standard"` (barcode/SKU-wise row expansion with grouped image reference).
- **PO Print Preview Modal Modernization (`POPrintPreviewModal.tsx`)**:
  - Integrate new template as default view.
  - Dynamically pass company, supplier, items, images, and commercial terms.
  - Support zoom, portrait/landscape orientation toggle, and browser `@media print` engine.
- **Graceful Fallbacks**:
  - Handle missing images with high-resolution SVG footwear placeholders.
  - Handle missing optional attributes (Heels, Upper Material, Outsole) without clipping or layout shifts.
- **Automated Verification**: Headless Playwright script verifying both Sizewise and Standard preview/print output with multi-resolution screenshot evidence.

## 4. Current State
- **Frontend Workspaces**:
  - `PoSizewiseTab.tsx`: Generates `printHeader`, `printLineItems`, and `printSizePivotRows` and passes them to `POPrintPreviewModal.tsx`.
  - `PoGenerateTab.tsx`: Standard SKU/barcode grid passing standard lines to `POPrintPreviewModal.tsx`.
  - `POPrintPreviewModal.tsx`: Currently renders either `FootwearPurchaseOrderA4` (legacy export layout), `SizePivotMatrixA4` (plain unstyled table), or `StandardInvoiceA4`.
- **Backend Services**:
  - `PurchaseService.create_purchase_order`: Computes `subtotal`, `tax_total`, `grand_total`, allocates technical IDs via `IdentityEngine`, snapshots commercial terms into `rule_snapshots["commercial_terms"]`.
  - `GET /purchase/orders/{order_id}`: Unpacks commercial terms via `PurchaseOrderResponse.populate_commercial_terms`.
  - `GET /purchase/suppliers/`: Enriches supplier records with `payment_terms`, `freight_terms`, `currency`, `buyer`, `department`, `special_instructions`.
  - `GET /purchase/settings`: Returns company jurisdiction state.

## 5. Gap Analysis

| Visual Feature / Requirement | Current Implementation Status | Gap Identified | Remediation Action |
|---|---|---|---|
| **Header Branding** | `FootwearPurchaseOrderA4` hardcoded to "TATTLY FOOTWEAR"; `SizePivotMatrixA4` has basic text | Company address, GSTIN, PAN, and warehouse are not dynamically bound from tenant context | Bind `company_name`, address, GSTIN, PAN from tenant state and `header.deliveryLocation` to "Warehouse" |
| **Supplier Card** | Basic 2-column text in `SizePivotMatrixA4`; export box in `FootwearPurchaseOrderA4` | Missing clean light-blue card container with code, GSTIN, contact phone, email | Render dedicated light-blue supplier box (`#f0f6ff`) with formatted details |
| **PO Meta Box** | Date/PO scattered across headers | Missing dedicated PO No, Order Date, Expected Delivery, Warehouse, Status pill badge | Implement right-side PO metadata card with status badge |
| **Item Details Table** | Hardcoded EU 40-45 in `FootwearPurchaseOrderA4`; plain unstyled grid in `SizePivotMatrixA4` | Column headers are static; size cells lack styled blue headers and proper rate/amount alignment | Dynamically generate size columns from active scale; display blue headers, bold row totals, and grand total |
| **Item Reference (Images)** | 1 thumbnail column in matrix or full technical specs inside row | Visual requires 2 large cards per row below table with Article No., Color, Heels, Upper Material, Outsole | Implement 2-card-per-row grid below table; resolve attributes from item master or product model |
| **Commercial Terms** | Rendered as text list or notes string | Missing light-blue card with Payment Terms, Freight Terms, Currency, Delivery Terms, Supplier Ref, Special Instructions | Render structured Commercial Terms card from saved PO snapshot |
| **Order Summary** | Rendered inside table footer or separate tax box | Missing clean light-blue card with Total Items, Total Qty, Subtotal, GST, Grand Total | Render structured Order Summary card aligned side-by-side with Commercial Terms |
| **Remarks & Signatures** | 4 signature boxes in `SizePivotMatrixA4` | Visual requires Remarks rule line + 3 signatures: Prepared By, Checked By, Authorized Signatory (with Designation) | Implement Remarks line and 3-column signature block |
| **Footer** | Jurisdictional footer | Missing computer-generated document notice and Page 1 of 1 pagination | Implement standard bottom footer |

## 6. Architecture Impact
- **Database Schema**: ZERO changes. All required fields exist in `purchase_orders`, `purchase_order_items`, `suppliers`, `items`, `item_variants`, and `rule_snapshots`.
- **API Contracts**: ZERO changes. Existing `/api/v1/purchase/orders/` endpoints supply all necessary line items, totals, and snapshots.
- **Frontend Architecture**: A new template `src/print_engine/templates/PurchaseOrderPrintA4.tsx` is registered in `src/print_engine/print_store.tsx` and utilized by `src/components/purchase/POPrintPreviewModal.tsx`.

## 7. Proposed Design

### A. Template Architecture (`PurchaseOrderPrintA4.tsx`)
```text
┌────────────────────────────────────────────────────────────────────────┐
│ SMRITI RETAIL OS Logo & Company Info           PURCHASE ORDER          │
│ GSTIN, PAN, Address, Contact                   PO#, Dates, Whs, Status │
├────────────────────────────────────────────────────────────────────────┤
│ SUPPLIER CARD: Name, Code, Address, GSTIN, Contact, Email             │
├────────────────────────────────────────────────────────────────────────┤
│ ITEM DETAILS (SIZEWISE or STANDARD)                                    │
│ Dynamic Size Columns (EU 36-44) | Total Qty | Rate (₹) | Amount (₹)     │
│ TOTAL Row                                                              │
├────────────────────────────────────────────────────────────────────────┤
│ ITEM REFERENCE (IMAGES) [2 Large Cards Per Row Grid]                   │
│ ┌─────────────────────────┐  ┌─────────────────────────┐               │
│ │ Article No.             │  │ Article No.             │               │
│ │ Color, Heels, Upper, Sole│  │ Color, Heels, Upper, Sole│               │
│ │ [ Large Shoe Photo ]    │  │ [ Large Shoe Photo ]    │               │
│ └─────────────────────────┘  └─────────────────────────┘               │
├────────────────────────────────────────────────────────────────────────┤
│ COMMERCIAL TERMS (Left)          │ ORDER SUMMARY (Right)               │
│ Payment, Freight, Currency,      │ Total Items, Total Qty, Subtotal,   │
│ Delivery Terms, Ref, Instructions│ GST, Grand Total (Large Bold)       │
├────────────────────────────────────────────────────────────────────────┤
│ Remarks: _____________________________________________________________ │
├────────────────────────────────────────────────────────────────────────┤
│ Prepared By            Checked By             Authorized Signatory     │
│ Name / Date            Name / Date            Name / Desig / Date      │
├────────────────────────────────────────────────────────────────────────┤
│ Computer-generated Purchase Order | SMRITI Retail OS | Page 1 of 1     │
└────────────────────────────────────────────────────────────────────────┘
```

## 8. Files Created
1. `src/print_engine/templates/PurchaseOrderPrintA4.tsx`: Canonical print template implementing approved Sizewise and Standard visual layouts.
2. `scripts/verify_po_print_format_visual_headless.py`: Automated Playwright test verifying both modes, multi-resolution layout, and visual fidelity.

## 9. Files Modified
1. `src/components/purchase/POPrintPreviewModal.tsx`: Route template format to `PurchaseOrderPrintA4`, pass structured attributes and company metadata.
2. `src/print_engine/print_store.tsx`: Register `purchase-order-print-a4` template in the print engine.
3. `src/components/purchase/types.ts`: Ensure `PurchaseOrderSizePivotRow` supports optional footwear attributes (`heelType`, `upperMaterial`, `outsoleMaterial`).
4. `docs/implementation/README.md`: Append implementation plan entry.

## 10. Dependencies
- `@media print` CSS engine with `@page { size: A4 portrait; margin: 8mm; }`.
- Existing `apiFetchV1` and `/api/v1/purchase/*` endpoints.
- Tailwind CSS design system classes present in `src/index.css`.

## 11. Risks
- **Risk 1: Missing Product Images**: Some items in database do not have `primary_image_url`.
  - *Mitigation*: Provide sleek, vector-based footwear silhouette placeholder with subtle badge; prevent layout distortion.
- **Risk 2: Multi-Page Overflow on Large Orders**: Orders with >10 articles or >20 lines can span multiple pages.
  - *Mitigation*: Use CSS `break-inside: avoid` on image cards, table rows, and signature blocks; repeat table headers across pages (`thead { display: table-header-group }`).
- **Risk 3: Dynamic Size Charts**: Not all footwear uses EU 36–44; some use UK 6–11 or US sizes.
  - *Mitigation*: Generate size columns dynamically from active size list; display chart name dynamically in section header.

## 12. Rollback Strategy
- All changes are confined to frontend presentation components (`PurchaseOrderPrintA4.tsx`, `POPrintPreviewModal.tsx`).
- In case of regression, reverting `POPrintPreviewModal.tsx` to prior commit restores previous fallback preview immediately without data impact.

## 13. Verification Plan
1. **Visual Parity Check**: Compare rendered DOM against approved visual reference (`input_file_0.png`).
2. **Dynamic Data Binding Check**: Confirm company info, supplier info, PO numbers, dates, rates, and amounts reflect live state.
3. **Dual Mode Check**: Test both `Sizewise` (Matrix pivot) and `Standard` (Barcode-wise) outputs.
4. **Resilience Check**: Test with missing images and missing optional attributes.

## 14. Test Plan
- Run automated headless script: `python scripts/verify_po_print_format_visual_headless.py`.
- Run frontend linter and unit tests: `npm test` or relevant test suite.
- Validate `@media print` layout and capture full-page screenshots at 1440x900 and 1920x1080.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Generate Walkthrough: `docs/walkthrough/purchase/Purchase_Order_Print_Format_Visual_Implementation_v1.0.0.md`.
- Append Walkthrough Master Index: `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Code deployed via standard git commit in DEV repository.
- Verify through browser and headless Playwright runner.

## 17. Status
Completed (Verified with 10/10 green Playwright automated tests, 0 tsc errors, visual evidence, statutory PDF output, and WGP walkthrough).

## 18. Related ADRs
- `docs/architecture/decisions/ADR-001-Canonical-Variant-Resolution.md`
- `docs/architecture/decisions/ADR-0021-Item-Variant-Identity-Architecture.md`

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Order_Print_Format_Visual_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Order_UX_Modernization_Phase_1_Unified_Workspace_v6.78.0.md`
- `docs/walkthrough/purchase/Purchase_Variant_Disambiguation_And_Legacy_Vendor_Autobridge_v6.75.1.md`
