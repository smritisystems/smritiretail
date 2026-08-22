<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vertical Slice 2 — Universal Party Master & Universal Item Master Canonicalization

## 1. Purpose
Establish the canonical Universal Party Master (`parties`, `party_roles`, `customer_profiles`, `supplier_profiles`) and Universal Item Master (`items`, `item_variants`, `item_barcodes`) in the SMRITI tenant data plane (`smritiXXX`). This eliminates data redundancy for multi-role entities (e.g. entities that act as both Customer and Supplier) and standardizes SKU dimensions, barcodes, and variant lookups across POS, B2B Sales, Procurement, and WMS.

---

## 2. Scope
- **Tenant Data Plane (`smritiXXX`) Only**: Zero business entity or catalog masters are written to `smritisys`.
- **Universal Party Model**: Core identity + polymorphic role assignments (`CUSTOMER`, `SUPPLIER`, `DEALER`, `DISTRIBUTOR`, `EMPLOYEE`, `TRANSPORTER`, `SALESMAN`) + specialized profile extensions (`CustomerProfile`, `SupplierProfile`).
- **Universal Item Model**: Core item master + multi-attribute variant dimensions (`ItemVariant`) + high-speed barcode mapping (`ItemBarcode`) + batch inventory integration (`ProductBatchStock`).
- **Backward Compatibility**: Non-destructive integration preserving legacy `customers`, `suppliers`, and `products` queries.

---

## 3. Files Created
1. `backend/app/models/party.py`: Canonical Universal Party, PartyRole, CustomerProfile, and SupplierProfile models.
2. `backend/app/models/item_master.py`: Canonical Universal Item, ItemVariant, and ItemBarcode models.
3. `backend/app/services/party_service.py`: `UniversalPartyService` for entity lifecycle, multi-role assignment, and tenant-scoped lookups.
4. `backend/app/services/item_master_service.py`: `UniversalItemMasterService` for item variants, barcode lookups, and batch inventory bridging.
5. `backend/tests/test_universal_party_master.py`: Automated verification suite for party roles, profiles, and tenant isolation.
6. `backend/tests/test_universal_item_master.py`: Automated verification suite for item variants, barcode resolution, and tenant isolation.
7. `docs/implementation/foundation/Platform_Refactor_Slice2_Party_Item_Plan_v1.0.md`: Master 19-section implementation plan for Slice 2.

---

## 4. Files Modified
1. `backend/app/models/__init__.py`: Exported canonical Party and Item models.
2. `docs/implementation/README.md`: Appended Slice 2 implementation plan to chronological index table.
3. `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`: Updated platform tracker with verified Slice 2 status.

---

## 5. Architecture Decisions
- **ADR-003: Party Role Extension Pattern**: Rather than creating bloated single-table rows or fragmented independent tables, Universal Party uses a normalized core identity (`parties`) linked 1:N with `party_roles` and 1:1 with optional profile extensions (`customer_profiles`, `supplier_profiles`).
- **ADR-004: Fast Barcode Resolution**: `ItemBarcode` is indexed directly by `barcode` string, allowing O(1) scanner lookups that resolve directly to the specific `ItemVariant` and parent `Item`.

---

## 6. Design Rationale
In enterprise retail and supply chain ecosystems, customers frequently operate as suppliers or wholesale distributors. Storing duplicate rows leads to fragmented ledger balances, mismatched GSTINs, and reconciliation errors. The Universal Party model ensures a single canonical tax/contact identity while allowing independent credit, pricing, and payment term profiles per role.

---

## 7. Implementation Summary
- **Universal Party Domain**:
  - `Party`: Root entity with `party_code`, `legal_name`, `trade_name`, `gstin`, `pan`, and address fields.
  - `PartyRole`: Polymorphic assignment linking a party to operational capacities.
  - `CustomerProfile`: Customer-specific fields (`customer_category`, `credit_limit`, `credit_days`, `tax_category`, `is_credit_hold`).
  - `SupplierProfile`: Supplier-specific fields (`supplier_type`, `payment_terms_days`, `msme_registration_no`, `tax_treatment`).
- **Universal Item Domain**:
  - `Item`: Root catalog master with SKU, HSN, tax rate, UOM, and tracking flags.
  - `ItemVariant`: Multi-dimensional variant attributes (size, color, fit) with variant-specific pricing.
  - `ItemBarcode`: High-performance scanner lookup table supporting EAN-13, Code 128, UPC, and QR codes.

---

## 8. Tests Executed
1. `backend/tests/test_universal_party_master.py`:
   - `test_create_and_fetch_universal_party_customer` (Passed)
   - `test_expand_party_to_dual_role_supplier` (Passed)
   - `test_party_tenant_isolation` (Passed)
2. `backend/tests/test_universal_item_master.py`:
   - `test_create_and_fetch_universal_item_with_variants` (Passed)
   - `test_lookup_by_barcode_canonical_item` (Passed)
   - `test_item_tenant_isolation` (Passed)
3. Full Multi-Module Regression Suite:
   - 69/69 automated tests passed in 25.19s across Routing Boundary, Tenant DB Provisioning, Menu Governance, Security Access, WMS Phases 1–4, and Slice 2 Universal Party & Item Masters.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 69 items

backend\tests\test_universal_party_master.py ...                         [  4%]
backend\tests\test_universal_item_master.py ...                          [  8%]
backend\tests\test_routing_boundary_canonical.py .............           [ 27%]
backend\tests\test_company_db_runtime_routing.py .......                 [ 37%]
backend\tests\test_company_db_naming_convention.py ......                [ 46%]
backend\tests\test_get_company_db_wiring.py .....                        [ 53%]
backend\tests\test_multi_company_database_architecture.py ......         [ 62%]
backend\tests\test_company_db_provisioning.py .....                      [ 69%]
backend\tests\test_menu_governance.py .                                  [ 71%]
backend\tests\test_security_menu_access.py ..                            [ 73%]
backend\tests\test_wms_phase1.py ....                                    [ 79%]
backend\tests\test_wms_phase2_grn_sales.py ...                           [ 84%]
backend\tests\test_wms_phase3_eway_bill.py .....                         [ 91%]
backend\tests\test_wms_phase4_audit_reconciliation.py ......             [100%]

======================= 69 passed, 1 warning in 25.19s ========================
```

---

## 10. Known Limitations
- Transaction endpoints in POS, Billing, and Purchase currently write to both legacy tables and canonical models; full decommissioning of legacy `customers` and `suppliers` tables is scheduled for Slice 3 once ledger posting unification is complete.

---

## 11. Future Work
- **Slice 3**: Sales, POS, and Inventory Lifecycle & Ledger Unification (`stock_movements`, sales orders, invoices, and purchase receipt posting).
- **Slice 4**: Pricing, GST, Payments, and Document Engine Unification.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-003`: Universal Party and Universal Item Extension Architecture.

---

## 13. Related RFCs
- `RFC-009`: Universal Party & Item Master Unification.
