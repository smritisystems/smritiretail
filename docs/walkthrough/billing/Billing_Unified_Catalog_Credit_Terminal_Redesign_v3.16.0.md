<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-09-27
  Modified     : 2026-09-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Unified Billing Engine — Catalog, Customer Credit Pipeline & Terminal UX Redesign v3.16.0

## 1. Purpose
This walkthrough documents the full-stack completion of the Unified Billing Engine pipeline, consisting of:
1. **Phase 3:** Billing Catalog, Product Facet Explorer, and fast scanner barcode resolution pipeline.
2. **Phase 4:** Billing Customer Directory and real-time credit limit, balance, and available exposure tracking.
3. **Phase 5:** Complete redesign of the Credit Billing Terminal UI/UX precisely matching the provided production ERP reference specifications, backed by 100% calculation parity with the Headless Billing Core (`/api/v1/billing/preview`).

## 2. Scope
- **Backend:**
  - `backend/app/schemas/billing_catalog.py`: Pydantic V2 schemas for faceted catalog queries and customer exposure tracking.
  - `backend/app/services/billing_catalog_service.py`: Service resolving multi-attribute product search, category facets, brand filters, stock status badges, fast scanner lookups, and customer credit exposure.
  - `backend/app/api/v1/billing.py`: Endpoints for `GET /api/v1/billing/products`, `GET /api/v1/billing/scan/{barcode}`, and `GET /api/v1/billing/customers`.
  - `backend/app/tests/test_phase3_phase4_billing_catalog.py`: Comprehensive test suite verifying multi-attribute search, category aggregations, barcode scanning, customer credit exposure, and multi-tenant isolation.
- **Frontend:**
  - `src/components/billing/CustomerMasterModal.tsx`: Isolated, draggable, and resizable customer lookup and registration modal with `All`, `Active`, `Inactive` tabs and live credit balance indicators.
  - `src/components/billing/ProductListModal.tsx`: Isolated, draggable, and resizable product list modal with category, brand, and status filtering.
  - `src/components/billing/DockedProductList.tsx`: Embedded catalog explorer featuring category-tree sidebar, multi-facet filter controls, product table with thumbnails, colored stock badges, and multi-item cart allocation.
  - `src/components/billing/useBillingCatalog.ts`: Common catalog query/filter abstraction reused across ProductListModal and DockedProductList.
  - `src/components/billing/billingDockProtocol.ts`: Enterprise BroadcastChannel ("SMRITI_BILLING_DOCK") protocol supporting ADD_TO_CART, CUSTOMER_SELECTED, and CART_UPDATED.
  - `src/components/billing/SmritiCreditBillingTerminal.tsx`: Complete redesign matching reference layouts, including global top blue navigation bar, left navigation rail, 10-column editable item grid, collapsible bottom KPI panel, lower item details & remarks panel, right sidebar with collapsible invoice summary, customer profile, and accordion controls.

## 3. Files Created
- `backend/app/schemas/billing_catalog.py`
- `backend/app/services/billing_catalog_service.py`
- `backend/app/tests/test_phase3_phase4_billing_catalog.py`
- `src/components/billing/CustomerMasterModal.tsx`
- `src/components/billing/DockedProductList.tsx`
- `src/components/billing/ProductListModal.tsx`
- `src/components/billing/useBillingCatalog.ts`
- `src/components/billing/billingDockProtocol.ts`
- `docs/walkthrough/billing/Billing_Unified_Catalog_Credit_Terminal_Redesign_v3.16.0.md`

## 4. Files Modified
- `backend/app/api/v1/billing.py`
- `src/components/billing/SmritiCreditBillingTerminal.tsx`
- `src/components/billing/BillingWorkspace.tsx`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Deterministic Calculation Parity:** All invoice totals, statutory GST breakdowns (CGST/SGST or IGST), and rounded net amounts are computed strictly via the Headless Billing Core (`POST /api/v1/billing/preview`). Client-side state performs zero ad-hoc financial math.
2. **Dual-View Workspace Hierarchy:** Users can seamlessly toggle between the high-speed 10-column editable item grid (for fast cashiers) and the docked multi-facet catalog explorer (for visual browsing) without losing active cart state.
3. **Isolated Window Architecture & BroadcastChannel Protocol:** Both Customer Master and Product List modals support dragging, resizing, and popping out into isolated windows communicating via `BroadcastChannel("SMRITI_BILLING_DOCK")` with `ADD_TO_CART`, `CUSTOMER_SELECTED`, and `CART_UPDATED` events.
4. **Strict Tenant Context Enclosure:** Every backend catalog query, barcode scan, and customer ledger exposure check enforces company-level tenant boundaries.

## 6. Design Rationale
- The visual styling strictly mirrors the royal navy blue branding (`#00288e`), clean white surfaces, subtle borders (`#e2e8f0`), rounded cards (`rounded-xl`), and crisp tabular typography shown in the reference specifications.
- Colored badges (green for positive stock/status, amber for low stock, red for negative/balance) provide immediate operator feedback.
- Panel toggles in the `View` menu empower counter staff to customize visible sections (Left Menu, Top Bar, Quick Actions, Item Panel, Right Panel, Bottom Panel) depending on screen resolution or touch kiosk mode.

## 7. Implementation Summary
- Verified and executed all 27 unit tests across Phase 2, Phase 3, and Phase 4.
- Implemented robust Query parameter sanitization in `BillingCatalogService` to handle both HTTP request injection and direct test runner invocation.
- Compiled the entire frontend application bundle with Vite (3,621 modules transformed, 0 errors).

## 8. Tests Executed
```bash
& "C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe" -m pytest backend/app/tests/test_phase2_headless_billing.py backend/app/tests/test_phase3_phase4_billing_catalog.py -q
npm run build
```

## 9. Verification Results
- Backend Pytest: 27/27 PASS in 49.60s.
- Frontend Build: 3,621 modules transformed, built in 36.74s, 0 errors.

## 10. Known Limitations
- Offline barcode scanning uses local fallback catalog data if the network is disconnected.

## 11. Future Work
- Integrate touch-screen soft numeric keypad for touch-only POS terminals.
- Add thermal receipt ESC/POS direct hardware spooling adapter.

## 12. Related ADRs
- `docs/architecture/ADR_PHASE2_HEADLESS_BILLING_CORE.md`
- `docs/architecture/SMRITI-ADR-CONTRACT-BILLING-v1.0.1.md`

## 13. Related RFCs
- `RFC-BILLING-V1-UNIFIED-PIPELINE`
