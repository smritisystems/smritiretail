<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Implementation Plan
  Policy ID    : IPGP-v1.0
-->

# Implementation Plan: CRM Customer 360° Stores, Outlets & Financial Exposure Integrity Remediation v6.99.1

## 1. Objective
Remediate data consistency, visual integrity, and financial accounting precision across customer hierarchies, store delivery networks, and credit exposures on the Customer 360° Dashboard (`Customer360DashboardView.tsx`). Permanently eliminate hardcoded "85 Stores" headers, static Phoenix Mall mock tables, prototype credit-limit fallbacks (`500000000`), and fabricated sparklines, binding the UI exclusively to authoritative PostgreSQL API data.

## 2. Business Motivation
Large enterprise retail accounts such as Reliance Retail Limited (`RRL-001` / `cust-rrl-192b561d`) operate nationwide store and distribution center (DC) networks with consolidated trade credit and multi-tier hierarchies. Displaying prototype mock tables or hardcoded counts compromises executive trust and operational dispatch accuracy. Furthermore, clear semantic distinction between Revolving Credit Exposure (₹155.24) and Unpaid Invoices Receivables (₹275.20) is essential for regulatory auditability and credit control.

## 3. Scope
- **Backend Schemas & Filtering:**
  - `backend/app/schemas/crm.py`: Prioritize `CustomerCompanyRelationship` credit limit and credit days before falling back to `CustomerGroup`. Exclude soft-deleted items (`is_deleted = TRUE`) from `billing_locations`, `delivery_locations`, `gst_registrations`, and `external_identities`.
- **Backend API Endpoints & Aggregation:**
  - `backend/app/api/v1/crm.py`: Filter soft-deleted locations in `/customers/{customer_id}/corporate-360`. Enhance store type classification for Distribution Centers (`Distribution Center`) vs Retail Outlets (`Store`). Replace `limit(10)` query with calendar-month grouped purchase trend query over trailing 6 months.
- **Frontend Customer 360 Workspace:**
  - `src/components/customer/corporate360/Customer360DashboardView.tsx`: Replace static 85-store heading and Phoenix Mall mock table with dynamic `liveStoreNetwork` bindings. Add authentic empty state for direct single-tier accounts (0 child accounts) and awaiting trend state for empty 6-month purchase history.
  - `src/components/customer/corporate360/CorporateAccountHeader.tsx`, `CorporateKpiCards.tsx`, `CorporatePsvWidget.tsx`, `CorporateStoreNetwork.tsx`, `CorporateStoreTypeWidget.tsx`, `src/components/customer/corporate360/types.ts`: Remove hardcoded prototype fallbacks (`500000000`, `2318`, `2456`, `1624000000`).
- **Regression Test Coverage:**
  - `src/tests/customer360DashboardView.test.tsx` (Vitest) and `backend/app/tests/test_corporate_customer_360.py` (Pytest).

## 4. Current State
- Customer 360 Stores / Outlets screen rendered hardcoded `"85 Stores — 85 destinations"` and static table rows for Phoenix Marketcity (`REL-MUM-001`).
- Soft-deleted delivery locations (59 out of 66 for Reliance Retail) were included in total counts.
- Credit limit defaulted to ₹50,00,00,000 (`500000000`) instead of the configured relationship or group credit limit.
- Purchase trend sparkline rendered static hardcoded SVG paths instead of querying actual monthly purchase aggregates.
- Child customer count was displayed as 0 without contextual clarification that RRL is a direct single-tier corporate account.

## 5. Gap Analysis
| Requirement | Existing State | Remediated State |
|---|---|---|
| Stores & Outlets Count & List | Hardcoded "85 Stores" + static Phoenix Mall table | Dynamic `liveStoreNetwork` from API excluding soft-deleted locations |
| Soft-Deleted Location Handling | 59 soft-deleted locations included in counts | Filtered out via `not is_deleted` across schemas and endpoints |
| Store Type Classification | Generic or unclassified | Clear distinction between Distribution Centers / Logistics Hubs and Retail Counters |
| Credit Limit Mapping | Fallback to prototype ₹50,00,00,000 | Authoritative `CustomerCompanyRelationship` lookup with fallback to `CustomerGroup` |
| Purchase Volume Trend | Static SVG sparkline bars | Dynamic trailing 6 calendar months purchase trend aggregation |
| Parent-Child Hierarchy | Bare "0 Child Accounts" | Contextual single-tier account card (`Direct Single-Tier Account — 0 Child Accounts`) |
| Credit Exposure vs Invoices | Ambiguous balance presentation | Reconciled Revolving Credit Exposure (₹155.24) and Unpaid Invoices Receivables (₹275.20) |

## 6. Architecture Impact
- **Zero Database Migrations:** Uses existing PostgreSQL tables (`customers`, `customer_delivery_locations`, `customer_company_relationships`, `customer_credit_ledger_entries`, `sales_invoices`).
- **Single System of Record:** Retains FastAPI + PostgreSQL as the sole backend authority per SMRITI Platform Architecture.
- **Tenant Isolation:** Enforces strict `tenant_id` and `company_id` boundary checks across all queries and aggregations.

## 7. Proposed Design
1. **Schema & Endpoint Filtering:**
   - In `backend/app/schemas/crm.py`, inspect `CustomerCompanyRelationship` for active company's credit limit; filter deleted locations.
   - In `backend/app/api/v1/crm.py`, aggregate store types based on location name and code patterns (`DC`, `Warehouse`, `Hub` -> `Distribution Center`, others -> `Store`).
   - Aggregate sales invoices by truncating invoice dates to the first of the month (`DATE_TRUNC('month', invoice_date)`), covering trailing 6 calendar months in UTC.
2. **Frontend UI Dynamism:**
   - In `Customer360DashboardView.tsx`, compute store network length and distribution center counts from live data.
   - Render `liveStoreNetwork` in the stores table with store code, name, city, state, and type badges.
   - If no purchase trend exists, display clean `"Awaiting Trend"` badge rather than hardcoded bars.

## 8. Files Created
1. `docs/walkthrough/crm/CRM_Customer_360_Stores_Outlets_Integrity_Remediation_v6.99.1.md`
2. `docs/implementation/crm/CRM_Customer_360_Stores_Outlets_Integrity_Remediation_Plan_v6.99.1.md`

## 9. Files Modified
1. `backend/app/schemas/crm.py`
2. `backend/app/api/v1/crm.py`
3. `src/components/customer/corporate360/Customer360DashboardView.tsx`
4. `src/components/customer/corporate360/CorporateAccountHeader.tsx`
5. `src/components/customer/corporate360/CorporateKpiCards.tsx`
6. `src/components/customer/corporate360/CorporatePsvWidget.tsx`
7. `src/components/customer/corporate360/CorporateStoreNetwork.tsx`
8. `src/components/customer/corporate360/CorporateStoreTypeWidget.tsx`
9. `src/components/customer/corporate360/types.ts`
10. `src/tests/customer360DashboardView.test.tsx`
11. `docs/walkthrough/README.md`
12. `docs/implementation/README.md`
13. `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.115+
- SQLAlchemy 2.0+ (PostgreSQL dialect)
- React 18
- Lucide React icons
- Vite 5+ / Vitest 4.1+

## 11. Risks
- **Historical Reporting on Soft-Deleted Locations:** If users require viewing archived locations in a distinct historical tab, excluding them globally from `delivery_locations` might hide past history. Mitigated because audit trails remain intact in PostgreSQL, and an administrative toggle can be added in future without modifying base contracts.

## 12. Rollback Strategy
If rollback is required, revert the uncommitted working tree changes using `git restore` on modified files and remove the new documentation files. No database schema changes or migrations were made.

## 13. Verification Plan
- Unit & regression testing verifying soft-deleted location exclusion.
- Dynamic store network binding tests in Vitest.
- Backend API tests in Pytest.
- TypeScript compiler zero-error verification.
- Production bundle build verification.
- Architecture guard and UX field governance validation.

## 14. Test Plan
- Run `npx vitest run src/tests/customer360DashboardView.test.tsx` (31 tests green).
- Run `pytest backend/app/tests/test_corporate_customer_360.py` (16 tests green).
- Run `npx tsc --noEmit` (0 errors).
- Run `npm run build` (Clean production bundle build).
- Run `python scripts/architecture_duplication_gate.py` (11/11 passed, 0 violations).
- Run `python scripts/ci_ux_field_governance_guard.py` (0 violations).

## 15. Documentation Impact
- Created Walkthrough: `docs/walkthrough/crm/CRM_Customer_360_Stores_Outlets_Integrity_Remediation_v6.99.1.md`.
- Appended Walkthrough Master Index: `docs/walkthrough/README.md`.
- Appended Implementation Plan Master Index: `docs/implementation/README.md`.
- Updated CHANGELOG: `CHANGELOG.md` under version `6.99.1`.

## 16. Deployment Plan
Target branch is `smritiNX` in `F:\SMRITRretailNX`. Per DEV vs TEST policy, local remediation is committed only upon explicit user confirmation, then pushed to DEV repository and pulled into TEST environments.

## 17. Status
**Completed** (Verified: 31/31 Vitest green, 16/16 Pytest green, 0 TypeScript errors, clean Vite build, 0 Architecture Guard violations).

## 18. Related ADRs
- `ADR-0042`: Canonical Identity Resolution & Concurrency Safeguards
- `ADR-0089`: Decommissioning of Legacy Stores Table in favor of CustomerDeliveryLocation

## 19. Related Walkthroughs
- `docs/walkthrough/crm/CRM_Customer_360_Stores_Outlets_Integrity_Remediation_v6.99.1.md`
