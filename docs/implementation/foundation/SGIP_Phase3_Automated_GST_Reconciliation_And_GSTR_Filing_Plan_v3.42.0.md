<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.42.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — SGIP Phase 3: Automated GST Reconciliation & GSTR Filing Engine (v3.42.0)

## 1. Objective
To implement an automated GST Input Tax Credit (ITC) reconciliation engine comparing Purchase Invoices against GSTR-2B datasets, alongside GSTR-1 / GSTR-3B filing payload generation within the SMRITI Government Integration Platform (SGIP) backend.

## 2. Business Motivation
Indian tax compliance requires businesses to reconcile claimed ITC against GSTR-2B auto-drafted statements before monthly GSTR-3B tax return filing. Automated reconciliation detects mismatched invoice amounts, unrecorded supplier bills, and ineligible ITC claims, avoiding tax penalties and interest under CGST Act Section 16(2)(aa).

## 3. Scope
- **Models**: `GSTReconciliationRecord` in `backend/app/compliance/models/reconciliation.py`.
- **Services**: `GSTReconciliationService` in `backend/app/compliance/services/gst_recon_service.py` to compare Purchase Bills vs GSTR-2B data.
- **Outbox Compiler**: GSTR-1 and GSTR-3B JSON payload compilation integrated with `ComplianceQueueEngine`.
- **Endpoints**: `POST /api/v1/compliance/gst/reconcile` and `POST /api/v1/compliance/gstr1/compile` in `backend/app/compliance/api/router.py`.
- **Automated Tests**: Unit and integration test suite `backend/app/compliance/tests/test_sgip_phase3_gst_recon.py`.

## 4. Current State
SGIP Phase 1 (Compliance Foundation v3.16.0) and Phase 2 (E-Way Bill & E-Invoice Gateway v3.39.0) are live. GSTR-2B matching and outbox return payload generation are unhandled.

## 5. Gap Analysis
Without automated GSTR-2B reconciliation, finance teams manually match thousands of purchase invoice rows against GST portal downloads, leading to human errors and missed ITC claims.

## 6. Architecture Impact
Resides strictly inside `backend/app/compliance/`, maintaining System of Record and Platform Abstraction Layer (PAL) governance.

## 7. Proposed Design
```text
Purchase Invoices & GSTR-2B Import -> GSTReconciliationService
                                               ↓
                                   GSTReconciliationRecord (MATCHED | MISMATCHED | MISSING)
                                               ↓
                                   GSTR-1 / GSTR-3B Outbox Queue Event
```

## 8. Files Created
- [NEW] [reconciliation.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/models/reconciliation.py)
- [NEW] [gst_recon_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/services/gst_recon_service.py)
- [NEW] [test_sgip_phase3_gst_recon.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/tests/test_sgip_phase3_gst_recon.py)
- [NEW] [SGIP_Phase3_Automated_GST_Reconciliation_And_GSTR_Filing_Plan_v3.42.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/SGIP_Phase3_Automated_GST_Reconciliation_And_GSTR_Filing_Plan_v3.42.0.md)

## 9. Files Modified
- [MODIFY] [router.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/api/router.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
SQLAlchemy 2.0 Async, FastAPI, Pytest, Decimal.

## 11. Risks
Large GSTR-2B JSON payloads exceeding memory limits. Mitigation: Batch processing in chunks of 500 records.

## 12. Rollback Strategy
Remove GSTR endpoints and unmount reconciliation tables via Alembic.

## 13. Verification Plan
Run automated pytest suite covering 2B matching algorithms, tax amount variance detection, and outbox event formatting.

## 14. Test Plan
Run `python -m pytest app/compliance/tests/test_sgip_phase3_gst_recon.py -v`.

## 15. Documentation Impact
Update implementation index, walkthrough index, and produce Phase 3.42.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Draft / Approved

## 18. Related ADRs
- ADR-003: Platform Abstraction Layer
- ADR-008: SGIP Compliance Architecture

## 19. Related Walkthroughs
- `Foundation_SGIP_Phase2_EWayBill_EInvoice_v3.39.0.md`
