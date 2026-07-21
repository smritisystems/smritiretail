<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.4.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Walkthrough — Enterprise Supplier Master & Supplier Type Classification (v5.4.0)

## 1. Purpose
Upgrades the SMRITI Retail OS Supplier Master domain into a Domain-Driven Design (DDD) **Aggregate Root** model with 6 normalized child entity profiles (`SupplierTaxProfile`, `SupplierComplianceProfile`, `SupplierPaymentProfile`, `SupplierCreditProfile`, `SupplierBankDetails`, `SupplierAddress`, `SupplierContact`), multi-attribute procurement search engine, auto-code generator (`SUP-100001`), and metadata-driven **Supplier Type Master Classification** integrated into the SMRITI Master Lookup framework.

---

## 2. Scope
- PostgreSQL DDL schema migration `v540_enterprise_supplier_master.py`.
- SQLAlchemy ORM Aggregate Root mapping in `app/models/purchase.py`.
- Pydantic v2 schemas and regex validators (PAN, GSTIN, IFSC) in `app/schemas/purchase.py`.
- Procurement Search Engine & Repository in `app/repositories/supplier.py`.
- Domain Service with auto-code generator and Master Lookup validation in `app/services/supplier.py`.
- Async Integration Test Suite (`app/tests/test_supplier.py`) with 8 passing test cases.

---

## 3. Files Created
1. `backend/alembic/versions/v540_enterprise_supplier_master.py`
2. `backend/app/repositories/supplier.py`
3. `backend/app/services/supplier.py`
4. `backend/app/tests/test_supplier.py`
5. `docs/walkthrough/procurement/Procurement_Supplier_Type_Master_Classification_v5.4.0.md`

---

## 4. Files Modified
1. `backend/app/models/purchase.py`
2. `backend/app/schemas/purchase.py`
3. `backend/app/tests/conftest.py`

---

## 5. Architecture Decisions
- **Aggregate Root Pattern**: `Supplier` owns 6 specialized child profiles (`tax_profile`, `compliance_profile`, `payment_profile`, `credit_profile`, `bank_details`, `addresses`, `contacts`) managed atomically with `cascade="all, delete-orphan"`.
- **Compliance vs. Tax Separation**: Split statutory tax fields (GSTIN, PAN, TDS) into `SupplierTaxProfile` and operational licenses (MSME category/registration, FSSAI, Drug license, IEC) into `SupplierComplianceProfile`.
- **Master Lookup Integration**: `supplier_type_id` validates against the SMRITI Master Lookup framework (`master_values` table) before saving, supporting 21 default supplier role classifications.
- **Auto-Code Generator**: Generates immutable, server-assigned `SUP-100001` codes scoped per company.

---

## 6. Design Rationale
- **Multi-Bank Accounts**: Dedicated `SupplierBankDetails` entity supports multi-bank accounts with primary account enforcement and IFSC regex validation (`[A-Z]{4}0[A-Z0-9]{6}`).
- **Multi-Attribute Procurement Search**: Search prioritizes Code $\rightarrow$ GSTIN $\rightarrow$ Mobile $\rightarrow$ Trade Name $\rightarrow$ Supplier Name $\rightarrow$ Contact Person $\rightarrow$ PAN.

---

## 7. Implementation Summary
- **Schema Migration**: Alembic DDL `v540_enterprise_supplier_master.py` executed successfully.
- **Validation**: Regex validators enforce 10-char PAN (`[A-Z]{5}[0-9]{4}[A-Z]{1}`), 15-char GSTIN (`[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`), and 11-char IFSC (`[A-Z]{4}0[A-Z0-9]{6}`).
- **Error Diagnostics**: Replaced generic exceptions with structured `logger.warning` / `logger.exception` and appropriate HTTP 400/500 status codes.

---

## 8. Tests Executed
```bash
$env:PYTHONPATH="."; python -m pytest app/tests/test_supplier.py -v
```
- `test_create_supplier_aggregate_root_with_auto_code`: **PASSED**
- `test_invalid_pan_gstin_and_ifsc_regex_raises_validation_error`: **PASSED**
- `test_procurement_quick_search_by_code_name_tradename_mobile_gstin`: **PASSED**
- `test_single_primary_bank_account_enforcement`: **PASSED**
- `test_duplicate_mobile_or_code_raises_http_400`: **PASSED**
- `test_multi_tenant_isolation_prevents_cross_company_access`: **PASSED**
- `test_soft_delete_supplier_hides_from_queries_and_preserves_audit`: **PASSED**
- `test_supplier_type_master_lookup_validation`: **PASSED**

---

## 9. Verification Results
- **Terminal Execution**: `8 passed, 34 warnings in 3.26s`.

---

## 10. Known Limitations
- Outbox domain event publishing is staged for background event dispatcher integration.

---

## 11. Future Work
- Downstream Accounts Payable (AP) 45-day MSME Sec 43B(h) payment schedule calculator.
- Purchase Order & Goods Receipt Note (GRN) module integration.

---

## 12. Related ADRs
- SMRITI-ADR-005: Customer Master & CRM Domain Specification
- SMRITI-ADR-006: Enterprise Supplier Master & Vendor Management Domain Specification

---

## 13. Related RFCs
- SMRITI-RFC-014: Platform Abstraction Layer (PAL) & Master Lookup Framework
