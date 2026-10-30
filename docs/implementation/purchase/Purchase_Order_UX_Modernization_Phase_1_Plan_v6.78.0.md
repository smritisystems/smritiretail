<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.78.0
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Purchase Order UX Modernization Phase 1: Unified Workspace & Controlled Execution

## 1. Objective
Deliver a unified, high-velocity Purchase Order workspace for SMRITI Retail OS based on approved **Option B: Compact Header + Primary Item Grid + Expandable Commercial Details**. Eliminate artificial 3-tab barriers, establish a dedicated right-side slide-over drawer for Commercial & Delivery terms (`w-[440px] max-w-[90vw]`), position Barcode in Column 1 in Standard Mode, bound the Supplier Selector to `max-w-md` (448px) on desktop to eliminate horizontal fluid stretch, and guarantee 100% data integrity, calculation precision, and zero database schema mutations.

---

## 2. Business Motivation
In high-velocity retail apparel and footwear procurement:
1. **Entry Velocity:** Over 85% of buyer time and cognitive load is spent entering sizes, quantities, and rates across variant matrices or discrete barcodes. Mandatory 3-tab switching ("General", "Items", "Tax & Summary") imposed a 4-click tax on every PO, slowing operations and breaking data entry cadence.
2. **Context Continuity:** Buyers frequently lost sight of supplier names, supplier codes, and document status when navigating between tabs.
3. **Hardware Scanner Alignment:** Barcode scanning was hindered in Standard Mode because the barcode field was relegated to Column 4 or 5.
4. **Ergonomic Sizing:** On wide monitors (1920px), supplier selection controls stretched across 1,125px of empty whitespace, violating SMRITI UI design principles (*"Use the space an element needs, not all the space available"*).

---

## 3. Scope
- **UX Layout Architecture (Decision A):** Unified PO Workspace without forced multi-tab navigation. Item Grid lands as the immediate primary focal area upon opening the module.
- **Commercial & Delivery Drawer (Decision B):** Self-contained slide-over drawer (`CommercialDeliveryDrawer.tsx`) supporting payment terms, freight terms, currency, buyer, department, delivery location, lead time, remarks, and special instructions. Accessible, keyboard-dismissible (Escape key), and state-preserving.
- **Standard Mode Barcode Priority (Decision C):** Barcode positioned in Column 1 across compact and detailed Standard PO tables.
- **Supplier Selector Sizing (Decision D):** Strict desktop width bounding (`max-w-md` / 448px) on `SupplierSelect.tsx` to eliminate fluid horizontal stretch.
- **Proportionate UI (Decision E):** Token-driven element dimensions and compact summaries.
- **Supplier Commercial Terms Hydration:** Automatic inheritance of terms from Supplier Master, with clear visual indicators distinguishing master defaults from PO-level overrides.
- **Sizewise ↔ Standard Projection:** Full preservation of bidirectional conversion engine (`poModeConversion.ts`).
- **Zero Schema Mutations:** Strict preservation of existing PostgreSQL tables (`purchase_orders`, `purchase_order_items`, `rule_snapshots`).

---

## 4. Current State
- `PoGenerateTab.tsx` previously defaulted to a "general" header tab before users could access the item grid.
- `PoGenerateTab.tsx` placed the Barcode column after Item Code and Description.
- `SupplierSelect.tsx` container utilized unconstrained `flex-1 min-w-[240px]`, stretching to 1,125px on 1920px viewports.
- Commercial details were previously either hidden across disparate sub-tabs or rendered inline, consuming vertical grid height.
- Runtime React key warnings occurred during rapid browse dialog interactions (`PurchBrowseDlg.tsx`) and dynamic row additions.

---

## 5. Gap Analysis
| Area | Prior State | Modernized Target State |
| :--- | :--- | :--- |
| **Workspace Navigation** | 3 separate tabs ("General", "Items", "Tax & Summary") | Unified single-screen workspace (Option B) |
| **Commercial Terms Access** | Scattered across tabs or full-screen panels | Right-side slide-over drawer (`w-[440px]`) with Escape dismissal |
| **Standard Grid Barcode Position** | Column 4 or 5 | Column 1 (Hardware scanner priority) |
| **Supplier Select Sizing** | Unconstrained (up to 1,125px on wide viewports) | Constrained to `max-w-md` (448px) |
| **Commercial Override Visibility** | No distinction between supplier defaults and overrides | Explicit badges (`Supplier Master Default` vs `PO Override`) |
| **Console Runtime Warnings** | Non-unique key warnings on row and browse renders | Compound keys (`${id}-${idx}`) eliminating warnings |

---

## 6. Architecture Impact
- **Component Layer:**
  - `CommercialDeliveryDrawer.tsx`: Encapsulates commercial and logistics fields with internal state synchronization and change detection.
  - `SupplierSelect.tsx`: Constrained with `max-w-md` boundary.
  - `PoGenerateTab.tsx`: Re-architected to immediate grid landing (`activeTab = "items"`), Column 1 Barcode order, and drawer trigger.
  - `PoSizewiseTab.tsx`: Integrated with drawer trigger `#sw-open-commercial-drawer-btn` and commercial term defaults synchronization.
- **Backend & Schemas:**
  - `backend/app/schemas/purchase.py`: Added explicit `barcode: Optional[str] = None` to `PurchaseOrderItemCreate` and payload normalizers.
  - `backend/app/services/purchase.py`: Line item creation and updating services extract and pass clean `barcode` into `TransactionLineItemInput`.
  - `src/lib/apiFetchV1.ts`: Enhanced fallback error unpacking to surface structured FastAPI dictionary details (`explanation`, `message`) per HREP.
- **Database:** Zero changes. `purchase_orders.rule_snapshots["commercial_terms"]` stores all commercial fields in JSONB.

---

## 7. Proposed Design
```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ SMRITI Retail OS — Unified Purchase Order Workspace (Option B)                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ COMPACT HEADER (h ~ 64px)                                                        │
│ [Supplier: CHAWLA FOOTWEAR (V-001) ▼] [PO: PO-2026-0001] [Date: 14/10/2026]     │
│ [Delivery: 21/10/2026] [Status: DRAFT]                [Commercial Details ⚙]     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PRIMARY ITEM GRID (Dominant Viewport Area - 85% Height)                          │
│ Mode: [● Sizewise Matrix]  [○ Standard Barcode]                                  │
│                                                                                  │
│ Sizewise Mode:                                                                   │
│ Article | Color | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | Qty | Rate | Tot │
│ CH-13C  | PEACH |  8 |  8 | 12 | 16 | 20 | 16 | 12 |  8 |  8 | 108 | 660  | ... │
│                                                                                  │
│ Standard Mode:                                                                   │
│ Barcode    | # | Item Code | Product Name | Color | Size | Qty | Rate | Total    │
│ 8901234001 | 1 | CH-13C-36 | Chawla Peach | PEACH | 36   |   8 | 660  | ...    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ COMPACT FOOTER & PERSISTENT ACTIONS                                              │
│ Items: 1  | Total Qty: 108  | Gross: ₹71,280.00 | Net: ₹74,844.00                │
│                                           [Save as Draft]  [Submit PO]           │
└──────────────────────────────────────────────────────────────────────────────────┘
       ▲
       │ Click [Commercial Details ⚙]
       ▼
┌───────────────────────────────────────────────────────────────────┐
│ Commercial & Delivery Details (Slide-Over Drawer - 440px)         │
│ Supplier: CHAWLA FOOTWEAR (V-001)                                 │
│ ───────────────────────────────────────────────────────────────── │
│ Payment Terms:       [ 30 Days               ▼ ] (Supplier Def.)  │
│ Freight Terms:       [ Paid by Supplier      ▼ ] (Supplier Def.)  │
│ Currency:            [ INR - Indian Rupee    ▼ ] (Supplier Def.)  │
│ Buyer:               [ Retail Buyer          ▼ ]                  │
│ Department:          [ Footwear              ▼ ]                  │
│ Delivery Location:   [ Main Warehouse (MAIN) ▼ ]                  │
│ Lead Time (Days):    [ 7                       ]                  │
│ Special Instructions:[ Handle with care. Urgent delivery.       ] │
│ ───────────────────────────────────────────────────────────────── │
│ [Reset to Defaults]                             [Done / ESC]      │
└───────────────────────────────────────────────────────────────────┘
```

---

## 8. Files Created
1. `src/components/purchase/CommercialDeliveryDrawer.tsx`: Commercial & Delivery slide-over drawer (`w-[440px] max-w-[90vw]`).
2. `src/tests/poModernizationPhase1.test.ts`: Vitest test suite with 11 targeted unit and integration tests.
3. `.architecture/certificates/PF-2026-1014-80EAEB.json`: Preflight certificate for `CommercialDeliveryDrawer.tsx`.
4. `.architecture/certificates/PF-2026-1014-E9EFEC.json`: Preflight certificate for `SupplierSelect.tsx`.
5. `docs/walkthrough/purchase/evidence/po_viewport_1280px.png`: Playwright screenshot at 1280 × 800.
6. `docs/walkthrough/purchase/evidence/po_viewport_1440px.png`: Playwright screenshot at 1440 × 900.
7. `docs/walkthrough/purchase/evidence/po_viewport_1920px.png`: Playwright screenshot at 1920 × 1080.
8. `docs/walkthrough/purchase/evidence/po_sizewise_commercial_drawer_open.png`: Screenshot of open commercial drawer over Sizewise mode.
9. `docs/walkthrough/purchase/evidence/po_sizewise_active_view.png`: Screenshot of Sizewise active grid.
10. `docs/walkthrough/purchase/evidence/po_standard_active_view.png`: Screenshot of Standard mode with Barcode in Column 1.
11. `docs/walkthrough/purchase/evidence/po_standard_commercial_details_view.png`: Screenshot of open commercial drawer over Standard mode.

---

## 9. Files Modified
1. `src/components/common/SupplierSelect.tsx`: Constrained outer wrapper with `max-w-md`.
2. `src/components/purchase/PoSizewiseTab.tsx`: Integrated drawer, trigger `#sw-open-commercial-drawer-btn`, bounded supplier container.
3. `src/components/purchase/PoGenerateTab.tsx`: Direct grid landing, Barcode Column 1, drawer triggers `#pogen-header-commercial-drawer-btn` and `#pogen-open-commercial-drawer-btn`, compound React keys, line barcode field.
4. `src/components/purchase/PurchBrowseDlg.tsx`: Compound React keys on item rows.
5. `src/lib/apiFetchV1.ts`: Structured FastAPI `detail` dictionary extraction.
6. `backend/app/schemas/purchase.py`: Added `barcode` attribute to line item schemas and normalizers.
7. `backend/app/services/purchase.py`: Extracted and mapped line `barcode` to `TransactionLineItemInput`.
8. `package.json`: Version bumped to `6.78.0`.
9. `CHANGELOG.md`: Added release notes for v6.78.0.
10. `docs/walkthrough/README.md`: Appended walkthrough entry.
11. `docs/walkthrough/purchase/Purchase_Order_UX_Modernization_Phase_1_Unified_Workspace_v6.78.0.md`: Authored formal 13-section walkthrough.

---

## 10. Dependencies
- React 18 + Lucide Icons + Tailwind CSS.
- SMRITI Design Tokens (`src/index.css`).
- FastAPI backend on port 8000 (Docker container `smriti-api`).
- PostgreSQL `smritisys` on port 2781 (Docker container `smriti-db`).
- Nginx frontend on port 8101 (Docker container `smriti-web`).

---

## 11. Risks
| Risk Area | Severity | Mitigation Mechanism |
| :--- | :---: | :--- |
| **1. Inadvertent Supplier Master Mutation** | Critical | Commercial terms in PO form are strictly isolated in local component state and saved to `purchase_orders.rule_snapshots["commercial_terms"]`. No PUT/PATCH calls are ever emitted to `/api/v1/suppliers` from the PO drawer. |
| **2. Loss of Barcode Scanner Ergonomics** | High | Barcode placed permanently in Column 1 of Standard Mode table with auto-focus support. |
| **3. Downstream GRN Inward Mismatch** | High | Discrete line barcodes sent in PO payload match physical SKU barcodes in `products` / `product_variants`. |
| **4. Responsive Layout Regression** | Medium | Empirical Playwright DOM measurements across 1280px, 1440px, and 1920px viewports verify supplier selector bounding (`<= 448px`). |

---

## 12. Rollback Strategy
All changes are non-destructive and schema-free:
1. Revert Git working tree changes: `git checkout -- src/components/purchase/ src/components/common/ backend/app/`.
2. Rebuild frontend bundle: `npm run build`.
3. Synchronize Docker web and api containers: `docker cp dist/. smriti-web:/usr/src/app/dist/` and `docker restart smriti-web smriti-api`.
4. Database remains 100% unaffected as zero migrations were created.

---

## 13. Verification Plan
1. **Architecture Duplication Gate:** Run `python scripts/architecture_duplication_gate.py` (`npm run architecture:check`). Must report 0 violations.
2. **UX Field Governance Guard:** Run `python scripts/ci_ux_field_governance_guard.py` (`npm run governance:fields`). Must report 0 critical errors.
3. **Launchpad Tile Validation:** Run `npm run validate-launchpad`. Must validate all 52 tiles.
4. **TypeScript Typecheck:** Run `npm run lint` (`tsc --noEmit`). Must exit with code 0.
5. **Targeted Vitest Suite:** Run `npx vitest run src/tests/poModernizationPhase1.test.ts src/tests/poModeConversion.test.ts src/tests/articleFiltering.test.ts`. All 25 tests must pass.
6. **Headless Playwright Viewport Verification:** Verify supplier width (`<= 448px`) across 1280px, 1440px, and 1920px viewports, confirm drawer width (440px), and verify Standard mode Column 1 header is `'Barcode'`.

---

## 14. Test Plan
- **Unit Tests:**
  - Verify supplier container has `max-w-md` styling.
  - Verify Barcode column is rendered in Column 1 in both compact and detailed Standard tables.
  - Verify Commercial drawer opens on trigger click and closes on Escape keydown.
  - Verify Commercial terms initialize from Supplier Master and record overrides when modified.
  - Verify Reset to Defaults button restores inherited supplier values.
- **Integration Tests:**
  - Verify bidirectional conversion between Sizewise matrix and Standard line items preserves all quantities, rates, and barcodes.
  - Verify structured FastAPI error response extraction in `apiFetchV1.ts`.

---

## 15. Documentation Impact
- Updated `CHANGELOG.md` with version 6.78.0.
- Created `docs/walkthrough/purchase/Purchase_Order_UX_Modernization_Phase_1_Unified_Workspace_v6.78.0.md` with 13 required sections.
- Updated master walkthrough index in `docs/walkthrough/README.md`.
- Authored this Implementation Plan in `docs/implementation/purchase/Purchase_Order_UX_Modernization_Phase_1_Plan_v6.78.0.md`.
- Updated master implementation index in `docs/implementation/README.md`.

---

## 16. Deployment Plan
1. Local bundle compilation: `npm run build`.
2. Deploy frontend bundle to container: `docker cp dist/. smriti-web:/usr/src/app/dist/`.
3. Restart frontend server: `docker restart smriti-web`.
4. Deploy backend updates: `docker cp backend/app/schemas/purchase.py smriti-api:/app/app/schemas/purchase.py` and `docker cp backend/app/services/purchase.py smriti-api:/app/app/services/purchase.py`.
5. Restart backend server: `docker restart smriti-api`.
6. Smoke test endpoints and verify UI live in browser at `http://localhost:8101/?tab=purchase`.

---

## 17. Status
**Completed** (Verified with Level A Empirical Evidence across Playwright DOM measurements, Vitest test runs, TypeScript typechecks, and Docker container deployments).

---

## 18. Related ADRs
- `docs/architecture/ADR_001_PURCHASE_VARIANT_AMBIGUITY.md`
- `docs/architecture/ADR_005_SUPPLIER_COMMERCIAL_TERMS_SNAPSHOT.md`

---

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Order_UX_Modernization_Phase_1_Unified_Workspace_v6.78.0.md`
- `docs/walkthrough/purchase/Article_Based_Auto_Filtering_Item_Grid_v6.77.0.md`
- `docs/walkthrough/purchase/Purchase_Order_Supplier_Commercial_Terms_Mapping_v6.76.0.md`
