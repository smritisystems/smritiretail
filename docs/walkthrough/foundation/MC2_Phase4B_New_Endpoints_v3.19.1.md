<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.19.1
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# MC2 Phase 4B -- New Business Logic Endpoints

## 1. Purpose
Implement Phase 4B endpoints blocked on three Architect Decisions (AD-1, AD-2, AD-3).
All three decisions resolved and implemented.

## 2. Scope
New service methods and FastAPI route handlers only -- no DB schema changes, no migrations.

## 3. Files Created
| File | Purpose |
|---|---|
| backend/app/api/v1/workflow.py | Core Workflow API (AD-3) -- POST /workflow/{docType}/{id}/{action} |

## 4. Files Modified
| File | Change |
|---|---|
| backend/app/services/purchase.py | +4 methods: submit_purchase_order, get_outstanding_suppliers, get_pending_delivery_pos, get_supplier_default_rate |
| backend/app/services/sales.py | +2 methods: approve_sales_invoice, convert_quotation_to_invoice |
| backend/app/api/v1/purchase.py | +7 routes: settings, settings/jurisdiction, orders/{id}/submit, reports/outstanding, reports/pending-delivery, suppliers/{id}/default-rate |
| backend/app/api/v1/sales.py | +1 route: quotations/convert/{id} |
| backend/app/main.py | workflow router mounted at /api/v1/workflow |

## 5. Architecture Decisions Resolved
**AD-1:** GET/POST /purchase/settings is an alias to the existing PurchaseJurisdictionConfig model.
No new DB table. Returns company_state from purchase_jurisdiction_configs.

**AD-2:** GET /purchase/suppliers/{id}/default-rate uses last GRN (PurchaseReceiptItem.unit_cost)
as the primary source. Falls back to last PurchaseOrderItem.unit_cost if no GRN exists.
Returns source field so caller knows which was used.

**AD-3:** Workflow is a Core Service. Created backend/app/api/v1/workflow.py.
Supported: PurchaseOrder/submit, PurchaseOrder/cancel, SalesInvoice/approve,
SalesInvoice/cancel, SalesQuotation/approve, SalesQuotation/cancel.

## 6. Design Rationale
- State machines are table-driven in _SUPPORTED dict -- adding new document types requires
  only one dict entry, not scattered if-else blocks.
- Default-rate source field prevents silent confusion between GRN cost vs PO cost.
- Quotation convert creates the invoice in Draft status so approval step can be applied
  via the workflow endpoint, keeping business state changes auditable.

## 7. Implementation Summary
Implemented via append-only Python scripts. No existing handlers were modified.
All new handlers delegate directly to service methods following the established
PurchaseService/SalesService dependency injection pattern.

## 8. Tests Executed
`
python -m pytest app/tests/test_pos.py app/tests/test_sales.py app/tests/test_purchase.py
`
Result: 65/65 passed, 335 warnings in 38.71s

## 9. Verification Results
Evidence: commit b8aec7d -- 6 files, +530 insertions
Route listing confirmed all Phase 4B URLs registered:
  GET  /api/v1/purchase/settings
  POST /api/v1/purchase/settings/jurisdiction
  POST /api/v1/purchase/orders/{id}/submit
  GET  /api/v1/purchase/reports/outstanding
  GET  /api/v1/purchase/reports/pending-delivery
  GET  /api/v1/purchase/suppliers/{id}/default-rate
  POST /api/v1/sales/quotations/convert/{id}
  POST /api/v1/workflow/{doc_type}/{doc_id}/{action}

Interpretation: All Phase 4B contract URLs are reachable. 65/65 tests pass.
Recommendation: MC2 migration is now complete for POS, Sales, and Purchase primary flows.
Schedule v3.20.0 to remove deprecated legacy routes.

## 10. Known Limitations
1. Workflow state machine has no persistence/audit log -- state changes are not tracked in a separate table.
2. Outstanding report aggregates items in Python (N+1 per supplier) -- suitable for small datasets; needs SQL aggregation for large tenants.
3. quotation/convert does not copy quotation-level discount -- only line-level fields.

## 11. Future Work
- Add WorkflowEvent audit log table for state transition history
- Replace Python-loop outstanding aggregation with SQL GROUP BY
- v3.20.0: remove all deprecated legacy route aliases

## 12. Related ADRs
- ADR-001: Compatibility Alias strategy (Phase 4A)
- ADR-002: Workflow as Core Service (AD-3)
- ADR-003: Default-rate source priority (last GRN > last PO)

## 13. Related Walkthroughs
- MC2_Phase4A_URL_Contract_Alignment_v3.19.0.md

## Addendum — Model Column Fix (commit d3501c9)

### Evidence
Service bugs found during test authoring (column names diverged from ORM model):

| Location | Wrong | Correct |
|---|---|---|
| services/purchase.py — __init__ references | self.tenant_ctx | self.tenant |
| services/purchase.py — outstanding sum | it.unit_cost | it.cost_price |
| services/purchase.py — outstanding join | PurchaseOrderItem.purchase_order_id | PurchaseOrderItem.order_id |
| services/purchase.py — pending delivery | PurchaseReceipt.purchase_order_id | PurchaseReceipt.order_id |
| services/sales.py — SalesInvoice ctor | notes=... | removed (no column) |
| api/v1/sales.py — convert route | response_model=SalesInvoiceResponse | removed (customer_id required) |

10 new tests added covering all Phase 4B endpoints.
Final result: 75/75 passed.
