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
  Classification: Implementation Plan — SMRITI DataBridge Phase 3A Party Adapters
-->

# Implementation Plan: SMRITI DataBridge Phase 3A — Party Masters (Customer & Supplier Adapters)

## 1. Objective
Establish dedicated, canonical DataBridge domain adapters for **Customer** and **Supplier** master entities (`DataBridgeCustomerAdapter` and `DataBridgeSupplierAdapter`), extending the DataBridge ingress engine to validate, preview, diff, conflict-detect, and atomically commit party masters with full multi-tenant isolation, phone/GSTIN deduplication, and WORM compliance audit logging.

---

## 2. Business Motivation
Commercial transactions (Sales Invoices, Purchase Orders, Goods Receipt Notes) fundamentally depend on verified party master records. Migrations from legacy ERPs (e.g. Tally Prime, SAP, Busy, Excel) require rapid, bulk onboarding of thousands of customers and suppliers before or alongside transactions. Enabling governed Customer and Supplier DataBridge adapters eliminates manual account recreation and prevents phantom or duplicate accounts.

---

## 3. Scope
- **Entities**:
  - `Customer` (B2C retail customers, B2B institutional clients)
  - `Supplier` (Vendors, manufacturers, distributors)
- **Subsystems Affected**:
  - `backend/app/services/databridge/`
  - `backend/app/api/v1/databridge.py`
  - `src/lib/headerMapping/HeaderAliasRegistry.ts`
  - `backend/tests/test_databridge_phase3a_party.py`
- **Out of Scope**:
  - Direct Sales Invoicing or Purchase Order posting (deferred to Phase 3B and Phase 3C).
  - Schema alterations to `customers` or `suppliers` tables (adapters strictly use existing canonical ORM models).

---

## 4. Current State
- Existing Catalog DataBridge handles `ITEM`, `VARIANT`, `BARCODE`, `PRICEBOOK`, and `CATALOG_DOCUMENT`.
- Party masters are currently imported only via legacy monolithic routines or created individually through CRM/Procurement UI drawers.
- No preview, diff, conflict classification, or anti-tamper token mechanism exists for Customer or Supplier bulk imports.

---

## 5. Gap Analysis
1. `DataBridgeEntityType` lacks `CUSTOMER` and `SUPPLIER` enum members.
2. `DataBridgeService.resolve_adapter` does not support customer or supplier entities.
3. No dedicated `BaseDataBridgeAdapter` implementations exist for party matching rules (e.g., GSTIN validation, 10-digit phone normalization, customer code uniqueness).
4. `HeaderAliasRegistry.ts` lacks standardized commercial field aliases for Customer and Supplier CSV/Excel column headers.

---

## 6. Architecture Impact
- Reuses existing `BaseDataBridgeAdapter` contract without breaking catalog adapters.
- Orchestrates existing canonical `CrmService.create_customer` and `PurchaseService.create_supplier` methods.
- Zero duplicate CRM or Supplier domain logic; DataBridge functions strictly as an ingress normalization and diff layer.
- Preserves full backward-compatibility with Catalog DataBridge Phase 1 and Phase 2.

---

## 7. Proposed Design

### 7.1 Customer Adapter (`DataBridgeCustomerAdapter`)
- **Normalization**:
  - Header normalization via `HeaderNormalizer`.
  - Cleans `mobile` (strips country codes, non-digits, keeps 10 digits).
  - Normalizes `gst_number` to uppercase 15-character string.
  - Normalizes `code` to uppercase identifier.
- **Validation**:
  - Required fields: `name` (or `customer_name`), `mobile` (10 digits).
  - Statutory GSTIN check if provided (state code + format validation).
  - Rejects negative `credit_limit` or malformed email addresses.
- **Matching Priority** (company-scoped):
  1. Exact `code` (`Customer.code == code`)
  2. Exact `mobile` (`Customer.mobile == mobile`)
  3. Exact `gst_number` (`Customer.gst_number == gstin`)
- **Classification Rules**:
  - Match found + identical attributes -> `NO_CHANGE`
  - Match found + changed attributes (e.g. address, email) -> `UPDATE`
  - Code matched but phone belongs to different customer -> `EXISTING_CONFLICT`
  - No match found -> `CREATE`
- **Commit**:
  - Creates new customer via `CrmService` or direct ORM insert in transaction session.
  - Updates existing customer metadata if classified as `UPDATE`.

### 7.2 Supplier Adapter (`DataBridgeSupplierAdapter`)
- **Normalization**:
  - Cleans `code`, `name`, `gst_number`, `mobile`, `email`, `city`, `state`.
- **Validation**:
  - Required fields: `name`, `code` (or auto-generates if requested).
  - Statutory GSTIN format validation.
- **Matching Priority** (company-scoped):
  1. Exact `code` (`Supplier.code == code`)
  2. Exact `identity_code`
  3. Case-insensitive exact `name`
- **Classification Rules**:
  - Match found + identical attributes -> `NO_CHANGE`
  - Match found + updated contact/address -> `UPDATE`
  - Code matched but GSTIN mismatch -> `EXISTING_CONFLICT`
  - No match found -> `CREATE`
- **Commit**:
  - Creates supplier via `PurchaseService` or direct ORM insert in transaction session.

---

## 8. Files Created
1. `docs/implementation/foundation/DataBridge_Phase3A_Party_Adapters_Implementation_Plan_v1.0.0.md` (This document)
2. `backend/app/services/databridge/adapters/customer_adapter.py`
3. `backend/app/services/databridge/adapters/supplier_adapter.py`
4. `backend/tests/test_databridge_phase3a_party.py`
5. `docs/walkthrough/foundation/DataBridge_Phase3A_Party_Adapters_v1.0.0.md`

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Add `CUSTOMER` and `SUPPLIER` to `DataBridgeEntityType`.
2. `backend/app/services/databridge/adapters/__init__.py`: Export new adapters.
3. `backend/app/services/databridge/service.py`: Update `resolve_adapter` to return `DataBridgeCustomerAdapter` and `DataBridgeSupplierAdapter`.
4. `backend/app/api/v1/databridge.py`: Add `/customer/preview`, `/customer/commit`, `/supplier/preview`, `/supplier/commit` endpoints.
5. `src/lib/headerMapping/HeaderAliasRegistry.ts`: Add `SMRITI_CUSTOMER_FIELDS` and `SMRITI_SUPPLIER_FIELDS`.
6. `docs/implementation/README.md`: Append implementation plan index entry.

---

## 10. Dependencies
- `backend/app/models/crm.py` (`Customer`, `CustomerGroup`)
- `backend/app/models/purchase.py` (`Supplier`)
- `backend/app/core/gst_engine.py` (`validate_gstin`)
- `backend/app/services/identity/engine.py` (`IdentityEngine`)

---

## 11. Risks & Mitigations
- **Duplicate Customer Creation**: Mitigated by composite matching priority (`code` -> `mobile` -> `gst_number`) and company-scoped unique index checks.
- **Malformed GSTIN Ingress**: Mitigated by strict regex format check; invalid GSTIN blocks line with `SMRITI-VAL-GSTIN-INVALID`.
- **In-File Duplicates**: Pre-scan dictionary checks detect duplicate phones/codes within the same batch before DB evaluation.

---

## 12. Rollback Strategy
All changes reside in non-breaking adapter modules. Rollback involves removing `customer_adapter.py` and `supplier_adapter.py` and reverting `models.py` enum values. Existing catalog adapters are 100% unaffected.

---

## 13. Verification Plan
1. **Pytest Verification**: Dedicated test suite `test_databridge_phase3a_party.py` with 100% passing tests.
2. **TypeScript Compilation**: `npm run lint` (`tsc --noEmit`) passes with exit code 0.
3. **Architecture Duplication Gate**: `npm run architecture:check` passes with exit code 0.
4. **Existing Catalog Regression**: Run existing `test_databridge_phase1.py` and `test_databridge_phase2_catalog.py` to confirm zero regression.

---

## 14. Test Plan
- `test_databridge_customer_create`: Valid new customer -> `CREATE`.
- `test_databridge_customer_existing_no_change`: Identical customer -> `NO_CHANGE`.
- `test_databridge_customer_update_fields`: Changed email/address -> `UPDATE` with diff.
- `test_databridge_customer_phone_conflict`: Same code, different phone -> `EXISTING_CONFLICT`.
- `test_databridge_customer_invalid_gstin`: Malformed GSTIN -> `VALIDATION_ERROR`.
- `test_databridge_supplier_create`: Valid new supplier -> `CREATE`.
- `test_databridge_supplier_existing_no_change`: Identical supplier -> `NO_CHANGE`.
- `test_databridge_supplier_commit_atomic`: Commits batch, creates audit record.

---

## 15. Documentation Impact
- Create walkthrough: `docs/walkthrough/foundation/DataBridge_Phase3A_Party_Adapters_v1.0.0.md`.
- Append master indexes: `docs/implementation/README.md` and `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
Pure backend capability expansion under existing `DATABRIDGE` feature flag/capability template. No database schema migration needed.

---

## 17. Status
**COMPLETED**

---

## 18. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.
- `ADR-001/R-01`: SMRITI Barcode & SKU Immutability Governance.

---

## 19. Related Walkthroughs
- `DataBridge_Phase3A_Party_Adapters_v1.0.0.md` (Authoritative Phase 3A Walkthrough)
- `DataBridge_Core_Foundation_v1.0.0.md`
- `DataBridge_Catalog_Adapters_Phase2_v1.0.0.md`
- `DataBridge_Visual_QA_v1.2.0.md`
