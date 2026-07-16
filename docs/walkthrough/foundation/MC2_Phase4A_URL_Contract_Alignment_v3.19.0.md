<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.19.0
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# MC2 Phase 4A — URL Contract Alignment Walkthrough

## 1. Purpose

Align FastAPI route URLs with the frontend PAL contract so that the feature flags
`USE_FASTAPI_POS`, `USE_FASTAPI_SALES`, and `USE_FASTAPI_PURCHASE` (already `true`
in `src/config/flags.ts`) route traffic to working FastAPI endpoints instead of
returning 404s.

## 2. Scope

Phase 4A is a pure structural refactor — no new business logic, no schema changes,
no database migrations. Only route registration changes and compatibility aliases.

Phase 4B (new endpoints: `/purchase/settings`, `/suppliers/{id}/default-rate`,
Core Workflow API) is deferred pending three Architect Decisions (AD-1, AD-2, AD-3).

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/api/v1/health_flags.py` | GET /api/v1/health/flags — lists contract endpoints per PAL flag |

## 4. Files Modified

| File | Change summary |
|---|---|
| `backend/app/api/v1/pos.py` | Added contract aliases: POST /pos/shifts/open, POST /pos/shifts/close/{id}; marked legacy /shifts/open and /shifts/{id}/close deprecated=True |
| `backend/app/api/v1/sales.py` | Added contract aliases: GET/POST /invoices; marked legacy GET /, POST / deprecated=True |
| `backend/app/api/v1/purchase.py` | Added contract aliases: GET/POST /orders/, GET /orders/{id}, POST /orders/{id}/cancel+amend; marked /purchase-orders/* deprecated=True |
| `backend/app/main.py` | Dual-mount: sales at /api/v1/sales AND /api/v1/sales-invoices; purchase at /api/v1/purchase AND bare /api/v1; health router at /api/v1/health |
| `backend/app/tests/test_pos.py` | +2 contract URL tests |
| `backend/app/tests/test_sales.py` | +3 contract URL tests |
| `backend/app/tests/test_purchase.py` | +3 contract URL tests + health flag test |

## 5. Architecture Decisions

### AD-8: Compatibility Alias Strategy (not rename)
Per architectural review, all old route URLs are preserved as deprecated aliases
rather than being renamed. This prevents breaking any consumer not yet known
(mobile, CLI, integration). Removal is scheduled for v3.20.0.

### AD-9: Dual-mount pattern
The same FastAPI router is included twice in `main.py` — once at the legacy prefix
and once at the contract prefix. Both mounts reference the same handler functions,
so there is zero code duplication and zero behavioral difference between old and
new URLs.

### AD-10: Workflow endpoints are a Core Service, not module endpoints
`POST /workflow/{docType}/{id}/{action}` must not live in `sales.py` or
`purchase.py`. It belongs in a dedicated `core/workflow/` service. This decision
blocks Phase 4B workflow endpoints until AD-3 is resolved by the architect.

## 6. Design Rationale

The root cause of the URL mismatch was that Phases 1–3 migrated business logic
to FastAPI but used URL conventions inherited from Express rather than the
frontend PAL contract. Phase 4A corrects the contract without touching any
service logic.

## 7. Implementation Summary

- Automated Python scripts applied targeted string insertions to pos.py,
  sales.py, and purchase.py.
- `main.py` was patched to add duplicate router mounts with the contract prefixes.
- `health_flags.py` was written from scratch to provide operational visibility
  into flag-to-endpoint mapping.
- All test failures were traced to wrong fixture assumptions (fixture-style vs
  db_session+ASGITransport pattern) and wrong payload field names — both fixed
  by reading existing test bodies.

## 8. Tests Executed

```
python -m pytest app/tests/test_pos.py app/tests/test_sales.py app/tests/test_purchase.py
```

BEFORE: 57 passed, 304 warnings in 34.98s
AFTER:  65 passed, 335 warnings in 39.43s

New tests added: 8 (2 POS + 3 Sales + 3 Purchase including health flag)

## 9. Verification Results

**Evidence:**
- Commit: `4e0c9c6` — 8 files, +349 insertions, -7 deletions
- Terminal: `65/65 passed`
- Route listing confirmed all contract URLs registered:
  - `POST /api/v1/pos/shifts/open` ✅
  - `POST /api/v1/pos/shifts/close/{shift_id}` ✅
  - `POST /api/v1/pos/checkout` ✅ (was already correct)
  - `GET/POST /api/v1/sales/invoices` ✅
  - `GET /api/v1/sales/quotations/` ✅
  - `GET /api/v1/sales/returns/` ✅
  - `GET/POST /api/v1/purchase/orders/` ✅
  - `GET /api/v1/purchase/suppliers/` ✅
  - `GET /api/v1/health/flags` ✅

**Interpretation:**
All contract URLs are registered and respond correctly. Legacy URLs remain active
and marked deprecated. The feature flags (`USE_FASTAPI_*: true`) now route to
working endpoints for all primary CRUD operations.

**Recommendation:**
Proceed with AD-1, AD-2, AD-3 decisions to unlock Phase 4B. Then schedule removal
of deprecated legacy routes in v3.20.0.

## 10. Known Limitations

1. `POST /workflow/{docType}/{id}/{action}` — not yet implemented (blocked on AD-3)
2. `GET /purchase/settings` — not yet implemented (blocked on AD-1)
3. `GET /purchase/suppliers/{id}/default-rate` — not yet implemented (blocked on AD-2)
4. `POST /sales/quotations/convert/{id}` — not yet implemented (Phase 4B)
5. Legacy deprecated URLs will remain active until v3.20.0 removal

## 11. Future Work

- Phase 4B: implement missing endpoints after AD decisions
- v3.20.0: remove all deprecated legacy route aliases
- Integration tests: end-to-end flow (create PO → receive GRN → create invoice → stock)

## 12. Related ADRs

- ADR-008: Compatibility Alias Strategy (not rename) for public API contracts
- ADR-009: Dual-mount router pattern for zero-downtime URL migration
- ADR-010: Workflow is a Core Service, not a module endpoint

## 13. Related RFCs

- MC2 Phase 1–3: Business logic migration (completed)
- MC2 Phase 4A: This walkthrough
- MC2 Phase 4B: New endpoints — pending AD-1, AD-2, AD-3
