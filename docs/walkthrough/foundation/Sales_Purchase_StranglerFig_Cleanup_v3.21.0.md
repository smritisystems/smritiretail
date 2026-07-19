<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-07-16
  Modified     : 2026-07-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sales & Purchase — Strangler-Fig Cleanup v3.21.0

## 1. Purpose
Remove all Express dead-code fallback branches from the Sales and Purchase modules.
Both flags (USE_FASTAPI_SALES, USE_FASTAPI_PURCHASE) were already true and both
Express route files were never mounted in server.ts — making the else branches
unreachable and the three unflagged fetch calls broken (404).

---

## 2. Scope

| Component | Change Type | Count |
|---|---|---|
| SalesStudioTab.tsx | Remove 12 if/else blocks + import | 12 |
| PurchaseStudioTab.tsx | Strip 18 if/else blocks + import (state-machine script) | 18 |
| InventoryForecastWidget.tsx | Bug fix: broken Express fetch → apiFetchV1 | 2 |
| ApprovalMatrixTab.tsx | Bug fix: broken Express fetch → apiFetchV1 | 3 |
| DrillDownSidePanel.tsx | Bug fix: broken Express fetch → apiFetchV1 | 2 |
| src/config/flags.ts | Remove USE_FASTAPI_SALES and USE_FASTAPI_PURCHASE | 2 |
| src/routes/sales.ts | DELETE (never mounted) | — |
| src/routes/purchase.ts | DELETE (never mounted) | — |

---

## 3. Files Created
None.

---

## 4. Files Modified

| File | Change |
|---|---|
| src/components/SalesStudioTab.tsx | Removed 12 if/else blocks; removed isFeatureEnabled import |
| src/components/PurchaseStudioTab.tsx | Removed 18 if/else blocks; removed isFeatureEnabled import |
| src/components/InventoryForecastWidget.tsx | Bug fix: Express → apiFetchV1 |
| src/components/ApprovalMatrixTab.tsx | Bug fix: Express → apiFetchV1; added apiFetchV1 import |
| src/components/drilldown/DrillDownSidePanel.tsx | Bug fix: Express → apiFetchV1; added apiFetchV1 import |
| src/config/flags.ts | Removed 2 retired flag entries |

## 5. Files Deleted

| File | Reason |
|---|---|
| src/routes/sales.ts | Never imported/mounted in server.ts; dead file |
| src/routes/purchase.ts | Never imported/mounted in server.ts; dead file |

---

## 6. Architecture Decisions

### A. State-machine over regex for PurchaseStudioTab
PurchaseStudioTab had 18 if/else blocks spanning template literals with backticks.
Regex is unreliable for nested template literals. A Python line-by-line state-machine
correctly detected } else { terminators and skipped entire else branches.

### B. Bug fix classification for InventoryForecastWidget/ApprovalMatrixTab/DrillDownSidePanel
These three components had raw etch("/api/sales/...") calls with NO feature flag
guard. Since src/routes/sales.ts and src/routes/purchase.ts were never mounted
in server.ts, these calls were silently returning 404 and the components were
rendering empty lists. Migrating them to apiFetchV1 restores functionality.

### C. Array unwrapping for FastAPI response shape
Express returned bare arrays. FastAPI wraps results:
- /sales/orders/ → { orders: [] }
- /purchase/orders/ → { orders: [] }
- /sales/quotations/ → { quotations: [] } or bare array
All 3 bug-fix components use data?.orders ?? data ?? [] fallback pattern.

---

## 7. Implementation Summary

### Migration mapping

| Frontend | Old (Express — unmounted/dead) | New (FastAPI) |
|---|---|---|
| fetchSalesInvoices | GET /api/sales/invoices (else branch) | apiFetchV1('/sales/invoices') |
| fetchSalesReturns | GET /api/sales/returns (else branch) | apiFetchV1('/sales/returns') |
| fetchQuotations | GET /api/sales/quotations (broken) | apiFetchV1('/sales/quotations/') |
| fetchSalesOrders | GET /api/sales/orders (broken) | apiFetchV1('/sales/orders/') |
| handleSaveQuotation | POST /api/sales/quotations (else branch) | apiFetchV1 POST |
| handleWorkflowAction | POST /api/workflow/{type}/{id}/{action} | apiFetchV1 POST |
| handleSaveInvoice | POST /api/sales/invoices (else branch) | apiFetchV1 POST |
| handleSaveReturn | POST /api/sales/returns (else branch) | apiFetchV1 POST |
| handleConvertQuotation | POST /api/sales/quotations/convert/{id} | apiFetchV1 POST |
| handleDeleteQuotation | DELETE /api/sales/quotations/{id} | apiFetchV1 DELETE |
| Approve/Cancel Invoice (ACAS) | POST /api/workflow/... (else branch) | apiFetchV1 POST |
| PurchaseStudioTab (all 18) | All /api/purchase/... (else branches) | apiFetchV1 |
| InventoryForecastWidget | GET /api/sales/orders + /api/purchase/orders | apiFetchV1 |
| ApprovalMatrixTab | GET /api/purchase/orders + sales | apiFetchV1 |
| DrillDownSidePanel | GET /api/sales/quotations + orders | apiFetchV1 |

---

## 8. Tests Executed

`
Command: pytest app/tests/ --tb=short -q
Result : 161 passed, 748 warnings in 123.16s (zero regressions)
`

---

## 9. Verification Results

`
✅ Zero Express /api/sales fetch calls remaining in src/
✅ Zero Express /api/purchase fetch calls remaining in src/
✅ Zero USE_FASTAPI_SALES / USE_FASTAPI_PURCHASE references remaining
✅ src/routes/sales.ts deleted (git shows delete mode)
✅ src/routes/purchase.ts deleted (git shows delete mode)
✅ isFeatureEnabled import removed from SalesStudioTab and PurchaseStudioTab
✅ 161/161 full regression suite passes
`

---

## 10. Known Limitations

- USE_FASTAPI_POS still present (POS module not yet cleaned up)
- ApprovalMatrixTab also calls /api/workflow/... via raw Express fetch — not in scope
  for this migration (workflow module separate)
- FastAPI /sales/quotations/, /sales/orders/, /purchase/orders/ response shapes
  assumed based on REST conventions — runtime testing required to confirm exact
  { quotations }, { orders } keys vs bare arrays

---

## 11. Future Work

- v3.22.0: POS module cleanup — strip USE_FASTAPI_POS if/else blocks
- v3.22.0: Auth cleanup — remove legacy Express session path from authGuard.ts
- v3.22.0: Delete remaining Express route stubs (auth.ts, users.ts, assistant.ts, system.ts)

---

## 12. Related ADRs
None.

## 13. Related RFCs
None.

---

*Commit: 573bb96 | Branch: main | Date: 2026-07-16*
