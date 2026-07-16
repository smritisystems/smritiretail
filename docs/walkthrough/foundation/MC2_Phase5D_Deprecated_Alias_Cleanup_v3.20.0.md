<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.20.0
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# MC2 Phase 5D -- Deprecated URL Alias Cleanup

## 1. Purpose
Remove deprecated FastAPI URL compatibility aliases that were created in Phase 4A
and scheduled for removal at v3.20.0. Migrate all tests to canonical contract URLs.

## 2. Scope
FastAPI routers (pos.py, purchase.py, sales.py), test files, health_flags.py.
No service layer changes (except one bug fix). No Postgres schema changes.

## 3. Files Modified

| File | Change |
|---|---|
| backend/app/api/v1/pos.py | Removed /shifts/open, /shifts/{id}/close legacy handlers; restored GET /shifts/active/{register_id} |
| backend/app/api/v1/purchase.py | Removed /purchase-orders/ legacy handlers |
| backend/app/api/v1/sales.py | Removed /sales-invoices/ CREATE/LIST/SEARCH legacy handlers |
| backend/app/api/v1/health_flags.py | Deprecated endpoints marked REMOVED in v3.20.0 |
| backend/app/services/purchase.py | order.items = item_rows after refresh (relationship eager load fix) |
| backend/app/tests/test_pos.py | 11 URL updates to canonical paths |
| backend/app/tests/test_sales.py | 43 URL updates to canonical paths |
| backend/app/tests/test_purchase.py | 11 URL updates to canonical paths |

## 4. Canonical URL Mapping (Phase 5D)

| Deprecated | Canonical | Status |
|---|---|---|
| POST /api/v1/shifts/open | POST /api/v1/pos/shifts/open | REMOVED |
| POST /api/v1/shifts/{id}/close | POST /api/v1/pos/shifts/close/{id} | REMOVED |
| GET/POST /api/v1/sales-invoices/ | GET/POST /api/v1/sales/invoices/ | REMOVED |
| GET/POST /api/v1/purchase-orders/ | GET/POST /api/v1/purchase/orders/ | REMOVED |

## 5. Bug Fix (found during regression)
PurchaseService.create_purchase_order() called db.refresh(order) after commit.
db.refresh() does not load SQLAlchemy relationships — order.items remained empty.
Fix: added order.items = item_rows (in-memory attach) before return.
This was masked by the old legacy handler which may have had a different fetch pattern.

## 6. Tests Executed
`
python -m pytest app/tests/test_pos.py app/tests/test_sales.py app/tests/test_purchase.py
`
Result: 75/75 passed, 384 warnings in 42.60s

## 7. Verification Results
Evidence: commit 2185242 -- 8 files, +81 insertions, -252 deletions
Interpretation: Net 252 lines deleted -- the deprecated alias code is cleanly removed.
Recommendation: MC2 migration complete. Next: systemic debt (N+1 reports, WorkflowEvent).

## 8. Known Limitations
GET /shifts/active/{register_id} remains at the legacy /shifts/* prefix (not /pos/shifts/active/*).
This is intentional -- it is not a deprecated alias, it is a genuine utility endpoint.

## 9. Future Work
v3.21.0: Delete deprecated src/routes/*.ts files from Express
v3.21.0: Migrate App.tsx auth check to apiFetchV1(/auth/me) and remove auth.ts from Express
Systemic Debt: Replace N+1 report loops with SQL aggregation
Systemic Debt: Add WorkflowEvent audit log model
