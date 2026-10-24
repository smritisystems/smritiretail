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
  Classification: Walkthrough — DataBridge Phase 3C Outward Sales Document Adapters
-->

# Walkthrough: SMRITI DataBridge Phase 3C — Outward Sales Transaction Documents

## 1. Purpose
This walkthrough documents the design, implementation, and automated verification of **SMRITI DataBridge Phase 3C Outward Sales Transaction Document Adapters**:
- **Sales Invoice** (`DataBridgeSalesInvoiceAdapter`)
- **Sales Return / Credit Note** (`DataBridgeSalesReturnAdapter`)
- **Sales Order** (`DataBridgeSalesOrderAdapter`)

These adapters enable bulk migration and ingestion of outward commercial sales transactions from external ERPs (Tally Prime, SAP, Busy, Marg ERP, Excel spreadsheets) with multi-row line grouping, customer auto-resolution/auto-provisioning, product/SKU line reconciliation for foreign key satisfaction, multi-tenant isolation, cryptographic preview tokens, and immutable WORM audit logs with zero database schema mutations.

---

## 2. Scope
- **Domain Adapters**:
  - `SALES_INVOICE`: Multi-line tax invoices grouped by `invoice_no` with customer auto-provisioning, GST calculations, and line item persistence.
  - `SALES_RETURN`: Customer returns / credit notes grouped by `return_no` with invoice resolution/stubbing and refund calculations.
  - `SALES_ORDER`: Customer sales orders grouped by `order_no` with line items, delivery dates, and pending quantity tracking.
- **Subsystems Implemented & Modified**:
  - `backend/app/services/databridge/adapters/sales_invoice_adapter.py`
  - `backend/app/services/databridge/adapters/sales_return_adapter.py`
  - `backend/app/services/databridge/adapters/sales_order_adapter.py`
  - `backend/app/services/databridge/adapters/__init__.py`
  - `backend/app/services/databridge/models.py`
  - `backend/app/services/databridge/service.py`
  - `backend/app/api/v1/databridge.py`
  - `src/lib/headerMapping/types.ts`
  - `src/lib/headerMapping/HeaderAliasRegistry.ts`
  - `scripts/register_databridge_phase3c_architecture.py`
  - `backend/tests/test_databridge_phase3c_sales.py`
- **Exclusions**:
  - Zero database migrations (all operations target existing PostgreSQL schema).
  - Zero modifications to live tenant data.

---

## 3. Files Created
1. `backend/app/services/databridge/adapters/sales_invoice_adapter.py`
2. `backend/app/services/databridge/adapters/sales_return_adapter.py`
3. `backend/app/services/databridge/adapters/sales_order_adapter.py`
4. `scripts/register_databridge_phase3c_architecture.py`
5. `backend/tests/test_databridge_phase3c_sales.py`
6. `docs/implementation/foundation/DataBridge_Phase3C_Sales_Adapters_Implementation_Plan_v1.0.0.md`
7. `docs/walkthrough/foundation/DataBridge_Phase3C_Sales_Adapters_v1.0.0.md`

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py` (extended `DataBridgeEntityType` with `SALES_INVOICE`, `SALES_RETURN`, `SALES_ORDER`)
2. `backend/app/services/databridge/adapters/__init__.py` (exported sales adapters)
3. `backend/app/services/databridge/service.py` (wired adapters into `resolve_adapter`)
4. `backend/app/api/v1/databridge.py` (added preview and commit endpoints for `/sales-invoice/*`, `/sales-order/*`, `/sales-return/*`)
5. `src/lib/headerMapping/types.ts` (added `SALES_RETURN` and `SALES_ORDER` to `MappingContext`)
6. `src/lib/headerMapping/HeaderAliasRegistry.ts` (registered `SMRITI_SALES_INVOICE_FIELDS`, `SMRITI_SALES_ORDER_FIELDS`, `SMRITI_SALES_RETURN_FIELDS`)
7. `docs/implementation/README.md` (updated master index table)

---

## 5. Architecture Decisions
- **Multi-Row Line Grouping Invariant**: Inward tabular data frequently presents multi-line documents as flat rows repeating the document identifier (`invoice_no`, `order_no`, `return_no`). The adapters group rows into composite documents prior to validation, matching, diffing, and commitment.
- **Customer Auto-Provisioning**: When an invoice, order, or return references a customer by code, mobile, GSTIN, or name that does not exist in `customers`, the adapter provisions a minimal `Customer` record via `IdentityEngine.allocate_internal` to strictly satisfy `ForeignKey("customers.id", ondelete="RESTRICT")`.
- **Product Auto-Provisioning for Transactional Integrity**: Inward sales lines reference items by code or barcode. If absent from `products`, the adapter auto-provisions a `Product` entity with allocated `barcode` and internal identity to guarantee foreign key satisfaction.
- **Historical Sales Return Stubbing**: In historical data migrations where original invoices were issued in legacy systems, the adapter resolves or provisions a stub `SalesInvoice` reference (`INV-HIST-{return_no}`) to satisfy `ForeignKey("sales_invoices.id")` without breaking schema invariants.

---

## 6. Design Rationale
- **Isolation of Ingress Concerns**: Domain adapters encapsulate header aliases, data cleaning, mathematical verification, and entity resolution, keeping `DataBridgeService` focused on security, tenant isolation, and cryptographic auditing.
- **Strict Mathematical Invariants**: Sales invoice and return amounts require that pre-tax taxable values plus tax totals equal grand totals within rounding thresholds.

---

## 7. Implementation Summary
- **`DataBridgeSalesInvoiceAdapter`**:
  - Implemented header aliases for `invoice_no`, `customer_name`, `customer_gstin`, `item_code`, `quantity`, `price`, `gst_rate`, `tax_amount`, `total_amount`.
  - Grouped multi-line items by `invoice_no`.
  - Validated mandatory headers and positive line quantities.
  - Performed conflict detection for duplicate invoice numbers within the company.
  - Handled customer and product auto-resolution.
  - Created `SalesInvoice` and `SalesInvoiceItem` atomically.
- **`DataBridgeSalesOrderAdapter`**:
  - Implemented header aliases for `order_no`, `customer_name`, `item_code`, `quantity`, `price`, `gst_rate`, `po_number`.
  - Grouped lines by `order_no`.
  - Validated positive quantities and prices.
  - Created `SalesOrder` and `SalesOrderItem` records atomically.
- **`DataBridgeSalesReturnAdapter`**:
  - Implemented header aliases for `return_no`, `original_invoice_no`, `item_code`, `quantity`, `price`, `reason`.
  - Grouped lines by `return_no`.
  - Resolved or stubbed `original_invoice_id` to satisfy foreign keys.
  - Created `SalesReturn` and `SalesReturnItem` atomically.

---

## 8. Tests Executed
```bash
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/tests/test_databridge_phase3c_sales.py -v
```
Output:
- `test_tc_sales_001_sales_invoice_preview_and_commit`: PASSED
- `test_tc_sales_002_sales_invoice_duplicate_conflict`: PASSED
- `test_tc_sales_003_sales_invoice_in_file_duplicate`: PASSED
- `test_tc_sales_004_sales_order_preview_and_commit`: PASSED
- `test_tc_sales_005_sales_order_duplicate_conflict`: PASSED
- `test_tc_sales_006_sales_return_preview_and_commit`: PASSED
- `test_tc_sales_007_sales_return_duplicate_conflict`: PASSED
- `test_tc_sales_008_rest_endpoints_e2e_preview_and_commit`: PASSED

Full regression across all phases:
```bash
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/tests/test_databridge_phase1.py backend/tests/test_databridge_phase2_catalog.py backend/tests/test_databridge_phase3a_party.py backend/tests/test_databridge_phase3b_procurement.py backend/tests/test_databridge_phase3c_sales.py -v
```
Output:
- 52 passed, 22 warnings in 63.62s (0:01:03)

Architecture & Linter validations:
- `npm run architecture:check`: 11/11 checks passed, 0 violations.
- `npm run lint` (`tsc --noEmit`): exit code 0, 0 errors.

---

## 9. Verification Results
| Test Suite / Tool | Test Cases / Checks | Result | Status |
|-------------------|---------------------|--------|--------|
| `test_databridge_phase3c_sales.py` | 8/8 test cases | Passed (0 failures) | Done |
| Full DataBridge Regression (Phases 1-3C) | 52/52 test cases | Passed (0 failures) | Done |
| Architecture Guard (`architecture:check`) | 11/11 rules | Passed (0 violations) | Done |
| Frontend Type Check (`npm run lint`) | TypeScript compiler | Passed (exit code 0) | Done |

---

## 10. Known Limitations
- AI/analytical sales forecasting models under `backend/app/ai/` remain intentionally dormant per backend system-of-record policy until sufficient live transaction volume exists.
- Large files exceeding 5,000 rows require chunking or asynchronous job queuing (Phase 4).

---

## 11. Future Work
- **Phase 4**: Asynchronous background queue engine for files exceeding 5,000 rows with progress telemetry.
- **Phase 5**: Inventory stock movement adjustments and financial journal voucher adapters.

---

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export Architecture
- `ADR-0042`: DataBridge Enterprise Multi-Tenant Boundary
- `ADR-0043`: Transaction Document Grouping & Auto-Provisioning Invariants

---

## 13. Related RFCs
- `RFC-2026-004`: Outward Sales Ingress Protocols & Customer Master Invariants
