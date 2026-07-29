<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 24.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 30: Pharma & Healthcare Retail Engine (v24.0.0)

## 1. Objective
Execute **Phase 30** of SMRITI Retail OS Roadmap as a **Domain Release (`v24.0.0`)** building on top of the **SMRITI Platform Foundation Baseline (`v23.0.0`, PAR-001 v1.0 Baseline, CMP-001 Policy)**. Deliver **Pharma Subsystem (`backend/app/core/pharma/`)** providing Schedule H/H1 prescription compliance validation, active generic salt & substitute lookups, automated near-expiry sales lock, REST API Gateway (`/api/v1/pharma`), and pytest integration suite.

## 2. Business Motivation
- **Healthcare Retail Compliance:** Enables pharmacies and healthcare retailers to automate Schedule H/H1 prescription record keeping, block sales of near-expiry medicines, and offer substitute generic drug alternatives to patients.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- Pharma Core Services: `prescription_manager.py`, `generic_salt_search.py`, `batch_expiry_control.py`.
- DB Models & Schemas: `backend/app/models/pharma.py`, `backend/app/schemas/pharma.py`.
- REST API: `backend/app/api/v1/pharma.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Layers 1 through 7 Platform Foundation and Phase 29 Master Release Baseline (`v23.0.0`) operational. Phase 30 launches Pharma Vertical Release.

## 5. Gap Analysis
- Need Schedule H/H1 doctor registration validation, active salt ingredient composition search, and strict near-expiry batch locks (< 30 days).

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation. Pharma operates as a Layer 3/Domain business module consuming UDMS document platform services.

## 7. Proposed Design
- Rule-based Prescription Compliance Validator and Generic Salt Indexing Engine.

## 8. Files Created
- `/backend/app/core/pharma/prescription_manager.py`
- `/backend/app/core/pharma/generic_salt_search.py`
- `/backend/app/core/pharma/batch_expiry_control.py`
- `/backend/app/models/pharma.py`
- `/backend/app/schemas/pharma.py`
- `/backend/app/api/v1/pharma.py`
- `/backend/app/tests/test_pharma_engine.py`
- `/docs/implementation/pharma/Pharma_Healthcare_Plan_v24.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `datetime`.

## 11. Risks
- Dispensing incorrect medicine: Mitigated by mandatory doctor license & salt match validation.

## 12. Rollback Strategy
- Remove `/api/v1/pharma` route mount; core retail billing remains unaffected.

## 13. Verification Plan
- Automated pytest suite `test_pharma_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for Schedule H/H1 prescription validation, generic salt searching, and near-expiry sales lock.

## 15. Documentation Impact
- Implementation plan and walkthrough documentation.

## 16. Deployment Plan
- Git commit and build verification.

## 17. Status
Approved / In Progress.

## 18. Related ADRs
- ADR-002 SMRITI Metadata Architecture
- CMP-001 SMRITI Compatibility Policy
- GCR-001 SMRITI Golden Code Rule

## 19. Related Walkthroughs
- `docs/walkthrough/pharma/Pharma_Healthcare_v24.0.0.md`
