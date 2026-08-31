<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.8.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Public
-->

# Foundation: Database API & Multi-Tenant Enforcement Plan — v3.8.0

## Verification Metadata
Repository State : Verified
Repository Version : 3.7.0
Git Revision : 9467340
Evidence Level : A (Execution + Code Verification)
Review Method : SGAS Evidence-Based Audit
Architecture Style : Incremental (Non-Destructive)
Backward Compatibility : Mandatory

---

## 1. Objective
This plan outlines the design and implementation of REST API endpoints for key domain entities (Products, Customers, Sales Invoices) and maps/enforces multi-tenant workspace isolation using actual `Company` and `Branch` entities.

## 2. Business Motivation
To support the Tattly Threads pilot, the React billing client must be able to consume the database domain layer over HTTP REST APIs. Additionally, multi-store retailers require transactional and reporting boundary separation between branches under a single corporate tenant.

## 3. Scope
- Create database models, schemas, and repositories for `Company` and `Branch` entities.
- Implement multi-tenant filtering in `BaseRepository` based on request context headers (`X-Company-Id`, `X-Branch-Id`).
- Build FastAPI router endpoints under `/api/v1/products`, `/api/v1/customers`, and `/api/v1/sales`.
- Add integration tests for all new endpoints and tenant isolation logic.

## 4. Current State
As of `v3.7.0`, core business models exist, but their services are unexposed. Multi-tenant columns `company_id` and `branch_id` exist on tables but are cosmetic as no master tables exist and no queries apply branch-level isolation.

## 5. Gap Analysis
- **Missing APIs:** No REST controllers exist to search/save products, customers, or billing records.
- **Tenant Vulnerability:** Tenant columns are not validated or auto-appended to queries, permitting potential cross-company data leakage.

## 6. Architecture Impact
- **Routing:** Integrates REST routes under `backend/app/api/v1/`.
- **Query Pipeline:** Overrides `BaseRepository` query generation to inject dynamic filtering based on contextual tenant state.

## 7. Proposed Design

### Tenant Extraction Middleware
```python
async def get_tenant_context(
    x_company_id: str = Header(..., alias="X-Company-Id"),
    x_branch_id: str = Header(..., alias="X-Branch-Id")
) -> TenantContext:
    return TenantContext(company_id=x_company_id, branch_id=x_branch_id)
```

### Multi-Tenant Query Injection
```python
# In BaseRepository[T]:
def _tenant_apply(self, stmt):
    if hasattr(self.model, "company_id") and self.tenant_ctx:
        stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
    if hasattr(self.model, "branch_id") and self.tenant_ctx:
        stmt = stmt.filter(self.model.branch_id == self.tenant_ctx.branch_id)
    return stmt
```

## 8. Files Created
- `backend/app/models/tenant.py` — Company and Branch DB models
- `backend/app/schemas/tenant.py` — Tenant create/update/response schemas
- `backend/app/repositories/tenant.py` — Company/Branch repository adapters
- `backend/app/api/v1/products.py` — Product REST router
- `backend/app/api/v1/customers.py` — Customer/Group REST router
- `backend/app/api/v1/sales.py` — Sales Invoice REST router
- `backend/app/tests/test_api_v1.py` — Endpoint integration and isolation test suite

## 9. Files Modified
- [__init__.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/__init__.py) — Register new tenant models
- [base.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/db/base.py) — Import models for metadata collection
- [base.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/base.py) — Implement tenant filtering context
- [main.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/main.py) — Register new routers under `/api/v1/`

## 10. Dependencies
FastAPI, SQLAlchemy 2.x, Alembic, Pytest.

## 11. Risks
- Mismatched tenant headers could result in 404 errors for valid resources.
- *Mitigation:* Ensure default fallback headers are injected or validated during development.

## 12. Rollback Strategy
Revert the version bump, revert Git commits, and run `alembic downgrade -1`.

## 13. Verification Plan
- Deploy migrations and verify Company/Branch tables.
- Execute Pytest endpoint test suite.

## 14. Test Plan
- **GET /api/v1/products**: Verify correct listing and search checks.
- **Tenant Leakage Test**: Attempting to read a product of Company B from Company A context must return 404/403.

## 15. Documentation Impact
Update the Dev Tracker API registry and the SMRITI Wiki endpoints reference guides.

## 16. Deployment Plan
Scaffold Alembic migrations, verify locally, commit and test on the testing environment.

## 17. Status
Draft (Pending User Approval)

## 18. Related ADRs
- None.

## 19. Related Walkthroughs
- None.
