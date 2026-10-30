<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.64.1
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Complete Frontend-Backend API Parity & Reconciliation Wiring Implementation Plan (v1.0)

## 1. Objective
Achieve 100.0% frontend-to-backend API contract parity across all 443 frontend API call sites, eliminating every remaining 404 route gap in the application, including Purchase 3-Way Matching commitment (`POST /api/v1/purchase/3way-matching/commit`), CRM Loyalty Points Adjustment (`POST /api/v1/crm/loyalty/members/{id}/{adj_type}`), and Localization Units of Measurement (`GET /api/v1/localization/uoms`).

## 2. Business Motivation
Ensures that all operational user workflows—specifically purchase invoice reconciliation, store manager customer loyalty adjustments, and item master unit conversions—execute against authoritative, transaction-safe backend services with immutable audit records, zero 404 errors, and full GST/regulatory compliance.

## 3. Scope
- **Backend Schemas (`backend/app/schemas/purchase.py`):** Added `ThreeWayMatchingLine`, `ThreeWayMatchingCommitRequest`, and `ThreeWayMatchingCommitResponse`.
- **Purchase Core Router (`backend/app/api/v1/purchase.py`):** Implemented `POST /3way-matching/commit` with `SYSADMIN`/`MANAGER` role guard, AP reconciliation voucher generation, and compliance audit trail.
- **Loyalty Studio Router (`backend/app/api/v1/loyalty.py`):** Implemented `POST /members/{member_id}/{adj_type}` with signed delta determination (`bonus` vs `expire`), `CrmGrowthEngine` ledger transaction persistence, and immutable audit logging.
- **Localization Core Router (`backend/app/api/v1/localization.py`):** Exported `localization_core_router` providing standard `/api/v1/localization/uoms` and `/convert` endpoints.
- **FastAPI Router Mounting (`backend/app/main.py`):** Mounted `(loyalty, "/crm")` and `(localization.localization_core_router, "")`.
- **Automated Verification:** Added 3 test cases to `backend/tests/test_core_api_parity_wiring.py` (9/9 passed).

## 4. Current State
- Prior state had 439 matched calls and 3 unique unmatched frontend endpoints (4 call instances).
- Previous audit regex also flagged template literals with nested quotes, which have now been properly parsed.

## 5. Gap Analysis
- `ThreeWayMatchingModal.tsx` committed reconciliations against `/purchase/3way-matching/commit` which had no backend endpoint.
- `CrmStudioTab.tsx` adjusted bonus and expired points via `/crm/loyalty/members/${memberId}/${adjType}` while backend loyalty router was unmounted under `/crm`.
- `ItemDetailsGridTab.tsx` and `globalFieldRegistry.ts` fetched UOMs from `/localization/uoms` while `localization.py` was mounted only under `/control/reference`.

## 6. Architecture Impact
Zero database schema alterations required. All operations utilize existing domain models (`loyalty_members`, `loyalty_points_ledgers`, `compliance_immutable_audit_logs`) and services (`CrmGrowthEngine`, `GlobalReferenceService`, `ComplianceAuditService`).

## 7. Proposed Design
1. **3-Way Matching:** Implemented `commit_three_way_matching` generating unique `AP-VOUCH-YYYYMMDD-XXXXXX` vouchers and storing cryptographic audit log entries.
2. **Loyalty Adjustment:** Mapped `bonus` and `expire` to signed deltas applied via `CrmGrowthEngine.record_points_transaction`.
3. **Localization Router:** Mounted `localization_core_router` with `/localization/uoms` returning canonical GST UQC records.

## 8. Files Created
- `docs/implementation/foundation/Complete_FE_BE_Parity_And_Reconciliation_Wiring_Plan_v1.0.md`
- `docs/walkthrough/foundation/Foundation_Complete_FE_BE_Parity_And_Reconciliation_Wiring_v1.0.md`

## 9. Files Modified
- `backend/app/schemas/purchase.py`
- `backend/app/api/v1/purchase.py`
- `backend/app/api/v1/loyalty.py`
- `backend/app/api/v1/localization.py`
- `backend/app/main.py`
- `backend/tests/test_core_api_parity_wiring.py`
- `scripts/audit_fe_be_parity.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI 0.111+
- SQLAlchemy 2.0+ AsyncSession
- Pydantic v2
- `ComplianceAuditService` & `CrmGrowthEngine`

## 11. Risks
- Minimal: non-destructive additions with strict role-based access control (`MANAGER`, `SYSADMIN`).

## 12. Rollback Strategy
Git revert of the specific commit restores previous router mounts and schema entries with zero database migration impact.

## 13. Verification Plan
- Measure FE-BE API parity using `scripts/audit_fe_be_parity.py`.
- Execute pytest suite `backend/tests/test_core_api_parity_wiring.py`.
- Execute vitest suite `src/tests/threeWayMatching.test.ts` and `src/tests/globalFieldRegistry.test.ts`.
- Run `npx tsc --noEmit`.

## 14. Test Plan
- Unit tests asserting 200 OK responses, voucher format, and ledger balance deltas.
- Negative tests asserting error handling on missing documents and non-existent members.

## 15. Documentation Impact
- Updated `CHANGELOG.md` to `[6.64.1]`.
- Updated master implementation and walkthrough indexes.

## 16. Deployment Plan
Sync repository to test environment and verify live `/health` diagnostics.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-0045`: Sole FastAPI + Postgres Backend Architecture.
- `ADR-0089`: Offline-First POS Conflict Resolution & AP Vouchers.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Complete_FE_BE_Parity_And_Reconciliation_Wiring_v1.0.md`
