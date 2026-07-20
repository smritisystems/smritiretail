<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.14.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan - Indian Payments & Bank Reconciliation Suite (v4.14.0)

## 1. Objective
To implement **v4.14.0 - Indian Payments & Bank Reconciliation Suite**, covering a unified UPI/PG gateway abstraction layer, dynamic QR and Intent UPI generators, wallet settlement reconcilers, bank statement parsers, and auto-matching reconciliation engines.

## 2. Business Motivation
UPI accounts for over 75% of Indian retail store transactions. Multiple payment providers (Razorpay, Paytm, Cashfree, Pine Labs) are used by retailers, requiring a unified gateway abstraction. Settlement reconciliation (reconciling gateway payouts net of MDR fees and GST against ledger entries) is a daily pain point. Finally, reconciling bank statements with sales ledgers requires automated matching logic.

## 3. Scope
- **Unified UPI/PG Abstraction Layer** (`backend/app/core/pg_gateway.py`):
  - Interface `UPIGatewayInterface` for generating dynamic UPI QRs, deeplinks, and verifying statuses.
  - Implementations for Razorpay, Paytm, and Cashfree (Mock integrations).
- **Wallet Settlement Reconciler** (`backend/app/services/wallet_reconciler.py`):
  - Reconciles gateway settlement reports against local POS receipts.
  - Calculates Merchant Discount Rate (MDR) fees and 18% GST deductions.
- **Statement Import & Bank Reconciliation Engine** (`backend/app/services/bank_reconciler.py`):
  - Parses bank statements (HDFC, ICICI, SBI formats).
  - Auto-matching engine (reference numbers, UTRs, amount matching with day tolerances).
- **Test Suite** (`backend/app/tests/test_v4_14_payments_reconciliation.py`)

## 4. Current State
In v4.13.0, we completed compliance calculations and GSTR-2B/MSME checks. Currently, local POS transactions do not have integrated digital payment gateway checks, wallet settlement reconciliations, or bank statement matching capabilities.

## 5. Gap Analysis
- No abstraction for Indian payment aggregators.
- No automated checking of gateway fees (MDR) and GST on transaction payouts.
- Bank statement uploads and matching with internal book ledgers are manual processes.

## 6. Architecture Impact
- Standardized `UPIGatewayInterface` allows the frontend or POS screen to swap payment terminals (e.g., Paytm Soundbox vs. Razorpay POS) via config.
- Ledger-to-statement auto-matcher remains pure business logic, avoiding DB-specific querying.

## 7. Proposed Design
- **PG Gateway Abstraction**:
  ```python
  class UPIGatewayInterface:
      def create_dynamic_qr(self, txn_id: str, amount: Decimal) -> str: ...
      def generate_upi_intent_string(self, amount: Decimal) -> str: ...
      def check_payment_status(self, txn_id: str) -> dict: ...
  ```
- **Wallet Reconciler**: Compares local POS transactions against gateway settlement rows, checking:
  - Discrepancies in total received.
  - Correctness of deducted gateway charge (e.g. 1.8% or 2.0% MDR + 18% GST).
- **Bank Reconciler**: Match algorithm checks transaction IDs, UTR numbers, or dates (within ±3 days) to auto-match bank transactions against ledger entries, returning matches, partial matches (amount matches but date/ref differs), and mismatches.

## 8. Files Created
- `backend/app/core/pg_gateway.py`
- `backend/app/services/wallet_reconciler.py`
- `backend/app/services/bank_reconciler.py`
- `backend/app/tests/test_v4_14_payments_reconciliation.py`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 13. Verification Plan
- Unit tests verifying payment payload formatting, dynamic QR URI validation, MDR calculations, bank statement parsing, and transaction auto-matching.

## 17. Status
Draft
