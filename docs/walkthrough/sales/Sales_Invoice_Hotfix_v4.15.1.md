<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.15.1
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sales Invoice Hotfix Walkthrough — v4.15.1

## 1. Purpose
This document provides a walkthrough of the hotfixes applied to the FastAPI + PostgreSQL backend to resolve critical validation and database session exceptions during sales invoice generation.

## 2. Scope
The hotfix resolves:
- Frontend JSON casing mismatch issues (camelCase fields like `customerId`, `qty`, `taxRate`, `isInterstate`, `eWayBillNo` not matching backend Pydantic model's snake_case fields).
- Database serialization errors (`MissingGreenlet` exception) when serializing the newly created invoice model's lazily loaded `items` relationship in the FastAPI response.
- Missing auto-uuid and auto-invoice_no generation logic for frontend invocations that did not pass them.

## 3. Files Created
- None.

## 4. Files Modified
- [backend/app/schemas/sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/schemas/sales.py)
- [backend/app/api/v1/sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/sales.py)
- [backend/app/services/sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sales.py)

## 5. Architecture Decisions
- Integrated Pydantic `AliasChoices` for backward-compatible camelCase mapping directly in validation logic, maintaining standard clean architecture conventions.
- Explicitly loaded `items` relationship using SQLAlchemy `selectinload` during the POST return query, preventing synchronous lazy load execution on an async database session context.

## 6. Design Rationale
- Standardizing property aliases allows standard contract compliance without changing the main database schemas or model fields.
- Querying with `selectinload` preserves SQLAlchemy lazy-loading boundaries, avoiding global eager-loading overrides while resolving greenlet session boundary exceptions.

## 7. Implementation Summary
- **Pydantic Model Updates (`sales.py` schemas):** Added `validation_alias=AliasChoices(...)` for `product_id`, `quantity`, `gst_rate`, `customer_id`, `is_interstate`, and `eway_bill_no`.
- **API Endpoint Updates (`sales.py` api):** Added fallback checks for missing uuid primary keys and dynamic invoice sequence numbering.
- **Service Layer Updates (`sales.py` service):** Swapped `await self.db.refresh(db_invoice)` with an explicit query containing `selectinload(SalesInvoice.items)` to resolve lazy-load deserialization errors.

## 8. Tests Executed
- Simulated frontend invoice generation POST requests with valid authorization tokens.
- Inspected database `sales_invoices`, `sales_invoice_items`, and `stock_movements` tables to verify transactions write successfully.
- Conducted browser-based interactive verification for Manager and Super User roles.

## 9. Verification Results
- Status: **Done** (verified with transactional database logs and browser UI feedback).
- Database entries successfully generated for invoices (`inv-eec3fc5f`), invoice items, and stock movement OUT lines.
- Product inventory level correctly decremented from 100 to 88.

## 10. Known Limitations
- Transaction references assume default local timezone offsets.

## 11. Future Work
- Add client-side input validations matching statutory GST formats.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
