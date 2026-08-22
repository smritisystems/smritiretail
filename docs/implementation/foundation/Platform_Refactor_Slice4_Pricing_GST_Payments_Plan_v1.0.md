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

# Implementation Plan: Vertical Slice 4 — Pricing, GST, Payments, and Document Engine Unification

## 1. Objective
Unify Price Book resolution, multi-tier discount hierarchies, statutory GST rate scheduling, multi-tender payment settlement ledgers, and atomic document numbering engines inside the tenant data plane (`smritiXXX`).

---

## 2. Business Motivation
Enterprise omnichannel retail demands dynamic pricing (wholesale vs retail tier books, volume breaks), strict statutory tax auditability, idempotent split-tender payment processing, and gapless, compliant document sequence numbering. Consolidating these engines prevents revenue leakage, duplicate payments, and statutory numbering non-compliance.

---

## 3. Scope

### In-Scope
1. **Unified Pricing Engine (`price_books`, `price_book_entries`, `customer_price_tiers`)**:
   - Hierarchical resolution: Customer Tier -> Custom Price Book -> Promotional Discount -> Item Base MRP.
   - Volume break thresholds (`min_quantity`).
2. **Multi-Tender Payment Settlement Ledger (`payment_transactions`, `payment_allocations`)**:
   - Atomic recording of split tenders (CASH, CARD, UPI, CREDIT_MEMO, CHEQUE, LOYALTY_POINTS).
   - Strict `idempotency_key` enforcement on payment requests to eliminate double-charging risks.
3. **Atomic Document Numbering Engine (`document_series`, `numbering_audit_logs`)**:
   - Row-locked sequence allocation per financial year and document type (e.g. `INV/2026-27/0001`, `PO/2026-27/0001`).
   - Immutable audit logging for every numbering increment.
4. **Tenant Isolation**:
   - All price books, payment transactions, and document sequences execute strictly inside `smritiXXX`.

### Out-of-Scope (Deferred)
- External bank payment gateway API integration webhook handlers.
- General ledger double-entry journal balance sheet generation (scheduled for Slice 5).

---

## 4. Current State
- `document_series` exists with schema baseline.
- Pricing logic was partially fragmented across POS frontend and sales services.
- Payment tenders were captured as flat strings on invoices rather than structured multi-tender transaction ledgers.

---

## 5. Gap Analysis
| Dimension | Current State | Target Architecture (Slice 4) |
| :--- | :--- | :--- |
| **Pricing Resolution** | Item master base price | 4-tier hierarchical resolution (`PriceBook` + `CustomerPriceTier` + volume breaks) |
| **Payment Ledger** | Single payment mode string on invoice | Multi-tender `PaymentTransaction` records with unique `idempotency_key` |
| **Document Numbering** | Basic sequence table | Atomic row-locked sequence allocation with audit trail |
| **Data Plane Boundary** | Tenant DB | Strictly tenant data plane (`smritiXXX`) |

---

## 6. Architecture Impact
- **Deterministic Pricing**: Pricing evaluations are decoupled from UI hardcoding and evaluated through authoritative backend services.
- **Financial Auditability**: Multi-tender payments have distinct transaction IDs and allocation links to invoices.

---

## 7. Proposed Design

### A. Pricing Domain (`backend/app/models/pricing.py`)
```sql
CREATE TABLE IF NOT EXISTS price_books (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50),
    branch_id VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    is_default BOOLEAN DEFAULT FALSE,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_book_entries (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50),
    branch_id VARCHAR(50),
    price_book_id VARCHAR(50) REFERENCES price_books(id) ON DELETE CASCADE,
    item_id VARCHAR(50) REFERENCES items(id) ON DELETE CASCADE,
    variant_id VARCHAR(50) REFERENCES item_variants(id) ON DELETE CASCADE,
    min_quantity NUMERIC(12, 4) DEFAULT 1.0000,
    selling_price NUMERIC(15, 2) NOT NULL,
    mrp NUMERIC(15, 2) NOT NULL,
    cost_price NUMERIC(15, 2),
    is_active BOOLEAN DEFAULT TRUE
);
```

### B. Payment Ledger Domain (`backend/app/models/payment_ledger.py`)
- `PaymentTransaction`: `id`, `transaction_no`, `reference_doc_type`, `reference_doc_id`, `party_id`, `tender_type`, `amount`, `currency`, `idempotency_key` (UNIQUE), `status`.
- `PaymentAllocation`: `payment_id`, `invoice_id`, `allocated_amount`.

---

## 8. Files Created
- `backend/app/models/pricing.py`: Canonical PriceBook, PriceBookEntry, CustomerPriceTier models.
- `backend/app/models/payment_ledger.py`: Canonical PaymentTransaction, PaymentAllocation models.
- `backend/app/services/unified_pricing_payment_service.py`: Domain service for pricing resolution, atomic document numbering, and idempotent multi-tender payment recording.
- `backend/tests/test_unified_pricing_payment_engine.py`: Automated verification suite for pricing tiers, idempotent payments, sequence numbers, and tenant isolation.
- `docs/implementation/foundation/Platform_Refactor_Slice4_Pricing_GST_Payments_Plan_v1.0.md`: This implementation plan.

---

## 9. Files Modified
- `backend/app/models/__init__.py`: Export Pricing and Payment Ledger models.
- `docs/implementation/README.md`: Append Slice 4 plan to master index.
- `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`: Track Slice 4 verification.

---

## 10. Dependencies
- Vertical Slice 2: Universal Party & Item Master.
- Vertical Slice 3: Sales, POS, and Operational Stock Ledger.

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Duplicate payment requests on network retry | High | Enforce database-level UNIQUE constraint on `idempotency_key` |
| Numbering sequence contention under high concurrency | Medium | Use `SELECT ... FOR UPDATE` row locks on `document_series` |

---

## 12. Rollback Strategy
Additive DDL tables. If rollback is required, existing invoice tables continue to function without schema destruction.

---

## 13. Verification Plan
1. Test tier-based pricing resolution (Retail vs Wholesale Price Book).
2. Test atomic document sequence generation without sequence gaps.
3. Test split-tender payment settlement and duplicate idempotency key rejection.
4. Verify tenant isolation between `smriti001` and `smriti002`.

---

## 14. Test Plan
- Run `backend/tests/test_unified_pricing_payment_engine.py`.
- Run full 77+ test multi-module regression suite.

---

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Generate Walkthrough `docs/walkthrough/foundation/Platform_Pricing_GST_Payments_Unification_v6.16.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
1. Apply DDL to tenant databases (`smriti001`, `smriti002`).
2. Deploy backend service models.
3. Validate automated test execution.

---

## 17. Status
**Draft — Ready for Review & Execution**

---

## 18. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-007`: Hierarchical Pricing, Document Sequence Locking, and Idempotent Payments.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_Sales_POS_Ledger_Unification_v6.16.0.md`.
