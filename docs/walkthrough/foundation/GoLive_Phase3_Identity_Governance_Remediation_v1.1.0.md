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
**Status:** `Completed`  
**Evidence Level:** A (Verifiable Literal Test Logs, AST Scans, & Migration Diffs)

---

## 1. Purpose
Correct critical identity-generation governance regressions identified during the post-audit inspection of Go-Live Phase 3 transactional creation paths. Eliminate all local, ad-hoc, and uncoordinated persistent ID generators (`_uid()`, `uuid.uuid4()`) from backend services (`PurchaseService`, `SalesService`, `sales.py`), delegating all entity identity and numbering authority to the frozen **SMRITI Unified Identity Control Plane (`IdentityEngine`)**. Formalize database registry declarations in `smriti_identity_registry` via Alembic migration `v1470` and register statutory sovereign external aliases in `smriti_identity_alias`.

---

## 2. Scope
- **Slice A (Alembic Schema & Identity Registry):** Migration `v1470` creating `identity_code` column on `purchase_receipts`, registering `PURCHASE_RECEIPT` (`PUR-GRN`), `DEBIT_NOTE` (`PUR-DN`), `PURCHASE_BILL` (`PUR-BIL`) in `smriti_identity_registry`, and seeding numbering sequences in `smriti_numbering_registry`.
- **Slice B (Purchase Service Remediation):** Deletion of `def _uid() -> str:`; conversion of `create_purchase_receipt`, `create_debit_note`, `create_purchase_bill`, `create_purchase_order`, `create_from_reorder_trigger`, and `amend_purchase_order` to allocate technical IDs via `IdentityEngine.allocate_internal()` (UUIDv7 + governed sequence code) or `IdentityEngine.generate_technical_id()`.
- **Slice C (Statutory & Sovereign External Alias Ingestion):** Centralized registration of supplier invoice numbers (`SUPPLIER_INVOICE`) and NIC E-Way Bill numbers (`NIC_EWAY`) into `smriti_identity_alias` with tenant isolation and duplicate-safe upsert/savepoints.
- **Slice D (Sales & Dispatch Service Remediation):** Deletion of `def _uid() -> str:` from `SalesService`; elevation of `POST /api/v1/sales/eway-bills/` to allocate UUIDv7 and governed sequence `TAX-EWB-XXXXXXXX` via `IdentityEngine.allocate_internal()`, updating `EWayBillResponse` schema.
- **Slice E (Static AST Analysis & Hard Governance Tests):** Creation of `test_identity_governance_remediation.py` asserting zero AST occurrences of `_uid` and `uuid.uuid4()` across creation services, combined with runtime assertions for UUIDv7 entropy and alias persistence.
- **Slice F (Zero Functional Regression):** Preservation of all Go-Live UI slices (`GrnReceiptTab.tsx`, `PoGenerateTab.tsx`, `SalesStudioTab.tsx`, `CrmStudioTab.tsx`) and verification across the 6/6 automated workflow test suite.

---

## 3. Files Created
1. `backend/alembic/versions/v1470_purchase_grn_debit_note_purchase_bill_identity.py`: Alembic migration establishing column parity and control-plane registration for GRN, Debit Note, and Purchase Bill.
2. `backend/app/tests/test_identity_governance_remediation.py`: AST scan test battery and runtime identity allocation tests (5/5 tests passing).
3. `docs/walkthrough/foundation/GoLive_Phase3_Identity_Governance_Remediation_v1.1.0.md`: This official WGP-compliant walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/purchase.py`: Added `identity_code = Column(String(100), unique=True, nullable=True, index=True)` to `PurchaseReceipt` model.
2. `backend/app/services/purchase.py`: Removed `_uid()` completely; converted receipt, bill, and debit note creation to `IdentityEngine.allocate_internal()` with alias registration; converted line items and order helpers to `IdentityEngine.generate_technical_id()`.
3. `backend/app/api/v1/sales.py`: Converted `create_eway_bill` to allocate via `IdentityEngine.allocate_internal()` (`TAX-EWB`) and registered sovereign NIC alias.
4. `backend/app/schemas/sales.py`: Added `identity_code: Optional[str] = None` to `EWayBillResponse`.
5. `backend/app/services/sales.py`: Removed `_uid()` completely; converted order/quotation conversion, returns, and stock movements to `IdentityEngine`.
6. `backend/app/tests/test_golive_phase3.py`: Added UUIDv7 and identity code assertions across all 6 end-to-end tests.
7. `docs/implementation/foundation/GoLive.md`: Added granular 8-blocker mapping table and Identity Governance Remediation section; marked Completed.
8. `CHANGELOG.md`: Added release notes under `[6.40.1]`.
9. `docs/walkthrough/README.md`: Appended this walkthrough to master index.

---

## 5. Architecture Decisions
- **Unified Identity Control Plane Authority:** No transactional creation path may construct ad-hoc identifiers. Persistent primary keys must be time-ordered UUIDv7 generated via `IdentityEngine.generate_technical_id()`, and governed human-readable identifiers must be allocated through `IdentityEngine.allocate_internal()`.
- **Sovereign Alias Separation:** External identifiers that originate outside SMRITI (such as vendor physical tax invoice numbers or NIC Government portal E-Way Bill numbers) are not stored as system-governed codes; they are stored in `smriti_identity_alias` linked to the canonical technical ID (`entity_id`).
- **Outbox Table Boundary Parity in CodeGenerator:** For event-sourced outbox boundaries (`DEBIT_NOTE`, `PURCHASE_BILL`) where tables do not exist in the relational schema, configuring `identity_code_field = None` in `smriti_identity_registry` enables sequential code generation from `smriti_numbering_registry` while cleanly bypassing collision SELECT queries against nonexistent tables.

---

## 6. Design Rationale
- **Elimination of ID Collisions & Fractured Audits:** Local `_uid()` manufactured raw `uuid4().hex[:12]` strings with zero timestamp locality and zero collision coordination. Transitioning to RFC 9562 UUIDv7 provides monotonic indexing in B-tree database tables, while governed sequence codes (`PUR-GRN`, `PUR-DN`, `PUR-BIL`, `TAX-EWB`) guarantee gapless auditing.
- **Automated AST Quality Gate:** To permanently prevent regressions, `test_identity_governance_remediation.py` inspects the Python AST of creation files, failing the CI gate if any local ID generation function definition or call is discovered in creation routines.

---

## 7. Implementation Summary
- **Migration v1470 Applied:** Upgraded database schema to add `identity_code` to `purchase_receipts` and inserted canonical registry rows for `PURCHASE_RECEIPT`, `DEBIT_NOTE`, and `PURCHASE_BILL`.
- **Purchase Service Cleaned:** Removed local helper `_uid()`. Refactored `create_purchase_receipt`, `create_debit_note`, and `create_purchase_bill` to delegate identity allocation to `IdentityEngine.allocate_internal()`. Line items now use `IdentityEngine.generate_technical_id()`.
- **Sales API & Service Cleaned:** Removed local helper `_uid()`. Refactored `create_eway_bill` to allocate via `IdentityEngine.allocate_internal()` with alias registration in `smriti_identity_alias`.
- **Backfilled Legacy Master Rows:** Identified and backfilled company and branch rows with governed `ORG-CMP` and `ORG-BRN` codes to satisfy foreign key allocation lineage.

---

## 8. Tests Executed

### Test Battery 1: Hard Identity Governance & AST Scan Suite
```bash
pytest app/tests/test_identity_governance_remediation.py -v
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO
collected 5 items

app/tests/test_identity_governance_remediation.py::test_ast_no_forbidden_id_generators PASSED [ 20%]
app/tests/test_identity_governance_remediation.py::test_grn_purchase_receipt_identity_governed PASSED [ 40%]
app/tests/test_identity_governance_remediation.py::test_debit_note_identity_governed PASSED [ 60%]
app/tests/test_identity_governance_remediation.py::test_purchase_bill_identity_governed PASSED [ 80%]
app/tests/test_identity_governance_remediation.py::test_eway_bill_identity_governed PASSED [100%]

============================== 5 passed in 1.48s ==============================
```

### Test Battery 2: Go-Live Phase 3 Workflow Battery (with UUIDv7 Assertions)
```bash
pytest app/tests/test_golive_phase3.py -v
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO
collected 6 items

app/tests/test_golive_phase3.py::test_grn_receipt_flow PASSED            [ 16%]
app/tests/test_golive_phase3.py::test_purchase_bill_from_grn PASSED      [ 33%]
app/tests/test_golive_phase3.py::test_debit_note_creation PASSED         [ 50%]
app/tests/test_golive_phase3.py::test_sales_return_credit_note PASSED    [ 66%]
app/tests/test_golive_phase3.py::test_eway_bill_dispatch_record PASSED   [ 83%]
app/tests/test_golive_phase3.py::test_kpi_endpoints_live PASSED          [100%]

================== 6 passed, 11 warnings in 72.27s (0:01:12) ==================
```

### Test Battery 3: Unified Identity Phase 1 Regression Battery
```bash
pytest app/tests/test_phase1_1_entity_integration.py app/tests/test_phase1_2_transactional_integration.py app/tests/test_phase1_3_external_integration.py app/tests/test_phase1_4_master_resolver.py -v
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO
collected 27 items

app/tests/test_phase1_1_entity_integration.py::test_phase1_1_schema_parity_and_backfill PASSED [  3%]
app/tests/test_phase1_1_entity_integration.py::test_phase1_1_entity_identity_allocation PASSED [  7%]
app/tests/test_phase1_1_entity_integration.py::test_phase1_1_client_supplied_id_suppression PASSED [ 11%]
app/tests/test_phase1_1_entity_integration.py::test_phase1_1_legacy_alias_ingestion PASSED [ 14%]
app/tests/test_phase1_1_entity_integration.py::test_phase1_1_sequence_gapless_increment PASSED [ 18%]
app/tests/test_phase1_1_entity_integration.py::test_phase1_1_identity_resolver PASSED [ 22%]
app/tests/test_phase1_2_transactional_integration.py::test_phase1_2_schema_parity_and_backfill PASSED [ 25%]
app/tests/test_phase1_2_transactional_integration.py::test_phase1_2_transactional_identity_allocation PASSED [ 29%]
app/tests/test_phase1_2_transactional_integration.py::test_phase1_2_client_supplied_id_suppression PASSED [ 33%]
app/tests/test_phase1_2_transactional_integration.py::test_phase1_2_stock_movement_ledger_boundary PASSED [ 37%]
app/tests/test_phase1_2_transactional_integration.py::test_phase1_2_historical_document_alias_ingestion PASSED [ 40%]
app/tests/test_phase1_2_transactional_integration.py::test_phase1_2_sequence_gapless_increment PASSED [ 44%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_schema_parity_and_backfill PASSED [ 48%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_party_identity_allocation PASSED [ 51%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_eway_bill_identity_allocation PASSED [ 55%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_payment_transaction_ledger_boundary PASSED [ 59%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_client_supplied_id_suppression PASSED [ 62%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_external_alias_ingestion PASSED [ 66%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_alias_registration_api PASSED [ 70%]
app/tests/test_phase1_3_external_integration.py::test_phase1_3_multitenant_isolation PASSED [ 74%]
app/tests/test_phase1_4_master_resolver.py::test_phase1_4_schema_parity PASSED [ 77%]
app/tests/test_phase1_4_master_resolver.py::test_phase1_4_tier1_governed_identity_code_resolution PASSED [ 81%]
app/tests/test_phase1_4_master_resolver.py::test_phase1_4_tier2_external_alias_case_insensitive_resolution PASSED [ 85%]
app/tests/test_phase1_4_master_resolver.py::test_phase1_4_tier3_technical_uuidv7_reverse_lookup PASSED [ 88%]
app/tests/test_phase1_4_master_resolver.py::test_phase1_4_tier4_sovereign_business_code_resolution PASSED [ 92%]
app/tests/test_phase1_4_master_resolver.py::test_phase1_4_batch_resolution PASSED [ 96%]
app/tests/test_phase1_4_master_resolver.py::test_phase1_4_identity_envelope_hydration PASSED [100%]

============================= 27 passed in 24.36s =============================
```

### Static & Duplication Gate Executions:
```bash
npx tsc --noEmit
```
Output: Code 0 (0 errors).

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

---

## 9. Verification Results

| Verification Item | Command / Test Citation | Target State | Actual State | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AST Anti-Regression Gate** | `test_ast_no_forbidden_id_generators` | 0 `_uid` & 0 `uuid4()` in creation services | Statically verified clean AST | `Done` |
| **GRN Receipt Identity** | `test_grn_purchase_receipt_identity_governed` | UUIDv7 PK, `PUR-GRN-XXXXXXXX`, allocation log | Verified RFC 9562 UUIDv7 & log | `Done` |
| **Debit Note Identity** | `test_debit_note_identity_governed` | UUIDv7 PK, `PUR-DN-XXXXXXXX`, allocation log | Verified RFC 9562 UUIDv7 & log | `Done` |
| **Purchase Bill Identity** | `test_purchase_bill_identity_governed` | UUIDv7 PK, `PUR-BIL-XXXXXXXX`, supplier alias | Verified UUIDv7 & sovereign alias | `Done` |
| **E-Way Bill Identity** | `test_eway_bill_identity_governed` | UUIDv7 PK, `TAX-EWB-XXXXXXXX`, NIC alias | Verified UUIDv7 & NIC alias | `Done` |
| **Go-Live Phase 3 Workflow Battery** | `test_golive_phase3.py` (6 tests) | 6/6 tests passing | 6/6 tests passed in 72.27s | `Done` |
| **Phase 1 Identity Battery** | `test_phase1_*` (4 files, 27 tests) | 27/27 tests passing | 27/27 tests passed in 24.36s | `Done` |
| **Frontend Type Safety** | `npx tsc --noEmit` | 0 errors | Exited with code 0 (clean) | `Done` |
| **Architecture Gate** | `architecture_duplication_gate.py` | 0 P0/P1 violations, 0 debt | 11/11 checks passed, 0 violations | `Done` |

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
