<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Walkthrough — Enterprise Size Scale Management Architecture (v5.5.0)

## 1. Purpose
Establishes the SMRITI Retail OS **Enterprise Size Scale Management** domain, providing a Domain-Driven Design (DDD) **Aggregate Root** model (`SizeScale`), ordered child size values (`SizeValue`), and normalized regional size conversion child entities (`SizeConversion`) for dynamically resolving cross-region sizes (`UK` $\leftrightarrow$ `EU` $\leftrightarrow$ `US` $\leftrightarrow$ `JP` $\leftrightarrow$ `AU` $\leftrightarrow$ `CM` $\leftrightarrow$ `Mondopoint`).

---

## 2. Scope
- PostgreSQL DDL schema migration `v550_enterprise_size_master.py`.
- SQLAlchemy ORM Aggregate Root mapping in `app/models/size_master.py`.
- Pydantic v2 schemas in `app/schemas/size_master.py`.
- Size Scale Repository & Procurement Search Engine in `app/repositories/size_master.py`.
- Domain Service with auto-code generator (`SCALE-100001`) and normalized conversion resolver in `app/services/size_master.py`.
- Async Integration Test Suite (`app/tests/test_size_master.py`) with 8 passing test cases.

---

## 3. Files Created
1. `backend/alembic/versions/v550_enterprise_size_master.py`
2. `backend/app/models/size_master.py`
3. `backend/app/schemas/size_master.py`
4. `backend/app/repositories/size_master.py`
5. `backend/app/services/size_master.py`
6. `backend/app/tests/test_size_master.py`
7. `docs/walkthrough/inventory/Inventory_Size_Scale_Management_v5.5.0.md`

---

## 4. Files Modified
1. `backend/app/tests/conftest.py`
2. `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **Normalized Child Entity (`SizeConversion`)**: Replaced fixed table columns (`uk_size`, `us_size`, `eu_size`) with a normalized `SizeConversion` entity (`region_code`, `converted_size_label`). This eliminates future DDL migrations when supporting additional regional size standards (JP, AU, Mondopoint, CM, Inches).
- **Master Lookup Governance**: Integrated lookup references for `scale_type_id` (Footwear, Apparel, Jeans, Rings, Gloves, Helmets), `category_id`, and `gender_id` (Male, Female, Unisex, Boys, Girls, Baby).
- **Auto-Code Generator**: Auto-generates immutable, company-scoped scale codes (`SCALE-100001`).

---

## 6. Design Rationale
- **Product Integration**: Linked products via `products.size_scale_id` to validate allowed size choices per product line.
- **Conversion Resolver**: `SizeMasterService.resolve_size_conversion()` resolves target region sizes dynamically for POS terminals, E-commerce APIs, and Stock Reports.

---

## 7. Implementation Summary
- **Schema Migration**: Executed `python -m alembic upgrade head` (`v540_enterprise_supplier -> v550_enterprise_size_master`). Created `size_scales`, `size_values`, `size_conversions` tables and added `size_scale_id` column to `products`.
- **Validation**: Enforced uniqueness on `(company_id, code)` and `(size_scale_id, display_size)`.

---

## 8. Tests Executed
```bash
$env:PYTHONPATH="."; python -m pytest app/tests/test_size_master.py -v
```
- `test_create_size_scale_aggregate_root`: **PASSED**
- `test_normalized_regional_size_conversion_resolver`: **PASSED**
- `test_lookup_size_scales_by_category_and_gender`: **PASSED**
- `test_duplicate_scale_code_raises_http_400`: **PASSED**
- `test_duplicate_size_value_within_scale_raises_http_400`: **PASSED**
- `test_multi_tenant_isolation_prevents_cross_company_access`: **PASSED**
- `test_soft_delete_size_scale_hides_from_queries_and_preserves_audit`: **PASSED**
- `test_atomic_rollback_on_invalid_payload`: **PASSED**

---

## 9. Verification Results
- **Terminal Execution**: `8 passed, 38 warnings in 2.68s`.

---

## 10. Known Limitations
- Outbox domain events (`SizeScaleCreated`, `SizeScaleUpdated`) ready for background signal listener broadcast.

---

## 11. Future Work
- POS Billing Terminal grid matrix integration (2D Size $\times$ Color stock grid).
- E-commerce size guide conversion API.

---

## 12. Related ADRs
- SMRITI-ADR-007: Enterprise Size Scale Management Domain Specification

---

## 13. Related RFCs
- SMRITI-RFC-015: Dynamic Product Variant & Master Lookup Architecture
