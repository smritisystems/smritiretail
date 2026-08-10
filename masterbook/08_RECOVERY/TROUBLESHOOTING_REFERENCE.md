<!--
  SMRITI Retail OS — Masterbook
  Document  : 08_RECOVERY/TROUBLESHOOTING_REFERENCE.md
  Status    : LIVING DOCUMENT — append new issues as discovered
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Troubleshooting Reference

> This is a **living document**. Append new issues as they are discovered and resolved.
> Format: Issue ID → Symptom → Root Cause → Fix → Prevention.

---

## ISSUE-2026-08-10-01 — Sales Invoice HTTP 422: customer_id Field Required

**Symptom:** `POST /api/v1/sales/invoices → 422: body → customer_id: Field required`

**Root Cause (confirmed via audit SCS-INV-001):**
Three gaps in the frontend-to-backend wiring:
1. `ISalesService.ts` had no `customerId` field — ID was never carried in the type contract
2. `SalesService.ts` `saveInvoice()` never mapped `customerId` to the JSON payload
3. `SalesBillingStudio.tsx` `handleConfirmPostInvoice()` never extracted `selectedCustomer.id` into the command

**Fix:**
- Added `customerId?: string` to `SalesInvoiceRecord` in `ISalesService.ts`
- Mapped `customerId: invoiceData.customerId` in `SalesService.ts`
- Added `customerId: selectedCustomer?.id` in `CreateSalesInvoiceCommand` in `SalesBillingStudio.tsx`
- Added frontend POST guard: `if (!selectedCustomer?.id) { showToast(...); return; }`

**Prevention:** All future transaction commands must trace the FK field from UI state → type contract → service → payload → schema → DB.

---

## ISSUE-2026-08-10-02 — Cross-Company Customer Injection (Security Gap)

**Symptom:** A Company A customer's `id` could be submitted in a Company B invoice with no backend rejection.

**Root Cause:** `SalesBusinessOrchestrator.create_sales_invoice()` had no customer ownership validation.

**Fix:** Added customer-tenant isolation check in orchestrator:
```python
cust_check = await db.execute(select(Customer).where(
    Customer.id == invoice_in.customer_id,
    Customer.company_id == tenant_ctx.company_id,
))
if not cust_check.scalars().first():
    raise HTTPException(404, "Customer not found in this company")
```

**Prevention:** Every orchestrator that creates transactions must validate all FK references against `tenant_ctx.company_id`.

---

## ISSUE-2026-08-10-03 — CustomerService Silent Fake ID Fallback

**Symptom:** When `POST /customers` fails (network error), `CustomerService.save()` silently returned `cust_${Date.now()}` as the customer ID. This fake ID was used in invoice POST → orchestrator returned 404 (customer not found).

**Root Cause:** Silent catch block in `CustomerService.ts` returned a local object instead of throwing.

**Fix:** Removed the silent fallback. Backend failure now throws — Quick Add modal shows an error toast to the user.

**Prevention:** Never silently return a fake/local ID for any entity that requires a backend DB row.

---

## ISSUE-2026-08-10-04 — Company Switch: Stale Customer Cache in SalesBillingStudio

**Symptom:** After switching from Company A to Company B, the customer dropdown in SalesBillingStudio still showed Company A customers.

**Root Cause:** `SalesBillingStudio` did not subscribe to `Workspace.Changed.v1`. The `CustomerService.localCache` was not flushed on company switch.

**Fix:**
- `CustomerService` already subscribed to `Workspace.Changed.v1` (flushes `localCache`)
- Added explicit `Workspace.Changed.v1` subscriber in `SalesBillingStudio` to reset `selectedCustomer` state

**Prevention:** Every component holding company-sensitive UI state must subscribe to `Workspace.Changed.v1`.

---

## ISSUE-2026-08-10-05 — Pydantic date_from_datetime_inexact on CustomerResponse

**Symptom:** `GET /api/v1/customers → ResponseValidationError: date_from_datetime_inexact on created_date`

**Root Cause:** `Customer` ORM model has `created_date = Column(Date, default=datetime.utcnow)`. `datetime.utcnow` returns a `datetime` object but Pydantic v2 strict date validation rejects `datetime` in a `date` field.

**Fix:** When creating Customer rows directly (e.g. in tests), pass `created_date=date.today()` explicitly.

**Prevention:** Use `default=date.today` (function reference, not `datetime.utcnow`) for `Date` columns.

---

## ISSUE-2026-08-10-06 — Test Deadlock: CrmService.commit() on Shared Session

**Symptom:** `asyncpg.exceptions.DeadlockDetectedError` when `POST /customers` is called in pytest with shared `db_session` fixture.

**Root Cause:** `CrmService.create_customer()` calls `await self.db.commit()` internally. The shared `db_session` fixture is not designed to have `.commit()` called mid-test. After commit, the subsequent eager-load SELECT causes a PostgreSQL deadlock on the same connection.

**Fix (test):** Use direct ORM `_create_db_customer()` helper for tests that need a customer but are testing invoice behavior, not customer creation HTTP path.

**Prevention:** Tests that use the shared session should not call endpoints whose services call `db.commit()` internally. Those endpoints need their own DB session (pool connection).

---

## ISSUE-2026-08-10-07 — Test 307 Redirect on /customers/

**Symptom:** Tests using `/api/v1/crm/customers/` (trailing slash) received `307 Temporary Redirect`.

**Root Cause:** FastAPI router defines `@router.post("/customers")` (no trailing slash). httpx's `AsyncClient` does not follow redirects by default.

**Fix:** Use `/api/v1/customers` (no trailing slash, no `/crm/` prefix since router is mounted at `/api/v1`).

**Prevention:** Always check actual router `@router.post(path)` definition. Never assume trailing slash. Never assume `crm` prefix is in the URL — check `app.include_router(router, prefix=...)`.

---

*Status: LIVING DOCUMENT | Version: 1.0.0 | 2026-08-10*
