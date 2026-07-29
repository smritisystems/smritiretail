<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.34.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Record Security & Row-Level Security (RLS) — v3.34.0

This document defines the implementation plan for Phase 5 of the SMRITI Enterprise Access Architecture Upgrade, introducing dynamic row-level query interceptors for record-level scopes.

---

## 1. Objective
Implement dynamic SQLAlchemy query interception to enforce record-level scopes (`SELF`, `BRANCH`, `COMPANY`, `GLOBAL`) based on the active user's permission sets and active security context, ensuring zero-leak data boundaries.

---

## 2. Business Motivation
Provide robust multi-tenant and multi-location security compliance. Prevent staff at one branch from viewing sales invoices, POS shifts, or purchase orders belonging to other branches or companies, unless explicitly granted global platform access.

---

## 3. Scope
- Define `SecurityContext` representation and ContextVar tracking.
- Enhance SQLAlchemy query interceptor (`apply_tenant_filter` renamed to `apply_security_isolation_filter`) in `backend/app/db/session.py`.
- Integrate context-aware scope filters (`SELF`, `BRANCH`, `COMPANY`) using `with_loader_criteria` for all select statements targeting `BaseEntity`.
- Implement active permission tracking context in dependencies (`require_permission`).
- Add unit tests verifying scope-boundary enforcement across POS shifts, sales invoices, and products.

---

## 4. Current State
- Database queries are restricted globally at the `tenant_id` level only via `apply_tenant_filter`.
- Local branch or company boundaries are not programmatically enforced in select queries, relying on manual service-level filter queries which are error-prone.

---

## 5. Gap Analysis
- No unified repository filter for branch-scoped user isolation.
- High risk of data exposure if developers omit branch/company parameters when writing new API endpoints.

---

## 6. Architecture Impact
- Enforces strict query-level isolation transparently for all `BaseEntity` subclasses.
- Enhances reliability of multi-branch and multi-company deployments.

---

## 7. Proposed Design

### A. Context Variable and Data Class
We will introduce `SecurityContext` in `backend/app/db/session.py` to hold active user attributes:
```python
from dataclasses import dataclass

@dataclass
class SecurityContext:
    user_id: str
    username: str
    is_platform_admin: bool
    tenant_id: str
    company_id: str
    branch_id: str
    scopes: dict  # maps permission_code -> scope string ("SELF", "BRANCH", "COMPANY", "GLOBAL")
```

### B. Dynamic Interceptor Logic
The SQLAlchemy execution listener will parse the context and dynamically inject the relevant ownership criteria:
```python
@event.listens_for(Session, "do_orm_execute")
def apply_security_isolation_filter(execute_state):
    if execute_state.is_select and not execute_state.execution_options.get("ignore_security_isolation", False):
        ctx = active_tenant_ctx.get()
        if ctx:
            from ..db.base import BaseEntity
            filters = []
            
            # 1. Tenant Isolation
            if getattr(ctx, "tenant_id", None):
                filters.append(lambda cls: cls.tenant_id == ctx.tenant_id)
                
            # 2. Record-Level Security Scopes
            if not getattr(ctx, "is_platform_admin", False):
                active_perm = active_permission.get()
                if active_perm:
                    user_scope = ctx.scopes.get(active_perm, "BRANCH")  # Default to BRANCH-scoped
                    if user_scope == "SELF":
                        filters.append(lambda cls: cls.created_by == ctx.user_id)
                    elif user_scope == "BRANCH" and getattr(ctx, "branch_id", None):
                        filters.append(lambda cls: cls.branch_id == ctx.branch_id)
                    elif user_scope == "COMPANY" and getattr(ctx, "company_id", None):
                        filters.append(lambda cls: cls.company_id == ctx.company_id)
                        
            # Apply all collected filters dynamically
            for f in filters:
                execute_state.statement = execute_state.statement.options(
                    with_loader_criteria(BaseEntity, f)
                )
```

---

## 8. Files Created
- `docs/implementation/foundation/SMRITI_Record_Security_RLS_Plan_v3.34.0.md`

---

## 9. Files Modified
- [backend/app/db/session.py](file:///f:/SMRITRretailNXmgrt/backend/app/db/session.py)
- [backend/app/api/deps.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/deps.py)

---

## 10. Dependencies
- SQLAlchemy 2.0 ORM query execution listeners.

---

## 11. Risks
- SQL query compile-time performance overhead.
- Mitigation: Keep context evaluation and loader criteria logic O(1).

---

## 12. Rollback Strategy
- Restore `backend/app/db/session.py` and `backend/app/api/deps.py` to their previous state.

---

## 13. Verification Plan
- Deploy changes to test sandbox and execute endpoints with different user roles to verify data scope visibility.

---

## 14. Test Plan
- Write integration tests in `backend/app/tests/test_record_security.py` asserting that a cashier user at Branch A cannot fetch or view invoices from Branch B.

---

## 15. Documentation Impact
- Document RLS architecture in the developer manuals.

---

## 16. Deployment Plan
- Released as a core framework patch in v3.34.0.

---

## 17. Status
Approved.

---

## 18. Related ADRs
- **ADR-004:** Scoped Security Configuration.

---

## 19. Related Walkthroughs
- None.
