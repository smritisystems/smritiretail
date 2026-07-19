<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.13.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Procurement — Supplier Payments — Walkthrough v3.13.0

**Date:** 2026-07-11  
**Status:** Done

---

## 1. Purpose

Implement recording payments made to suppliers, providing atomic decrement of supplier outstanding balance to close the loop on the procurement/purchase workflow.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Supplier Payment recording (CASH, BANK_TRANSFER, CHEQUE, UPI) | Detailed bank reconciliation |
| Atomic decrement of supplier outstanding balance | Multi-currency payments |
| Overpayment guard (cannot pay more than outstanding) | Partial allocations to specific GRNs |
| REST endpoints (POST create, GET list, GET by ID) | - |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/models/supplier_payment.py` | `SupplierPayment` database model |
| `backend/app/schemas/supplier_payment.py` | Input validation and output serialization schemas |
| `backend/app/services/supplier_payment.py` | Supplier payment logic and database operations |
| `backend/app/api/v1/supplier_payment.py` | API endpoints router |
| `backend/app/tests/test_supplier_payment.py` | 10 automated test cases |
| `backend/alembic/versions/9862a004de1c_add_supplier_payments_table.py` | Migration file for supplier payments |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/models/__init__.py` | Registered `SupplierPayment` model |
| `backend/alembic/env.py` | Imported `SupplierPayment` for autogeneration |
| `backend/app/main.py` | Registered supplier payment API router |
| `backend/app/core/config.py` | Bumped VERSION to `3.13.0` |

---

## 5. Architecture Decisions

### A. Atomic outstanding updates
To prevent race conditions where multiple transactions attempt to edit supplier outstanding amounts, the payment is committed and the supplier outstanding is updated atomically in the same database transaction.

### B. Strict Overpayment Guard
Payments exceeding the outstanding balance are rejected with HTTP 400.

---

## 6. Design Rationale

- Handled overpayment checks inside the service layer rather than schema validators to allow checking against current db state.
- Integrated validation rules to reject negative/zero amounts using Pydantic `field_validator`.

---

## 7. Implementation Summary

### API Surface

```
POST   /api/v1/supplier-payments/    → 201 SupplierPaymentResponse   [MANAGER|SYSADMIN]
GET    /api/v1/supplier-payments/    → 200 List[SupplierPaymentResponse] [any authenticated]
GET    /api/v1/supplier-payments/{id} → 200 SupplierPaymentResponse   [any authenticated]
```

---

## 8. Tests Executed

**Command:**
```
python -m pytest app/tests/test_supplier_payment.py -v
```

**Output:**
```
app/tests/test_supplier_payment.py::test_record_payment_decrements_outstanding PASSED
app/tests/test_supplier_payment.py::test_record_payment_with_reference PASSED
app/tests/test_supplier_payment.py::test_overpayment_is_rejected PASSED
app/tests/test_supplier_payment.py::test_zero_amount_rejected_by_schema PASSED
app/tests/test_supplier_payment.py::test_invalid_payment_mode_rejected PASSED
app/tests/test_supplier_payment.py::test_cashier_cannot_record_payment PASSED
app/tests/test_supplier_payment.py::test_payment_to_nonexistent_supplier_returns_404 PASSED
app/tests/test_supplier_payment.py::test_list_payments_scoped_to_tenant PASSED
app/tests/test_supplier_payment.py::test_list_payments_filter_by_supplier PASSED
app/tests/test_supplier_payment.py::test_multiple_payments_accumulate_correctly PASSED
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| Outstanding decremented correctly | Done |
| Cashier role blocked (403) | Done |
| Overpayment rejected | Done |
| All 10 tests passed | Done |

---

## 10. Known Limitations

- Payments are not matched/allocated to specific GRNs (First-In, First-Out or manual GRN allocation is not implemented).

---

## 11. Future Work

- GRN-wise payment allocation.
- Bank statement upload and auto-reconciliation.

---

## 12. Related ADRs

None.

---

## 13. Related RFCs

None.
