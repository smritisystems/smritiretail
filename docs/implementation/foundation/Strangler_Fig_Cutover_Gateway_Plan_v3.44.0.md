<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.44.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Strangler-Fig Migration Cutover Gateway & Dynamic Flag Resolution Engine (v3.44.0)

## 1. Objective
To implement an automated cutover state management endpoint `/api/v1/health/cutover` inside FastAPI backend, enabling real-time verification of domain migration statuses from Express/`db_store.json` to FastAPI + PostgreSQL per the SMRITI System-of-Record Policy.

## 2. Business Motivation
The SMRITI Backend System-of-Record Policy requires progressive strangler-fig cutover module by module (Reports → Inventory → Auth → Sales/Purchase/POS). Providing a live cutover health API ensures frontend applications dynamically route requests to FastAPI + PostgreSQL without downtime or double-posting bugs.

## 3. Scope
- **Cutover API**: `GET /api/v1/health/cutover` added to `backend/app/api/v1/health_flags.py`.
- **Domain Cutover Registry**: In-memory and environment-backed flags for `POS`, `SALES`, `PURCHASE`, `INVENTORY`, `REPORTS`, `COMPLIANCE`, `TRANSFERS`, `SECURITY`, `PIE`.
- **Automated Tests**: Unit and integration test suite `backend/app/tests/test_strangler_fig_cutover.py`.

## 4. Current State
Health flags endpoint `/api/v1/health/flags` exists but does not report overall strangler-fig migration progress or transactional system of record compliance.

## 5. Gap Analysis
Without a centralized cutover status endpoint, frontend cutover flags (`USE_FASTAPI_SALES`, `USE_FASTAPI_PURCHASE`, `USE_FASTAPI_POS`) must be hardcoded without backend validation.

## 6. Architecture Impact
Directly supports SMRITI Backend System-of-Record Policy (FastAPI + Postgres System of Record, Express feature frozen).

## 7. Proposed Design
```text
Frontend Client -> GET /api/v1/health/cutover
                         ↓
            Strangler-Fig Migration Engine
                         ↓
  { "domains": { "SALES": "STRANGLER_FIG_MIGRATED", ... }, "system_of_record": "FastAPI + Postgres" }
```

## 8. Files Created
- [NEW] [test_strangler_fig_cutover.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_strangler_fig_cutover.py)
- [NEW] [Strangler_Fig_Cutover_Gateway_Plan_v3.44.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/Strangler_Fig_Cutover_Gateway_Plan_v3.44.0.md)

## 9. Files Modified
- [MODIFY] [health_flags.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/health_flags.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
FastAPI, Pytest, AsyncSession.

## 11. Risks
Incorrect cutover flag state reporting. Mitigation: Dynamic environment detection fallback to active route inspection.

## 12. Rollback Strategy
Revert `health_flags.py` additions.

## 13. Verification Plan
Run automated pytest suite covering `/api/v1/health/cutover` response schema and migration completion percentage calculation.

## 14. Test Plan
Run `python -m pytest app/tests/test_strangler_fig_cutover.py -v`.

## 15. Documentation Impact
Update implementation index, walkthrough index, and produce Phase 3.44.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Draft / Approved

## 18. Related ADRs
- ADR-001: Architecture Overview
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `Foundation_Enterprise_Security_And_Approval_Engine_v3.38.0.md`
