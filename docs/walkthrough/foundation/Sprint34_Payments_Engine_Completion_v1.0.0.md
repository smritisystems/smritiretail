<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Sprint 34 — Section 7 Shared Business Engines: Payments Engine Completion

**Document ID:** `WGP-FOUNDATION-SPRINT34-V1.0.0`  
**Version:** `1.0.0`  
**Date:** `2026-08-25`  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Status:** `Completed / Verified`

---

## 1. Purpose
This walkthrough documents the design, architecture, implementation, and verification of **Sprint 34: Section 7 Shared Business Engines: Payments Engine Completion**. It delivers an authoritative, transactional Payments Engine within the FastAPI + PostgreSQL system of record, supporting multi-tender split payments, strict idempotency token deduplication, full and partial refund processing with over-refund guards, multi-invoice dynamic allocations, and official structured receipt generation.

---

## 2. Scope
- **Multi-Tender Methods**: Supporting 9 core payment tender types (`CASH`, `CARD`, `UPI`, `NETBANKING`, `WALLET`, `CREDIT_NOTE`, `CHEQUE`, `LOYALTY_POINTS`, `BANK_TRANSFER`).
- **Atomic Split Settlements**: Processing payments split across multiple payment methods with automatic `PaymentAllocation` creation.
- **Idempotency Guarantees**: Enforcing unique `idempotency_key` checks to return existing records and avoid duplicate billing or duplicate settlement postings.
- **Refunds & Reversals**: Enabling full and partial refunds linked to original payment transactions with balance tracking and reason auditing.
- **Dynamic Multi-Invoice Allocation**: Distributing unallocated payment balances across multiple open invoices with limit validation.
- **Payment Receipts**: Compiling authoritative structured receipts with tender breakdowns, transaction IDs, and settlement links.
- **REST Endpoints**: Full REST router mounted at `/api/v1/payments/*`.
- **Automated Verification**: End-to-end integration test suite (`backend/tests/t_payments.py`) and full 87-test platform regression.

---

## 3. Files Created
1. [`backend/app/schemas/payments.py`](file:///F:/SMRITRretailNX/backend/app/schemas/payments.py) — Pydantic schemas for multi-tender payments, refunds, allocations, receipts, and queries.
2. [`backend/app/services/payments_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/payments_engine.py) — Payments service engine implementing atomic multi-tender processing, idempotency gating, refunds, allocations, and receipts.
3. [`backend/app/api/v1/payments.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/payments.py) — REST API router mounted at `/api/v1/payments`.
4. [`backend/tests/t_payments.py`](file:///F:/SMRITRretailNX/backend/tests/t_payments.py) — Comprehensive 6-test integration suite.
5. [`docs/walkthrough/foundation/Sprint34_Payments_Engine_Completion_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint34_Payments_Engine_Completion_v1.0.0.md) — This walkthrough document.

---

## 4. Files Modified
1. [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py) — Mounted `payments.router` at `/api/v1/payments`.
2. [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Certified Section 7 Payments Engine as `Done / Verified` per Rule 11.
3. [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 34 to Master Walkthrough Index.
4. [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Logged `v3.50.0` release notes.

---

## 5. Architecture Decisions
1. **Idempotency-First Transaction Model**: All payment execution requests require an `idempotency_key`. The engine guarantees that multiple identical calls return the original result without inserting duplicate `PaymentTransaction` rows or duplicate ledger entries.
2. **Atomic Multi-Tender Splitting**: A single customer settlement can be split across any combination of tender types (e.g. ₹500 Cash + ₹700 UPI) while linking each to the same reference invoice.
3. **Refund Balance Tracking**: Refund transactions are recorded with `reference_doc_type = "PAYMENT_REFUND"` linked to the original transaction ID. Sum of refunds is validated against the original amount to prevent over-refunding.

---

## 6. Design Rationale
- **Decimal Precision**: All currency calculations use Python `Decimal` with 2 decimal places and `ROUND_HALF_UP` rounding.
- **Decoupled Allocation Engine**: Payments can be auto-allocated upon creation or accepted as advance payments and allocated later across multiple invoices via `/allocate`.

---

## 7. Implementation Summary
- **Pydantic Schemas**: Modeled `ProcessPaymentRequest`, `MultiTenderPaymentResponse`, `PaymentRefundRequest`, `PaymentRefundResponse`, `PaymentAllocationRequest`, and `PaymentReceiptResponse`.
- **PaymentsEngine Service**:
  - `process_payment`: Atomic transaction and allocation logging with idempotency deduplication.
  - `process_refund`: Refund execution with remaining balance calculations and over-refund guard.
  - `allocate_payment`: Distributed allocation linking payment transaction to invoice ID.
  - `generate_payment_receipt`: Structured receipt compilation.
  - `query_transactions`: Filtered ledger queries.
- **REST Endpoints**:
  - `POST /api/v1/payments/process`
  - `POST /api/v1/payments/refund`
  - `POST /api/v1/payments/{payment_id}/allocate`
  - `GET /api/v1/payments/receipt/{reference_doc_id}`
  - `GET /api/v1/payments/transactions`

---

## 8. Tests Executed
```powershell
# Payments Engine Integration Suite (6 tests)
python -m pytest tests/t_payments.py -v

# Full Platform Regression Suite (87 tests)
python -m pytest tests/t_payments.py tests/t_promotions.py tests/t_pricing_engine.py tests/t_stock_acct.py tests/t_item_master.py tests/t_party_master.py tests/t_tx_reproduce.py tests/t_gov_logic.py tests/t_workspace_ui.py tests/t_cap_registry.py tests/t_ctrl_ref.py tests/t_reports_parity.py -v
```

---

## 9. Verification Results
```text
============================== 87 passed in 52.68s ==============================
- Multi-Tender Split Payment Processing: PASSED
- Idempotency Key Duplicate Prevention: PASSED
- Full & Partial Refund with Balance Guard: PASSED
- Payment Allocation Across Invoices: PASSED
- Payment Receipt Generation: PASSED
- REST API Payments Endpoints: PASSED
- Full Platform Regression: 87/87 PASSED (100% Green)
```

---

## 10. Known Limitations
- External payment gateway webhook signature verifications for online providers (e.g. Razorpay, Pine Labs) are configured per integration gateway in `backend/app/services/integration_hub.py`.

---

## 11. Future Work
- **Sprint 35**: Section 7 Documents Engine Completion (document types/categories/lifecycles, templates, rendering, printing, numbering, version binding).
- **Sprint 36**: Section 7 Fulfillment Engine Completion.
- **Sprint 37**: Section 7 Barcode and Labels Engine Completion.

---

## 12. Related ADRs
- `ADR-0021`: Authoritative System of Record in FastAPI + PostgreSQL.
- `ADR-0024`: Multi-Tender Settlement and Idempotency Architecture.

---

## 13. Related RFCs
- `RFC-2026-08`: Authoritative Payment Transaction Ledger & Allocation Reconciliation.
