# API and Backend Assessment

## Inventory

FastAPI is initialized in `backend/app/main.py`; routes use `/api/v1` and are assembled from a router registry. The current source tree contains about 96 API module files and over 1,200 route decorators. Backend folders include API dependencies, services, repositories, SQLAlchemy models, Pydantic schemas, middleware, core configuration, database routing, compliance and platform/event modules.

Representative business endpoints include purchase orders, suppliers, GRNs, sales/POS, inventory/WMS, CRM, barcode/item master, payments, reporting, compliance, system controls, backup and integrations.

## Positive patterns

- Route modules commonly inject `get_current_user`, `get_tenant_context`, `get_company_db` and role dependencies.
- Purchase endpoints shown use typed request/response schemas and invoke `PurchaseService`.
- SQLAlchemy async sessions are provided through dependencies; a dedicated tenant routing path exists.
- Central error handlers, request logging, legacy deprecation handling and optional rate limiting are registered.
- Alembic has scoped migration helpers and a dedicated isolated-test runner.

## Findings and limitations

1. **Tenant fail-closed remediation (EA-SEC-01).** Non-SYSADMIN users without a valid company identity now fail closed, and `get_company_db()` rejects an empty company context. Existing valid-company legacy assignment behavior remains; focused mocked tests passed.
2. **API breadth outpaces verified contracts.** Route presence does not prove service, DB, response and UI behavior. No endpoints were called.
3. **Mixed routing paths and legacy aliases remain.** Router registration mounts some modules at more than one prefix and several aliases exist. This raises contract and duplicate-route maintenance risk; actual collision behavior was not enumerated.
4. **Startup may proceed after schema/bootstrap warnings.** `main.py` catches startup seeding/guard failures and logs schema gaps as critical rather than preventing service startup. Resulting endpoint availability is unknown.
5. **Automatic database bootstrap is the default in the backend entrypoint.** `SKIP_MIGRATIONS` defaults to false. Deployment migration approval/rollback gates are therefore important (EA-OPS-02).
6. **No backend test suite was run.** The test runner creates/marks databases and applies migrations; the required isolated PostgreSQL approval/instance was not available.
7. **Approved security remediations (EA-SEC-03/04).** Bearer webhook routing now uses the persisted authenticated user's role; CGE reversals now require a manager role and a matching completed sales return with replay protection. Focused mocked tests passed; database-backed verification remains pending. Service-key/HMAC webhook behavior remains as before.

## API/service/data workflow evidence

Source layers appear in place but not every business rule is confined to a service: a full repository-wide layer-boundary analysis was outside the available runtime evidence. No writes or API calls were performed. Purchase and sales flows are therefore classified as **implemented in source; end-to-end status unknown**, not passed.

## Score

**Backend Engineering: 5.0/10.** Good framework and layering foundations, but tenant verification, migration governance, route-contract coverage and actual transaction tests remain open. See [07_MODULE_FUNCTIONAL_ASSESSMENT.md](./07_MODULE_FUNCTIONAL_ASSESSMENT.md) and the [risk register](./13_RISK_REGISTER_REMEDIATION_ROADMAP.md).
