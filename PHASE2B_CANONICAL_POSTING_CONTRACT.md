<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-09-08
  Modified     : 2026-09-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Posting Contract Specification (Phase 2B)
-->

# Phase 2B — Canonical POS Posting Contract & Convergence Specification

**Contract Document ID:** SMRITI-CTR-POS-2026-09-2B  
**Version:** 1.0.0  
**Status:** ESTABLISHED (Phase 2B Baseline)  
**Baseline Characterization:** `docs/implementation/foundation/PHASE2A_POS_CONTRACT.md`  
**Financial Policy Reference:** `PHASE2B_FINANCIAL_POLICY.md`

---

## 1. Objective & Architectural Boundaries

### 1.1 Objective
This contract resolves the architectural and semantic conflicts characterized in Phase 2A (`PHASE2A_POS_CONTRACT.md`), unifies the divergent financial writers under a single canonical posting contract, and establishes the implementation blueprint for Phase 2C.

**Core Invariant:**  
No production financial writer was rewired, deleted, or disabled in Phase 2B. Phase 2B is strictly a specification and contract resolution phase.

### 1.2 Non-Negotiable Boundary Architecture (Anti-God Service Rule)
To prevent the creation of a monolithic "God Service", system responsibilities remain strictly partitioned across domain boundaries:

```text
       ┌────────────────────────────────────────────────────────┐
       │              POS Adapter (POSService)                  │
       │  • Shift row locking (SELECT FOR UPDATE)               │
       │  • Validate shift status == 'OPEN'                     │
       │  • Capture cashier_id, terminal_id, tenders, offline no │
       └──────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │     Canonical Sales Authority (SalesService Core)      │
       │  • Caller-controlled AsyncSession (no auto-commit)     │
       │  • Idempotency check & replay                          │
       │  • Dual-key variant/product resolution                 │
       │  • Canonical statutory tax calculation (gst_engine)    │
       │  • Customer & credit limit validation (CRMService)     │
       │  • Document number allocation (DocumentsEngine)        │
       └───────┬──────────────────┬──────────────────┬──────────┘
               │                  │                  │
               ▼                  ▼                  ▼
      ┌─────────────────┐ ┌────────────────┐ ┌────────────────┐
      │ Inventory WMS   │ │ PaymentsEngine │ │ Outbox Service │
      │   Authority     │ │   Authority    │ │   Authority    │
      │ • FEFO batch    │ │ • Multi-tender │ │ • Transactional│
      │ • StockMovement │ │ • Allocations  │ │   outbox event │
      │ • Sync aggregate│ │ • Tenders      │ │   (same atomic │
      │   products.stock│ │   (flush only) │ │    transaction)│
      └─────────────────┘ └────────────────┘ └────────────────┘
```

1. **Sales/Billing Authority:** Canonical transaction, pricing, tax, document numbering, and invoice record truth.
2. **InventoryWmsService:** Physical stock truth, FEFO batch allocation, stock movements, and aggregate stock synchronization.
3. **PaymentsEngine:** Multi-tender payment capture, payment allocations, and receipt numbering.
4. **UnifiedAccountingLedgerService:** Authoritative double-entry GL truth (`accounts`, `journal_vouchers`, `general_ledger_entries`).
5. **OutboxService:** Reliable committed event publishing boundary via `integration_outbox_events`.
6. **POSService:** POS adapter preserving shift row locking, cashier context, terminal context, and rapid UI response.
7. **SalesService:** Compatibility-facing sales API adapter during strangler-fig migration.

---

## 2. Canonical Posting Contract Interface

### 2.1 Data Transfer Models
The canonical contract between POS/adapters and the authority is defined by strongly typed, immutable dataclasses:

```python
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, Any, List, Optional, Sequence
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

@dataclass(frozen=True)
class PosPostingContext:
    """Immutable operational context supplied by the POS adapter."""
    company_id: str
    branch_id: str
    warehouse_id: Optional[str]
    shift_id: str
    cashier_id: Optional[str]
    terminal_id: Optional[str]
    counter_id: Optional[str]
    idempotency_key: str
    client_invoice_no: Optional[str] = None  # Populated if terminal offline sequence
    source_channel: str = "POS_RETAIL"

@dataclass(frozen=True)
class PosPostingLineItem:
    """Line item input before canonical tax and inventory resolution."""
    code: str
    quantity: Decimal
    unit_price: Decimal
    name: Optional[str] = None
    variant_id: Optional[str] = None
    product_id: Optional[str] = None
    batch_no: Optional[str] = None
    gst_rate: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    disc_pct: Decimal = Decimal("0.00")
    is_tax_inclusive: Optional[bool] = None  # None => defaults to True for retail MRP
    is_fee_line: bool = False
    mrp: Optional[Decimal] = None

@dataclass(frozen=True)
class PosTenderItem:
    """Individual tender line in multi-tender settlement."""
    tender_type: str  # CASH | CARD | UPI | WALLET | CREDIT
    amount: Decimal
    gateway_reference: Optional[str] = None

@dataclass(frozen=True)
class PosPostingRequest:
    """Full posting payload submitted to the Canonical Authority."""
    context: PosPostingContext
    customer_id: Optional[str]
    customer_name: Optional[str]
    lines: Sequence[PosPostingLineItem]
    tenders: Sequence[PosTenderItem]
    bill_discount_val: Optional[Decimal] = None
    bill_discount_type: Optional[str] = None  # "percent" | "flat"
    notes: Optional[str] = None

@dataclass(frozen=True)
class PosPostingResult:
    """Deterministic result returned by the authority."""
    invoice_id: str
    invoice_no: str
    company_id: str
    branch_id: str
    shift_id: str
    date: date
    taxable_value: Decimal
    tax_total: Decimal
    grand_total: Decimal
    rounding_amount: Decimal
    payment_mode: str
    paid_amount: Decimal
    balance_amount: Decimal
    cached_replay: bool
    status: str
    item_count: int
    outbox_event_id: str
```

### 2.2 Authority Protocol & Transaction Ownership Contract
```python
from typing import Protocol

class CanonicalSalesAuthority(Protocol):
    async def post_sales_transaction(
        self,
        *,
        session: AsyncSession,
        request: PosPostingRequest,
        commit: bool = False,
    ) -> PosPostingResult:
        """
        Executes canonical validation, tax calculation, inventory deduction,
        payment capture, and outbox event recording.

        TRANSACTION OWNERSHIP RULE:
        - When commit=False (default for composed transactions):
          The authority executes flushes (session.flush()) only.
          It does NOT commit or roll back the session.
          The caller (outer coordinator) controls the final commit/rollback.
        - When commit=True (standalone callers):
          The authority issues commit on success and rollback on failure.
        """
        ...
```

---

## 3. Payment Boundary Resolution: Single DB Transaction vs. Saga

### 3.1 Architectural Evaluation
In retail POS, checkout completes when the customer tenders money (cash, card, UPI) and receives a printed receipt. We explicitly evaluated two transactional boundaries:

| Strategy | Description | Pros | Cons / Risks |
| :--- | :--- | :--- | :--- |
| **Strategy A: Unified Atomic DB Transaction** | Invoice creation, stock deduction, multi-tender payment recording, and outbox event occur in **one atomic database transaction** on the Company DB. | 100% ACID consistency. Zero risk of orphaned payments or un-tendered completed bills. Cashier and drawer state remain strictly synchronous. | Requires all participating services to support caller-controlled sessions without internal commits. |
| **Strategy B: Two-Phase Saga** | Invoice is posted in Transaction 1 (status: "UNPAID"), followed by Payment capture in Transaction 2. If Payment fails, a compensating event voids/cancels the invoice. | Decouples invoice and payment writers. Tolerates services that insist on committing internally. | Dual-write hazard. Invoice is visible in DB even if payment crashes. Requires complex compensation/retry infrastructure. Poor UX at retail checkout. |

### 3.2 Finding on `PaymentsEngine`
Inspection of `backend/app/services/payments_engine.py` reveals:
- Line 166: `await session.commit()` is hardcoded inside `process_payment()`.
- Line 291: `await session.commit()` is hardcoded inside `refund_payment()`.
- `PaymentsEngine` currently forces a commit on the caller's session, which breaks Strategy A composition.

### 3.3 Phase 2C Refactor Contract for `PaymentsEngine`
Rather than bypassing `PaymentsEngine` or resorting to an asynchronous saga for synchronous POS checkout, **`PaymentsEngine` must be refactored in Phase 2C**:
1. Add `commit: bool = True` parameter to `PaymentsEngine.process_payment` and `PaymentsEngine.refund_payment`.
2. When `commit=False`:
   - Session operations execute normally.
   - Replace `await session.commit()` with `await session.flush()`.
   - The outer transaction coordinator controls the atomic commit.

---

## 4. Canonical Request Idempotency Contract

### 4.1 Semantics & Scoping
The idempotency contract guarantees that network retries, double-clicks, or terminal replays never produce duplicate invoices, duplicate stock decrements, duplicate payment entries, or duplicate outbox events:
- **Scope:** Scoped strictly by `(company_id, branch_id, idempotency_key)`.
- **Separation from Primary Key:** `idempotency_key` is distinct from `SalesInvoice.id` and distinct from `SalesInvoice.invoice_no`.
- **Payload Hashing:** The authority computes a deterministic SHA-256 hash of the canonical line items, quantities, prices, and tenders.

### 4.2 Replay vs. Conflict Behavior
When a request arrives with an `idempotency_key`:
1. **Existing Record Found with MATCHING Payload Hash:**
   - Immediately returns the previously committed `PosPostingResult` with `cached_replay = True`.
   - Does NOT re-execute inventory deductions, payments, or outbox creation.
2. **Existing Record Found with DIFFERENT Payload Hash:**
   - Raises `HTTP 409 Conflict`:
     `"Idempotency key collision: request payload differs from previous execution."`
3. **Concurrent Identical Requests (Race Condition):**
   - Protected by unique constraint `(company_id, branch_id, idempotency_key)` on `sales_invoices`.
   - The second concurrent transaction catches `IntegrityError`, rolls back its nested savepoint, re-reads the committed winner, and returns the cached result safely.

---

## 5. POS Shift & Terminal Context Contract

### 5.1 Shift Locking & Validation
Before invoking the authority, the POS adapter (`POSService`):
1. Acquires a pessimistic row lock on the shift:
   ```python
   stmt = select(Shift).where(
       Shift.id == shift_id,
       Shift.company_id == company_id,
       Shift.branch_id == branch_id,
       Shift.is_deleted == False
   ).with_for_update()
   ```
2. Validates that `shift.status == "OPEN"`. If closed, immediately rejects with `HTTP 400`.
3. Passes validated `shift_id`, `cashier_id`, `terminal_id`, and `counter_id` in `PosPostingContext`.

### 5.2 Authority Invariant Enforcement
The Canonical Authority enforces:
- `sales_invoices.shift_id = context.shift_id`
- `sales_invoices.terminal_id = context.terminal_id`
- `sales_invoices.counter_id = context.counter_id`
- `sales_invoices.salesperson_id = context.cashier_id`
Non-POS callers (B2B Customer PO, E-commerce) leave `shift_id` as `None`.

---

## 6. Canonical Outbox Event Contract

### 6.1 Publication Invariant
Adapters must NOT emit competing, unstructured financial event schemas. Exactly one canonical event is recorded for every committed sales posting:
- **Authority:** `backend/app/services/outbox_service.py:OutboxService`
- **Database Model:** `backend/app/models/outbox.py:IntegrationOutboxEvent`
- **Target Channel:** `PSV_QUEUE` (or `SALES_TRANSACTIONS`)
- **Event Type:** `SALES_INVOICE_POSTED`
- **Schema Version:** `"1.0"`

### 6.2 Event Payload Structure
```json
{
  "event_id": "evt_00061e8c97df4321_debf6ba61d44497d",
  "event_type": "SALES_INVOICE_POSTED",
  "event_version": "1.0",
  "aggregate_type": "SALES_INVOICE",
  "aggregate_id": "inv-1788844009-901f93",
  "company_id": "COMP-001",
  "branch_id": "BR-001",
  "correlation_id": "corr_4d8721bf90ea12",
  "causation_id": "POS-00124",
  "idempotency_key": "idem-pos-terminal1-tx981",
  "pos_metadata": {
    "shift_id": "shift-0091",
    "terminal_id": "TERM-01",
    "cashier_id": "usr-cashier-4",
    "counter_id": "CNT-02"
  },
  "invoice": {
    "invoice_no": "POS-00124",
    "date": "2026-09-08",
    "customer_id": "CUST-WALKIN",
    "taxable_value": "100.00",
    "tax_total": "18.00",
    "grand_total": "118.00",
    "rounding_amount": "0.00",
    "is_interstate": false,
    "place_of_supply_code": "27"
  },
  "items": [
    {
      "line_no": 1,
      "product_id": "prod-101",
      "variant_id": "var-202",
      "sku": "SKU-SHIRT-M",
      "quantity": "1.0000",
      "unit_price": "100.00",
      "gst_rate": "18.00",
      "taxable_value": "100.00",
      "tax_amount": "18.00",
      "total_amount": "118.00"
    }
  ],
  "tenders": [
    {
      "tender_type": "CASH",
      "amount": "118.00"
    }
  ]
}
```

---

## 7. Master Authority Matrix

| Domain / Responsibility | Current Authority | Target Canonical Authority | Adapter Behavior | Phase |
| :--- | :--- | :--- | :--- | :--- |
| **1. Invoice Creation & Item Snapshot** | Competing: `POSService`, `SalesService`, `UnifiedSalesLedgerService` | **`SalesService` (Canonical Sales Authority)** | Adapters convert DTOs to `PosPostingRequest` | Phase 2C-1 |
| **2. Document Numbering** | Competing: Client-supplied (POS), `DocumentsEngine` (Sales) | **`DocumentsEngine`** | POS supplies client number or requests `AUTO` | Phase 2C-1 |
| **3. Statutory Tax Calculation** | Divergent: Simplistic (POS), `calculate_line_item_tax` (Sales) | **`gst_engine.py`** | Zero tax logic in adapters; all delegate to engine | Phase 2C-1 |
| **4. Discount (Line-Level)** | `SalesService` & `gst_engine.py` | **`gst_engine.py`** | Adapters supply `disc_pct` per line | Phase 2C-1 |
| **5. Discount (Bill-Level)** | Uncoordinated post-tax deduction (POS) | **Pending Stakeholder Approval** | Flagged as `NEEDS_APPROVAL` | Phase 2B / 2C |
| **6. Item / Variant Identity** | Dual-key resolver (POS), unmapped fallback (Sales/Ledger) | **`CanonicalTransactionWriter`** | Validates dual-keys; rejects quarantined/unresolved | Phase 2C-1 |
| **7. Physical Stock Availability** | Direct `Product.stock` check (POS), WMS batch check (Sales) | **`InventoryWmsService`** | Adapters never inspect or check stock directly | Phase 2C-1 |
| **8. Batch Allocation (FEFO)** | None (POS), `allocate_stock_fefo` (Sales) | **`InventoryWmsService`** | POS passes optional batch; auto-FEFO otherwise | Phase 2C-1 |
| **9. Stock Movement Audit** | Duplicate: Direct `StockMovement` (POS), `atomic_mutate_batch_stock` (WMS) | **`InventoryWmsService`** | All movements emitted by WMS (`quantity = abs(qty)`) | Phase 2C-1 |
| **10. Payment Capture & Multi-Tender** | Payment mode string only (POS), none (Sales), `PaymentsEngine` (separate) | **`PaymentsEngine`** | POS submits tender array; authority captures | Phase 2C-3 |
| **11. Payment Allocation** | None (POS), separate commit (Payments) | **`PaymentsEngine`** | Synchronously allocated to invoice in same DB tx | Phase 2C-3 |
| **12. POS Shift Row Lock & State** | `POSService` | **`POSService` (Adapter Responsibility)** | Shift locked `FOR UPDATE` before authority call | Phase 2C-4 |
| **13. Customer Scope & Verification** | None (POS), CRM validation (Sales) | **`CRMService` & `SalesService`** | Customer scope verified; walk-in normalized | Phase 2C-1 |
| **14. Customer Credit Control** | None (POS), authoritative check/ledger (Sales) | **`CRMService`** | Walk-in credit blocked; ledger updated for B2B | Phase 2C-1 |
| **15. Transactional Outbox Event** | Competing: `POS_SALE_COMPLETED` (POS), `SALES_INVOICE_CREATED` (Sales) | **`OutboxService`** | Single `SALES_INVOICE_POSTED` event schema | Phase 2C-1 |
| **16. General Ledger (GL) Posting** | Asynchronous outbox worker | **`UnifiedAccountingLedgerService`** | Dispatched asynchronously from outbox event | Existing |
| **17. Request Idempotency** | Inconsistent: Invoice no caching (POS), `idempotency_key` (Sales) | **Canonical Idempotency Engine** | Headers `Idempotency-Key` enforced per company | Phase 2C-1 |
| **18. Database Routing & Isolation** | `get_company_db` | **`get_company_db`** | Multi-tenant Company DB strictly enforced | Existing |

---

## 8. Resolution of Phase 2A Class-D Conflicts

Every Class-D conflict characterized in Phase 2A is explicitly classified and resolved:

| Conflict Identified in Phase 2A | Final Classification | Policy / Architecture Resolution |
| :--- | :--- | :--- |
| **1. Tenant-scoped invoice numbering** | **A (Canonical Authority)** | `DocumentsEngine` allocates sequence for AUTO/missing. Client-supplied number validated for uniqueness within `company_id` (409 on duplicate). |
| **2. Invoice Idempotency Key separation** | **A (Canonical) / C (Duplicate)** | Idempotency key is strictly separated from document number and invoice PK. Model pattern matches `SalesReturn.idempotency_key`. POS caching on invoice_no is removed (C). |
| **3. Movement Cardinality under FEFO** | **A (Canonical Inventory)** | One invoice line produces $N$ stock movements ($N \ge 1$ for physical goods across multiple batches, $N = 0$ for service/no-stock lines). |
| **4. Company/Branch/Warehouse Isolation** | **A (Zero-Trust Validation)** | Authority verifies ownership of all supplied branch, warehouse, product, batch, and customer IDs against active Company DB. |
| **5. Movement Quantity & Sign Convention** | **A (Canonical WMS) / C (Duplicate)** | Canonical convention: `StockMovement.quantity = abs(qty_delta)` with `movement_type = "OUTWARD_SALE"`. Negative quantity convention in POS and ledger is removed (C). |
| **6. Payment Boundary & Atomicity** | **A (Caller-Controlled Session)** | POS checkout captures payment in the same Company DB transaction. `PaymentsEngine.process_payment` refactored to accept `commit: bool = True` (flushing when False). |
| **7. Tax Calculation Engine** | **A (Canonical GST) / C (Duplicate)** | `backend/app/core/gst_engine.py:calculate_line_item_tax` is sole tax authority. Simplistic 4-decimal POS calculation removed (C). |
| **8. POS Bill-Level Discount** | **NEEDS_APPROVAL** | Proportional pre-tax line allocation (Option A) vs. Post-tax financial discount (Option B) requires business stakeholder sign-off. |
| **9. Outbox Event Contract** | **A (Canonical Outbox) / C (Duplicate)** | Single canonical event `SALES_INVOICE_POSTED` (schema v1.0) emitted to `PSV_QUEUE`. Competing legacy schemas removed (C). |
| **10. Transaction Ownership / Auto-commit** | **A (Caller Controls Commit)** | Outer coordinator owns commit/rollback; Canonical Authority flushes only when `commit=False`. |
| **11. Direct `Product.stock` Mutation** | **C (Duplicate Behavior to Remove)** | Direct in-memory mutation of `Product.stock` in `pos.py` is removed; all mutations delegate to `InventoryWmsService.atomic_mutate_batch_stock`. |
| **12. Ad-Hoc Product Creation** | **C (Duplicate Behavior to Remove)** | Synthetic product generation (`prod_adhoc_<uuid>`) in `sales_ledger_svc.py` is prohibited; unresolved items fail closed with `SMRITI-VAL-NO-IDENTITY`. |

---

## 9. Phase 2C Implementation Plan

The implementation sequence is structured as five smallest, safest incremental steps:

### Phase 2C-1: Build Canonical Posting Interface & Service Method
- Add `post_sales_transaction` method to `SalesService` accepting `PosPostingRequest`.
- Integrate `CanonicalTransactionWriter` (dual-key resolution), `calculate_line_item_tax` (statutory GST), `InventoryWmsService` (FEFO stock mutation), and `OutboxService`.
- Support `commit: bool = True` (caller-controlled unit of work).
- Ensure existing POS checkout and B2B billing endpoints remain completely untouched.

### Phase 2C-2: Add Comprehensive Characterization & Contract Unit Tests
- Write isolated unit/integration tests for `post_sales_transaction` covering:
  - Intra-state and inter-state tax splits.
  - Tax-inclusive MRP vs Tax-exclusive base rate.
  - FEFO multi-batch stock deductions and movement cardinality.
  - Quarantined item rejection (`SMRITI-QUARANTINE-REJECT`).
  - Unresolved item rejection (`SMRITI-VAL-NO-IDENTITY`).
  - Service / no-stock line handling ($N = 0$ movements).
  - Idempotency replay and conflict detection.
  - Cross-tenant / cross-branch rejection.

### Phase 2C-3: Make PaymentsEngine Transaction-Boundary Safe
- Refactor `PaymentsEngine.process_payment` and `refund_payment` to add `commit: bool = True`.
- When `commit=False`, replace `session.commit()` with `session.flush()`.
- Add test verifying `post_sales_transaction` atomically commits Invoice + Stock + Payment + Outbox.

### Phase 2C-4: Converge POS Adapter (`POSService.pos_checkout`)
- Update `POSService.pos_checkout` to act strictly as a thin adapter:
  - Acquire `Shift` row lock (`with_for_update()`) and verify `status == "OPEN"`.
  - Transform `POSCheckoutRequest` into `PosPostingRequest`.
  - Invoke `CanonicalSalesAuthority.post_sales_transaction(session=self.db, request=req, commit=True)`.
  - Return existing `POSCheckoutResponse` structure for 100% frontend backward compatibility.
- Remove duplicate in-memory `Product.stock` mutation, unrounded 4-decimal tax, and duplicate outbox emission from `pos.py`.

### Phase 2C-5: Execute Gate 11E Regression & Production Readiness Verification
- Run complete idempotency, rollback, concurrent-checkout, and tenant-isolation test suites.
- Verify zero regression across POS Fast Checkout, Customer PO Billing Workspace, and B2B Delivery Challan flows.

---

## 10. Final Gate Verdict

### Status: PASS
- All 12 Class-D conflicts from Phase 2A are either:
  1. Resolved by existing canonical implementation/policy (**11 conflicts resolved**), or
  2. Explicitly marked as **`NEEDS_APPROVAL`** (**1 conflict: POS Bill-Level Discount Allocation**).
- Zero financial behavior has been silently assumed or guessed.
- Zero production financial writers were rewired, deleted, or disabled in Phase 2B.
- Phase 2C implementation sequence is strictly defined.

*End of Posting Contract Specification.*
