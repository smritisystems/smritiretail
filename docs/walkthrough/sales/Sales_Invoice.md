<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-14
  Modified     : 2026-08-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Sales & Invoice Frontend-to-Backend Wiring & Contract Certification v3.22.0

## 1. Purpose
Wire the completed Sales & Invoice backend (`backend/app/api/v1/sales.py`, `backend/app/services/sales.py`) to the existing SMRITI frontend (`SalesStudioTab.tsx`) without altering the frozen v1.1 architecture. Implement double-submit idempotency protection, JWT-based tenant header validation, stock deduction, and transactional outbox recording in `smritisys`. Verify end-to-end browser and API flows via dedicated contract tests (TEST-01 to TEST-10) and the 29-test production certification suite.

## 2. Scope
- **Frontend Wiring**: Connected `src/components/SalesStudioTab.tsx` to FastAPI endpoints (`POST /api/v1/sales/invoices`, `GET /api/v1/sales/invoices/{id}`, `GET /api/v1/sales/invoices/{id}/html`, `GET /api/v1/sales/invoices/{id}/pdf`) via `apiFetchV1`.
- **State Replacement**: Replaced client-side invoice state immediately with authoritative server responses (`tax_total`, `grand_total`, `invoice_no`, `status`).
- **Client-Generated Idempotency**: Implemented `Idempotency-Key` header handling in `POST /api/v1/sales/invoices` and persisted client key across request retries in `SalesStudioTab.tsx`.
- **Cross-Tenant PDF/HTML Protection**: Enforced tenant `company_id` and `branch_id` isolation in `InvoicePdfService` so PDF/HTML document endpoints return `404 Not Found` if requested across company boundaries.
- **Tenant Header Security**: Enforced `X-Company-Code` header validation against JWT claims in `deps.get_tenant_context` to reject header tampering with `403 Forbidden`.
- **Single PDF/HTML Engine**: `InvoicePdfService` serves as the single source of truth for both HTML preview and PDF output rendering.
- **Contract Certification**: 39/39 passing integration and certification tests.

## 3. Files Created
- [`backend/tests/t_sales_contract.py`](file:///F:/SMRITRretailNX/backend/tests/t_sales_contract.py): 10 dedicated contract, cross-tenant isolation, and 3-step idempotency integration tests (TEST-01 to TEST-10).
- [`docs/walkthrough/sales/Sales_Invoice.md`](file:///F:/SMRITRretailNX/docs/walkthrough/sales/Sales_Invoice.md): Formal governance walkthrough.

## 4. Files Modified
- [`src/components/SalesStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/SalesStudioTab.tsx): Replaced local invoice state with authoritative server response upon save, added client `Idempotency-Key` header persistence across retries, and integrated HTML print preview modal.
- [`backend/app/services/sales.py`](file:///F:/SMRITRretailNX/backend/app/services/sales.py): Added `idempotency_key` parameter support in `create_sales_invoice`, product lookup by ID or code, outbox event recording, and eager `selectinload(SalesInvoice.items)`.
- [`backend/app/services/invoice_pdf_service.py`](file:///F:/SMRITRretailNX/backend/app/services/invoice_pdf_service.py): Enforced tenant `company_id` and `branch_id` isolation filters to prevent cross-tenant PDF/HTML invoice lookups.
- [`backend/app/api/v1/sales.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/sales.py): Extracted `Idempotency-Key` header in `create_sales_invoice_contract` and passed active `tenant_ctx` to `InvoicePdfService`.
- [`backend/app/schemas/sales.py`](file:///F:/SMRITRretailNX/backend/app/schemas/sales.py): Added `validation_alias=AliasChoices(...)` for camelCase and snake_case API payload compatibility.
- [`backend/app/api/deps.py`](file:///F:/SMRITRretailNX/backend/app/api/deps.py): Enforced `X-Company-Code` header validation against JWT claims for non-SYSADMIN users.
- [`backend/app/repositories/sales.py`](file:///F:/SMRITRretailNX/backend/app/repositories/sales.py): Overrode `get(id)` method with `selectinload(SalesInvoice.items)` to prevent `MissingGreenlet` serialization errors.
- [`backend/app/core/error_handlers.py`](file:///F:/SMRITRretailNX/backend/app/core/error_handlers.py): Added detailed exception logging for database errors.

## 5. Architecture Decisions
1. **Authoritative Response Replacement**: Browser estimates are discarded post-save; frontend invoice state is completely overwritten by the server's calculated totals, tax breakdowns, and system-assigned identifiers.
2. **Backend Authorization Independence**: `deps.get_tenant_context` independently validates JWT claims against requested tenant headers (`X-Company-Code`). Header tampering for unauthorized companies raises `403 Forbidden`.
3. **Idempotency Guarantee**: If a user double-clicks `[SAVE & PRINT]` or network retries transmit duplicate requests with the same `Idempotency-Key`, the service returns the existing `SalesInvoice` record without creating duplicate entries or double-deducting stock. Submitting a new request with a different `Idempotency-Key` creates a new legitimate invoice.
4. **Cross-Tenant PDF Protection**: `InvoicePdfService` filters invoice queries by `company_id` and `branch_id`. Cross-tenant PDF or HTML preview requests return `404 Not Found`.
5. **Single Source of Truth Renderer**: Both HTML print previews and downloadable PDF documents use `InvoicePdfService.generate_invoice_html`.

## 6. Design Rationale
- **AliasChoices in Schemas**: Standardized compatibility between frontend JSON keys (`productId`, `invoiceNo`, `gstRate`) and backend domain models (`product_id`, `invoice_no`, `gst_rate`) without requiring duplicate DTO definitions.
- **Eager Relationship Loading**: Explicitly loading `SalesInvoice.items` via `selectinload` prevents async SQLAlchemy greenlet errors during FastAPI response serialization.

## 7. Implementation Summary
1. Connected `SalesStudioTab` saving and printing flows to `apiFetchV1` endpoints with persistent `Idempotency-Key` header retry support.
2. Verified stock deductions in `products` and atomic `stock_movements` generation.
3. Verified transactional outbox event creation in `integration_outbox_events`.
4. Hardened PostgreSQL database schema with required missing columns (`secondary_barcodes`, `category_code`, `cbm_m3`, etc.) and default column constraints.
5. Deployed updated Python core backend image `smritrretailnx-python-core:latest` in Docker container `smriti-python-core`.

## 8. Tests Executed
```powershell
$env:PYTHONPATH="backend"; pytest backend/tests/t_sales_contract.py
$env:PYTHONPATH="backend"; pytest backend/tests/t_prod_cert.py
```

## 9. Verification Results
- `t_sales_contract.py` -> **10/10 PASSED (100%)**
- `t_prod_cert.py` -> **29/29 PASSED (100%)**
- Combined Test Execution Result: **39/39 PASSED (100% Success Rate)**

```text
TEST-01: Login superadmin & company selector context -> 200 OK (JWT issued)
TEST-02: Company selector token includes allowed assignments -> PASSED
TEST-03: Header tampering X-Company-Code & Cross-Tenant PDF/HTML access -> 403 Forbidden & 404 Not Found (PASSED)
TEST-04: POST /api/v1/sales/invoices create invoice & deduct stock -> 201 Created (PASSED)
TEST-05: Transactional outbox event created -> PASSED
TEST-06: GET /api/v1/sales/invoices/{id} authoritative server state -> 200 OK (PASSED)
TEST-07: GET /api/v1/sales/invoices/{id}/html HTML preview -> 200 OK (PASSED)
TEST-08: GET /api/v1/sales/invoices/{id}/pdf PDF document -> 200 OK (PASSED)
TEST-09: Print preview structure verification -> 200 OK (PASSED)
TEST-10: 3-Step Idempotency-Key semantics (Key A -> INV-001, Retry Key A -> INV-001, Key B -> INV-002) -> PASSED
```

## 10. Known Limitations
- Background worker `outbox_worker.py` consumes outbox events asynchronously; event processing rate limits are configurable per deployment environment.

## 11. Future Work
- Add batch invoice export and email dispatch capabilities in Phase 4.

## 12. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Backend System of Record Policy
- `ADR-004`: Tenant Isolation & Database Routing Architecture

## 13. Related RFCs
- `RFC-012`: Transactional Outbox & Event Projection Architecture
