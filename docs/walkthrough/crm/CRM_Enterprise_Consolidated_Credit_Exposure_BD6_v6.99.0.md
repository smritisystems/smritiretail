<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Enterprise Consolidated Credit Exposure & Treasury Monitoring (BD-6)

**Document ID:** WT-CRM-BD6-001  
**Version:** 6.99.0  
**Status:** Completed & Verified  
**Date:** 2026-10-19  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose

This document provides the canonical architectural walkthrough and verification record for the implementation of **Business Decision 6 (BD-6: Enterprise Consolidated Credit Exposure & Treasury Monitoring)** in SMRITI Retail OS. BD-6 aggregates multi-company commercial credit relationships under Model C, queries actual receivables ledger balances across all operating legal entities (`customer_credit_ledger_entries`), computes consolidated corporate group credit exposure metrics, evaluates central treasury credit risk tiers, and surfaces proactive risk indicators in the Customer Master Workspace.

---

## 2. Scope

- **Backend Schemas (`backend/app/schemas/crm.py`):**
  - Defined `CompanyCreditExposureItem` and `CustomerCreditExposureResponse` with dual camelCase serialization aliases.
- **Backend Service (`backend/app/services/crm.py`):**
  - Implemented `CrmService.get_customer_credit_exposure(customer_id, include_inactive)`.
  - Aggregates multi-company limits and payment terms from Model C `customer_company_relationships`.
  - Queries latest real-time receivables ledger balances (`balance_after`) from `customer_credit_ledger_entries` for each legal entity.
  - Computes per-company available credit, utilization percentage, and exposure status (`NORMAL`, `HIGH_WARNING`, `CRITICAL_BREACH`, `ON_HOLD`).
  - Evaluates consolidated group exposure metrics: total credit limit, total credit used, available credit, group utilization percentage, and group risk tiers (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`, `ON_HOLD`).
- **REST API Endpoint (`backend/app/api/v1/crm.py`):**
  - Mounted `GET /api/v1/crm/customers/{customer_id}/credit-exposure`.
- **Frontend Master Types (`src/components/customer/types.ts`):**
  - Added TypeScript contracts `CompanyCreditExposureItem` and `CustomerCreditExposureResponse`.
- **Persistent Header UI (`CorporateMasterAccountHeader.tsx`):**
  - Added multi-company group credit exposure badge with risk-tier color coding and consolidated credit limit / outstanding figures alongside entity-specific parameters.
- **Commercial Terms Panel UI (`CorporateCommercialTermsPanel.tsx`):**
  - Added dedicated "Consolidated Group Treasury & Credit Exposure (BD-6)" monitoring section with 4 KPI summary cards, dynamic multi-tier progress bar, hold alert banner, and legal entity breakdown table.
- **Workspace Orchestration (`CustMasterWs.tsx`):**
  - Added `creditExposure` state, `loadCreditExposure` fetcher, real-time exposure refresh triggers upon relationship mutation, and wired exposure data to header and commercial terms components.
- **Verification Suites:**
  - Authored 7 comprehensive backend unit tests in `backend/tests/test_customer_credit_exposure_bd6.py`.
  - Added 5 dedicated UI and risk-rendering unit tests in `src/tests/customerMasterLifecycle.test.tsx`.
  - Re-issued Preflight Certificates `PF-2026-1019-67EBA5` and `PF-2026-1019-660016`.
  - Passed Architecture Duplication Gate (11/11 checks green).
  - Passed TypeScript compilation check (`npm run lint`: 0 errors).

---

## 3. Files Created

| File Path | Description |
|---|---|
| `backend/tests/test_customer_credit_exposure_bd6.py` | Comprehensive Pytest suite covering single/multi-company exposure calculations, hold propagation, limit breaches, ledger balance queries, and FastAPI route integration. |
| `.architecture/certificates/PF-2026-1019-67EBA5.json` | Preflight Certificate for updated `CorporateCommercialTermsPanel.tsx`. |
| `.architecture/certificates/PF-2026-1019-660016.json` | Preflight Certificate for updated `CorporateMasterAccountHeader.tsx`. |
| `docs/walkthrough/crm/CRM_Enterprise_Consolidated_Credit_Exposure_BD6_v6.99.0.md` | Authoritative walkthrough and verification document. |

---

## 4. Files Modified

| File Path | Modifications |
|---|---|
| `backend/app/schemas/crm.py` | Added `CompanyCreditExposureItem` and `CustomerCreditExposureResponse` Pydantic models with camelCase aliases. |
| `backend/app/services/crm.py` | Implemented `get_customer_credit_exposure` with multi-company relationship aggregation, ledger balance queries, and treasury risk evaluation. |
| `backend/app/api/v1/crm.py` | Mounted `GET /api/v1/crm/customers/{customer_id}/credit-exposure`. |
| `src/components/customer/types.ts` | Added `CompanyCreditExposureItem` and `CustomerCreditExposureResponse` TypeScript interfaces. |
| `src/components/customer/corporateWorkspace/CorporateMasterAccountHeader.tsx` | Added `creditExposure` prop, group exposure indicator badge with risk color coding, and consolidated limits. |
| `src/components/customer/corporateWorkspace/CorporateCommercialTermsPanel.tsx` | Added `creditExposure` prop, fallback group exposure memo, and BD-6 Consolidated Group Treasury & Credit Exposure section with KPI cards and breakdown table. |
| `src/components/customer/CustMasterWs.tsx` | Added `creditExposure` state, `loadCreditExposure` fetcher, refresh on relationship changes, and passed exposure prop to header and commercial panel. |
| `src/tests/customerMasterLifecycle.test.tsx` | Added 5 unit tests verifying header and commercial terms panel exposure rendering, badge styling, and hold alert banners. |
| `docs/walkthrough/README.md` | Appended walkthrough master index entry. |

---

## 5. Architecture Decisions

- **AD-BD6-01: Sovereign Per-Company Limits with Central Group Treasury Aggregation:**
  Operating entities maintain distinct legal credit facilities. Checkouts strictly evaluate `customer_company_relationships.credit_limit` and `customer_company_relationships.credit_hold` for the active legal entity. BD-6 aggregates limits and balances across entities exclusively for treasury monitoring and group credit risk supervision without contaminating subsidiary balance sheets.
- **AD-BD6-02: Authoritative Ledger Query via CustomerCreditLedgerEntry:**
  Rather than relying solely on denormalized `customer.outstanding` snapshots, entity-specific receivables are derived from the latest active record in `customer_credit_ledger_entries` ordered by `entry_date DESC, created_at DESC`, falling back gracefully to customer primary outstanding if no entries exist.
- **AD-BD6-03: Real-Time Risk Tier Escalation:**
  Group risk tiers are computed systematically:
  - `ON_HOLD`: Triggered immediately if ANY active commercial relationship carries `credit_hold = true`.
  - `CRITICAL`: Group utilization $\ge 100\%$.
  - `HIGH`: Group utilization $\ge 80\%$.
  - `MODERATE`: Group utilization $\ge 50\%$.
  - `LOW`: Healthy headroom with utilization $< 50\%$.

---

## 6. Design Rationale

Corporate enterprise accounts frequently purchase across multiple operating companies or wholesale/retail divisions. Allowing isolated visibility into only one company's balance prevents corporate treasury from detecting aggregate insolvency risks or limit exhaustion across the enterprise group. BD-6 equips CFOs, central credit managers, and store operators with instant consolidated exposure visibility while strictly preserving statutory legal entity sovereignty.

---

## 7. Implementation Summary

### 7.1 Backend API Contract
```http
GET /api/v1/crm/customers/{customer_id}/credit-exposure
```
Response payload structure:
```json
{
  "customerId": "cust-rrl-001",
  "customerName": "Reliance Retail Limited",
  "totalCreditLimit": 1500000.0,
  "totalCreditUsed": 600000.0,
  "totalAvailableCredit": 900000.0,
  "groupUtilizationPercent": 40.0,
  "groupRiskLevel": "LOW",
  "companyCount": 2,
  "holdCount": 0,
  "companyExposures": [
    {
      "companyId": "COMP-001",
      "companyName": "Smriti Retail Co",
      "creditLimit": 1000000.0,
      "creditDays": 30,
      "creditHold": false,
      "creditUsed": 400000.0,
      "availableCredit": 600000.0,
      "utilizationPercent": 40.0,
      "exposureStatus": "NORMAL"
    },
    {
      "companyId": "COMP-002",
      "companyName": "Smriti Wholesale Co",
      "creditLimit": 500000.0,
      "creditDays": 45,
      "creditHold": false,
      "creditUsed": 200000.0,
      "availableCredit": 300000.0,
      "utilizationPercent": 40.0,
      "exposureStatus": "NORMAL"
    }
  ]
}
```

---

## 8. Tests Executed

### 8.1 Backend Pytest Suite
```powershell
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/tests/test_customer_company_relationships.py backend/tests/test_customer_lifecycle_security.py backend/tests/test_customer_multicompany_repository.py backend/tests/test_customer_merge_bd2.py backend/tests/test_customer_credit_exposure_bd6.py -v
```
**Literal Output:**
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collected 31 items

backend\tests\test_customer_company_relationships.py::test_customer_company_relationship_schema_validation PASSED [  3%]
backend\tests\test_customer_company_relationships.py::test_customer_company_relationship_model_structure PASSED [  6%]
backend\tests\test_customer_company_relationships.py::test_cross_company_customer_group_guard PASSED [  9%]
backend\tests\test_customer_company_relationships.py::test_matching_company_customer_group_passes_guard PASSED [ 12%]
backend\tests\test_customer_lifecycle_security.py::test_customer_delete_eligibility_schema_serialization PASSED [ 16%]
backend\tests\test_customer_lifecycle_security.py::test_customer_deactivate_request_schema PASSED [ 19%]
backend\tests\test_customer_lifecycle_security.py::test_check_delete_eligibility_blocks_on_invoices_and_balance PASSED [ 22%]
backend\tests\test_customer_lifecycle_security.py::test_check_delete_eligibility_permits_clean_customer PASSED [ 25%]
backend\tests\test_customer_lifecycle_security.py::test_permanent_delete_raises_400_when_blocked PASSED [ 29%]
backend\tests\test_customer_lifecycle_security.py::test_permanent_delete_executes_when_clean PASSED [ 32%]
backend\tests\test_customer_lifecycle_security.py::test_deactivate_and_reactivate_customer_lifecycle PASSED [ 35%]
backend\tests\test_customer_multicompany_repository.py::test_customer_response_serialization_with_company_relationships PASSED [ 38%]
backend\tests\test_customer_multicompany_repository.py::test_customer_repository_model_c_tenant_filter_generation PASSED [ 41%]
backend\tests\test_customer_multicompany_repository.py::test_require_cross_company_customer_access_sysadmin_allowed PASSED [ 45%]
backend\tests\test_customer_multicompany_repository.py::test_require_cross_company_customer_access_admin_allowed PASSED [ 48%]
backend\tests\test_customer_multicompany_repository.py::test_require_cross_company_customer_access_unauthorized_rejected PASSED [ 51%]
backend\tests\test_customer_multicompany_repository.py::test_enterprise_search_customers_audit_logging PASSED [ 54%]
backend\tests\test_customer_merge_bd2.py::test_customer_merge_schema_serialization PASSED [ 58%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_self_merge_rejection PASSED [ 61%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_target_or_source_not_found PASSED [ 64%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_source_already_merged_rejection PASSED [ 67%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_pan_parity_guard_violation PASSED [ 70%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_full_consolidation_and_reassignment PASSED [ 74%]
backend\tests\test_customer_merge_bd2.py::test_rest_api_merge_customers_endpoint PASSED [ 77%]
backend\tests\test_customer_credit_exposure_bd6.py::test_credit_exposure_schema_serialization PASSED [ 80%]
backend\tests\test_customer_credit_exposure_bd6.py::test_get_customer_credit_exposure_single_company PASSED [ 83%]
backend\tests\test_customer_credit_exposure_bd6.py::test_get_customer_credit_exposure_multi_company_aggregation PASSED [ 87%]
backend\tests\test_customer_credit_exposure_bd6.py::test_credit_hold_propagation_to_group_risk PASSED [ 90%]
backend\tests\test_customer_credit_exposure_bd6.py::test_credit_breach_and_warning_thresholds PASSED [ 93%]
backend\tests\test_customer_credit_exposure_bd6.py::test_get_customer_credit_exposure_not_found PASSED [ 96%]
backend\tests\test_customer_credit_exposure_bd6.py::test_api_endpoint_credit_exposure PASSED [100%]

====================== 31 passed, 18 warnings in 16.14s =======================
```

### 8.2 Frontend Vitest Suite
```powershell
npx vitest run src/tests/customerMasterLifecycle.test.tsx src/tests/corporateCustomer360.test.tsx
```
**Literal Output:**
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/customerMasterLifecycle.test.tsx (25 tests) 90ms
 ✓ src/tests/corporateCustomer360.test.tsx (11 tests) 62ms

 Test Files  2 passed (2)
      Tests  36 passed (36)
   Start at  21:09:47
   Duration  8.39s (transform 602ms, setup 0ms, import 8.53s, tests 147ms, environment 0ms)
```

---

## 9. Verification Results

| Verification Check | Target Asset | Result | Evidence Status |
|---|---|---|---|
| Backend Pytest Suite | `backend/tests/test_customer_credit_exposure_bd6.py` | 7/7 Tests Passed | **Done** |
| Customer Regression Suite | 5 Backend Test Suites | 31/31 Tests Passed | **Done** |
| Frontend Vitest Suite | `src/tests/customerMasterLifecycle.test.tsx` | 25/25 Tests Passed | **Done** |
| Customer 360 Vitest Suite | `src/tests/corporateCustomer360.test.tsx` | 11/11 Tests Passed | **Done** |
| TypeScript Linting | `npm run lint` (`tsc --noEmit`) | 0 Errors | **Done** |
| Architecture CI Gate | `scripts/architecture_duplication_gate.py` | 11/11 Checks Passed | **Done** |
| Preflight Certificates | `CorporateCommercialTermsPanel.tsx`, `CorporateMasterAccountHeader.tsx` | Valid & Tracked | **Done** |

---

## 10. Known Limitations

- Multi-currency exposure aggregation is currently standardized to INR. International foreign currency credit lines require formal currency exchange rate snapshots in Phase 4.
- Invoicing blocks currently enforce company-specific holds; a central setting to toggle auto-propagation of hold across all sister companies remains an opt-in policy for corporate group admins.

---

## 11. Future Work

- **Automated Inter-Company Credit Reallocation:** Provide an authorized workflow for central treasury managers to transfer unutilized credit headroom from Company A to Company B upon CFO sign-off.
- **BD-7 Group Legal Entity Hierarchy:** Implement parent-subsidiary company tree modeling and visualization in `Company` master.

---

## 12. Related ADRs

- `ARCH-CRM-001`: SMRITI Enterprise Corporate Customer Architecture Discovery
- `ARCH-CRM-001-VAL`: SMRITI Enterprise Customer Pre-Implementation Validation Gate
- `ARCH-CRM-001-PLAN`: SMRITI Enterprise Customer Architecture Decisions & Revised Implementation Plan (BD-1 through BD-7)

---

## 13. Related RFCs

- `RFC-CRM-BD6`: Consolidated Enterprise Customer Credit Exposure and Treasury Governance Standard

---
*End of Walkthrough WT-CRM-BD6-001*  
*Author: Jawahar Ramkripal Mallah | © SMRITIBooks.com. All Rights Reserved.*
