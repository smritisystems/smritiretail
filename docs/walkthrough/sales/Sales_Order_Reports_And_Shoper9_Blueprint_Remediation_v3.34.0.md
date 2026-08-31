<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.34.0
  * Created    : 2026-08-27
  * Modified   : 2026-08-27
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Sales Order Reports Enhancement & Shoper9 Blueprint Integration Remediation

**Version:** `v3.34.0`
**Area:** `Sales / BI Reporting / Legacy Blueprints`
**Status:** `Verified & Completed`

---

## 1. Purpose
Enhance and complete the 7 Sales Order reports (`RPT-SO-001` through `RPT-SO-007`) in the SMRITI Retail OS BI Center, wire real PostgreSQL database queries against canonical `sales_orders`, `sales_order_items`, and `sales_order_invoice_allocations` tables with multi-tenant isolation, remove placeholder fallbacks, and fix Shoper9 blueprint matrix mapping and test suites.

---

## 2. Scope
- **Backend API & Query Engine:**
  - `backend/app/schemas/reports.py`: Enhanced schemas with standardized `report_id`, `report_name`, `generated_at`, `filters`, `summary`, `rows`, `totals`, and `lines`.
  - `backend/app/services/reports.py`: Added analytical SQL aggregation logic, tenant filters (`company_id`, `branch_id`), date filtering, status filtering, and product-level billing ratio calculations.
  - `backend/app/services/sales.py`: Added parameterized query filtering and eager-loading of items and allocations.
  - `backend/app/api/v1/reports.py`: Endpoints for `RPT-SO-001` through `RPT-SO-007`.
- **Frontend UI & Visual Formatters:**
  - `src/components/ReportDesignerTab.tsx`: Replaced generic placeholders, wired real endpoints, set FY 2026-2027 default date range (`2026-04-01`), added expandable Technical Details accordion, and formatted all metrics with 2-decimal Indian Rupee notation.
- **Legacy Shoper9 Blueprint Engine:**
  - `scripts/shoper9_blueprint_parser.py`: Added CLI argument parser (`--source-dir`, `--output-dir`, `--timestamp`) for deterministic, reproducible artifact generation.
  - `docs/legacy/shoper/SH9_MAP_MATRIX.csv`: Corrected index shift for menu items 418–427.
- **Testing & Verification:**
  - `backend/tests/test_sales_order_reports.py`: 8 endpoint and mapping unit tests.
  - `backend/tests/test_shoper9_blueprint_parser.py`: Synthetic fixture test for deterministic parser reproducibility.
  - `src/tests/shoper9BlueprintMapping.test.ts`: Vitest test suite for legacy blueprint mapping.

---

## 3. Files Created
- `backend/tests/test_sales_order_reports.py`
- `docs/walkthrough/sales/Sales_Order_Reports_And_Shoper9_Blueprint_Remediation_v3.34.0.md`

---

## 4. Files Modified
- `backend/app/schemas/reports.py`
- `backend/app/services/reports.py`
- `backend/app/services/sales.py`
- `backend/tests/conftest.py`
- `backend/tests/test_shoper9_blueprint_parser.py`
- `docs/legacy/shoper/SH9_MAP_MATRIX.csv`
- `docs/legacy_blueprints/shoper9/menus.json`
- `docs/legacy_blueprints/shoper9/review_report.md`
- `scripts/shoper9_blueprint_parser.py`
- `src/components/ReportDesignerTab.tsx`
- `src/tests/shoper9BlueprintMapping.test.ts`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **Canonical Table Structure:** Queries strictly operate on `sales_orders`, `sales_order_items`, `sales_order_invoice_allocations`, `sales_invoices`, and `sales_invoice_items`. Decommissioned tables (`sales_invoice_lines`) are prohibited.
- **Multi-Tenant Scoping:** All queries enforce `company_id` and `branch_id` isolation, supporting both exact tenant matches and company-wide null-scoped master records.
- **Dual Payload Contract:** Backend returns both modern standardized envelope fields (`report_id`, `report_name`, `filters`, `summary`, `rows`, `totals`) and backward-compatible top-level keys (`lines`, `total_orders`, `total_order_value`).

---

## 6. Design Rationale
- Initializing `filters.startDate` to `"2026-04-01"` ensures that opening any report in the BI Studio immediately displays live historical transactions for the current fiscal year without requiring manual date picker manipulation.
- Providing an expandable "Technical Details" panel keeps the primary interface clean for business users while giving auditors and developers instant access to API parameters, execution context, and row counts.

---

## 7. Implementation Summary
1. **Sales Order Summary (`RPT-SO-001`):** Computes total orders (60), ordered quantity (25,864), gross order value (₹3,17,34,919.90), billed value (₹1,06,00,428.59), pending value (₹2,11,34,491.31), and status counts.
2. **Pending Orders (`RPT-SO-002`):** Lists all active orders awaiting billing with pending quantities and outstanding values.
3. **Billed vs Pending Orders (`RPT-SO-003`):** Calculates billed vs pending percentages and billing ratios per order.
4. **Customer-wise Orders (`RPT-SO-004`):** Aggregates orders by customer entity, calculating total quantity, booked value, billed value, pending value, and average order ticket.
5. **Product-wise Ordered Quantity (`RPT-SO-005`):** Aggregates 450 distinct products/styles with ordered, billed, and pending quantities and average costs.
6. **Order Fulfillment Status (`RPT-SO-006`):** Groups sales orders by fulfillment status (`PARTIALLY_BILLED`, `UNFULFILLED`, `FULLY_BILLED`).
7. **Invoice Allocation Report (`RPT-SO-007`):** Tracks 120 linked tax invoices against parent sales orders with allocated and pending quantities.

---

## 8. Tests Executed
1. `npx vitest run`: 44 test files, 343 tests passed.
2. `pytest backend/tests/`: 39 unit and integration tests passed.
3. `npm run lint`: `tsc --noEmit` passed with 0 errors.
4. `npm run build`: Vite production build passed (3,512 modules transformed).
5. `git diff --check`: 0 whitespace errors.

---

## 9. Verification Results
- **Automated Test Results:**
  - Vitest: 343 / 343 passed (100%)
  - Pytest: 39 / 39 passed (100%)
  - TypeScript: 0 lint/compile errors
- **Direct Database Execution:**
  - Real database `smriti001` verified with 60 Sales Orders, 18,036 Sales Order Items, and 120 Sales Order Invoice Allocations.
  - Zero placeholder text rendered.

---

## 10. Known Limitations
- Advanced OCR parsing for physical PO PDFs remains scaffolding until real production image volumes are provided.

---

## 11. Future Work
- Add automated PDF and Excel schedule dispatch workers for periodic sales order summary emails.

---

## 12. Related ADRs
- `docs/architecture/ADR_001_FastAPI_Postgres_Sole_Backend.md`
- `docs/architecture/ADR_004_Multi_Tenant_Database_Isolation.md`

---

## 13. Related RFCs
- `docs/rfc/RFC_009_Sales_Order_Allocation_Engine.md`
