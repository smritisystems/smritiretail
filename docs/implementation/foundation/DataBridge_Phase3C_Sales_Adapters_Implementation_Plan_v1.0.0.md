<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan — SMRITI DataBridge Phase 3C Outward Sales Document Adapters
-->

# Implementation Plan: SMRITI DataBridge Phase 3C — Outward Sales Transaction Documents

## 1. Objective
Establish canonical, enterprise-grade DataBridge domain adapters for outward sales transactions:
- **Sales Invoice** (`DataBridgeSalesInvoiceAdapter`)
- **Sales Return / Credit Note** (`DataBridgeSalesReturnAdapter`)
- **Sales Order** (`DataBridgeSalesOrderAdapter`)

These adapters extend the SMRITI DataBridge engine to parse, normalize (including multi-row tabular line grouping by document identifier and nested items), validate, match, diff, conflict-detect, preview, and atomically commit outward sales transactions with customer dependency auto-resolution/auto-provisioning, product/SKU line reconciliation, multi-tenant isolation, and WORM audit logging without database schema mutations.

---

## 2. Business Motivation
During store openings, legacy ERP migrations (Tally Prime, SAP, Busy, Marg ERP, Excel spreadsheets), and ongoing B2B wholesale / omni-channel customer operations, businesses must ingest batches of historical or pending sales transactions. Manual entry of multi-line sales invoices, sales orders, and sales returns is error-prone and time-consuming. DataBridge Phase 3C automates sales document ingestion while enforcing commercial invariants: line math integrity, GST reconciliation (taxable amount, CGST/SGST/IGST, total amount), idempotency against duplicate invoice numbers or order numbers, customer master resolution, and optional inline provisioning of missing customer and product records.

---

## 3. Scope
- **Entities**:
  - `SALES_INVOICE`: Multi-item tax invoices with invoice numbers, customer linkages, item rates, line taxes, and statutory totals.
  - `SALES_RETURN`: Outward customer returns / credit notes referencing original invoices or recorded as historical returns.
  - `SALES_ORDER`: Multi-item customer sales orders with order numbers, customer linkages, delivery dates, and pending quantities.
- **Subsystems Affected**:
  - `backend/app/services/databridge/models.py` (extend `DataBridgeEntityType` with `SALES_INVOICE`, `SALES_RETURN`, `SALES_ORDER`)
  - `backend/app/services/databridge/adapters/sales_invoice_adapter.py`
  - `backend/app/services/databridge/adapters/sales_return_adapter.py`
  - `backend/app/services/databridge/adapters/sales_order_adapter.py`
  - `backend/app/services/databridge/adapters/__init__.py`
  - `backend/app/services/databridge/service.py` (`resolve_adapter` registry)
  - `backend/app/api/v1/databridge.py` (preview/commit endpoints for `/sales-invoice/*`, `/sales-return/*`, `/sales-order/*`)
  - `src/lib/headerMapping/types.ts` (`MappingContext`)
  - `src/lib/headerMapping/HeaderAliasRegistry.ts` (sales column header dictionaries)
  - `backend/tests/test_databridge_phase3c_sales.py` (verification test suite)
- **Out of Scope**:
  - Modifying existing database tables or columns (strictly zero migrations; all models match existing PostgreSQL schema).
  - Deleting or mutating existing production tenant data.

---

## 4. Current State
- Phase 1 Core Foundation provides 7-stage pipeline, multi-tenant isolation, 30-min preview tokens, and WORM audit trails.
- Phase 2 provides catalog adapters (`ITEM`, `VARIANT`, `BARCODE`, `PRICEBOOK`).
- Phase 3A provides party adapters (`CUSTOMER`, `SUPPLIER`).
- Phase 3B provides procurement transaction adapters (`PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, `PURCHASE_DEBIT_NOTE`).
- Sales documents currently can only be created via interactive transactional APIs in `backend/app/api/v1/sales.py`.

---

## 5. Gap Analysis
1. **No DataBridge adapter for Sales Invoices**: No batch ingestion capability for multi-line sales invoices with header alias mapping, customer auto-resolution, and line grouping.
2. **No DataBridge adapter for Sales Returns**: No batch ingestion capability for customer returns or credit notes.
3. **No DataBridge adapter for Sales Orders**: No batch ingestion capability for customer sales orders with line items.
4. **Header Alias Registry Missing Sales Dictionaries**: Frontend alias registry lacks comprehensive alias dictionaries for sales orders and sales returns.

---

## 6. Architecture Impact
- **Zero Schema Migrations**: All operations use existing `sales_invoices`, `sales_invoice_items`, `sales_orders`, `sales_order_items`, `sales_returns`, and `sales_return_items` tables.
- **Strict Multi-Tenant Isolation**: Enforces tenant boundary matching and prevents control-plane database operations.
- **Foreign Key Invariant Satisfaction**: Automatically resolves or provisions `Customer` and `Product` records when missing via `IdentityEngine.allocate_internal`, satisfying database foreign keys (`customer_id`, `product_id`).
- **Idempotency**: Prevents double-posting via document number uniqueness and preview token validation.

---

## 7. Proposed Design
1. **`DataBridgeSalesInvoiceAdapter`**:
   - Maps raw header aliases (`invoice_no`, `customer_name`, `customer_gstin`, `item_code`, `quantity`, `price`, `gst_rate`, `total_amount`).
   - Groups multi-line rows by `invoice_no`.
   - Validates mathematical invariants (`taxable_amount + tax_amount == total_amount`).
   - Resolves or provisions `Customer` (by ID, code, GSTIN, mobile, name).
   - Resolves or provisions `Product` (by ID, code, name).
   - Inserts `SalesInvoice` and `SalesInvoiceItem` atomically.
2. **`DataBridgeSalesOrderAdapter`**:
   - Maps raw header aliases (`order_no`, `customer_name`, `item_code`, `quantity`, `price`, `gst_rate`).
   - Groups multi-line rows by `order_no`.
   - Validates quantity, price, and totals.
   - Resolves or provisions `Customer` and `Product`.
   - Delegates to `SalesService.create_sales_order` or direct ORM insertion with `IdentityEngine`.
3. **`DataBridgeSalesReturnAdapter`**:
   - Maps raw header aliases (`return_no`, `original_invoice_no`, `item_code`, `quantity`, `price`, `reason`).
   - Groups multi-line rows by `return_no`.
   - Resolves `original_invoice_id` if invoice number is supplied.
   - Inserts `SalesReturn` and `SalesReturnItem` atomically with audit logging.

---

## 8. Files Created
- `backend/app/services/databridge/adapters/sales_invoice_adapter.py`
- `backend/app/services/databridge/adapters/sales_return_adapter.py`
- `backend/app/services/databridge/adapters/sales_order_adapter.py`
- `scripts/register_databridge_phase3c_architecture.py`
- `backend/tests/test_databridge_phase3c_sales.py`
- `docs/walkthrough/foundation/DataBridge_Phase3C_Sales_Adapters_v1.0.0.md`

---

## 9. Files Modified
- `backend/app/services/databridge/models.py`
- `backend/app/services/databridge/adapters/__init__.py`
- `backend/app/services/databridge/service.py`
- `backend/app/api/v1/databridge.py`
- `src/lib/headerMapping/types.ts`
- `src/lib/headerMapping/HeaderAliasRegistry.ts`
- `docs/implementation/README.md`

---

## 10. Dependencies
- FastAPI & SQLAlchemy AsyncSession
- `app.models.sales` (`SalesInvoice`, `SalesInvoiceItem`, `SalesOrder`, `SalesOrderItem`, `SalesReturn`, `SalesReturnItem`)
- `app.models.crm` (`Customer`)
- `app.models.inventory` (`Product`)
- `app.services.identity.engine` (`IdentityEngine`)
- `app.services.sales` (`SalesService`)

---

## 11. Risks
- **Foreign Key Violation Risk**: If an inward item row references an unknown product and product creation fails, foreign key constraint will block transaction.
  - *Mitigation*: Ensure `Product` auto-provisioning creates valid product records with assigned `barcode` and allocated internal IDs.
- **Tenant Context Invariant**: Ensure `TenantContext` is instantiated with only `company_id` and `branch_id`.

---

## 12. Rollback Strategy
If any issues arise, the new adapters can be disabled by rolling back the `resolve_adapter` dispatch in `service.py`. Existing database data is unmodified because no schema changes or data mutations were performed.

---

## 13. Verification Plan
- Unit and integration tests covering preview, validation, conflict detection, grouping, customer auto-resolution, and atomic commits.
- Architecture certification script: `npm run architecture:check`.
- TypeScript compile validation: `npm run lint`.
- Pytest regression suite across Phase 1, Phase 2, Phase 3A, Phase 3B, and Phase 3C.

---

## 14. Test Plan
- `test_sales_invoice_preview_and_commit`: Multi-row sales invoice grouping, math validation, customer auto-provisioning, and DB verification.
- `test_sales_order_preview_and_commit`: Multi-row sales order grouping, quantity validation, and DB verification.
- `test_sales_return_preview_and_commit`: Sales return grouping, invoice reference resolution, and DB verification.
- `test_duplicate_document_conflict`: Duplicate invoice/order numbers raise blocking conflict.
- `test_invalid_math_conflict`: Mismatched line totals raise blocking conflict.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/foundation/DataBridge_Phase3C_Sales_Adapters_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
- Deploy as code-only enhancement.
- Register capability bindings in tenant database.
- Zero downtime; zero migration required.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0042`: DataBridge Enterprise Architecture & Multi-Tenant Ingress Boundary
- `ADR-0043`: Transaction Document Grouping & Auto-Provisioning Invariants

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Phase3A_Party_Adapters_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3B_Procurement_Adapters_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3C_Sales_Adapters_v1.0.0.md`
