<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-03
  Modified     : 2026-09-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# CUSTOMER BILLING — B2B CREDIT TRANSACTION CONTRACT REVIEW

**Document ID:** ARCH-REV-2026-0903-B2B-CREDIT  
**Status:** **CREDIT CONTRACT REQUIRES PRODUCT DECISION**  
**Review Type:** READ-ONLY PRODUCT & ARCHITECTURAL SPECIFICATION  
**Scope:** Customer Master → B2B Corporate Classification → Credit Billing → Settlement → AR Ledger → UAT Certification  

---

## 1. Current Architecture

The billing ecosystem in SMRITI Retail OS contains two distinct billing interfaces and a unified FastAPI + PostgreSQL backend:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND CLIENT LAYER                              │
├──────────────────────────────────────┬──────────────────────────────────────────┤
│ 1. Distributor Invoicing (BillingTerm)│ 2. ProPOS Terminal (ProPosBillingTerm)   │
│    - B2B Wholesale / Distributor     │    - Retail / POS Counter                │
│    - Uses headerState.transaction    │    - Multi-tender split keypad           │
│    - Invokes SmritiInvoiceSettlement │    - Invokes ProPosSettlementDl          │
│      (InvoiceSettlementD.tsx)        │                                          │
└──────────────────────────────────────┴──────────────────────────────────────────┘
                                       │
                POST /api/v1/sales/invoices (apiFetchV1)
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                            BACKEND SERVICES LAYER                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│ SalesService (backend/app/services/sales.py)                                    │
│   ├── check_credit_limit (CrmService - backend/app/services/crm.py)             │
│   ├── WmsService (batch stock deduction OUTWARD_SALE)                           │
│   ├── OutboxService (PSV_QUEUE event SALES_INVOICE_CREATED)                     │
│   ├── UnifiedLedger (Journal voucher: Debit 1030 AR, Credit 4010 Revenue)       │
│   ├── PaymentsEngine (Multi-tender ledger & allocations)                        │
│   └── DocumentsEngine (Gapless row-locked DocumentSeries allocator)             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                         AUTHORITATIVE DATABASE (PostgreSQL)                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ smriti001: sales_invoices, sales_invoice_items, customers, customer_groups,     │
│            document_series, payment_transactions, journal_vouchers              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Critical Architectural Findings:
1. **Frontend Disconnect:** In [BillingTerm.tsx](file:///f:/SMRITRretailNX/src/components/billing/BillingTerm.tsx#L1259), the header allows the cashier to toggle `Transaction: Credit | Cash | Retail`. However, this value (`headerState.transaction`) is never passed into the settlement modal (`InvoiceSettlementD.tsx`), and `handleCompleteSettlement` pulls `payment_mode` exclusively from `payments[0]?.mode.toUpperCase()`, which the modal hardcodes to `"Cash"`.
2. **Missing Tender Option:** In [InvoiceSettlementD.tsx](file:///f:/SMRITRretailNX/src/components/billing/InvoiceSettlementD.tsx#L300-L306), the payment mode dropdown contains: `Cash`, `Credit Card`, `Debit Card`, `UPI`, `Cheque`, `Credit Note`. Neither `"Credit"` nor `"On Account"` exists in the options list.
3. **Idempotency Trap:** In [backend/app/services/sales.py:83-95](file:///f:/SMRITRretailNX/backend/app/services/sales.py#L83-L95), `SalesService` treats `SalesInvoice.invoice_no == invoice_in.invoice_no` as an idempotency match and silently returns an existing invoice. Because `BillingTerm.tsx` defaults to `docPrefix: "D1DS13"`, `docNo: "1"`, subsequent test runs submit `D1DS13-1` and receive the previous run's CASH invoice rather than generating a fresh credit invoice.

---

## 2. Existing Credit-Sale Capabilities

An exhaustive audit of the SMRITI codebase confirms that **SMRITI already possesses mature backend primitives** for credit management:

| Capability | Canonical Source | Status | Description |
|---|---|---|---|
| **Credit Limit Check** | [backend/app/services/crm.py:210](file:///f:/SMRITRretailNX/backend/app/services/crm.py#L210) | `EXISTING — REUSE` | Enforces `customer.outstanding + new_amount <= group.credit_limit`. Blocks with `SMRITI-CREDIT-001` or holds with `SMRITI-CREDIT-002`. |
| **Credit Days & Grace** | [backend/app/models/crm.py:28-29](file:///f:/SMRITRretailNX/backend/app/models/crm.py#L28-L29) | `EXISTING — REUSE` | `CustomerGroup.credit_days` (e.g. 60 days) and `grace_days` are stored in PostgreSQL. |
| **Customer Outstanding** | [backend/app/models/crm.py:62](file:///f:/SMRITRretailNX/backend/app/models/crm.py#L62) | `EXISTING — REUSE` | `Customer.outstanding` column exists in `customers`. Checked during credit limit validation. |
| **Double-Entry AR Posting** | [backend/app/services/unified_ledger.py:437](file:///f:/SMRITRretailNX/backend/app/services/unified_ledger.py#L437) | `EXISTING — REUSE` | `post_sales_invoice_to_gl` debits `Accounts Receivable (1030)` and credits `Sales Revenue (4010)` and `Output GST`. |
| **Payment Allocations** | [backend/app/services/payments_engine.py:310](file:///f:/SMRITRretailNX/backend/app/services/payments_engine.py#L310) | `EXISTING — REUSE` | `PaymentsEngine` allocates customer payment receipts against open invoice balances with overpayment guards. |
| **Document Numbering** | [backend/app/services/documents_engine.py:103](file:///f:/SMRITRretailNX/backend/app/services/documents_engine.py#L103) | `EXISTING — REUSE` | Gapless, transactional `SELECT FOR UPDATE` series allocator with audit logging on `document_series`. |
| **Suspended Credit Bill** | [BillingTerm.tsx:842](file:///f:/SMRITRretailNX/src/components/billing/BillingTerm.tsx#L842) | `EXISTING — REUSE` | `handleSuspendInvoice` already sets `payment_mode: "CREDIT"` and `status: "Suspended"`. |

---

## 3. Payment Contract

For an authoritative B2B Credit Transaction, the API payload and database fields must adhere to the following contract:

```typescript
// Frontend Submission Payload (POST /api/v1/sales/invoices)
{
  "invoice_no": "INV/2026-27/0042",      // From sequence or generated by backend
  "date": "2026-09-03",
  "customer_id": "cust-4f6c2400",        // Mandatory registered B2B customer ID
  "customer_name": "Apex Corp Logistics Ltd",
  "customer_gstin": "27AABCA1234F1Z5",
  "status": "Completed",                 // Legally completed, stock-deducted tax invoice
  "payment_mode": "CREDIT",              // Authoritative credit indicator
  "paid_amount": 0.00,                   // ZERO cash/tender collected at counter
  "balance_amount": 1678.95,             // Exactly equal to grand_total
  "net_amount": 1678.95,
  "taxable_value": 1599.00,
  "tax_total": 79.95,
  "grand_total": 1678.95,
  "rule_snapshots": {
    "transaction_type": "Credit",
    "credit_terms": {
      "credit_days": 60,
      "due_date": "2026-11-02",
      "credit_limit": 500000.00,
      "previous_outstanding": 0.00,
      "projected_outstanding": 1678.95
    },
    "payments": []                       // Empty or [{ mode: "On Account", amount: 1678.95 }]
  }
}
```

### Authoritative Database Values in `sales_invoices`:
* `payment_mode`: `'CREDIT'`
* `paid_amount`: `0.00`
* `balance_amount`: `1678.95` (`== grand_total`)
* `status`: `'Completed'`
* `customer_id`: Verified foreign key to `customers.id` (strictly non-null, never `CUST-WALKIN`)

---

## 4. Settlement UX Contract

When a B2B Distributor Invoice is designated as **Credit**, forcing the user to enter cash tender or count ₹2000/₹500 banknotes is a domain violation.

### Proposed Modal Behavior:

```text
┌────────────────────────────────────────────────────────────────────────┐
│               SMRITI INVOICE SETTLEMENT STUDIO — B2B CREDIT            │
├────────────────────────────────────────────────────────────────────────┤
│ Bill No: D1DS13-0022    │ Date: 03/09/2026   │ Terms: Credit / On Acct │
│ Customer: Apex Corp Logistics Ltd [GSTIN: 27AABCA1234F1Z5]             │
├────────────────────────────────────────────────────────────────────────┤
│ CREDIT TERMS SUMMARY                                                   │
│   • Customer Group      : Corporate Clients (CG-Corporate)             │
│   • Credit Limit        : ₹5,00,000.00                                 │
│   • Current Outstanding : ₹0.00                                        │
│   • Credit Period       : 60 Days                                      │
│   • Payment Due Date    : 02/11/2026                                   │
│   • This Invoice Total  : ₹1,678.95                                    │
│   • Projected Balance   : ₹1,678.95 (Within Limit ✓)                   │
├────────────────────────────────────────────────────────────────────────┤
│ TENDER DETAILS                                                         │
│   • Settlement Mode     : On Account (No immediate cash collected)     │
│   • Amount Tendered     : ₹0.00                                        │
│   • Balance Unpaid      : ₹1,678.95                                    │
├────────────────────────────────────────────────────────────────────────┤
│ [Complete Settlement (F8 / Enter)]            [Hold / Suspend (F12)]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Classification:
* `headerState.transaction === "Credit"`:
  * **Hide / Disable** the Cash Denomination Counter.
  * **Default Tender Mode** to `"On Account"` / `"Credit"`.
  * **Set Tendered Amount** to `0.00` and **Balance Unpaid** to `netAmount`.
  * Display the customer's active credit terms and credit limit headroom.

---

## 5. Credit Terms Contract

### Storage and Inheritance:
* **Customer Group Source:** `customer_groups` table in PostgreSQL.
  * `credit_limit`: Stored on `customer_groups.credit_limit` (e.g. `₹5,00,000.00` for `CG-Corporate`).
  * `credit_days`: Stored on `customer_groups.credit_days` (e.g. `60` days).
  * `grace_days`: Stored on `customer_groups.grace_days` (e.g. `0` days).
  * `credit_hold`: Stored on `customer_groups.credit_hold` (boolean).
  * `auto_block_sales`: Stored on `customer_groups.auto_block_sales` (boolean).
* **Customer Override:** `Customer.outstanding` tracks real-time debt. (Individual customer-level `credit_limit` override exists in `party_profiles` if secondary profile is linked).

### Due Date Calculation:
$$\text{Due Date} = \text{Invoice Date} + \text{Credit Days}$$
For Invoice Date `2026-09-03` with 60 credit days, the canonical due date is `2026-11-02`.

### Existing Backend Validation:
In [backend/app/services/sales.py:258](file:///f:/SMRITRretailNX/backend/app/services/sales.py#L258), the backend calls:
```python
await self.crm_service.check_credit_limit(resolved_customer_id, float(calculated_grand_total))
```
This validation is already live. If `customer.outstanding + grand_total > group.credit_limit`, it raises `HTTP 400 (SMRITI-CREDIT-001)`.

---

## 6. Outstanding / Receivable Contract

### Current State & Identified Gap:
* **Cancellation:** In [backend/app/services/sales.py:1451](file:///f:/SMRITRretailNX/backend/app/services/sales.py#L1451), `cancel_invoice` explicitly decrements `cust.outstanding`:
  ```python
  cust.outstanding = max(Decimal("0.00"), cust.outstanding - invoice.grand_total)
  ```
* **Creation Gap:** In `SalesService.create_invoice`, when `payment_mode == "CREDIT"`, `cust.outstanding` is currently **NOT incremented**. This is an architectural gap where the decrement was implemented on cancellation, but the increment on creation was overlooked.
* **General Ledger:** [backend/app/services/unified_ledger.py:437](file:///f:/SMRITRretailNX/backend/app/services/unified_ledger.py#L437) debits `Accounts Receivable (1030)`.

### Target Contract:
1. When a `CREDIT` invoice is settled (`status == "Completed"` and `payment_mode == "CREDIT"`):
   $$\text{customer.outstanding} = \text{customer.outstanding} + \text{invoice.grand\_total}$$
2. When a `CASH` / `CARD` / `UPI` invoice is completed:
   $$\text{customer.outstanding} = \text{customer.outstanding} \quad (\text{unchanged})$$
3. When a payment receipt is allocated via `PaymentsEngine.process_payment`:
   $$\text{customer.outstanding} = \text{customer.outstanding} - \text{payment.allocated\_amount}$$

---

## 7. Document Numbering Contract

### Root Cause of UAT Collision:
`BillingTerm.tsx` initializes `headerState.docNo = "1"` in React local state on page mount. Every fresh browser launch attempts `D1DS13-1`.

### Canonical Numbering Architecture:
SMRITI already has a dedicated atomic document numbering engine:
* **Service:** `DocumentsEngine.allocate_next_number_in_transaction` in [backend/app/services/documents_engine.py:103](file:///f:/SMRITRretailNX/backend/app/services/documents_engine.py#L103)
* **Endpoint:** `POST /api/v1/documents/numbering/allocate` in [backend/app/api/v1/documents.py:90](file:///f:/SMRITRretailNX/backend/app/api/v1/documents.py#L90)
* **Mechanism:** Row-level locking (`SELECT ... WITH FOR UPDATE`) on `document_series` with audit logging in `numbering_audit_logs`.

### Target Flow:
1. When `BillingTerm.tsx` loads or triggers `New Invoice`, it should either:
   * Query `POST /api/v1/documents/numbering/allocate` for `document_type="SALES_INVOICE"`, OR
   * Omit `invoice_no` in `POST /api/v1/sales/invoices` and let `SalesService` call `DocumentsEngine` automatically.
2. For testing/UAT isolation: `BillingTerm.tsx` must increment its sequence or accept unique series prefixes.

---

## 8. Idempotency Contract

### Flaw in Current Implementation:
In [backend/app/services/sales.py:87](file:///f:/SMRITRretailNX/backend/app/services/sales.py#L87):
```python
(SalesInvoice.id == invoice_id) | (SalesInvoice.invoice_no == invoice_no)
```
Using `invoice_no == invoice_no` as an idempotency filter causes the backend to silently replay an old invoice when a duplicate invoice number is submitted, masking client-side errors.

### Canonical Idempotency Rule:
1. Idempotency must be evaluated **exclusively** against the `Idempotency-Key` HTTP header (or an explicit `idempotency_key` payload attribute).
2. If an invoice number already exists, but the request does **not** match the original `idempotency_key`, the backend must raise:
   ```text
   HTTP 409 Conflict: "Invoice number 'D1DS13-1' already exists under company COMP-001."
   ```
3. This ensures that accidental duplicate document numbers fail loudly and immediately.

---

## 9. Required Product Changes

| # | File | Change Description | Classification |
|---|---|---|---|
| 1 | `src/components/billing/BillingTerm.tsx` | In `handleCompleteSettlement`, if `headerState.transaction === "Credit"`, set `payment_mode: "CREDIT"`, `paid_amount: 0.00`, and `balance_amount: summaryTotals.netAmount`. | `MISSING — NEEDS IMPLEMENTATION` |
| 2 | `src/components/billing/BillingTerm.tsx` | Pass `transaction={headerState.transaction}` to `SmritiInvoiceSettlementModal`. | `MISSING — NEEDS IMPLEMENTATION` |
| 3 | `src/components/billing/InvoiceSettlementD.tsx` | When `transaction === "Credit"`, display B2B Credit Terms banner, default tender to `"On Account"`, set tendered amount to `0.00`, and disable cash denomination counter. | `MISSING — NEEDS IMPLEMENTATION` |
| 4 | `src/components/billing/types.ts` | Add `"Credit"` and `"On Account"` to `PaymentMode` union type. | `MISSING — NEEDS IMPLEMENTATION` |
| 5 | `backend/app/services/sales.py` | In `create_sales_invoice`, atomically increment `customer.outstanding += calculated_grand_total` when `is_settled_status and payment_mode == "CREDIT"`. | `MISSING — NEEDS IMPLEMENTATION` |
| 6 | `backend/app/services/sales.py` | Remove `(SalesInvoice.invoice_no == invoice_no)` from idempotency filter; reject duplicate invoice numbers with `HTTP 409 Conflict`. | `MISSING — NEEDS IMPLEMENTATION` |
| 7 | `src/components/billing/BillingTerm.tsx` | Call `DocumentsEngine` / sequence API or auto-increment `docNo` to prevent static `D1DS13-1` collisions. | `MISSING — NEEDS IMPLEMENTATION` |

---

## 10. Required UAT Assertions

The corrected headless UAT suite (`scripts/run_b2b_billing_headless_uat.py`) must enforce the following non-negotiable assertions:

1. **Foreign Key Integrity:**
   ```python
   assert inv_cid == created_customer_id, f"Invoice customer mismatch: {inv_cid} != {created_customer_id}"
   ```
2. **Payment Mode Rigor:**
   ```python
   assert inv_mode == "CREDIT", f"Invoice payment_mode mismatch: Expected 'CREDIT', got '{inv_mode}'"
   ```
3. **Financial Accounting Balance:**
   ```python
   assert float(inv_paid or 0) == 0.0, f"Credit invoice must have paid_amount == 0.0: Actual={inv_paid}"
   assert float(inv_balance or 0) == float(inv_grand or 0), f"Credit invoice balance must equal grand_total: {inv_balance} != {inv_grand}"
   ```
4. **Customer Outstanding Increment:**
   ```python
   cur.execute("SELECT outstanding FROM customers WHERE id = %s", (created_customer_id,))
   new_outstanding = cur.fetchone()[0]
   assert float(new_outstanding) == float(inv_grand), f"Customer outstanding was not incremented: {new_outstanding} != {inv_grand}"
   ```
5. **Fresh Document Number Verification:**
   ```python
   assert created_invoice_id != previous_test_invoice_id, "Idempotency collision: Reused invoice from prior session!"
   ```
6. **PDF Binary Verification:**
   ```python
   assert resp.status == 200
   assert "application/pdf" in resp.headers.get("Content-Type", "")
   assert pdf_bytes.startswith(b"%PDF")
   assert UAT_CUSTOMER_NAME in pdf_text
   assert created_invoice_no in pdf_text
   ```

---

## 11. Risks / Open Decisions

### Decision 1: Settlement Modal UI for Credit Sales
* **Option A (Modal Adaptation):** `InvoiceSettlementStudio` stays as the single settlement modal, but when `Transaction === "Credit"`, it transforms its UI to show B2B Credit Terms (Limit, Outstanding, Due Date) and disables cash denominations.
* **Option B (Bypass Modal):** When `Transaction === "Credit"`, clicking `Settlement (F8)` directly submits the credit invoice to the ledger without displaying the multi-tender dialog.
* **Recommendation:** **Option A**. In B2B wholesale, cashiers/accountants must review the customer's remaining credit limit and payment terms before dispatching the invoice.

### Decision 2: Outstanding Balance Update Responsibility
* **Option A (In-Line in SalesService):** Update `customer.outstanding` directly inside `SalesService.create_sales_invoice` within the same database transaction.
* **Option B (Asynchronous via Outbox):** Update `customer.outstanding` via the PSV queue consumer.
* **Recommendation:** **Option A**. In-line synchronous update guarantees that immediate subsequent credit limit checks (`check_credit_limit`) reflect the new debt without eventual consistency delay.

---

## Final Status Declaration

**CREDIT CONTRACT REQUIRES PRODUCT DECISION**

*(Pending alignment on Settlement Modal UI Option A vs Option B prior to implementing frontend/backend code modifications).*
