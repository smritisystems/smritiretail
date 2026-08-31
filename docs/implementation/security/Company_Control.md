<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Company Control Center Security Hardening Plan v1.0

## 1. Objective
Harden authentication and authorization on Company Control Center and Dev Tracker API endpoints to eliminate unauthenticated access and header spoofing vulnerabilities.

## 2. Business Motivation
Prevent unauthorized callers from executing company lifecycle actions or accessing tenant metadata by enforcing strict server-side JWT authentication.

## 3. Scope
Replace `x-user-id` client header trust with `get_current_user` and `require_role(UserRole.SYSADMIN)`.

## 4. Current State
Endpoints defaulted to `x_user_id: str = Header("usr_sysadmin")`, allowing header spoofing.

## 5. Gap Analysis
Absence of mandatory OAuth2 Bearer JWT dependencies on `/control-center/companies`, `/lifecycle/action`, and `/dev-tracker`.

## 6. Architecture Impact
None. Preserves `smritisys` control plane and `smriti001` transactional DB structure.

## 7. Proposed Design
Bind FastAPI `Depends(get_current_user)` and `Depends(require_role(UserRole.SYSADMIN))` to administrative endpoints.

## 8. Files Created
- `backend/tests/t_comp_ctr_sec.py`
- `docs/walkthrough/security/Company_Control.md`
- `docs/implementation/security/Company_Control.md`

## 9. Files Modified
- `backend/app/api/v1/company_center.py`
- `backend/app/api/v1/dev_tracker.py`
- `backend/app/main.py`
- `backend/app/services/db_resolver.py`
- `backend/tests/t_comp_center_e2e.py`

## 10. Dependencies
`fastapi`, `sqlalchemy`, `pyjwt`, `psycopg2`.

## 11. Risks
Low. All existing tests updated to supply valid JWT bearer tokens or mock user objects.

## 12. Rollback Strategy
Revert modified API files using Git commit history.

## 13. Verification Plan
Execute `pytest backend/tests/t_comp_ctr_sec.py` and verify HTTP 401 on anonymous/spoofed requests.

## 14. Test Plan
Run full 82-test Pytest regression suite and Vite production build.

## 15. Documentation Impact
Update CHANGELOG.md and security walkthroughs.

## 16. Deployment Plan
Deploy hardened FastAPI backend binaries to production.

## 17. Status
Completed.

## 18. Related ADRs
ADR-002: Multi-Company Control Plane Database Architecture

## 19. Related Walkthroughs
Company_Control.md
