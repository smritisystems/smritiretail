<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.28.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Enterprise UI Refactor Walkthrough
-->

# Walkthrough: Create Purchase Order (B2B Purchase) Visual Refactor v3.28.0

## 1. Purpose
This walkthrough documents the visual refactor of the **Create Purchase Order (B2B Purchase)** screen inside SMRITI Purchase Studio (`src/components/PurchaseStudioTab.tsx`). The objective was to align the B2B purchase creation workflow with the modern, enterprise light theme visual standards (Fiori Horizon Inspired) of the SMRITI Design System.

## 2. Scope
- **Target Workspace**: Purchase Studio (`id: "purchase"`) &gt; `Create Purchase Order` (`activeSubTab === "create"`).
- **Visual Alignment**: Enterprise light theme, clean white surfaces (`bg-theme-surface-1`), crisp blue accents (`#0070F2`), compact 8-field order header card, 13-column item details grid, quick add row box, 3-column bottom configuration panels, and right-side summary sidebar.
- **Business Logic & Calculations**: Preserved full calculation formulas for subtotal, item discounts, taxable value, GST calculation, freight, other charges, and grand total.

## 3. Files Created
- `docs/walkthrough/procurement/Create_Purchase_Order_Refactor_v3.28.0.md`

## 4. Files Modified
- `src/components/PurchaseStudioTab.tsx` (Version 3.28.0 header updated, imported icons added, state variables added for PO header and charges, active sub-tab `create` view refactored to match benchmark).
- `docs/walkthrough/README.md` (Master index table updated with v3.28.0 entry).

## 5. Architecture Decisions
- **Fiori Horizon Visual Alignment**: Used semantic CSS variables (`bg-theme-surface-1`, `bg-theme-surface-2`, `border-theme-border`, `text-theme-body`, `text-theme-muted`) to ensure dynamic theme compatibility across Light and Dark mode.
- **Split Workspace Layout**: Maintained 3/4 left column for primary item entry and transaction configurations, and 1/4 right column for immediate sticky financial summary, amount in words, draft saving, and F12 Save & Submit action.

## 6. Design Rationale
- **Reference Image Visual Benchmark**: Adopted clean enterprise light visual language from user-provided B2B Create Purchase Order reference image.
- **Structured Order Header**: Grouped supplier details (`Shree Balaji Distributors`, `SUP-B2B-0012`, GSTIN, credit limit) in a dedicated left card, while grouping 8 critical order fields (`Order Type`, `PO No.`, `PO Date`, `Required By`, `Currency`, `Price List`, `Billing Address`, `Delivery Address`) in a clear 4x2 grid card.
- **13-Column Item Details Table**: Enabled granular line item management with inline editable quantity, rate, discount %, tax rate selection, and immediate auto-recalculation.

## 7. Implementation Summary
1. **Header & Navigation Bar**:
   - `Create Purchase Order` with `B2B Purchase` green badge (`bg-emerald-50 border border-emerald-200 text-emerald-700`).
   - Breadcrumb navigation: `Purchase > Orders > Create Purchase Order`.
   - Top action buttons: `Print Preview`, `Email`, `Download PDF`, `Pop Out` (`#0070F2`), and overflow menu.
2. **Top Information Row**:
   - Left Card: Supplier selection, supplier code badge (`SUP-B2B-0012`), GSTIN, address, credit limit footer (`Credit Limit: ₹25,00,000.00`, `Available: ₹12,75,650.00`).
   - Right Card: 8-field order grid with date pickers and dropdown selectors.
3. **Sub-Navigation Tabs Bar**:
   - Tabs: `Items` (Active), `Terms & Conditions`, `Additional Details`, `Attachments (0)`, `History`.
4. **Item Details Table Grid**:
   - 13 columns: `#`, `Barcode`, `Item / Description`, `HSN`, `Qty`, `UOM`, `Rate (₹)`, `Disc %`, `Disc Amt (₹)`, `Taxable Value (₹)`, `GST %`, `GST Amt (₹)`, `Total (₹)`, `Action`.
   - Quick Add Row box with barcode/search item, qty, UOM, rate, disc %, and `Add Item` button.
   - Bottom 3-column configuration panels: `Purchase Settings` (Payment Terms, Transporter, Freight, Shipping By, LR/GR No.), `Other Charges` (Loading, Unloading, Other Charges), and `Notes` textarea with character counter.
5. **Right Summary Sidebar**:
   - Real-time calculations: Subtotal, Discount (`-₹155.75` green text), Other Charges, Freight, Taxable Amount, Total GST, Round Off.
   - Dark Navy Grand Total Banner (`₹19,539.50`).
   - Amount in Words box (`Nineteen Thousand Five Hundred Thirty Nine Rupees and Fifty Paise Only`).
   - `Save as Draft v` dropdown and `F12 Save & Submit` primary blue button.

## 8. Tests Executed
- `npx tsc --noEmit` (Passed with 0 errors).
- `npx vitest run` (Passed 11/11 test files, 64/64 unit tests).
- `npm run build` (Passed production build in 22.16s).

## 9. Verification Results
- **TypeScript**: 0 errors.
- **Vitest Unit Tests**: 64/64 passed.
- **Vite Build**: Success (`dist/assets/smriti-purchase-studio-*.js` 166.23 kB).

## 10. Known Limitations
- Draft saving currently updates local React component state; backend persistence to Postgres `/api/v1/purchase-orders` requires active backend session token.

## 11. Future Work
- Add keyboard shortcuts (`F12` keypress listener) for quick submission without clicking.
- Add multi-currency exchange rate auto-fetch from backend currency matrix.

## 12. Related ADRs
- `ADR-001`: Platform Abstraction Layer (PAL) Architecture
- `ADR-004`: Fiori Horizon Enterprise Light Theme Standard

## 13. Related RFCs
- `RFC-2026-08-01`: Procurement & B2B Purchase Order Workflow Standardization
