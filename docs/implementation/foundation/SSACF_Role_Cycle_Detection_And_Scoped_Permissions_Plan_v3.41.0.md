<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.41.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — SSACF Role Cycle Detection, Scoped Permissions & Field-Level Security Engine (v3.41.0)

## 1. Objective
To implement Directed Acyclic Graph (DAG) cycle detection for role inheritance, granular authorization scopes (`OWN_DOCUMENT`, `OWN_BRANCH`, `ALL_BRANCHES`, `GLOBAL`), and field-level visibility/editability rules inside the SMRITI Security & Access Control Framework (SSACF).

## 2. Business Motivation
Enterprise retail organizations require strict role hierarchy validation to prevent infinite loops in authorization traversal, multi-branch data isolation, and field-level data privacy (e.g., hiding `cost_price` and supplier margin from store cashiers).

## 3. Scope
- **Cycle Guard (DAG)**: Directed graph BFS cycle detection in `SecurityService.get_effective_roles()` preventing circular role inheritance.
- **Scoped Permissions**: Enforcement of scope levels (`OWN_DOCUMENT`, `OWN_BRANCH`, `ALL_BRANCHES`, `GLOBAL`) in permission resolution.
- **Field-Level Security**: Dynamic field policy evaluation endpoint (`GET /api/v1/security/field-rules`) for resource attributes.
- **Automated Tests**: Unit and integration test suite `backend/app/tests/test_ssacf_cycle_and_scopes.py`.

## 4. Current State
SSACF Phase 2.1–2.4 are complete with Redis/Memory cache abstraction and endpoint migrations. Role hierarchies and field-level rules require structural graph validation and scope evaluation.

## 5. Gap Analysis
Without DAG cycle detection, circular parent-child role assignments crash the authorization resolver via stack depth exhaustion. Without scope resolution, users with branch access can inadvertently query cross-branch records.

## 6. Architecture Impact
Layered security integration in `backend/app/services/security.py` and `backend/app/api/v1/security.py`. Preserves the System of Record and Platform Abstraction Layer (PAL) principles.

## 7. Proposed Design
```text
Role Assignment / Update Request -> DAG Cycle Guard (BFS Traversal)
                                           ↓
                              SecurityResolver (Scope Check: OWN/BRANCH/GLOBAL)
                                           ↓
                              Field Policy Engine (GET /field-rules)
```

## 8. Files Created
- [NEW] [test_ssacf_cycle_and_scopes.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_ssacf_cycle_and_scopes.py)
- [NEW] [SSACF_Role_Cycle_Detection_And_Scoped_Permissions_Plan_v3.41.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/SSACF_Role_Cycle_Detection_And_Scoped_Permissions_Plan_v3.41.0.md)

## 9. Files Modified
- [MODIFY] [security.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/security.py)
- [MODIFY] [security.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/security.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, SQLAlchemy 2.0.

## 11. Risks
Cycle guard on deep role hierarchies. Mitigation: In-memory visited set tracking during BFS.

## 12. Rollback Strategy
Revert cycle validation logic and unmount `/field-rules` route.

## 13. Verification Plan
Run automated pytest suite testing circular role creation errors, scope resolution, and field-level rules API response.

## 14. Test Plan
Run `python -m pytest app/tests/test_ssacf_cycle_and_scopes.py -v`.

## 15. Documentation Impact
Update implementation index, walkthrough index, and produce Walkthrough v3.41.0.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Draft / Approved

## 18. Related ADRs
- ADR-007: SSACF Security Architecture

## 19. Related Walkthroughs
- `Security_SSACF_Role_And_Menu_Engine_v3.24.0.md`
