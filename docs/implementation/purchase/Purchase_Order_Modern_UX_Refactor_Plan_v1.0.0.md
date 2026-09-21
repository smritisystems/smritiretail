<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-21
  Modified     : 2026-09-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Purchase Order Modern UX Refactor Plan v1.0.0

## 1. Objective
Refactor the existing Purchase Order / Indent Generation module into a modern, fast, operator-friendly Purchase Order workspace that delivers "Power of Enterprise ERP, Simplicity of WhatsApp" for Indian retail operators. The goal is to maximize operational throughput, minimize visual clutter and unnecessary clicks, position the item grid as the primary working surface, place the item entry toolbar immediately below the grid, preserve retail-critical MRP and purchase rate separation, and provide instant visual feedback with zero compromise on existing transactional safety and backend business logic.

## 2. Business Motivation
Indian retail operators frequently create purchase orders with dozens to hundreds of line items across apparel, footwear, and general merchandise. The legacy terminal interface presented cramped input tables, misplaced toolbars, hidden MRP values, and fragmented summary controls that slowed down purchase indents and caused user friction. A modern, high-density ERP interface aligned with SMRITI's Fiori-inspired design system drastically improves speed, reduces operator cognitive load, eliminates data entry errors, and provides seamless barcode and F2 product lookup.

## 3. Scope
- **In Scope:**
  - Modernize visual hierarchy of `PoGenerateTab.tsx` following the reference design.
  - Header with status badge, breadcrumbs, and primary/secondary action buttons.
  - Four compact general cards: Document Information, Supplier & Delivery (with concise supplier details and SLA Scorecard link), Terms & Reference, and Status & Policy.
  - Primary Item Grid workspace with all required columns: `#`, `ITEM CODE`, `BARCODE`, `PRODUCT NAME`, `BRAND`, `STYLE`, `SHADE / COLOR`, `SIZE`, `MRP (₹)`, `QTY`, `FREE`, `UNIT`, `RATE (₹)`, `DISC. (%)`, `TAX (%)`, `AMOUNT (₹)`, and `ACTIONS`.
  - Item Toolbar relocated strictly **below** the item grid, featuring quick barcode scan / search input, `+ Add Item`, `Browse Items (F2)`, `Import from Excel`, and `Item View` selector (Standard, Compact, Detailed, Size Pivot).
  - Bottom summary panel: Notes textarea, Summary metrics (Total Items, Total Qty, Free Qty), and comprehensive Order Amount Summary (Gross, Item Discount, Freight, Other Charges, Taxable, CGST/SGST/IGST, Round Off, Net Order Value).
  - Persistent bottom action bar: `Cancel`, `Save Draft`, and `Submit Purchase Order`.
  - Preservation of all backend APIs, transactional schemas, vendor policy validation, F2 screen registration, and keyboard shortcuts (`Ctrl+S`, `F2`, `F4`, `F6`, `F9`).
- **Out of Scope:**
  - Changes to database schema, migrations, or backend endpoints.
  - Modifying other purchase modules (GRN, Invoices, Returns).

## 4. Current State
`PoGenerateTab.tsx` is an 88KB monolithic React component with an outdated layout where:
- The item actions toolbar was positioned above the grid or scattered across different header bars.
- MRP was not shown as an explicit prominent column in the standard grid.
- Header fields were arranged in generic grey split panes rather than 4 cohesive compact information cards.
- Bottom summary was a single horizontal total bar without distinct Notes, Item breakdown, and detailed Tax/Charge calculation breakdown.
- No quick inline barcode scanner entry was available directly in the item action toolbar.

## 5. Gap Analysis
| Aspect | Current Implementation | Target Design / Requirement |
|---|---|---|
| **Page Layout** | Split-pane header, top toolbar, table, bottom status bar | Header bar with tabs, 4 compact cards, Item Grid, Item Toolbar below grid, 3-card Summary, bottom action bar |
| **Toolbar Placement** | Above the item grid | **Immediately BELOW the item grid** |
| **MRP Field** | Hidden or secondary in rate calculation | Dedicated visible column `MRP (₹)` separated from `RATE (₹)` |
| **Item Entry** | Manual row focus or F2 modal only | Barcode quick scan + F2 lookup + manual row add + Excel import |
| **Grid Views** | Tab toggle between standard and pivot | `Item View [ Standard ▼ ]` dropdown supporting Standard, Compact, Detailed, Size Pivot |
| **Summary Details** | Total Qty, Gross, Total Tax | Notes, Item metrics (Items, Qty, Free Qty), and detailed Order Amount Summary (Freight, Charges, CGST, SGST, Net Order Value) |
| **Supplier Card** | Dropdown with select list | Searchable input, selected supplier summary card, SLA Scorecard link, delivery date/location |

## 6. Architecture Impact
No backend architecture changes. Frontend types in `src/components/purchase/types.ts` are cleanly extended with optional retail fields (`barcode`, `mrp`, `freeQty`, `unit`, `discountPercent`, `discountAmount`, `supplierReference`, `priceIncludesTax`, `freightAmount`, `otherCharges`) ensuring 100% backward compatibility with existing tests and API contracts.

## 7. Proposed Design
- **Header:**
  - Icon: Document blue badge
  - Title: `Purchase Order`, status badge `[DRAFT]`
  - Subtitle: `Create purchase order to request goods from supplier`
  - Top Actions: `[Save Draft]`, `[Preview (F9)]`, `[Submit PO ▼]`, `[...]`
  - Tabs: `General`, `Items (N)`, `Other Details`, `Attachments`, `History`
- **General Information (4 Compact Cards):**
  1. `Document Information`: Type, Prefix, PO Number, PO Date
  2. `Supplier & Delivery`: Searchable Supplier, New Supplier, Supplier Summary Card (GSTIN, City, Phone, Scorecard link), Delivery Date, Expected Delivery, Delivery Location
  3. `Terms & Reference`: Supplier Reference, Payment Terms, Currency, Buyer, Department, Price Includes Tax toggle
  4. `Status & Policy`: Document Status, Vendor Status, Policy link, Credit Limit, Outstanding, Context Alert Banner
- **Item Grid:**
  - High-density table with sticky headers, subtle zebra striping, row selection highlight.
  - Columns: `#`, `ITEM CODE`, `BARCODE`, `PRODUCT NAME`, `BRAND`, `STYLE`, `SHADE / COLOR`, `SIZE`, `MRP (₹)`, `QTY`, `FREE`, `UNIT`, `RATE (₹)`, `DISC. (%)`, `TAX (%)`, `AMOUNT (₹)`, `ACTIONS`.
- **Item Toolbar (Directly Below Grid):**
  - Left: Box icon, text `Scan barcode, search or press F2 to browse products.`
  - Search input: `Scan barcode or search item (Press F2)`
  - Buttons: `[+ Add Item]`, `[Browse Items (F2)]`, `[Import from Excel]`, `[...]`
  - Right: `Item View [ Standard ▼ ]`
- **Bottom Summary:**
  - 3-column layout: Notes card (Left), Summary metrics (Center), Order Amount Summary (Right) with prominent Net Order Value.
- **Action Bar:**
  - Sticky bottom: `[Cancel]`, `[Save Draft]`, `[Submit Purchase Order]`.

## 8. Files Created
- `docs/implementation/purchase/Purchase_Order_Modern_UX_Refactor_Plan_v1.0.0.md` (this plan)
- `src/tests/poGenerateUX.test.ts` (new UX verification test suite)

## 9. Files Modified
- `src/components/purchase/types.ts`
- `src/components/purchase/PoGenerateTab.tsx`
- `docs/implementation/README.md`

## 10. Dependencies
- React 18
- Tailwind CSS / SMRITI Design Tokens
- Material Symbols Outlined icons
- Existing F2 Dispatcher & PurchBrowseDlg
- Existing POPrintPreviewModal & SupplierScorecardModal

## 11. Risks
- **Risk:** Complex state and vendor policy engine in `PoGenerateTab.tsx` could get broken during JSX restructuring.
  - **Mitigation:** Retain all state variables, hooks, `evaluateProductForVendor`, `handleSubmitGate`, `useF2Screen`, and existing modals intact; refactor presentation and handlers carefully.
- **Risk:** Calculations breaking existing tests.
  - **Mitigation:** Use default `0` for new discount and charge fields so standard calculations yield identical values.

## 12. Rollback Strategy
Git revert of modified files restores the previous version without database or backend impact.

## 13. Verification Plan
- Unit tests execution (`npm run test src/tests/poGenerate.test.ts` and `src/tests/poGenerateUX.test.ts`).
- Full repository TypeScript check (`npm run lint` -> `tsc --noEmit`).
- Browser verification using browser subagent to visually verify:
  - Toolbar placed below grid
  - MRP displayed prominently
  - Cards readable and responsive
  - F2 browse and barcode scan functional
  - Calculations and summary correct
  - Net Order Value prominently highlighted

## 14. Test Plan
1. Calculation tests (standard, discount, tax, charges, net order value).
2. Keyboard navigation and hotkey tests.
3. Barcode lookup and item insertion tests.
4. Draft save and submit payload validation.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create walkthrough in `docs/walkthrough/purchase/Purchase_Order_Modern_UX_Refactor_v1.0.0.md`.

## 16. Deployment Plan
Pure frontend component update, deployed via standard Vite client build.

## 17. Status
Approved (In Progress)

## 18. Related ADRs
- ADR-0034: Purchase Order Vendor Policy Enforcement Architecture
- ADR-0028: F2 Universal Lookup Engine v2

## 19. Related Walkthroughs
- `docs/walkthrough/procurement/Procurement_GRN_Inward_Engine_Immutability_And_PO_Lifecycle_Governance_v3.33.6.md`
- `docs/walkthrough/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md`
