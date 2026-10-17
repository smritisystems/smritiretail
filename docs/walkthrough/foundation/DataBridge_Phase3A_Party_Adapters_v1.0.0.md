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
  Classification: Internal — Foundation Walkthrough
-->

# SMRITI DataBridge Phase 3A — Party Masters (Customer & Supplier) Domain Adapters Walkthrough

## 1. Purpose
This walkthrough documents the design, implementation, and automated test certification of **SMRITI DataBridge Phase 3A: Party Masters (Customer and Supplier) Domain Adapters**.
It expands the SMRITI DataBridge capability beyond catalog master data to provide high-speed, governed ingestion for both Customer (`Customer`) and Supplier (`Supplier`) party masters. The adapters implement the canonical 7-stage lifecycle (`normalize` -> `validate` -> `match` -> `diff` -> `classify` -> `preview` -> `commit`), enforce strict multi-tenant company database isolation, utilize governed Identity Codes from `IdentityEngine`, and maintain zero-mutation preview guarantees with cryptographic audit recording.

---

## 2. Scope
- **Entities Covered**:
  - `Customer` (CRM Party Master domain, table `customers`)
  - `Supplier` (Procurement Party Master domain, table `suppliers`)
- **Key Capabilities**:
  - Flexible commercial header resolution (`HeaderAliasRegistry.ts` + adapter alias dictionaries) supporting heterogenous column formats (`client name`, `vendor code`, `mobile no`, `gstin`, `addr`, etc.).
  - Deterministic entity matching hierarchy:
    - Customer: Exact `code` -> `identity_code` -> `mobile` (10-digit normalized) -> `gst_number`.
    - Supplier: Exact `code` -> `identity_code` -> case-insensitive `name`.
  - Conflict detection: Cross-customer mobile conflicts (`SMRITI-CONFL-CUST-PHONE`), code/GSTIN mismatches (`SMRITI-CONFL-CUST-GSTIN`, `SMRITI-CONFL-SUPP-GSTIN`), and in-file duplicate row detection (`SMRITI-VAL-DUP-ROW-CODE`, `SMRITI-VAL-DUP-ROW-PHONE`).
  - Zero-mutation in-memory preview producing granular attribute-level diffs (`DataBridgeDiff`) and 30-minute cryptographically signed preview tokens.
  - Governed identity allocation via `IdentityEngine.allocate_internal` allocating canonical UUIDv7 IDs and governed identity codes (`CRM-CUS-*`, `PUR-SUP-*`).
  - Dedicated API endpoints: `/api/v1/databridge/customer/preview`, `/customer/commit`, `/supplier/preview`, `/supplier/commit`.
  - Comprehensive Pytest automation with 11/11 tests passing.

---

## 3. Files Created
1. `backend/app/services/databridge/adapters/customer_adapter.py`: Authoritative domain adapter for `Customer` entity ingress, validation, matching, diffing, and persistence.
2. `backend/app/services/databridge/adapters/supplier_adapter.py`: Authoritative domain adapter for `Supplier` entity ingress, validation, matching, diffing, and persistence.
3. `backend/tests/test_databridge_phase3a_party.py`: Dedicated Pytest suite containing 11 end-to-end integration and API tests for Customer and Supplier adapters.
4. `scripts/register_databridge_phase3a_architecture.py`: Preflight certificate and capability registration script for Phase 3A party adapters.
5. `docs/implementation/foundation/DataBridge_Phase3A_Party_Adapters_Implementation_Plan_v1.0.0.md`: Formal 19-section IPGP-compliant implementation plan.
6. `docs/walkthrough/foundation/DataBridge_Phase3A_Party_Adapters_v1.0.0.md`: This comprehensive 13-section walkthrough.

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py`:
   - Extended `DataBridgeEntityType` enum with `CUSTOMER = "CUSTOMER"` and `SUPPLIER = "SUPPLIER"`.
2. `backend/app/services/databridge/adapters/__init__.py`:
   - Exported `DataBridgeCustomerAdapter` and `DataBridgeSupplierAdapter`.
3. `backend/app/services/databridge/service.py`:
   - Imported new adapters and wired `DataBridgeEntityType.CUSTOMER` and `DataBridgeEntityType.SUPPLIER` in `resolve_adapter()`.
4. `backend/app/api/v1/databridge.py`:
   - Added `/customer/preview`, `/customer/commit`, `/supplier/preview`, and `/supplier/commit` endpoints.
5. `src/lib/headerMapping/types.ts`:
   - Extended `MappingContext` union with `'CUSTOMER'` and `'SUPPLIER'`.
6. `src/lib/headerMapping/HeaderAliasRegistry.ts`:
   - Made `contextDefaults` in `AmbiguousRule` partial.
   - Added canonical `SMRITI_CUSTOMER_FIELDS` and `SMRITI_SUPPLIER_FIELDS` field definitions and alias mappings.
7. `docs/implementation/README.md`:
   - Added master index row for the Phase 3A Implementation Plan.

---

## 5. Architecture Decisions
- **ADR-DATABRIDGE-01 Addendum (Party Master Adapters)**:
  - Party master ingress must conform to the exact same 7-stage adapter lifecycle as catalog master data.
  - Ingress must NEVER create synthetic dummy codes when an authoritative code can be allocated by `IdentityEngine.allocate_internal`.
  - Customer mobile numbers must be normalized to standard 10-digit format (stripping country prefixes such as `+91` or `91`).
  - Cross-customer phone collisions must be blocked with `SMRITI-CONFL-CUST-PHONE` (`EXISTING_CONFLICT`) rather than silently merging or mutating existing records.
  - Zero database schema migrations: Existing `customers` and `suppliers` PostgreSQL tables already contain all required attributes and constraints.

---

## 6. Design Rationale
- **Subclassing `BaseDataBridgeAdapter`**:
  By inheriting from `BaseDataBridgeAdapter`, `DataBridgeCustomerAdapter` and `DataBridgeSupplierAdapter` reuse core normalization routines (`clean_header_key`, `normalize_row_headers`) while maintaining strict domain-specific invariants.
- **Identity Allocation via `IdentityEngine`**:
  Directly calling `IdentityEngine.allocate_internal(session, entity_type="CUSTOMER", company_id=company_id)` guarantees RFC 9562 UUIDv7 technical keys and sequence-governed human-friendly codes (`CRM-CUS-00000800`, `PUR-SUP-00000800`), ensuring full parity with first-party CRM and Purchase studio operations.
- **Replay Idempotency & Conflict Safety**:
  When an incoming payload matches an existing record and has identical attributes, it is classified as `NO_CHANGE`. In-file duplicates (e.g. duplicate customer code or phone number within the same batch) are detected during preview pre-scan, preventing database uniqueness constraint violations.

---

## 7. Implementation Summary
- **Customer Adapter (`DataBridgeCustomerAdapter`)**:
  - Implements `CUSTOMER_HEADER_MAP` matching 11+ commercial aliases per attribute.
  - Normalizes mobile numbers to 10 digits and validates GSTIN format via statutory `validate_gstin(gstin)` from `app.core.gst_engine`.
  - Matches by `code`, `identity_code`, `mobile`, or `gst_number`.
  - Detects phone conflict across different customer records and flags `SMRITI-CONFL-CUST-PHONE`.
  - Performs attribute diff across `name`, `mobile`, `email`, `gst_number`, `pan_number`, `customer_type`, `pricing_basis`.
  - Persists new records using `Customer` ORM model in caller's transactional session.
- **Supplier Adapter (`DataBridgeSupplierAdapter`)**:
  - Implements `SUPPLIER_HEADER_MAP` matching 10+ commercial aliases per attribute.
  - Matches by `code`, `identity_code`, or case-insensitive `name`.
  - Detects GSTIN mismatches against existing records with `SMRITI-CONFL-SUPP-GSTIN`.
  - Performs attribute diff across `name`, `mobile`, `email`, `gst_number`, `address`, `city`, `state`, `pincode`.
  - Persists new records with `outstanding=Decimal("0.00")` using `Supplier` ORM model.
- **Frontend Header Registry**:
  - Exported `SMRITI_CUSTOMER_FIELDS` and `SMRITI_SUPPLIER_FIELDS` in `HeaderAliasRegistry.ts`.
  - Extended `MappingContext` in `types.ts` to support `'CUSTOMER'` and `'SUPPLIER'`.

---

## 8. Tests Executed
Dedicated automated Pytest test suite `backend/tests/test_databridge_phase3a_party.py` was executed:
1. `test_tc_party_001_customer_create_and_commit`: Creates new customer, verifies preview `CREATE`, commits, and asserts database persistence.
2. `test_tc_party_002_customer_existing_no_change`: Replays identical customer data, asserts `NO_CHANGE` classification and empty diff.
3. `test_tc_party_003_customer_update_fields`: Updates customer name, email, pricing_basis, asserts `UPDATE` with diff fields, and verifies updated database state.
4. `test_tc_party_004_customer_invalid_gstin_blocked`: Submits malformed GSTIN, asserts `VALIDATION_ERROR` with `SMRITI-VAL-GSTIN-INVALID`, and confirms commit rejection.
5. `test_tc_party_005_customer_phone_conflict`: Submits duplicate phone number for a new customer code, asserts `EXISTING_CONFLICT` with `SMRITI-CONFL-CUST-PHONE`.
6. `test_tc_party_006_supplier_create_and_commit`: Creates new supplier, verifies preview `CREATE`, commits, and asserts database persistence.
7. `test_tc_party_007_supplier_existing_no_change`: Replays identical supplier data, asserts `NO_CHANGE` classification and empty diff.
8. `test_tc_party_008_supplier_update_fields`: Updates supplier name, city, pincode, asserts `UPDATE` with diff, and verifies updated database state.
9. `test_tc_party_009_in_file_duplicate_code_detection`: Submits batch with duplicate supplier code, asserts `VALIDATION_ERROR` with `SMRITI-VAL-DUP-ROW-CODE`.
10. `test_tc_party_010_api_customer_endpoints`: Executes HTTP POST `/api/v1/databridge/customer/preview` and `/customer/commit` through FastAPI AsyncClient.
11. `test_tc_party_011_api_supplier_endpoints`: Executes HTTP POST `/api/v1/databridge/supplier/preview` and `/supplier/commit` through FastAPI AsyncClient.

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collected 11 items

backend\tests\test_databridge_phase3a_party.py::test_tc_party_001_customer_create_and_commit PASSED [  9%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_002_customer_existing_no_change PASSED [ 18%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_003_customer_update_fields PASSED [ 27%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_004_customer_invalid_gstin_blocked PASSED [ 36%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_005_customer_phone_conflict PASSED [ 45%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_006_supplier_create_and_commit PASSED [ 54%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_007_supplier_existing_no_change PASSED [ 63%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_008_supplier_update_fields PASSED [ 72%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_009_in_file_duplicate_code_detection PASSED [ 81%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_010_api_customer_endpoints PASSED [ 90%]
backend\tests\test_databridge_phase3a_party.py::test_tc_party_011_api_supplier_endpoints PASSED [100%]

====================== 11 passed, 22 warnings in 20.32s =======================
```

**Regression Suite Results (Phase 1 & Phase 2)**:
```text
====================== 25 passed, 22 warnings in 43.92s =======================
```
- Total test suite: **36/36 tests green** (11 Phase 3A + 25 Phase 1 & 2).
- TypeScript lint (`tsc --noEmit`): **Exit code 0** (0 errors).
- Architecture duplication gate (`scripts/architecture_duplication_gate.py`): **11/11 checks passed, 0 violations**.

---

## 10. Known Limitations
- Multi-state GST registrations for a single customer are currently created with primary GSTIN. Secondary state-level delivery branches and GST registrations can be expanded in Phase 3A.2 or managed via CRM Studio.
- Credit limits and payment terms utilize standard system defaults on initial import; specific terms can be enriched via subsequent delta imports or direct studio configuration.

---

## 11. Future Work
- **Phase 3B**: Inward Procurement Transaction Adapters (`PurchaseOrder`, `GoodsReceiptNote`, `PurchaseInvoice`, `PurchaseDebitNote`) utilizing `DataBridgeSupplierAdapter` for inline auto-provisioning of missing suppliers.
- **Phase 3C**: Outward Sales Transaction Adapters (`SalesInvoice`, `SalesReturn`, `SalesOrder`) utilizing `DataBridgeCustomerAdapter` for inline auto-provisioning of missing retail/corporate customers.

---

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.

---

## 13. Related RFCs
- `RFC-2026-DATABRIDGE-PHASE3A`: SMRITI Party Masters Ingress and Conflict Resolution Standard.
