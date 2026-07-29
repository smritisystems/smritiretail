<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.48.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — SGIP Phase 4: Direct Portal Auto-Pull Sync & Monthly GSTR Filing Worker Engine (v3.48.0)

## 1. Objective
To implement **SGIP Phase 4**, providing background auto-pull worker engines for fetching GSTR-2B statements directly from GSTN/NIC APIs, alongside automated GSTR-1 and GSTR-3B return payload generation and DSC/EVC digital signature verification.

## 2. Business Motivation
Automating GST reconciliation and return submission reduces manual portal downloads, eliminates mismatch penalties, ensures accurate Input Tax Credit (ITC) claiming, and complies with government statutory deadlines.

## 3. Scope
- **ORM Models**: `GSTRFilingRecord` and `GSTROutboxLog` in `backend/app/compliance/models/filing.py`.
- **Services**:
  - `GSTRAutoPullService` in `backend/app/compliance/services/gstr_autopull_service.py`.
  - `GSTRFilingService` in `backend/app/compliance/services/gstr_filing_service.py`.
- **REST Endpoints**: `/api/v1/compliance/gst/auto-pull` and `/api/v1/compliance/gst/filing/submit` mounted in `backend/app/compliance/api/router.py`.
- **Automated Test Suite**: `backend/app/compliance/tests/test_sgip_phase4_auto_pull_filing.py`.

## 4. Current State
SGIP Phase 3 (v3.42.0) provided GSTR-2B 4-state ITC reconciliation logic. Direct GSSP auto-pull worker background automation and return filing payload validation are required.

## 5. Gap Analysis
Manual JSON statement uploads are prone to human error and delay monthly ITC claims. Automated API workers ensure continuous compliance synchronization.

## 6. Architecture Impact
Resides inside FastAPI + Postgres compliance system of record (`backend/app/compliance/`). Express acts strictly as a proxy router.

## 7. Proposed Design
```text
GSTN / GSSP Portal <---> GSTRAutoPullService (Background Cron Worker)
                                 │
                                 ▼
                     GSTReconciliationRecord (2B Matching Engine)
                                 │
                                 ▼
                     GSTRFilingService (GSTR-1 / GSTR-3B Formatter)
                                 │
                                 ▼
                      DSC / EVC Verification Engine
                                 │
                                 ▼
                         GSTROutboxLog Ledger
```

## 8. Files Created
- [NEW] [filing.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/models/filing.py)
- [NEW] [gstr_autopull_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/services/gstr_autopull_service.py)
- [NEW] [gstr_filing_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/services/gstr_filing_service.py)
- [NEW] [test_sgip_phase4_auto_pull_filing.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/tests/test_sgip_phase4_auto_pull_filing.py)
- [NEW] [SGIP_Phase4_AutoPull_And_GSTR_Filing_Worker_Plan_v3.48.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/SGIP_Phase4_AutoPull_And_GSTR_Filing_Worker_Plan_v3.48.0.md)

## 9. Files Modified
- [MODIFY] [compliance/models/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/models/__init__.py)
- [MODIFY] [compliance/api/router.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/api/router.py)
- [MODIFY] [conftest.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/conftest.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, Decimal, hashlib.

## 11. Risks
GSTN API rate-limiting or network downtime. Mitigation: Exponential backoff retries and outbox queue status tracking.

## 12. Rollback Strategy
Remove GSTR filing router endpoints and drop `gstr_filing_records` table via Alembic downgrade.

## 13. Verification Plan
Execute automated test suite covering GSTR-2B auto-pull payload parsing, GSTR-1/3B return calculation, DSC validation, and outbox logging.

## 14. Test Plan
Run `python -m pytest app/compliance/tests/test_sgip_phase4_auto_pull_filing.py -v`.

## 15. Documentation Impact
Update implementation index, walkthrough index, and create Phase 4 Walkthrough document.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-005: Compliance & GST Gateway Architecture

## 19. Related Walkthroughs
- `Foundation_SGIP_Phase3_GST_Reconciliation_v3.42.0.md`
