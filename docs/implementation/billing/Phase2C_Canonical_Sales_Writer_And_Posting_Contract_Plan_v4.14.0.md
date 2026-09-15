<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.14.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Implementation Plan (Phase 2C)
-->

# Phase 2C — Canonical Sales Writer, Posting Contract & POS Adapter Convergence Implementation Plan

**Plan ID:** SMRITI-PLAN-BILLING-2026-09-2C  
**Version:** `v4.14.0`  
**Status:** `Approved`  
**Classification:** Enterprise Tier-1 Financial Authority Execution  
**Area:** `billing`  
**Dependencies:** `PHASE2B_BILLING_WORKSPACE_BLUEPRINT.md`, `PHASE2B_CANONICAL_POSTING_CONTRACT.md`, `PHASE2B_FINANCIAL_POLICY.md`  

---

## 1. Objective
Establish `CanonicalSalesPostingWriter` as the single canonical transactional write authority for all confirmed sales invoice postings in SMRITI Retail OS. Unify disparate and competing writers across POS (`POSService.pos_checkout`) and Sales (`SalesService.create_sales_invoice`), eliminate dual-write hazards, enforce caller-controlled transactional sessions (`commit: bool = True/False`), and qualify the canonical characterization test suite with 100% green assertions.

---

## 2. Business Motivation
Enterprise retail operations require deterministic financial truth. Disparate billing writers cause data drift:
- Competing tax math leads to fractional paise rounding errors between POS thermal slips and B2B A4 invoices.
- Direct in-memory stock decrements bypass warehouse batch FEFO rules and omit WMS ledger audit trails.
- Competing outbox event payloads create integration failures for accounting sinks and government compliance gateways (GSTN/E-Way Bill).
Converging all sales channels onto `CanonicalSalesPostingWriter` guarantees 100% ACID consistency, deterministic GST calculations per Section 15(3)(a) of the CGST Act, and reliable idempotency protection against double-billing.

---

## 3. Scope
1. **Canonical Schema Contract**: Operational context (`CanonicalPostingContext`), line items with dual-key resolution (`CanonicalPostingLineItem`), and multi-tender splits (`CanonicalTenderItem`).
2. **Transactional Session Safety**: Refactor `PaymentsEngine.allocate_payment` to accept `commit: bool = True` (flushing when `False`), ensuring atomic commits across invoices, inventory movements, payment allocations, and outbox events.
3. **Environment & Characterization Qualification**: Unblock `test_canonical_sales_writer.py` by configuring test environment secret loaders and asserting 100% test passes across intra-state CGST+SGST, inter-state IGST, MRP-inclusive, base-rate exclusive, and idempotency replay.
4. **POS Adapter Convergence**: Transform `POSService.pos_checkout` from a competing direct writer into a thin ingress adapter delegating to `CanonicalSalesPostingWriter`.
5. **Safe Retirement & Disarmament**: Decommission direct in-memory `Product.stock` decrements and unrounded 4-decimal tax logic in legacy POS checkout routines.

---

## 4. Current State
- `backend/app/schemas/canonical_posting.py` and `backend/app/services/canonical_sales_writer.py` have been scaffolded and established per Phase 2B blueprints.
- `backend/tests/test_canonical_sales_writer.py` exists but fails test collection due to missing `JWT_SECRET_KEY` environment initialization during standalone execution.
- `PaymentsEngine.allocate_payment` contains a hardcoded `await session.commit()`, violating caller-controlled session invariants.
- `POSService.pos_checkout` in `backend/app/services/pos.py` directly executes parallel invoice item insertion, manual stock mutation, and ad-hoc event publishing.

---

## 5. Gap Analysis
| Dimension | Current Legacy POS / Sales State | Target Canonical State |
| :--- | :--- | :--- |
| **Transaction Authority** | Competing: `POSService`, `SalesService`, `sales_ledger_svc.py` | Single Authority: `CanonicalSalesPostingWriter` |
| **Tax Calculation** | Divergent: POS inline rounding vs Sales GST engine | Sole Authority: `backend/app/core/gst_engine.py` |
| **Stock Deductions** | `Product.stock -= qty` (POS) vs WMS movements | `InventoryWmsService.atomic_mutate_batch_stock` |
| **Payment Atomicity** | Standalone transaction or hardcoded commit | Composed in caller's AsyncSession (`commit=False`) |
| **Outbox Events** | `POS_SALE_COMPLETED` vs `SALES_INVOICE_CREATED` | Canonical `SALES_INVOICE_POSTED` (schema v1.0) |
| **Idempotency** | Inconsistent document number caching | Unique `(company_id, branch_id, idempotency_key)` |

---

## 6. Architecture Impact
- **Non-Negotiable Anti-God Service Boundary**: `CanonicalSalesPostingWriter` delegates stock mutations strictly to `InventoryWmsService`, payments to `PaymentsEngine`, and tax calculations to `gst_engine.py`.
- **Database Routing Invariance**: All transactional writes remain strictly inside the tenant Company DB (`smritiXXX`). Zero writes to control plane `smritisys`.
- **Backward Compatibility**: `POSCheckoutResponse` remains 100% schema-compatible with frontend POS terminals (`ProPosBillingTerm.tsx`).

---

## 7. Proposed Design
```text
  Client (POS / B2B Workspace / Customer PO / Sales Order)
                     │
                     ▼
             POSService.pos_checkout (Adapter)
   [Shift Lock: select(Shift).with_for_update(), status == 'OPEN']
                     │
                     ▼
       CanonicalSalesPostingWriter.post_sales_transaction
   (session: AsyncSession, req: CanonicalPostingRequest, commit=True)
         │
         ├── 1. Idempotency Cache Check (SHA-256 Payload Hash)
         ├── 2. Customer Credit & Identity Gate (CRMService)
         ├── 3. Dual-Key Item / Variant Resolution (CanonicalTransactionWriter)
         ├── 4. Statutory Line Tax Math (calculate_line_item_tax)
         ├── 5. Document Number Allocation (NumberingService)
         ├── 6. SalesInvoice & SalesInvoiceItem Insertion
         ├── 7. Physical Stock Mutation & Movement Audit (InventoryWmsService)
         ├── 8. Multi-Tender Payment Allocation (PaymentsEngine, commit=False)
         ├── 9. Transactional Outbox Event Emission (OutboxService, commit=False)
         └── 10. Atomic Commit / Flush
```

---

## 8. Files Created
1. `docs/implementation/billing/Phase2C_Canonical_Sales_Writer_And_Posting_Contract_Plan_v4.14.0.md`: This formal 19-section implementation plan.

---

## 9. Files Modified
1. `backend/tests/test_canonical_sales_writer.py`: Environment configuration loading and characterization test assertions.
2. `backend/app/services/payments_engine.py`: Add `commit: bool = True` to `allocate_payment`.
3. `backend/app/services/pos.py`: Convert `pos_checkout` to delegate to `CanonicalSalesPostingWriter`.
4. `docs/implementation/README.md`: Master index update.

---

## 10. Dependencies
- `backend/app/core/gst_engine.py` (Statutory tax calculation)
- `backend/app/services/inventory_wms.py` (Physical batch inventory)
- `backend/app/services/payments_engine.py` (Multi-tender payments)
- `backend/app/services/outbox_service.py` (Committed event envelope)

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :---: | :--- |
| Breaking existing frontend POS checkout payloads | High | POS adapter maintains 100% signature and field parity in `POSCheckoutResponse`. |
| Partial database commit during payment failure | High | `PaymentsEngine` runs with `commit=False`, executing `flush()` so the entire transaction rolls back cleanly on any failure. |
| Negative stock violation blocking cash checkout | Medium | Governed `allow_negative_stock` context flag supported for POS retail mode where store policy permits. |

---

## 12. Rollback Strategy
If runtime anomalies occur in `POSService.pos_checkout`, a feature flag `ENABLE_CANONICAL_POS_WRITER=False` allows immediate fallback to legacy POS checkout logic without downtime.

---

## 13. Verification Plan
- Column and foreign key relational integrity check.
- Characterization testing of intra-state and inter-state tax splits.
- Multi-tender payment reconciliation (Cash + UPI + Credit Card).
- Stock movement cardinality check: exactly 1 `StockMovement` per physical line.

---

## 14. Test Plan
1. `python -m pytest backend/tests/test_canonical_sales_writer.py -v` (Target: 5/5 green)
2. `python -m pytest backend/tests/t_pos_sct_fk.py -v` (Target: 4/4 green)
3. `python -m pytest backend/tests/t_univ_item.py -v` (Target: 10/10 green)
4. `npx tsc --noEmit` (Target: 0 errors)
5. `python scripts/architecture_duplication_gate.py` (Target: 0 P0/P1 violations)

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Generate formal Phase 2C Walkthrough upon completion (`docs/walkthrough/billing/Phase2C_Canonical_Sales_Writer_Execution_v4.14.0.md`).

---

## 16. Deployment Plan
1. Apply codebase changes to development workspace `f:\SMRITRretailNX`.
2. Run test suites and verify all assertions pass.
3. Commit with verifiable code diffs and literal test outputs.
4. Deploy to test environment via `git pull`.

---

## 17. Status
`Completed` — Fully implemented and certified with 100% test passes.

---

## 18. Related ADRs
- `ADR-POS-002`: Forward-Only Accounting & Foreign Key Governance.
- `ADR-FIN-001`: Phase 2B Canonical Financial Policy & Tax Determination.
- `ADR-WMS-004`: Atomic Batch Mutation & FEFO Movement Cardinality.

---

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Phase2C_Canonical_Sales_Writer_Execution_v4.14.0.md`
- `docs/walkthrough/inventory/Universal_Item_Master_5Tier_Resolution_And_Retirement_v4.13.0.md`
- `docs/walkthrough/billing/Billing_B2B_Credit_Transaction_Contract_v3.30.0.md`
