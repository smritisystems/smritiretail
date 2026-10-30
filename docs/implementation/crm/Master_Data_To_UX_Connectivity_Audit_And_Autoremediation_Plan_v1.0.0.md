<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.5
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Implementation Plan
  Policy ID    : IPGP-v1.0
-->

# Implementation Plan: Master Data-to-UX Connectivity Audit & Auto-Remediation v1.0.0

## 1. Objective
Perform a comprehensive, codebase-wide audit of all UX components and screens in SMRITI Retail OS to detect, classify, and eliminate hardcoded mock data, dummy records, static placeholder totals, and disconnected UI fallbacks. Reconnect all audited screens to authoritative PostgreSQL database tables and FastAPI backend endpoints, beginning with the Customer 360° / PSV (Party Stock Visibility) screen, ensuring zero fabricated business data reaches production UX.

## 2. Business Motivation
In enterprise retail environments, executive decisions, store operations, and statutory audits rely strictly on authentic transactional ledgers. Hardcoded metric tiles (e.g. `5,420 Document Qty`, `5,180 Received Qty`), prototype tables (`PO-2026-001` with fabricated barcodes), and silent mock-data fallbacks create severe audit risk, undermine trust, and violate SMRITI Retail OS core architecture principles. Every displayed quantity, count, status, and currency figure must trace directly to PostgreSQL system-of-record tables.

## 3. Scope
- **Customer 360° & PSV Stock Visibility (`Customer360DashboardView.tsx`, `CorporateCustomer360.tsx`):**
  - Replace hardcoded PSV KPI metric tiles (`5,420`, `5,180`, `4,980`, `240`, `120`, `80`) with live database totals derived from `/api/v1/psv/reconciliation`.
  - Replace hardcoded `125 Total Records` badge with live reactive count.
  - Replace hardcoded `psvDetailedRows` reference dataset (`PO-2026-001` through `PO-2026-005`) with live query execution against `sales_invoices`, `sales_invoice_items`, and `psv_stock_events`.
  - Dynamically populate filter dropdowns (Store / Outlet, Child Customer, Article / Style, Color, Size) from live data.
  - Eliminate hardcoded `documents`, `fallbackInvoices`, `billingAddresses`, `deliveryAddresses`, `contacts`, and `recentActivity` arrays in favor of authentic database entities and honest empty states.
- **Application-Wide Silent Mock-Data Fallbacks:**
  - `src/App.tsx`: Eliminate `dummy-master-0001` / `DUMMY-001` product injection when database product queries return empty lists.
- **Backend API & Service Enhancements:**
  - `backend/app/services/psv_projection.py` & `backend/app/api/v1/psv.py`: Add `customer_id`, `store_code`, `start_date`, and `end_date` parameters to `get_quantity_reconciliation` for scoped party reconciliation.
  - `backend/app/api/v1/crm.py`: Incorporate PSV reconciliation summary into `CorporateCustomer360Response`.

## 4. Current State
- The Customer 360° Dashboard renders authentic company, GSTIN, PAN, and store network counts for `cust-rrl-192b561d` (`RRL-001`), but when switching to the PSV Stock tab:
  - The 6 metric tiles display static integers (`5,420`, `5,180`, `4,980`, `240`, `120`, `80`).
  - The stream table displays 5 mock rows (`PO-2026-001` to `PO-2026-005`) using sample barcodes (`8901234567890`) with fictitious apparel descriptions.
  - The header displays a hardcoded string `125 Total Records`.
  - The dropdown filters have static hardcoded `<option>` elements.
  - In `src/App.tsx`, an empty product list automatically injects a dummy item `DUMMY-001`.

## 5. Gap Analysis
| Element / Component | Current State | Target State |
|---|---|---|
| PSV KPI Tiles (Overview & PSV Tab) | Hardcoded numbers (`5,420`, `5,180`, `4,980`, `240`, `120`, `80`) | Live database aggregates (`total_document_qty`, `total_received_qty`, `total_approved_qty`, `total_pending_approval_qty`, `total_short_qty`, `total_excess_qty`) |
| PSV Reconciliation Stream Table | 5 hardcoded mock rows (`PO-2026-001` - `PO-2026-005`) | Dynamic pagination & live rows from `/api/v1/psv/reconciliation?customer_id=...` |
| PSV Total Records Counter | Hardcoded `125 Total Records` | Dynamic `{totalItems} Total Records` matching database count |
| PSV Filter Dropdowns | Static options (`REL001-001`, `REL-MUM-001`) | Dynamically generated options from live customer stores and item attributes |
| Product Master Empty State (`App.tsx`) | Injects fabricated `DUMMY-001` product | Maintains honest empty state `[]` with empty-state UI |
| Customer 360 Secondary Tabs | Fallback arrays for documents, contacts, activity | Authoritative database-backed collections with empty-state indicators |

## 6. Architecture Impact
- **Zero Database Schema Migrations:** Reuses existing PostgreSQL tables (`customers`, `customer_delivery_locations`, `sales_invoices`, `sales_invoice_items`, `psv_parties`, `psv_stock_events`, `psv_stock_balances`).
- **FastAPI Backend-of-Record:** Enhances `/api/v1/psv/reconciliation` to accept customer scoping and returns canonical DTOs.
- **Tenant Isolation:** Enforces `company_id` and `customer_id` filtering on all queries.

## 7. Proposed Design
1. **Backend (`psv_projection.py` & `psv.py`):**
   - Extend `PSVProjectionService.get_quantity_reconciliation()` with `customer_id`, `store_code`, `start_date`, and `end_date`.
   - Filter `SalesInvoice` records by `customer_id` and `delivery_store_code` before executing line item and event reconciliations.
2. **Frontend (`Customer360DashboardView.tsx`):**
   - Introduce `useLivePsvReconciliation` hook or effect querying `/api/v1/psv/reconciliation` with customer, store, and date filters.
   - Bind metric tiles to `psvSummary` from the API.
   - Bind stream table to `psvItems` from the API.
   - Generate filter options from `liveStoreNetwork` and unique styles/colors in `psvItems`.
3. **Core App (`App.tsx`):**
   - Remove silent injection of `dummy-master-0001`.

## 8. Files Created
- `docs/implementation/crm/Master_Data_To_UX_Connectivity_Audit_And_Autoremediation_Plan_v1.0.0.md`
- `docs/walkthrough/crm/Master_Data_To_UX_Connectivity_Audit_And_Autoremediation_v1.0.0.md`
- `docs/audit/MASTER_DATA_CONNECTIVITY_REGISTER.md`

## 9. Files Modified
- `backend/app/services/psv_projection.py`
- `backend/app/api/v1/psv.py`
- `src/components/customer/corporate360/Customer360DashboardView.tsx`
- `src/App.tsx`
- `src/tests/customer360DashboardView.test.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.111+
- SQLAlchemy 2.0+ (asyncpg driver)
- PostgreSQL 16
- React 18 / Vite 5 / TypeScript 5.5

## 11. Risks
- Large transaction volumes on `sales_invoice_items`: Mitigated by default limit (200 records) and indexed joins on `invoice_id` and `customer_id`.
- Soft-deleted locations appearing in store dropdowns: Mitigated by filtering `is_deleted = false` and `status = 'ACTIVE'`.

## 12. Rollback Strategy
- All modifications are committed to Git branch `smritiNX`. Reverting commit restores previous static reference dataset without database downtime.

## 13. Verification Plan
- Direct asyncpg database inspection comparing live PostgreSQL records with API responses.
- Automated Vitest test suite executing in Node environment.
- Automated Pytest test suite executing against FastAPI test client.
- Full TypeScript type-checking via `npx tsc --noEmit`.

## 14. Test Plan
- Verify PSV reconciliation API returns 200 with accurate item count and quantity summary when given `customer_id`.
- Verify Customer 360 Dashboard renders live summary numbers matching database totals.
- Verify table rows render live invoice items, barcodes, store codes, and workflow badges.
- Verify search and filter interactions correctly mutate query parameters.
- Verify `App.tsx` leaves products list empty when API returns 0 items.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Update `docs/walkthrough/README.md` master index.
- Create `docs/audit/MASTER_DATA_CONNECTIVITY_REGISTER.md`.
- Append version entry in `CHANGELOG.md`.

## 16. Deployment Plan
- Deploy backend service updates to FastAPI containers.
- Deploy frontend bundle to web container.
- Run health checks on `/api/v1/health` and `/api/v1/psv/reconciliation`.

## 17. Status
Approved — In Progress

## 18. Related ADRs
- `docs/architecture/ADR-001-FASTAPI-POSTGRES-SOLE-BACKEND.md`
- `docs/architecture/ADR-014-PSV-SHADOW-INVENTORY-LEDGER.md`

## 19. Related Walkthroughs
- `docs/walkthrough/crm/CRM_Customer_360_Stores_Outlets_Integrity_Remediation_v6.99.1.md`
- `docs/walkthrough/crm/Master_Data_To_UX_Connectivity_Audit_And_Autoremediation_v1.0.0.md`
