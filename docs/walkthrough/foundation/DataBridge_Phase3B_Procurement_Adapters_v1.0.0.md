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

# Walkthrough: SMRITI DataBridge Phase 3B — Inward Procurement Transaction Adapters

**Status:** Done  
**Area:** Foundation / DataBridge  
**Version:** v1.0.0  
**Date:** 2026-10-06  

---

## 1. Purpose
To deliver authoritative, zero-drift, and transaction-safe domain adapters for all inward procurement documents in SMRITI Retail OS (`PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, and `PURCHASE_DEBIT_NOTE`). This extends the universal SMRITI DataBridge pipeline from Catalog Masters (Phase 2) and Party Masters (Phase 3A) into complete multi-line business transaction ingress, providing tabular normalization, commercial header aliasing, supplier & item auto-provisioning, immutable preview calculation, atomic commit execution, and WORM compliance logging without requiring database schema changes.

---

## 2. Scope
- **Domain Document Adapters:**
  - `PurchaseOrder` (`DataBridgePurchaseOrderAdapter`): Multi-line aggregation by `order_no`, supplier auto-provisioning, product allocation, order math validation, immutable status conflict guards (`CONFIRMED` orders immutable).
  - `GoodsReceiptNote` (`DataBridgeGrnAdapter`): Inward receipt ingestion by `receipt_no`, batch number extraction, PO link matching, product auto-provisioning, and atomic receipt creation via `PurchaseService`.
  - `PurchaseInvoice` (`DataBridgePurchaseInvoiceAdapter`): Purchase bill / vendor invoice intake by `bill_no`, invoice total and tax invariant validation (`taxable_amount + tax_amount == total_amount`), supplier resolution, and bill posting.
  - `PurchaseDebitNote` (`DataBridgePurchaseDebitNoteAdapter`): Debit note intake by `debit_note_no`, claim amount validation, and posting via `PurchaseService`.
- **API Endpoints:**
  - `POST /api/v1/databridge/purchase-order/preview` and `/commit`
  - `POST /api/v1/databridge/grn/preview` and `/commit`
  - `POST /api/v1/databridge/purchase-invoice/preview` and `/commit`
  - `POST /api/v1/databridge/purchase-debit-note/preview` and `/commit`
- **Frontend Dictionaries:**
  - `src/lib/headerMapping/types.ts`: Extended `MappingContext` with `'purchase-order' | 'grn' | 'purchase-invoice' | 'purchase-debit-note'`.
  - `src/lib/headerMapping/HeaderAliasRegistry.ts`: Comprehensive field aliases for PO, GRN, Bill, and Debit Note headers.
- **Verification & Testing:**
  - 8/8 automated test cases green in `backend/tests/test_databridge_phase3b_procurement.py`.
  - 44/44 full regression test suite green across Phases 1, 2, 3A, and 3B.
  - Architecture duplication checks passed (11/11 checks, 0 violations).
  - TypeScript compiler check (`tsc --noEmit`) passed with 0 errors.

---

## 3. Files Created
1. `backend/app/services/databridge/adapters/purchase_order_adapter.py`
2. `backend/app/services/databridge/adapters/grn_adapter.py`
3. `backend/app/services/databridge/adapters/purchase_invoice_adapter.py`
4. `backend/app/services/databridge/adapters/purchase_debit_note_adapter.py`
5. `backend/tests/test_databridge_phase3b_procurement.py`
6. `scripts/register_databridge_phase3b_architecture.py`
7. `docs/implementation/foundation/DataBridge_Phase3B_Procurement_Adapters_Implementation_Plan_v1.0.0.md`
8. `docs/walkthrough/foundation/DataBridge_Phase3B_Procurement_Adapters_v1.0.0.md`

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py`
2. `backend/app/services/databridge/adapters/__init__.py`
3. `backend/app/services/databridge/service.py`
4. `backend/app/api/v1/databridge.py`
5. `src/lib/headerMapping/types.ts`
6. `src/lib/headerMapping/HeaderAliasRegistry.ts`
7. `docs/walkthrough/README.md`
8. `docs/implementation/README.md`

---

## 5. Architecture Decisions
- **Multi-Line Document Grouping:** Tabular inputs (CSV, Excel) repeat document identifiers across rows for each line item. Adapters implement `group_rows()` collapsing multiple spreadsheet lines into single document units while retaining row indexes.
- **Deterministic Missing Master Auto-Provisioning:** When an inward purchase document references an unknown supplier or product, the adapter safely auto-provisions the master entity using `IdentityEngine.allocate_internal` within the same transaction to satisfy foreign key constraints before creating child transaction lines.
- **Strict Invariant Verification:** Purchase bills and debit notes enforce statutory math constraints (`taxable_amount + tax_amount == total_amount`) at preview stage, raising blocking errors (`SMRITI-VAL-BILL-MATH-INVARIANT`) before database writes.
- **Immutable Document Protection:** Existing documents with locked statuses (e.g. `CONFIRMED` Purchase Orders) reject modification with `EXISTING_CONFLICT` (`ORDER_IMMUTABLE`).

---

## 6. Design Rationale
- Reusing existing `PurchaseService` domain methods (`create_purchase_order`, `create_purchase_receipt`, `create_purchase_bill`, `create_debit_note`) ensures 100% adherence to SMRITI transactional business logic, GL posting, stock updates, and identity generation rules.
- Explicit preview tokens (`prev_<uuid>`) cryptographically bind the preview inspection state and payload SHA-256 hash, preventing stale or tampered commit attempts.

---

## 7. Implementation Summary
The implementation follows the canonical 7-stage DataBridge adapter lifecycle:
1. **Normalize:** Header key cleaning and alias mapping (`PO_HEADER_MAP`, `GRN_HEADER_MAP`, etc.).
2. **Group:** Multi-line row aggregation into cohesive document structures with line item arrays.
3. **Validate:** Schema invariant and statutory math validation.
4. **Match:** Idempotent lookup by `order_no`, `receipt_no`, `bill_no`, or `debit_note_no`.
5. **Diff & Classify:** Identification of `CREATE`, `NO_CHANGE`, or `EXISTING_CONFLICT`.
6. **Preview:** Token issuance, subtotal and tax calculation, and summary aggregation.
7. **Commit:** Atomic delegation to `PurchaseService` wrapped in transactional rollback safety.

---

## 8. Tests Executed
```bash
pytest backend/tests/test_databridge_phase3b_procurement.py -v
pytest backend/tests/test_databridge_phase1.py backend/tests/test_databridge_phase2_catalog.py backend/tests/test_databridge_phase3a_party.py backend/tests/test_databridge_phase3b_procurement.py -v
npm run architecture:check
npm run lint
```

---

## 9. Verification Results
- **Phase 3B Test Suite:** 8/8 passed (100% green).
  - `test_tc_proc_001_po_create_with_lines`: PASSED
  - `test_tc_proc_002_po_existing_no_change_and_conflict`: PASSED
  - `test_tc_proc_003_po_supplier_auto_provisioning`: PASSED
  - `test_tc_proc_004_po_line_math_validation`: PASSED
  - `test_tc_proc_005_grn_create_and_match`: PASSED
  - `test_tc_proc_006_purchase_bill_create`: PASSED
  - `test_tc_proc_007_debit_note_create`: PASSED
  - `test_tc_proc_008_api_procurement_endpoints`: PASSED
- **Full DataBridge Regression Suite:** 44/44 passed across Phases 1, 2, 3A, and 3B.
- **Architecture Governance:** 11/11 checks passed, 0 P0/P1 violations.
- **TypeScript Compilation:** 0 compiler errors (`tsc --noEmit` exit code 0).
- **Database Integrity:** 0 migrations created; 0 existing records mutated.

---

## 10. Known Limitations
- Purchase Bills and Debit Notes currently require existing Purchase Orders or Receipts when linking document hierarchies; standalone bills with arbitrary item line grids default to header amounts per the underlying `PurchaseBillCreate` schema.

---

## 11. Future Work
- Proceed to Phase 3C: Outward Sales Transaction Documents (`SalesInvoice`, `SalesReturn`, `SalesOrder`).
- Support automatic GL posting reconciliation for multi-currency vendor bills in Phase 4.

---

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.

---

## 13. Related RFCs
- `RFC-DATABRIDGE-01`: Universal Ingress & Migration Protocol for SMRITI Retail OS.
