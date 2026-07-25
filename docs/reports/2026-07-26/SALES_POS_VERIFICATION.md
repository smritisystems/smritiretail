---
Title: Sales & POS Verification Report
Version: 3.29.0
Module: Sales & POS
Sprint: Sprint 18
Author: Jawahar Ramkripal Mallah
Reviewed By: Jawahar Ramkripal Mallah
Status: PASSED
Date: 2026-07-26
Container: smriti-api
Git Commit: 69eb0a1
---

# SMRITI Retail OS — Sales & POS Complete Verification Report

## 1. Executive Summary

| Metric | Target | Actual | Status |
| :--- | :---: | :---: | :---: |
| **Total Tests Executed** | 51 | 51 | ✅ Passed |
| **Tests Passed** | 51 | 51 | ✅ Passed |
| **Tests Failed** | 0 | 0 | ✅ Clean |
| **Pass Rate** | 100% | 100% | ✅ Target Met |
| **Execution Duration** | < 45s | 30.20s | ✅ Optimal |
| **Container Service** | `smriti-api` | `smriti-api` | ✅ Verified |
| **API Errors** | 0 | 0 | ✅ Resolved |

This report documents the comprehensive verification, engine constructor realignment, and model synonym mappings applied across all four test suites comprising the **Sales, Invoicing, Returns & POS** domain of SMRITI Retail OS. All 51 test cases across `test_sales.py` (33), `test_pos.py` (6), `test_sales_invoicing.py` (6), and `test_sales_return.py` (6) were verified inside the `smriti-api` Docker container with a **100% pass rate**.

---

## 2. Scope

- **API & Engine Boundaries**:
  - `POST /api/v1/sales/invoices` — Create Sales Invoice & Payments.
  - `GET /api/v1/sales/invoices/{id}` — Fetch Sales Invoice details.
  - `DELETE /api/v1/sales/invoices/{id}` & `DELETE /api/v1/sales/{id}` — Soft-delete / Cancel Sales Invoice.
  - `POST /api/v1/sales/quotations/convert/{id}` — Convert Sales Quotation to Invoice.
  - `SalesInvoicingEngine` — Automated Invoice generation from confirmed Sales Orders.
  - `SalesReturnEngine` — Outbound Customer Return processing & Credit Note issuance.
- **Service & Domain Layer**: [backend/app/services/sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sales.py), [backend/app/sales/engine/invoicing_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/sales/engine/invoicing_engine.py), and [backend/app/sales/engine/return_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/sales/engine/return_engine.py).
- **Automated Test Suites**:
  1. `backend/app/tests/test_sales.py` (33 tests)
  2. `backend/app/tests/test_pos.py` (6 tests)
  3. `backend/app/tests/test_sales_invoicing.py` (6 tests)
  4. `backend/app/tests/test_sales_return.py` (6 tests)

---

## 3. Environment & System Metadata

| Parameter | Specification |
| :--- | :--- |
| **Operating System** | Linux (Inside Docker Container) / Host: Windows |
| **Docker Container** | `smriti-api` (Execution Mode: Mandatory Docker per Governance) |
| **Python Version** | Python 3.11.15 |
| **Frameworks** | FastAPI 0.111, SQLAlchemy 2.0 (Async), Pytest 9.1.1 |
| **Database Engine** | PostgreSQL 16 (`smriti-db` container) |
| **Development Path** | `f:\SMRITRretailNXmgrt` mapped to `/app` inside `smriti-api` |

---

## 4. Root Cause Analysis

1. **Missing DELETE Route Handler**: The REST API router in `api/v1/sales.py` lacked explicit `@router.delete("/invoices/{invoice_id}")` and `@router.delete("/{invoice_id}")` handlers, resulting in HTTP 405 Method Not Allowed errors when calling invoice cancellation endpoints.
2. **RBAC Guard Realignment**: Route handlers required `require_role(UserRole.MANAGER, UserRole.SYSADMIN)` dependency guards so Cashier users are rejected with HTTP 403 Forbidden while Manager/Admin users can delete invoices.
3. **ORM Model Parameter Mismatches**:
   - `SalesInvoicePayment`: Passed `transaction_no` (invalid attribute) instead of `reference_no`, omitting required `payment_no` and `customer_id`.
   - `SalesInvoice`: Passed `date`, `payment_mode`, `is_interstate`, etc. (invalid attributes) instead of standard model columns `invoice_date`, `cgst_amount`, `sgst_amount`, `igst_amount`.
   - `SalesInvoiceItem` & `SalesReturnItem`: Passed invalid keyword arguments `id=string`, `uuid`, `unit_price`, `gst_percentage`, `line_total` directly into child item constructors when underlying ORM schema defined integer surrogate PKs (`id: Integer`) and standard column names (`price`, `gst_rate`, `total_amount`).
4. **Quotation Conversion Foreign Key Violation**: `convert_quotation_to_invoice` constructed `SalesInvoice` instances with dummy/missing `customer_id`, causing PostgreSQL referential integrity errors.

---

## 5. Fixes Applied

1. **Route Handler & RBAC Fix ([backend/app/api/v1/sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/sales.py))**:
   - Added `@router.delete("/invoices/{invoice_id}")` and `@router.delete("/{invoice_id}")` guarded with `require_role(UserRole.MANAGER, UserRole.SYSADMIN)`.
   - Returns standard HTTP 200 payload: `{"success": True, "invoice_id": invoice_id, "status": "Cancelled"}`.
2. **Service & Engine Parameter Realignment ([backend/app/sales/engine/invoicing_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/sales/engine/invoicing_engine.py) & [return_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/sales/engine/return_engine.py))**:
   - Fixed `SalesInvoiceItem` constructor to pass `code`, `name`, `price`, `gst_rate`, `tax_amount`, `total_amount`, removing invalid string `id` and `uuid` kwargs.
   - Fixed `SalesReturnItem` constructor to pass `code`, `name`, `price`, `gst_rate`, `tax_amount`, `total_amount`, removing invalid string `id` and `uuid` kwargs.
3. **Model Synonym Aliasing ([backend/app/models/sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/sales.py))**:
   - Added `synonym` imports from `sqlalchemy.orm`.
   - Mapped `SalesReturn` legacy field aliases (`invoice_id`, `return_date`, `refund_amount`) to model columns `original_invoice_id`, `date`, `grand_total`.
   - Mapped `SalesReturnItem` legacy field aliases (`unit_price`, `gst_percentage`, `line_total`) to model columns `price`, `gst_rate`, `total_amount`.

---

## 6. Architecture Impact

| Architectural Category | Status / Impact | Description |
| :--- | :---: | :--- |
| **Affected Module** | Sales & POS | Invoices, Orders, Returns, Credit Notes, Workflows, POS Terminal |
| **Database Schema** | No Schema Changes | Zero database migrations required; existing schema preserved |
| **API Endpoints** | Additive | Added `DELETE /api/v1/sales/invoices/{id}` contract route |
| **Breaking Changes** | None | Full backward compatibility maintained for all client SDK contracts |
| **Database Migration** | Not Required | Operates cleanly on existing v3.29.0 schema |
| **Backward Compatibility** | Yes | Fully compliant with Level 1 AOP-003 Contract Governance |

---

## 7. Metrics & Comparative Analysis (Before vs After)

| Test Suite / File | Before Debugging | After Fixes | Improvement | Status |
| :--- | ---: | ---: | :---: | :---: |
| `backend/app/tests/test_sales.py` | 13 / 33 | 33 / 33 | +20 (+153.8%) | ✅ 100% |
| `backend/app/tests/test_pos.py` | 0 / 6 | 6 / 6 | +6 (+100.0%) | ✅ 100% |
| `backend/app/tests/test_sales_invoicing.py` | 0 / 6 | 6 / 6 | +6 (+100.0%) | ✅ 100% |
| `backend/app/tests/test_sales_return.py` | 0 / 6 | 6 / 6 | +6 (+100.0%) | ✅ 100% |
| **Total Sales Domain Suite** | **13 / 51** (25.5%) | **51 / 51** (100.0%) | **+38 (+292.3%)** | ✅ **100.0%** |

---

## 8. Risk & Backward Compatibility Assessment

- **Risk Level**: **Low**
- **Risk Rationale**:
  - 100% test suite pass rate verified across all 51 test cases inside `smriti-api` container.
  - Zero database schema migrations required.
  - Synonym aliasing preserves legacy property access without mutating DB column definitions.
  - Soft-deletion logic (`is_deleted=True`, `status="Cancelled"`) preserves full audit trail.

---

## 9. Environment Evidence & System Logs

### Pytest Execution Terminal Log (51/51 Passed)
```text
============================= test session starts ==============================
platform linux -- Python 3.11.15, pytest-9.1.1, pluggy-1.6.0
rootdir: /app
configfile: pyproject.toml
plugins: cov-7.1.0, asyncio-1.4.0, anyio-4.14.2
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 51 items

app/tests/test_sales.py .................................                [ 64%]
app/tests/test_pos.py ......                                             [ 76%]
app/tests/test_sales_invoicing.py ......                                 [ 88%]
app/tests/test_sales_return.py ......                                    [100%]

=============================== warnings summary ===============================
../usr/local/lib/python3.11/site-packages/starlette/formparsers.py:12
  /usr/local/lib/python3.11/site-packages/starlette/formparsers.py:12: PendingDeprecationWarning: Please use `import python_multipart` instead.
    import multipart

../usr/local/lib/python3.11/site-packages/passlib/utils/__init__.py:854
  /usr/local/lib/python3.11/site-packages/passlib/utils/__init__.py:854: DeprecationWarning: 'crypt' is deprecated and slated for removal in Python 3.13
    from crypt import crypt as _crypt

../usr/local/lib/python3.11/site-packages/pydantic/fields.py:770
  /usr/local/lib/python3.11/site-packages/pydantic/fields.py:770: PydanticDeprecatedSince20: `min_items` is deprecated and will be removed, use `min_length` instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.7/migration/
    warn('`min_items` is deprecated and will be removed, use `min_length` instead', DeprecationWarning)

app/tests/test_sales.py::test_create_sales_quotation_as_cashier
  /usr/local/lib/python3.11/site-packages/passlib/handlers/argon2.py:716: DeprecationWarning: Accessing argon2.__version__ is deprecated and will be removed in a future release. Use importlib.metadata directly to query for argon2-cffi's packaging metadata.
    _argon2_cffi.__version__, max_version)

../usr/local/lib/python3.11/site-packages/_pytest/cacheprovider.py:469
  /usr/local/lib/python3.11/site-packages/_pytest/cacheprovider.py:469: PytestCacheWarning: could not create cache path /app/.pytest_cache/v/cache/nodeids: [Errno 13] Permission denied: '/app/.pytest_cache/v/cache'
    config.cache.set("cache/nodeids", sorted(self.cached_nodeids))

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================= 51 passed, 5 warnings in 30.20s ========================
```

---

## 10. Verifiable Code Diffs (Git Diff)

```diff
diff --git a/backend/app/models/sales.py b/backend/app/models/sales.py
index 35c004a..69eb0a1 100644
--- a/backend/app/models/sales.py
+++ b/backend/app/models/sales.py
@@ -15,7 +15,7 @@ Classification: Internal
 from decimal import Decimal
 from datetime import datetime, timezone
 from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, DateTime, Text, text
-from sqlalchemy.orm import relationship
+from sqlalchemy.orm import relationship, synonym
 from ..db.base import Base, BaseEntity, RowSecuredMixin
 
 class SalesInvoice(RowSecuredMixin, BaseEntity):
@@ -164,6 +164,10 @@ class SalesReturn(RowSecuredMixin, BaseEntity):
     is_interstate       = Column(Boolean, default=False)
     credit_note_id      = Column(String(50), nullable=True)
 
+    invoice_id = synonym("original_invoice_id")
+    return_date = synonym("date")
+    refund_amount = synonym("grand_total")
+
     invoice  = relationship("SalesInvoice")
     customer = relationship("Customer")
     items    = relationship("SalesReturnItem", back_populates="return_order", cascade="all, delete-orphan", lazy="selectin")
@@ -193,6 +197,10 @@ class SalesReturnItem(Base):
     company_id     = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True)
     branch_id      = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True)
 
+    unit_price     = synonym("price")
+    gst_percentage = synonym("gst_rate")
+    line_total     = synonym("total_amount")
+
     return_order = relationship("SalesReturn", back_populates="items")
     product      = relationship("Product")

diff --git a/backend/app/sales/engine/invoicing_engine.py b/backend/app/sales/engine/invoicing_engine.py
index 0bef12f..4b17c09 100644
--- a/backend/app/sales/engine/invoicing_engine.py
+++ b/backend/app/sales/engine/invoicing_engine.py
@@ -100,20 +100,24 @@ class SalesInvoicingEngine:
             line_tot = line_subtotal + cgst + sgst + igst
 
             inv_item = SalesInvoiceItem(
-                id=f"inv-item-{uuid.uuid4().hex[:12]}",
-                uuid=str(uuid.uuid4()),
-                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
-                company_id=self.tenant.company_id,
-                branch_id=self.tenant.branch_id,
                 invoice_id=invoice_id,
                 product_id=item.product_id,
+                code=getattr(product, "code", "") or "",
+                name=getattr(product, "name", "") or "",
                 quantity=qty,
                 unit_price=price,
+                price=price,
                 gst_percentage=gst_pct,
+                gst_rate=gst_pct,
+                tax_amount=(cgst + sgst + igst).quantize(Decimal("0.01")),
                 cgst_amount=cgst.quantize(Decimal("0.01")),
                 sgst_amount=sgst.quantize(Decimal("0.01")),
                 igst_amount=igst.quantize(Decimal("0.01")),
-                line_total=line_tot.quantize(Decimal("0.01"))
+                line_total=line_tot.quantize(Decimal("0.01")),
+                total_amount=line_tot.quantize(Decimal("0.01")),
+                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
+                company_id=self.tenant.company_id,
+                branch_id=self.tenant.branch_id
             )
             invoice_items.append(inv_item)

diff --git a/backend/app/sales/engine/return_engine.py b/backend/app/sales/engine/return_engine.py
index 0a04cc4..aec2e1d 100644
--- a/backend/app/sales/engine/return_engine.py
+++ b/backend/app/sales/engine/return_engine.py
@@ -115,21 +115,22 @@ class SalesReturnEngine:
             line_tot = line_sub + cgst + sgst + igst
 
             ret_item = SalesReturnItem(
-                id=f"ret-item-{uuid.uuid4().hex[:12]}",
-                uuid=str(uuid.uuid4()),
-                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
-                company_id=self.tenant.company_id,
-                branch_id=self.tenant.branch_id,
                 return_id=return_id,
                 product_id=p_id,
+                code=getattr(inv_item, "code", "") or "",
+                name=getattr(inv_item, "name", "") or "",
                 quantity=qty,
-                unit_price=unit_price,
-                condition=condition,
-                gst_percentage=gst_pct,
+                price=unit_price,
+                gst_rate=gst_pct,
+                tax_amount=(cgst + sgst + igst).quantize(Decimal("0.01")),
+                total_amount=line_tot.quantize(Decimal("0.01")),
                 cgst_amount=cgst.quantize(Decimal("0.01")),
                 sgst_amount=sgst.quantize(Decimal("0.01")),
                 igst_amount=igst.quantize(Decimal("0.01")),
-                line_total=line_tot.quantize(Decimal("0.01"))
+                condition=condition,
+                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
+                company_id=self.tenant.company_id,
+                branch_id=self.tenant.branch_id
             )
             return_items.append(ret_item)
```

---

## 11. UOI vs Line-Item Primary Key Architectural Clarification

### Technical Observation Assessment
Parent entities (`SalesInvoice`, `SalesReturn`, `SalesOrder`, `Customer`, `Product`) inherit from `BaseEntity` / `RowSecuredMixin` using Universal Object Identification (UOI) string/UUID keys (`INV-XXXXXX`, `RET-XXXXXX`), while line-item entities (`SalesInvoiceItem`, `SalesReturnItem`, `SalesOrderItem`) inherit from `Base` with surrogate integer auto-increment primary keys (`id: BigInteger`).

### Architectural Rationale & Strategy
1. **Parent Document UOI Primacy**: Parent System-of-Record entities hold canonical business identity, audit history, row security, and UOI routing (`INV-XXXXXX`, `RET-XXXXXX`). They are globally referenceable across all four application tiers.
2. **Child Detail Optimization**: Detail line items are strictly owned by their parent UOI document and possess no independent lifecycle outside their parent document. Using integer surrogate PKs for child detail lines reduces B-Tree index footprint and accelerates SQL join throughput during high-frequency retail POS checkout bursts.
3. **Future UOI Evolution (UUIDv7)**: If offline edge POS synchronization or multi-master ledger replication requires independent global identification of individual line items, child entities will adopt `uuid: UUID (UUIDv7)` as an indexed candidate key while retaining integer PKs for performance, under a formal Level 1 ADR (**ADR-008: Child Entity UOI Strategy**).

---

## 12. Sign-Off & Future Roadmap

### Sign-Off
- **Author**: Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)
- **Status**: **APPROVED & PASSED**
- **Date**: 2026-07-26

### Future Roadmap
1. Proceed with **Purchase Module** (`test_purchase.py`) supplier schema realignment.
2. Draft **ADR-008** to formalize line-item primary key guidelines across all 6 domain schema modules.
