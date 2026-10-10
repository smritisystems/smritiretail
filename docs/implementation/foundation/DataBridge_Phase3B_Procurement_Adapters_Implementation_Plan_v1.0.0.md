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
  Classification: Implementation Plan — SMRITI DataBridge Phase 3B Procurement Document Adapters
-->

# Implementation Plan: SMRITI DataBridge Phase 3B — Inward Procurement Transaction Documents

## 1. Objective
Establish canonical, enterprise-grade DataBridge domain adapters for inward procurement transactions:
- **Purchase Order (PO)** (`DataBridgePurchaseOrderAdapter`)
- **Goods Receipt Note (GRN)** (`DataBridgeGrnAdapter`)
- **Purchase Invoice / Bill** (`DataBridgePurchaseInvoiceAdapter`)
- **Purchase Return / Debit Note** (`DataBridgePurchaseDebitNoteAdapter`)

These adapters extend the SMRITI DataBridge engine to parse, normalize (including multi-row line grouping and nested JSON), validate, match, diff, conflict-detect, preview, and atomically commit inward transactions with supplier dependency resolution/auto-provisioning, product/SKU line reconciliation, multi-tenant isolation, and WORM audit logging without database schema mutations.

---

## 2. Business Motivation
During store openings, legacy ERP migrations (Tally Prime, SAP, Busy, Marg ERP, Excel spreadsheets), and ongoing B2B vendor interactions, businesses must ingest batches of historical or pending procurement records. Manual entry of multi-line purchase orders, receipts, and invoices is error-prone and time-consuming. DataBridge Phase 3B automates procurement document ingestion while enforcing commercial invariants: line math integrity, GST reconciliation, idempotency against duplicate document numbers, and optional inline provisioning of missing supplier master records.

---

## 3. Scope
- **Entities**:
  - `PURCHASE_ORDER`: Multi-item purchase orders with order numbers, supplier linkages, item rates, and GST calculations.
  - `GOODS_RECEIPT_NOTE`: Inward physical receipts (GRN) with batch tracking, received quantities, and warehouse locations.
  - `PURCHASE_INVOICE`: Commercial supplier bills posted against suppliers and purchase orders.
  - `PURCHASE_DEBIT_NOTE`: Commercial supplier debit notes for purchase returns or rate differences.
- **Subsystems Affected**:
  - `backend/app/services/databridge/models.py` (extend `DataBridgeEntityType`)
  - `backend/app/services/databridge/adapters/` (new procurement adapters)
  - `backend/app/services/databridge/service.py` (`resolve_adapter` registry)
  - `backend/app/api/v1/databridge.py` (preview/commit endpoints for procurement documents)
  - `src/lib/headerMapping/HeaderAliasRegistry.ts` (procurement column header dictionaries)
  - `backend/tests/test_databridge_phase3b_procurement.py` (verification test suite)
- **Out of Scope**:
  - Outward sales documents (Sales Invoices, Credit Notes, Sales Orders) — deferred to Phase 3C.
  - Database schema alterations (strictly zero migrations; all models match existing PostgreSQL schema).

---

## 4. Current State
- Phase 1 Core Foundation provides 7-stage pipeline, multi-tenant isolation, 30-min preview tokens, and WORM audit trails.
- Phase 2 provides catalog adapters (`ITEM`, `VARIANT`, `BARCODE`, `PRICEBOOK`).
- Phase 3A provides party adapters (`CUSTOMER`, `SUPPLIER`).
- Procurement documents currently can only be created via interactive transactional APIs in `backend/app/api/v1/purchase.py`.

---

## 5. Gap Analysis
1. `DataBridgeEntityType` lacks enum values for `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, `PURCHASE_DEBIT_NOTE`.
2. No adapters exist to handle multi-line grouping where repeated document identifiers represent multiple items of one transaction.
3. Lack of auto-provisioning logic to resolve supplier identity codes or auto-create missing suppliers when importing supplier documents.
4. Absence of line-level validation for unit costs, quantities, HSN/GST rates, and grand total invariants.
5. `HeaderAliasRegistry.ts` lacks standardized procurement transaction headers (`po_no`, `order_date`, `grn_no`, `bill_no`, `debit_note_no`, `cost_price`, `quantity`, etc.).

---

## 6. Architecture Impact
- Seamlessly reuses `BaseDataBridgeAdapter` and delegates to canonical `PurchaseService` methods.
- Inward transaction documents are validated against existing database records via asynchronous SQLAlchemy sessions.
- In-memory grouping allows parsing both flattened flat-file tabular rows and hierarchical JSON structures.
- Strict tenant context isolation guarantees no cross-company or cross-branch data pollution.

---

## 7. Proposed Design

### 7.1 Lifecycle & Grouping Strategy
Ingress data will be grouped by canonical document identifier (`order_no`, `receipt_no`, `bill_no`, `debit_note_no`).
Each unique document number maps to one transaction with header attributes and an array of `items`.

```
Ingress Rows (CSV/JSON)
  ↓
Stage 1: normalize() → Group by document ID + Map field aliases
  ↓
Stage 2: validate()  → Required fields, supplier reference, item quantities > 0, non-negative rates
  ↓
Stage 3: match()     → Query existing DB records by document number + company_id
  ↓
Stage 4: diff()      → Compare line counts, line totals, and supplier assignment
  ↓
Stage 5: classify()  → CREATE / UPDATE / DUPLICATE_SKIP / CONFLICT
  ↓
Stage 6: preview()   → Generate tamper-evident Preview Token (30 min TTL)
  ↓
Stage 7: commit()    → Call canonical PurchaseService within tenant DB session
```

### 7.2 Dependency Auto-Provisioning
When an ingress transaction references a supplier that is not found:
- If `supplier_name` or `supplier_code` is provided in the row and `auto_create_supplier=True` (or defaulted), the adapter instantiates `DataBridgeSupplierAdapter` to provision the supplier immediately within the transaction session.
- If supplier information is missing, the document is flagged with error `SMRITI-DEP-SUPPLIER-MISSING`.

---

## 8. Files Created
1. `backend/app/services/databridge/adapters/purchase_order_adapter.py`
2. `backend/app/services/databridge/adapters/grn_adapter.py`
3. `backend/app/services/databridge/adapters/purchase_invoice_adapter.py`
4. `backend/app/services/databridge/adapters/purchase_debit_note_adapter.py`
5. `scripts/register_databridge_phase3b_architecture.py`
6. `backend/tests/test_databridge_phase3b_procurement.py`

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`
2. `backend/app/services/databridge/adapters/__init__.py`
3. `backend/app/services/databridge/service.py`
4. `backend/app/api/v1/databridge.py`
5. `src/lib/headerMapping/HeaderAliasRegistry.ts`
6. `docs/implementation/README.md`

---

## 10. Dependencies
- Canonical models in `backend/app/models/purchase.py`
- Canonical domain service `PurchaseService` in `backend/app/services/purchase.py`
- `IdentityEngine` in `backend/app/services/identity/engine.py`
- Preflight Certificate Manager in `scripts/lib/certificate_manager.py`

---

## 11. Risks
- **Risk**: Inconsistent multi-row grouping if document numbers have leading/trailing whitespace.
  - **Mitigation**: Whitespace stripping and uppercase normalization on document identifiers in Stage 1 (`normalize`).
- **Risk**: Arithmetic rounding discrepancies between ERP export sums and calculated line taxes.
  - **Mitigation**: Tolerant reconciliation within +/- 0.05 rounding threshold; line-item mathematical truth takes precedence.

---

## 12. Rollback Strategy
All code resides strictly within `backend/app/services/databridge/` and API controllers. No database migrations are introduced. Rollback is achievable by checking out the preceding Git commit.

---

## 13. Verification Plan
1. Architecture verification: `npm run architecture:check` passes with 0 violations.
2. Static typing & linting: `npm run lint` passes with 0 errors.
3. Automated pytest suite: `backend/tests/test_databridge_phase3b_procurement.py` covering:
   - Purchase Order creation with line items
   - Duplicate PO prevention / idempotent replay
   - GRN creation and linking
   - Purchase Bill / Invoice creation and line totals
   - Debit Note creation
   - Missing supplier validation and auto-provisioning
4. Full regression suite: Phases 1, 2, 3A, and 3B running concurrently green.

---

## 14. Test Plan
- `test_tc_proc_001_po_create_with_lines`
- `test_tc_proc_002_po_duplicate_rejection`
- `test_tc_proc_003_po_supplier_auto_provisioning`
- `test_tc_proc_004_po_line_math_validation`
- `test_tc_proc_005_grn_create_and_match`
- `test_tc_proc_006_purchase_bill_create`
- `test_tc_proc_007_debit_note_create`
- `test_tc_proc_008_api_procurement_endpoints`

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Create `docs/walkthrough/foundation/DataBridge_Phase3B_Procurement_Adapters_v1.0.0.md`
- Update `docs/walkthrough/README.md`

---

## 16. Deployment Plan
Pure application-layer rollout. Hot reload via Uvicorn/Vite development daemons. Zero downtime, zero schema migration.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Core_Foundation_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Catalog_Adapters_Phase2_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3A_Party_Adapters_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase3B_Procurement_Adapters_v1.0.0.md` (to be created)
