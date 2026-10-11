<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.51
  Created      : 2026-10-11
  Modified     : 2026-10-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail OS — P0 & P0.1 Billing Hardening + Modern UX

## 1. Purpose
Remediate P0 and P0.1 billing transaction reliability defects, harden offline persistence integrity, backend idempotency, statutory invoice identity validation, payment integrity, and modern UX across SMRITI retail terminals (`SmritiCreditBillingTerminal.tsx`, `ProPosBillingTerm.tsx`, `ProPosSettlementDl.tsx`, `ProPosTaxInvoiceRc.tsx`, `TaxInvoiceA4.tsx`, `SalesOrderA4.tsx`, and `ProPosOfflineSyncEngine.ts`). Specifically, ensure that transactions never report false success, carts are preserved upon failure, offline sync handles storage quota errors and corrupted records, sensitive credentials are recursively sanitized before disk storage, a read-only reconciliation endpoint is available for uncertain outcomes, statutory B2B GSTIN validation blocks non-compliant issuance, and payment verification clearly distinguishes pending, UTR-recorded, and verified states.

## 2. Scope
- **Offline Persistence Integrity (`ProPosOfflineSyncEngine.ts`):** Enforce explicit success/failure on queueing; throw `STORAGE_QUOTA_EXCEEDED` on quota failure; roll back in-memory queue if disk write fails so cart is never cleared under false durability claims; isolate corrupted storage strings to `smriti_propos_offline_corrupted_<ts>` quarantine keys; gracefully skip corrupted records; recursively sanitize sensitive credentials (passwords, tokens, CVVs, full card numbers masked to `card_last4`).
- **Backend Idempotency & Reconciliation (`backend/app/api/v1/billing.py`, `SmritiCreditBillingTerminal.tsx`):** Expose read-only `GET /api/v1/billing/reconcile/{idempotency_key}`; query `TransactionIdempotencyRecord` atomically without mutating stock or ledger; persist idempotency key in `sessionStorage` per draft to survive page reloads; wire reconciliation retry button and F6 hotkey in `SmritiCreditBillingTerminal`.
- **Statutory Identity & Validation (`ProPosTaxInvoiceRc.tsx`, `TaxInvoiceA4.tsx`, `SalesOrderA4.tsx`, `ProPosBillingTerm.tsx`, `gstEngine.ts`):** Purge all remaining hardcoded seller ("TATTLY THREADS", "27AAXFT2508H1ZR") and bank details across A4 and thermal templates; suppress fabricated SBI bank accounts when no account is configured; validate statutory B2B customer GSTIN via `parseAndValidateGSTIN` before checkout to block non-compliant tax invoice issuance; require recognized Indian State/UT code in `gstEngine.ts`.
- **Payment Integrity (`ProPosSettlementDl.tsx`):** Remove misleading "Scan Verified" badge; dynamically resolve merchant UPI VPA from authenticated tenant config (`smriti_company_upi_vpa`); introduce explicit multi-state indicators (`Awaiting Scan / UTR`, `UTR Recorded (Verify in Soundbox/App)`, `Verified`); state clearly that UPI QR generation is an initiation trigger, not debit confirmation.
- **Modern UX & Keyboard Navigation:** Preserve SIMPLE mode and 7-action rule; retain keyboard shortcuts (F2 lookup, F6 reconcile, F7 cash, F8 settlement); provide persistent checkout progress states (`DRAFT`, `PROCESSING`, `SUBMITTED`, `FAILED`, `RECONCILIATION_REQUIRED`); decouple hardware receipt printing with error boundaries.

## 3. Files Created
- `src/tests/p0BillingRemediationAndUx.test.ts` — Comprehensive 17-scenario regression test battery verifying all P0 and P0.1 transaction invariants, failure injections, and UX state transitions.

## 4. Files Modified
- `src/sync/ProPosOfflineSyncEngine.ts` — Hardened storage quota failure handling, memory rollback, corrupted record quarantine, restart recovery, and recursive payload credential sanitization.
- `backend/app/api/v1/billing.py` — Mounted `GET /api/v1/billing/reconcile/{idempotency_key}` for non-destructive transaction status queries.
- `src/components/billing/SmritiCreditBillingTerminal.tsx` — Added sessionStorage idempotency key persistence, `handleReconcileInvoice` handler, actionable error banners, loading indicators, and F6 reconciliation shortcut.
- `src/components/billing/propos/ProPosBillingTerm.tsx` — Enforced statutory B2B customer GSTIN validation, offline queueing with cart preservation, online-only tender gating, and double-submit prevention.
- `src/components/billing/propos/ProPosSettlementDl.tsx` — Removed false "Scan Verified" badge, added multi-stage UPI status indicators, and resolved merchant UPI VPA dynamically.
- `src/components/billing/propos/ProPosTaxInvoiceRc.tsx` — Purged hardcoded seller fallbacks in compact thermal slip layout and isolated printer exceptions.
- `src/components/templates/TaxInvoiceA4.tsx` — Removed hardcoded SBI bank account details, fallback GSTINs, and fabricated addresses.
- `src/components/templates/SalesOrderA4.tsx` — Replaced hardcoded supplier name, GSTIN, address, bank, and watermark with dynamic getters.
- `src/utils/gstEngine.ts` — Enforced recognized Indian State/UT code validation in `parseAndValidateGSTIN`.

## 5. Architecture Decisions
- **ADR-P0-BILLING-001 (Strict Server Confirmation Authority):** Client terminals must never transition transaction document status to `SUBMITTED` unless an authoritative HTTP 200/201 response containing `invoice_no` is received from FastAPI. Network drops transition document state to `RECONCILIATION_REQUIRED` while retaining cart items.
- **ADR-P0-BILLING-002 (Single-Draft Idempotency Retention & Non-Destructive Reconciliation):** A stable UUID idempotency key is bound to the active draft cart and retained in `sessionStorage` across network retries and reloads. Uncertain checkout outcomes are reconciled via `GET /billing/reconcile/{key}` rather than speculative checkout retries.
- **ADR-P0-BILLING-003 (Durable Offline Queue with Tender Gating & Rollback):** Offline checkout is strictly restricted to cash and physical card tenders. If local storage quota is exceeded, `STORAGE_QUOTA_EXCEEDED` is thrown and memory is rolled back so the cashier's cart is preserved.
- **ADR-P0-BILLING-004 (Statutory Tenant Identity Dynamic Derivation & B2B GSTIN Guard):** All receipt templates resolve seller and branch details dynamically. Issuance of B2B tax invoices is blocked when the customer GSTIN fails format or State/UT code validation.
- **ADR-P0-BILLING-005 (Payment State Integrity):** Entering a UTR or displaying a QR code transitions state to `UTR Recorded (Manual Verification)` and must never be displayed as verified without gateway confirmation.

## 6. Design Rationale
In high-volume retail environments, silent failure or false success causes severe inventory discrepancies and financial leaks. If storage quota is exceeded and the error is swallowed, clearing the cart leads to permanent loss of customer sales upon browser restart. Similarly, displaying static bank details or fabricated buyer addresses exposes merchants to statutory tax penalties under Section 31 of the CGST Act. Non-destructive reconciliation ensures cashier confidence during network instability without creating duplicate sales.

## 7. Implementation Summary
1. **Durable Offline Storage & Rollback:** `ProPosOfflineSyncEngine.queueOfflineSale` checks storage persistence. If `localStorage` is unavailable or disabled, it throws `STORAGE_UNAVAILABLE`. If `localStorage.setItem` throws a quota error, it rolls back memory and throws `STORAGE_QUOTA_EXCEEDED`. The POS catch block displays an error and preserves the cart without false claims of durability.
2. **Corrupted Record Isolation & Legacy Sanitization:** `loadStorage` isolates malformed JSON into `smriti_propos_offline_corrupted_<ts>` and clears the queue key, preventing repeated crashes on application restart. Furthermore, legacy records loaded from disk are actively sanitized before being placed into memory.
3. **Recursive Credential Sanitization & PAN Masking:** `sanitizePayloadForOfflineStorage` recursively purges tokens, passwords, secrets, CVVs, and masks card numbers to `card_last4`. It also scans arbitrary string fields for embedded 13-19 digit PAN strings and replaces them with `****-****-****-1234`.
4. **Backend Idempotency & Non-Destructive Reconciliation:** Mounted `GET /api/v1/billing/reconcile/{idempotency_key}` in FastAPI. Returns explicit `is_committed: false` and honest guidance on `NOT_FOUND` (informing the cashier that absent records at query time do not guarantee in-flight requests cannot arrive later, advising retention of the stable key on retry). Atomicity and concurrency protection are guaranteed by PostgreSQL transaction advisory locks (`TransactionIntegrityEngine.try_acquire_advisory_lock`) and database-level unique constraint `uq_tx_idemp_tenant_key`.
5. **Authoritative Statutory Profile Enforcement:** Defaulted all store profile fields to empty strings (removing dummy fallbacks like "Retail Store", "Mumbai", "Maharashtra", "Authorized Supplier", "Main Office / Plant", "N/A"). In `ProPosBillingTerm.tsx`, checkout is blocked with an explicit error if company name or address is unconfigured. For B2B tax invoices, checkout is blocked if seller GSTIN is missing or invalid.
6. **Honest Payment State UI & Cashier Soundbox Confirmation:** In `ProPosSettlementDl.tsx`, entering a UTR does NOT mark payment verified. Added cashier confirmation checkbox `isSoundboxVerified` requiring explicit audio prompt/banking app confirmation to transition to `Verified (Soundbox Confirmed)`. Otherwise, status is displayed as `UTR Recorded (Verification Pending)`.
7. **Decoupled Hardware Printing:** Isolated hardware receipt printing failures from invoice commitment so print errors never report transaction failure.

## 8. Tests Executed
- `src/tests/p0BillingRemediationAndUx.test.ts` (22 tests, Vitest) — 22/22 PASSED
  - Scenario 1: Successful credit checkout transitions to SUBMITTED and captures server confirmation.
  - Scenario 2: Credit limit rejection marks FAILED, shows error, and preserves cart.
  - Scenario 3: Network failure never marks SUBMITTED and flags RECONCILIATION_REQUIRED.
  - Scenario 4: Timeout retains stable idempotency key for safe retry.
  - Scenario 5: Duplicate submit prevention blocks concurrent API calls.
  - Scenario 6: Offline sale persistence and restart recovery.
  - Scenario 7: Offline queue deduplication and multi-queue handling.
  - Scenario 8: Dynamic tenant seller and buyer resolution.
  - Scenario 9: Responsive status indicators and loading state.
  - Scenario 10: Printer failure isolation from committed invoice.
  - Scenario 11: Storage quota exceeded throws STORAGE_QUOTA_EXCEEDED and rolls back memory.
  - Scenario 12: Corrupted record quarantine and graceful skip.
  - Scenario 13: Sensitive payment payload sanitization (CVV, password, card PAN masked).
  - Scenario 14: Safe read-only reconciliation endpoint verification.
  - Scenario 15: Statutory B2B GSTIN validation rejection for invalid GSTIN.
  - Scenario 16: Dynamic bank details suppression and merchant UPI VPA resolution.
  - Scenario 17: UPI payment verification distinct states (Awaiting Scan vs UTR Recorded vs Verified).
  - Scenario 18: Storage unavailable/quota error throws and performs hard memory queue rollback.
  - Scenario 19: Deep recursive credential purging and string value PAN pattern masking.
  - Scenario 20: Legacy unsanitized stored record sanitization upon disk recovery.
  - Scenario 21: Authoritative company profile validation blocks statutory invoice issuance when missing/invalid.
  - Scenario 22: Reconcile endpoint returns honest NOT_FOUND guidance advising retention of stable key.
- `src/tests/p0BillingRemediationAndUx.test.ts` (27 tests, Vitest) — 27/27 PASSED (including Scenarios 23-27 for P0.3 item master coverage, manual UPI attestation, and missing price/tax rejection).
- `backend/app/tests/test_p03_missing_items_and_integrity.py` (15 tests, Pytest against isolated PostgreSQL) — 15/15 PASSED.
- `backend/app/tests/test_billing.py` (10 tests, Pytest against isolated PostgreSQL) — 10/10 PASSED.
- `backend/app/tests/test_phase2_headless_billing.py` (18 tests, Pytest against isolated PostgreSQL) — 18/18 PASSED.
- Architecture Duplication Gate: `python scripts/architecture_duplication_gate.py` — PASSED (0 violations, 0 debt).
- UX Field Governance Guard: `python scripts/ci_ux_field_governance_guard.py` — PASSED (0 violations, 100% parity).
- Python Syntax / Bytecode Compiler: `python -m py_compile backend/app/services/canonical_sales_writer.py backend/app/services/headless_billing.py` — 0 errors (exited with code 0).
- TypeScript Compiler: `npx tsc --noEmit` — 0 errors (exited with code 0).

## 9. Verification Results
- **P0.3 Backend Integration Tests:** 43 tests across 3 backend suites (`test_p03_missing_items_and_integrity.py`, `test_billing.py`, `test_phase2_headless_billing.py`) — **43/43 PASSED (100% GREEN)** against ephemeral PostgreSQL databases.
- **Frontend Remediation Tests:** 27 tests in `p0BillingRemediationAndUx.test.ts` — **27/27 PASSED (100% GREEN)**.
- **Total Test Count:** **70/70 PASSED, 0 FAILURES**.
- **Live Database Isolation:** Verified — Ephemeral PostgreSQL database fixtures via NullPool; zero mutations written to production database.
- **Headless Evidence Generated:**
  - `artifacts/headless-billing/rendered_react_ui_item_not_found.png` (Rendered React UI)
  - `artifacts/headless-billing/rendered_react_ui_upi_manual_attestation.png` (Rendered React UI)
  - `artifacts/headless-billing/rendered_react_ui_tax_invoice_receipt.png` (Rendered React UI)
  - `artifacts/headless-billing/synthetic_headless_billing_cycle_trace.png` (Synthetic Flow Trace)
  - `artifacts/headless-billing/synthetic_headless_billing_cycle_trace.svg` (Synthetic Flow Trace Source)
  - `artifacts/headless-billing/test_results.json` (Machine-readable results)

## 10. Known Limitations & Outstanding Risks
- **Cashier Field Validation:** Physical hardware cashier workflow validation (barcode handheld scanner, physical POS printer, and soundbox speaker) remains pending real on-premise staging tests.
- **Production Release Status:** **RELEASE ON HOLD** per governance rules until physical cashier terminal hardware validation is completed in staging.

## 11. Future Work
- Deploy staging environment on `F:\Smriti9` via git pull (strictly following DEV vs TEST environment rules) for final cashier hardware end-to-end dry run.
- Add hardware cash drawer kick-out verification via WebUSB / WebSerial.

## 12. Related ADRs
- ADR-042: Canonical Sales Posting Architecture
- ADR-045: Universal In-Memory Store & Legacy Route Retirement
- ADR-P0-BILLING-001: Strict Server Confirmation Authority

## 13. Related RFCs
- RFC-8594: Sunset & Deprecation HTTP Headers
- RFC-4180: Common Format and MIME Type for CSV Files
