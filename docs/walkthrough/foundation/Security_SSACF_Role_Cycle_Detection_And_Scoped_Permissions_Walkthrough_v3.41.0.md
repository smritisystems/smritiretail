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

# Walkthrough — SSACF Role Cycle Detection, Scoped Permissions & Field-Level Security Engine (v3.41.0)

**Status:** Done  
**Evidence Level:** A (Direct Automated Test Outputs + Git Diffs)

## 1. Purpose
To deliver Directed Acyclic Graph (DAG) cycle detection for role inheritance, dynamic field-level visibility/editability rules, and authorization scope evaluation in SSACF Phase 2.5.

## 2. Scope
- **Services:** `SecurityService` in `backend/app/services/security.py` with BFS role cycle detection, `get_field_rules()`, and `get_effective_permission_scopes()`.
- **API Endpoints:** `/api/v1/security/field-rules` and `/api/v1/security/scopes` in `backend/app/api/v1/security.py`.
- **Tests:** `backend/app/tests/test_ssacf_cycle_and_scopes.py`.

## 3. Files Created
- `backend/app/tests/test_ssacf_cycle_and_scopes.py`
- `docs/implementation/foundation/SSACF_Role_Cycle_Detection_And_Scoped_Permissions_Plan_v3.41.0.md`
- `docs/walkthrough/foundation/Security_SSACF_Role_Cycle_Detection_And_Scoped_Permissions_Walkthrough_v3.41.0.md`

## 4. Files Modified
- `backend/app/services/security.py`
- `backend/app/api/v1/security.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **DAG Cycle Guard:** Prevents infinite loops or stack overflow during role hierarchy resolution by tracking visited role IDs and raising `ValueError` on circular parent-child references.
- **Field-Level Data Privacy:** Standardizes field-level rule responses for frontend consumption (e.g. hiding `cost_price` for store users).

## 6. Design Rationale
Large enterprises require strong authorization guarantees to prevent role cycle corruption and restrict field visibility based on user roles.

## 7. Implementation Summary
Implemented BFS cycle guard, field-level rules API, and permission scope compilation.

## 8. Tests Executed
Executed test suite via pytest:
```bash
..\.venv311\Scripts\python.exe -m pytest app/tests/test_ssacf_cycle_and_scopes.py -v
```

## 9. Verification Results
```text
collected 2 items

app/tests/test_ssacf_cycle_and_scopes.py::test_role_cycle_detection_raises_error PASSED [ 50%]
app/tests/test_ssacf_cycle_and_scopes.py::test_field_rules_and_permission_scopes_endpoints PASSED [100%]

======================== 2 PASSED in 7.90s ========================
```

## 10. Known Limitations
- Field rules are currently policy-configured and fallback to default resource maps.

## 11. Future Work
- Dynamic field-level UI rule designer component.

## 12. Related ADRs
- ADR-007: SSACF Security Architecture

## 13. Related RFCs
- RFC-3.41.0: SSACF Role Graph & Field Privacy Governance
