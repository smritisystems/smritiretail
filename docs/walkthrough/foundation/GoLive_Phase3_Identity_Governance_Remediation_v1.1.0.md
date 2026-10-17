<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Go-Live Remediation Phase 3 — Identity Governance Remediation

**Document Version:** `v1.1.0`  
**Related Plan:** [`docs/implementation/foundation/GoLive.md`](../../implementation/foundation/GoLive.md)  
**Status:** `FROZEN`  
**Evidence Level:** A (Verifiable Literal Test Logs, AST Scans, & Migration Diffs)

---

## 1. Purpose
Correct critical identity-generation governance regressions identified during the post-audit inspection of Go-Live Phase 3 transactional creation paths. Eliminate all local, ad-hoc, and uncoordinated persistent ID generators (`_uid()`, `uuid.uuid4()`) from backend services (`PurchaseService`, `SalesService`, `sales.py`, `sales_ledger_svc.py`, `inventory_wms.py`, `univ_party_svc.py`), delegating all entity identity and numbering authority to the frozen **SMRITI Unified Identity Control Plane (`IdentityEngine`)**. Formalize database registry declarations in `smriti_identity_registry` via Alembic migration `v1470` and register statutory sovereign external aliases in `smriti_identity_alias`. Expand Rule 13 repository-wide AST scanning across all 878 project files to permanently lock down persistent identity generation.

---

## 2. Scope
- **Slice A (Alembic Schema & Identity Registry):** Migration `v1470` creating `identity_code` column on `purchase_receipts`, registering `PURCHASE_RECEIPT` (`PUR-GRN`), `DEBIT_NOTE` (`PUR-DN`), `PURCHASE_BILL` (`PUR-BIL`) in `smriti_identity_registry`, and seeding numbering sequences in `smriti_numbering_registry`.
- **Slice B (Purchase Service Remediation):** Deletion of `def _uid() -> str:`; conversion of `create_purchase_receipt`, `create_debit_note`, `create_purchase_bill`, `create_purchase_order`, `create_from_reorder_trigger`, and `amend_purchase_order` to allocate technical IDs via `IdentityEngine.allocate_internal()` (UUIDv7 + governed sequence code) or `IdentityEngine.generate_technical_id()`.
- **Slice C (Statutory & Sovereign External Alias Ingestion):** Centralized registration of supplier invoice numbers (`SUPPLIER_INVOICE`) and NIC E-Way Bill numbers (`NIC_EWAY`) into `smriti_identity_alias` with tenant isolation and duplicate-safe upsert/savepoints.
- **Slice D (Sales & Dispatch Service Remediation):** Deletion of `def _uid() -> str:` from `SalesService`; elevation of `POST /api/v1/sales/eway-bills/` to allocate UUIDv7 and governed sequence `TAX-EWB-XXXXXXXX` via `IdentityEngine.allocate_internal()`, updating `EWayBillResponse` schema.
- **Slice E (Static AST Analysis & Repository-Wide Identity Scan):** Creation of `test_identity_governance_remediation.py` and `scripts/scan_identity_governance.py` asserting zero AST occurrences of `_uid()` definitions repository-wide and zero `uuid.uuid4()` / `uuid.uuid1-5()` in canonical persistent creation routines.
- **Slice F (Established Phase 1 Identity Regression):** Verification of the complete 34/34 test suite across all 5 identity packages (`test_identity_engine.py`, `test_phase1_1_entity_integration.py`, `test_phase1_2_transactional_integration.py`, `test_phase1_3_external_integration.py`, `test_phase1_4_master_resolver.py`).
- **Slice G (Zero Functional Regression):** Preservation of all Go-Live UI slices (`GrnReceiptTab.tsx`, `PoGenerateTab.tsx`, `SalesStudioTab.tsx`, `CrmStudioTab.tsx`) and verification across the 6/6 automated workflow test suite.

---

## 3. Files Created
1. `backend/alembic/versions/v1470_purchase_grn_debit_note_purchase_bill_identity.py`: Alembic migration establishing column parity and control-plane registration for GRN, Debit Note, and Purchase Bill.
2. `backend/app/tests/test_identity_governance_remediation.py`: AST scan test battery and runtime identity allocation tests (5/5 tests passing).
3. `scripts/scan_identity_governance.py`: Standalone Rule 13 repository-wide AST scanner inspecting 878 files and 260 functions for forbidden persistent ID generators.
4. `docs/walkthrough/foundation/GoLive_Phase3_Identity_Governance_Remediation_v1.1.0.md`: This official WGP-compliant walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/purchase.py`: Added `identity_code = Column(String(100), unique=True, nullable=True, index=True)` to `PurchaseReceipt` model.
2. `backend/app/models/workflow.py`: Routed `WorkflowEvent.id` default through `IdentityEngine.generate_technical_id`.
3. `backend/app/services/purchase.py`: Removed `_uid()` completely; converted receipt, bill, and debit note creation to `IdentityEngine.allocate_internal()` with alias registration; converted line items and order helpers to `IdentityEngine.generate_technical_id()`.
4. `backend/app/services/sales.py`: Removed `_uid()` completely; converted order/quotation conversion, returns, and stock movements to `IdentityEngine`.
5. `backend/app/services/sales_ledger_svc.py`: Replaced local `_uid()` and `uuid4()` with `IdentityEngine.generate_technical_id()`.
6. `backend/app/services/inventory_wms.py`: Replaced local `pbs-`, `sm-`, `st-`, `sti-` UUIDv4 generators with `IdentityEngine.generate_technical_id()`.
7. `backend/app/services/univ_party_svc.py`: Replaced local `ptyr_`, `cprof_`, `sprof_`, `pty_` UUIDv4 generators with `IdentityEngine.generate_technical_id()`.
8. `backend/app/services/crm.py`: Replaced ad-hoc fallback customer ID with `IdentityEngine.generate_technical_id()`.
9. `backend/app/services/identity/code_generator.py`: Restored canonical Phase 1 atomic counter implementation with PostgreSQL `SELECT FOR UPDATE` row locking.
10. `backend/app/api/v1/sales.py`: Converted `create_eway_bill` to allocate via `IdentityEngine.allocate_internal()` (`TAX-EWB`) and registered sovereign NIC alias.
11. `backend/app/schemas/sales.py`: Added `identity_code: Optional[str] = None` to `EWayBillResponse`.
12. `backend/app/tests/test_golive_phase3.py`: Added UUIDv7 and identity code assertions across all 6 end-to-end tests.
13. `docs/implementation/foundation/GoLive.md`: Added granular 8-blocker mapping table and 7-gate release matrix; updated status.
14. `CHANGELOG.md`: Added release notes under `[6.40.1]`.
15. `docs/walkthrough/README.md`: Appended this walkthrough to master index.

---

## 5. Architecture Decisions
- **Unified Identity Control Plane Authority:** No transactional creation path may construct ad-hoc identifiers. Persistent primary keys must be time-ordered UUIDv7 generated via `IdentityEngine.generate_technical_id()`, and governed human-readable identifiers must be allocated through `IdentityEngine.allocate_internal()`.
- **Sovereign Alias Separation:** External identifiers that originate outside SMRITI (such as vendor physical tax invoice numbers or NIC Government portal E-Way Bill numbers) are not stored as system-governed codes; they are stored in `smriti_identity_alias` linked to the canonical technical ID (`entity_id`).
- **Outbox Table Boundary Parity in CodeGenerator:** For event-sourced outbox boundaries (`DEBIT_NOTE`, `PURCHASE_BILL`) where tables do not exist in the relational schema, configuring `identity_code_field = None` in `smriti_identity_registry` enables sequential code generation from `smriti_numbering_registry` while cleanly bypassing collision SELECT queries against nonexistent tables.
- **Repository-Wide AST Policy Guard (Rule 13):** Distinguishes persistent identity generation from legitimate ephemeral UI/draft state and cryptographic hashing, preventing local ID generator reintroduction across any backend service.

---

## 6. Design Rationale
- **Elimination of ID Collisions & Fractured Audits:** Local `_uid()` manufactured raw `uuid4().hex[:12]` strings with zero timestamp locality and zero collision coordination. Transitioning to RFC 9562 UUIDv7 provides monotonic indexing in B-tree database tables, while governed sequence codes (`PUR-GRN`, `PUR-DN`, `PUR-BIL`, `TAX-EWB`) guarantee gapless auditing.
- **Automated AST Quality Gate:** To permanently prevent regressions, `test_identity_governance_remediation.py` and `scripts/scan_identity_governance.py` inspect the Python AST of all backend modules, failing the gate if any local ID generation function definition or unapproved UUID call is discovered in creation routines.

---

## 7. Implementation Summary
- **Migration v1470 Applied:** Upgraded database schema to add `identity_code` to `purchase_receipts` and inserted canonical registry rows for `PURCHASE_RECEIPT`, `DEBIT_NOTE`, and `PURCHASE_BILL`.
- **Purchase Service Cleaned:** Removed local helper `_uid()`. Refactored `create_purchase_receipt`, `create_debit_note`, and `create_purchase_bill` to delegate identity allocation to `IdentityEngine.allocate_internal()`. Line items now use `IdentityEngine.generate_technical_id()`.
- **Sales API & Service Cleaned:** Removed local helper `_uid()`. Refactored `create_eway_bill` to allocate via `IdentityEngine.allocate_internal()` with alias registration in `smriti_identity_alias`.
- **Backend-Wide Elimination of Ad-Hoc IDs:** Removed `_uid()` and uncoordinated UUIDv4 generation across `workflow.py`, `sales_ledger_svc.py`, `inventory_wms.py`, `univ_party_svc.py`, and `crm.py`.
- **Backfilled Legacy Master Rows:** Identified and backfilled company and branch rows with governed `ORG-CMP` and `ORG-BRN` codes to satisfy foreign key allocation lineage.

---

## 8. Tests Executed

### Test Battery 1: Hard Identity Governance & AST Scan Suite (Step 1)
```bash
pytest backend/app/tests/test_identity_governance_remediation.py -v
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 5 items

backend\app\tests\test_identity_governance_remediation.py::test_ast_scan_forbidden_persistent_id_generators PASSED [ 20%]
backend\app\tests\test_identity_governance_remediation.py::test_grn_identity_engine_governance PASSED [ 40%]
backend\app\tests\test_identity_governance_remediation.py::test_debit_note_identity_engine_governance PASSED [ 60%]
backend\app\tests\test_identity_governance_remediation.py::test_purchase_bill_identity_engine_governance PASSED [ 80%]
backend\app\tests\test_identity_governance_remediation.py::test_eway_bill_identity_engine_and_alias_governance PASSED [100%]

================== 5 passed, 11 warnings in 89.97s (0:01:29) ==================
```

### Test Battery 2: Go-Live Phase 3 Workflow Battery (Step 2)
```bash
pytest backend/app/tests/test_golive_phase3.py -v
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 6 items

backend\app\tests\test_golive_phase3.py::test_grn_receipt_flow PASSED    [ 16%]
backend\app\tests\test_golive_phase3.py::test_purchase_bill_from_grn PASSED [ 33%]
backend\app\tests\test_golive_phase3.py::test_debit_note_creation PASSED [ 50%]
backend\app\tests\test_golive_phase3.py::test_sales_return_credit_note PASSED [ 66%]
backend\app\tests\test_golive_phase3.py::test_eway_bill_dispatch_record PASSED [ 83%]
backend\app\tests\test_golive_phase3.py::test_kpi_endpoints_live PASSED  [100%]

================== 6 passed, 11 warnings in 70.82s (0:01:10) ==================
```

### Test Battery 3: Established Phase 1 Identity Regression Suite — 34/34 (Step 3)
```bash
pytest backend/app/tests/test_identity_engine.py backend/app/tests/test_phase1_1_entity_integration.py backend/app/tests/test_phase1_2_transactional_integration.py backend/app/tests/test_phase1_3_external_integration.py backend/app/tests/test_phase1_4_master_resolver.py -v
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 34 items

backend\app\tests\test_identity_engine.py::test_uuid7_rfc9562_properties PASSED [  2%]
backend\app\tests\test_identity_engine.py::test_identity_code_validator_taxonomy PASSED [  5%]
backend\app\tests\test_identity_engine.py::test_postgresql_100_concurrent_allocations PASSED [  8%]
backend\app\tests\test_identity_engine.py::test_transactional_rollback_policy PASSED [ 11%]
backend\app\tests\test_identity_engine.py::test_tenant_isolated_resolution PASSED [ 14%]
backend\app\tests\test_identity_engine.py::test_alias_polymorphic_resolution PASSED [ 17%]
backend\app\tests\test_identity_engine.py::test_client_id_rejection_and_internal_allocation PASSED [ 20%]
backend\app\tests\test_phase1_1_entity_integration.py::test_backfilled_identity_codes_format_and_sequence PASSED [ 23%]
backend\app\tests\test_phase1_1_entity_integration.py::test_tier_1_governed_identity_code_resolution PASSED [ 26%]
backend\app\tests\test_phase1_1_entity_integration.py::test_tier_2_legacy_shoper9_alias_resolution PASSED [ 29%]
backend\app\tests\test_phase1_1_entity_integration.py::test_entity_creation_lifecycle_allocates_governed_identity_code PASSED [ 32%]
backend\app\tests\test_phase1_1_entity_integration.py::test_pydantic_schema_serialization PASSED [ 35%]
backend\app\tests\test_phase1_2_transactional_integration.py::test_transactional_identity_codes_format_and_sequence PASSED [ 38%]
backend\app\tests\test_phase1_2_transactional_integration.py::test_ledger_boundary_stock_movements_uses_uuidv7_without_sequential_code PASSED [ 41%]
backend\app\tests\test_phase1_2_transactional_integration.py::test_tier_1_transactional_identity_resolution PASSED [ 44%]
backend\app\tests\test_phase1_2_transactional_integration.py::test_tier_2_historical_document_alias_resolution PASSED [ 47%]
backend\app\tests\test_phase1_2_transactional_integration.py::test_reject_client_supplied_persistent_id PASSED [ 50%]
backend\app\tests\test_phase1_2_transactional_integration.py::test_transactional_creation_lifecycle_allocates_governed_identity PASSED [ 52%]
backend\app\tests\test_phase1_3_external_integration.py::test_external_partner_identity_codes_format_and_sequence PASSED [ 55%]
backend\app\tests\test_phase1_3_external_integration.py::test_ledger_boundary_payment_transactions_uses_uuidv7_without_sequential_code PASSED [ 58%]
backend\app\tests\test_phase1_3_external_integration.py::test_tier_1_external_partner_identity_resolution PASSED [ 61%]
backend\app\tests\test_phase1_3_external_integration.py::test_tier_2_partner_and_statutory_alias_resolution PASSED [ 64%]
backend\app\tests\test_phase1_3_external_integration.py::test_reject_client_supplied_persistent_id PASSED [ 67%]
backend\app\tests\test_phase1_3_external_integration.py::test_external_partner_creation_lifecycle_allocates_governed_identity PASSED [ 70%]
backend\app\tests\test_phase1_3_external_integration.py::test_alias_records_use_identity_engine_generated_id PASSED [ 73%]
backend\app\tests\test_phase1_3_external_integration.py::test_duplicate_external_alias_is_rejected_or_reused PASSED [ 76%]
backend\app\tests\test_phase1_4_master_resolver.py::test_tier_1_governed_identity_code_resolution_all_domains PASSED [ 79%]
backend\app\tests\test_phase1_4_master_resolver.py::test_tier_2_external_alias_case_insensitive_resolution PASSED [ 82%]
backend\app\tests\test_phase1_4_master_resolver.py::test_tier_3_unscoped_technical_uuidv7_resolution PASSED [ 85%]
backend\app\tests\test_phase1_4_master_resolver.py::test_tier_4_sovereign_business_code_resolution PASSED [ 88%]
backend\app\tests\test_phase1_4_master_resolver.py::test_batch_resolution_performance_and_parity PASSED [ 91%]
backend\app\tests\test_phase1_4_master_resolver.py::test_identity_envelope_hydration_and_aliases PASSED [ 94%]
backend\app\tests\test_phase1_4_master_resolver.py::test_resolution_cache_hit_miss_and_invalidation PASSED [ 97%]
backend\app\tests\test_phase1_4_master_resolver.py::test_omnichannel_cross_domain_search PASSED [100%]

================= 34 passed, 11 warnings in 83.14s (0:01:23) ==================
```

### Static & Duplication Gate Executions (Steps 4, 5, 6, 7):

#### Step 4: Frontend Type Safety
```bash
npx tsc --noEmit
```
Output: Code 0 (0 errors).

#### Step 5: Architecture Duplication Gate
```bash
python scripts/architecture_duplication_gate.py
```
Output:
```text
================================================================================
 SMRITI ARCHITECTURE GOVERNANCE — CI / PRE-COMMIT GATE (HARDENED)
================================================================================
 Checks Executed:    11
 P0/P1 Violations:   0
 Registered Debt:    0
--------------------------------------------------------------------------------
================================================================================
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
================================================================================
```

#### Step 6: Version SSOT Consistency Check
```bash
python scripts/validate_version_ssot.py
```
Output:
```text
--- SMRITI Version SSOT Inspection ---
package.json          : 6.40.1
backend/core/config.py: 6.40.1
src/config/version.ts : 6.40.1
CHANGELOG.md (head)   : 6.40.1

[PASS] Version SSOT consistent across all boundaries: 6.40.1
```

#### Step 7: Repository-Wide Identity Governance Scan (Rule 13)
```bash
python scripts/scan_identity_governance.py
```
Output:
```text
================================================================================
 SMRITI REPOSITORY-WIDE IDENTITY GOVERNANCE SCAN (RULE 13)
================================================================================
 Files Scanned:                 878
 Functions Inspected:           260
 Canonical Creation Functions:  22
 Violations Detected:           0
--------------------------------------------------------------------------------
[PASS] ZERO IDENTITY GOVERNANCE VIOLATIONS DETECTED.
 Zero '_uid()' definitions found across entire backend.
 All canonical transactional creation paths delegate to IdentityEngine.
================================================================================
```

---

## 9. Verification Results

### Explicit Phase 1 & Phase 3 Suite Breakdown:
```text
Phase 1 Foundation suite        7/7   PASSED
Phase 1.1 dedicated suite       5/5   PASSED
Phase 1.2 dedicated suite       6/6   PASSED
Phase 1.3 dedicated suite       8/8   PASSED
Phase 1.4 dedicated suite       8/8   PASSED
Phase 1 combined regression     34/34 PASSED
Phase 3 governance suite        5/5   PASSED
Phase 3 Go-Live suite           6/6   PASSED
```

| Verification Item | Command / Test Citation | Target State | Actual State | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AST Anti-Regression Gate** | `test_identity_governance_remediation.py::test_ast_scan_forbidden_persistent_id_generators` | 0 `_uid` & 0 `uuid4()` in creation services | Statically verified clean AST | `Done` |
| **GRN Receipt Identity** | `test_identity_governance_remediation.py::test_grn_identity_engine_governance` | UUIDv7 PK, `PUR-GRN-XXXXXXXX`, allocation log | Verified RFC 9562 UUIDv7 & log | `Done` |
| **Debit Note Identity** | `test_identity_governance_remediation.py::test_debit_note_identity_engine_governance` | UUIDv7 PK, `PUR-DN-XXXXXXXX`, allocation log | Verified RFC 9562 UUIDv7 & log | `Done` |
| **Purchase Bill Identity** | `test_identity_governance_remediation.py::test_purchase_bill_identity_engine_governance` | UUIDv7 PK, `PUR-BIL-XXXXXXXX`, supplier alias | Verified UUIDv7 & sovereign alias | `Done` |
| **E-Way Bill Identity** | `test_identity_governance_remediation.py::test_eway_bill_identity_engine_and_alias_governance` | UUIDv7 PK, `TAX-EWB-XXXXXXXX`, NIC alias | Verified UUIDv7 & NIC alias | `Done` |
| **Go-Live Phase 3 Workflow Battery** | `test_golive_phase3.py` (6 tests) | 6/6 tests passing | 6/6 tests passed in 70.82s | `Done` |
| **Phase 1 Identity Foundation** | `test_identity_engine.py` (7 tests) | 7/7 tests passing | 7/7 tests passed in 40.46s | `Done` |
| **Phase 1.1 Master Entity** | `test_phase1_1_entity_integration.py` (5 tests) | 5/5 tests passing | 5/5 tests passed | `Done` |
| **Phase 1.2 Transactional Identity** | `test_phase1_2_transactional_integration.py` (6 tests) | 6/6 tests passing | 6/6 tests passed | `Done` |
| **Phase 1.3 External Identity** | `test_phase1_3_external_integration.py` (8 tests) | 8/8 tests passing | 8/8 tests passed | `Done` |
| **Phase 1.4 Master Resolver** | `test_phase1_4_master_resolver.py` (8 tests) | 8/8 tests passing | 8/8 tests passed | `Done` |
| **Full Phase 1 Combined Regression** | `pytest <5-phase-1-files>` (34 tests) | 34/34 tests passing | 34/34 tests passed in 83.14s | `Done` |
| **Frontend Type Safety** | `npx tsc --noEmit` | 0 errors | Exited with code 0 (clean) | `Done` |
| **Architecture Gate** | `scripts/architecture_duplication_gate.py` | 0 P0/P1 violations, 0 debt | 11/11 checks passed, 0 violations | `Done` |
| **Version SSOT** | `scripts/validate_version_ssot.py` | 6.40.1 consistent | Consistent across 4 SSOT files | `Done` |
| **Repository-Wide Identity Scan** | `scripts/scan_identity_governance.py` | 0 violations across 878 files | 878 files scanned, 0 violations | `Done` |

---

## 10. Known Limitations
- Offline POS sync for Purchase Receipts (GRN) is not enabled; GRN operations require active online connectivity to the PostgreSQL transactional database.
- E-Way Bill numbers must still be obtained from the NIC portal and entered into SMRITI, where they are registered as sovereign aliases; direct live NIC portal generation will be delivered in the upcoming B2B Dispatch Studio.

---

## 11. Future Work
- Integration with NIC GSP/ASP API for direct real-time registration of E-Way Bills during dispatch processing.
- Automated OCR extraction of supplier tax invoices during purchase bill booking to auto-fill supplier invoice aliases and line item breakdowns.

---

## 12. Related ADRs
- `ADR-0050`: SMRITI Unified Identity Control Plane & Numbering Engine.
- `ADR-0051`: Sovereign External Alias Registration and Multi-Tier Resolution Hierarchy.
- `ADR-0052`: Elimination of Client-Supplied and Ad-Hoc Server-Side Identifiers.

---

## 13. Related RFCs
- `RFC-2026-07-06`: Unified Identity & Numbering Architecture Specification.
- `RFC-2026-09-18`: Transactional Creation Path Identity Hardening.
