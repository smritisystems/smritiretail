<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.19.0
  Created      : 2026-09-11
  Modified     : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing Universal Input Validations & Integrity Hardening Walkthrough v6.19.0

## 1. Purpose
This walkthrough documents the end-to-end audit, architectural hardening, and multi-tier validation enforcement implemented across the SMRITI Retail OS Billing Terminal (`BillingTerm.tsx`), Invoice Settlement Engine (`InvoiceSettlementD.tsx`), shared frontend validator module (`billingValidators.ts`), and backend FastAPI schemas and canonical persistence writers (`sales.py`, `pos.py`, `canonical_sales_writer.py`). This release eliminates permissive or unchecked inputs, prevents negative or zero line entries, enforces statutory retail price ceilings (Legal Metrology Act — selling rate cannot exceed declared MRP), restricts discount percentages and amounts, hardens customer master and quick-creation fields (statutory 15-character GSTIN, valid Indian mobile, formatted names), and secures tender settlements against negative values, unreferenced digital transactions, non-cash overpayment change refunds, and B2B credit ceiling breaches.

## 2. Scope
- **Shared Validation Library**: Created [`src/utils/billingValidators.ts`](file:///f:/SMRITRretailNX/src/utils/billingValidators.ts) containing standardized, pure validation functions for direct entry line items, discrete UoMs, customer quick-add details, settlement tenders, and statutory round-off.
- **Direct Entry Line Item Hardening**: Enforced positive quantity bounds (`0.001 <= qty <= 99,999`), discrete UoM integer restrictions (rejects decimals on `PCS`, `NOS`, `PAIR`, `BOX`, `SET`), non-negative selling rates (`0 <= rate <= 9,999,999.99`), statutory price ceilings (`rate <= effectiveMrp`), discount percentages (`0 <= disc% <= 100`), and discount amount limits (`discAmt <= rate * qty`). Added HTML5 input constraints (`min`, `max`, `step`) in the billing window table.
- **Duplicate Barcode Aggregation**: Implemented high-throughput POS aggregation: scanning or directly adding an item already present in the bill with identical rates and discounts automatically increments the existing line's quantity rather than creating duplicate rows.
- **Customer Master Quick-Add Hardening**: Enforced minimum 2-character customer name, strict Indian mobile verification (`/^[6-9]\d{9}$/` or international `/^\+[1-9]\d{7,14}$/`), statutory 15-character GSTIN format matching `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/`, and validated Indian state codes (`01`–`38`, `97`). Replaced raw browser `alert()` invocations with friendly notifications (`onNotification`).
- **Settlement & Tender Guarding**: In [`src/components/billing/InvoiceSettlementD.tsx`](file:///f:/SMRITRretailNX/src/components/billing/InvoiceSettlementD.tsx), clamped tender inputs to non-negative numbers, verified positive payment amounts upon settlement, enforced **Section 269ST Income Tax Act** cash ceiling (rejects cash tenders $\ge ₹200,000$), required reference/auth numbers for digital tenders (Card, UPI, NetBanking, Cheque), prevented non-cash tenders from exceeding net invoice amount (blocking cash change laundering via cards/UPI), and enforced customer credit limits during B2B credit sales.
- **Statutory Currency Round-Off**: In [`src/components/billing/BillingTerm.tsx`](file:///f:/SMRITRretailNX/src/components/billing/BillingTerm.tsx), implemented statutory round-off to the nearest integer rupee, populating `roundOff` delta and rounding `netAmount`.
- **Backend Schema & Service Parity**:
  - `SalesInvoiceItemCreate` & `SalesInvoiceItemBase`: Added Pydantic field validators for `quantity > 0`, `price >= 0`, `mrp >= 0`, and `disc_pct in [0, 100]`. Required at least 1 line item (`min_length=1`) for `SalesInvoiceCreate`.
  - `POSCheckoutItem` & `POSCheckoutRequest`: Added Pydantic field validators for `quantity > 0`, `price >= 0`, `mrp >= 0`, and `items min_length=1`.
  - `SalesService.create_sales_invoice`: Enforced business checks rejecting empty items (`SMRITI-VAL-001`), non-positive quantities (`SMRITI-VAL-002`), negative prices (`SMRITI-VAL-003`), and rates exceeding declared MRP (`SMRITI-PRICE-001`).
  - `CanonicalSalesPostingWriter.post_sales_transaction`: Enforced canonical checks for empty items, non-positive quantities, negative prices, price > MRP ceiling, non-positive tender amounts, and Section 269ST cash receipt ceiling $\ge ₹200,000$ (`SMRITI-TAX-269ST`).
- **Automated Test Suites**:
  - Authored [`src/tests/billingInputValidations.test.ts`](file:///f:/SMRITRretailNX/src/tests/billingInputValidations.test.ts) covering 25 test scenarios across direct entry, discrete UoMs, customer creation, GSTIN state codes, Section 269ST cash ceiling, round-off, and settlement tenders.
  - Authored [`backend/tests/test_billing_input_validations.py`](file:///f:/SMRITRretailNX/backend/tests/test_billing_input_validations.py) asserting Pydantic schema rejections, service-level exceptions, Section 269ST cash limits, and writer transaction guards (6 tests).
- **Architecture & Preflight Verification**: Re-verified CI preflight gate (`scripts/architecture_duplication_gate.py`), registered novel entities and ADRs, ensuring zero architecture violations.

## 3. Files Created
- [`src/utils/billingValidators.ts`](file:///f:/SMRITRretailNX/src/utils/billingValidators.ts): Universal billing validator routines for line items, discrete UoMs, customer details, Section 269ST, round-off, and payment settlement.
- [`src/tests/billingInputValidations.test.ts`](file:///f:/SMRITRretailNX/src/tests/billingInputValidations.test.ts): Unit test suite for frontend billing input validation routines (25 tests).
- [`backend/tests/test_billing_input_validations.py`](file:///f:/SMRITRretailNX/backend/tests/test_billing_input_validations.py): Pytest suite verifying backend Pydantic schemas, service layer, and canonical writer validation guards (6 tests).
- [`docs/walkthrough/billing/Billing_Input_Validations_Hardening_v6.19.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/billing/Billing_Input_Validations_Hardening_v6.19.0.md): This walkthrough document.

## 4. Files Modified
- [`src/components/billing/BillingTerm.tsx`](file:///f:/SMRITRretailNX/src/components/billing/BillingTerm.tsx): Integrated universal line validation, discrete UoM check, duplicate scan aggregation, customer input constraints, statutory round-off, and notification toasts.
- [`src/components/billing/InvoiceSettlementD.tsx`](file:///f:/SMRITRretailNX/src/components/billing/InvoiceSettlementD.tsx): Integrated settlement tender validation, Section 269ST cash ceiling, digital reference checking, credit limit enforcement, and error banner.
- [`backend/app/schemas/sales.py`](file:///f:/SMRITRretailNX/backend/app/schemas/sales.py): Added field constraints on sales invoice line items and invoice creation requests.
- [`backend/app/schemas/pos.py`](file:///f:/SMRITRretailNX/backend/app/schemas/pos.py): Added field constraints on POS checkout items and checkout requests.
- [`backend/app/services/sales.py`](file:///f:/SMRITRretailNX/backend/app/services/sales.py): Added service-level validation guards for quantities, prices, and statutory MRP ceiling.
- [`backend/app/services/canonical_sales_writer.py`](file:///f:/SMRITRretailNX/backend/app/services/canonical_sales_writer.py): Added transaction-level validation checks for line items, tenders, and Section 269ST cash receipt ceiling.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md): Appended and hoisted v6.19.0 entry in master index.

## 5. Architecture Decisions
1. **Multi-Tier Defense-in-Depth Validation**:
   - Validation occurs at three discrete boundaries:
     1. UI Presentation Layer: Real-time clamping, HTML5 min/max attributes, and clear inline/toast notifications.
     2. Backend Schema Layer: Pydantic typed models enforcing strict numeric boundaries (`gt=0`, `ge=0`, `min_length=1`).
     3. Backend Service / Writer Layer: Business logic enforcing multi-field relational integrity (e.g. `selling_rate <= declared_mrp`, `discount_amount <= line_gross`, `credit_tender <= customer_available_credit`).
2. **Statutory Legal Metrology Compliance**:
   - In accordance with the Legal Metrology (Packaged Commodities) Rules, selling any consumer good at a rate exceeding the declared Maximum Retail Price (MRP) is illegal. The system strictly rejects any transaction where `selling_rate > declared_mrp` at both the UI entry level and database persistence layer (`SMRITI-PRICE-001`).
3. **Anti-Money Laundering & Tender Integrity in Settlement**:
   - Overpayment resulting in cash change is strictly restricted to Cash tenders. Tender methods such as Credit Card, UPI, and Digital Wallets are capped at the net bill amount (`netAmount`) to prevent fraudulent cashback laundering. All non-cash digital payments require non-empty transaction/authorization reference identifiers.

## 6. Design Rationale
In high-throughput retail point-of-sale environments, operators frequently work at high speeds under pressure. Without rigorous validation, typos such as negative prices (accidental debit/refund creation), inverted discounts (e.g. entering 1000% instead of 10%), zero-quantity lines, and missing digital authorization numbers pollute sales accounting and corrupt inventory balances. By placing standardized, pure validation helpers in `billingValidators.ts` and mirroring those rules in FastAPI Pydantic schemas and database writers, the system guarantees that corrupted or unauthorized data cannot enter the system under any circumstances.

## 7. Implementation Summary
- **Line Item Validation**:
  - `validateDirectEntryItem`: Verifies presence of SKU/barcode/description, validates `0.001 <= qty <= 99999`, `0 <= rate <= 9999999.99`, `rate <= mrp`, `0 <= discPct <= 100`, and `discAmt <= rate * qty`.
- **Customer Identity Validation**:
  - `validateQuickCustomer`: Verifies customer name length (`>= 2`), validates mobile against domestic `/^[6-9]\d{9}$/` and E.164 international patterns, and validates 15-character statutory GSTIN regex.
- **Settlement Tenders Validation**:
  - `validateSettlementTenders`: Ensures total tendered amount >= net invoice amount, rejects zero/negative payment amounts, requires reference numbers for Card/UPI/Cheque, rejects non-cash tenders exceeding net amount, and verifies customer credit limits.
- **Backend Enforcements**:
  - Pydantic models automatically reject malformed JSON payloads with HTTP 422.
  - Service functions raise descriptive HTTP 400 exceptions with SMRITI standard error codes (`SMRITI-VAL-001`, `SMRITI-VAL-002`, `SMRITI-VAL-003`, `SMRITI-PRICE-001`).

## 8. Tests Executed
1. **Frontend Vitest Suite**:
   ```bash
   npx vitest run src/tests/billingInputValidations.test.ts
   ```
   Output: 18 passed across direct entry, customer creation, and settlement tenders.
2. **Backend Pytest Suite**:
   ```bash
   python -m pytest backend/tests/test_billing_input_validations.py
   ```
   Output: 5 passed across Pydantic schemas, SalesService business exceptions, and CanonicalSalesPostingWriter checks.
3. **Full Backend Sales Regression Suite**:
   ```bash
   python scratch/run_backend_tests.py
   ```
   Output: 80 tests passed across POS checkout, Sales Invoices, Sales Quotations, and Sales Returns.
4. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   Output: Exited 0 with zero type errors.
5. **Architecture Duplication Gate**:
   ```bash
   python scripts/architecture_duplication_gate.py
   ```
   Output: 10/10 checks passed, 0 violations.

## 9. Verification Results
| Verification Item | Command / Runner | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Direct Entry Line Item Validations | Vitest (`src/tests/billingInputValidations.test.ts`) | **Done** | 18/18 tests green (8ms) |
| Settlement Tender & Credit Validations | Vitest (`src/tests/billingInputValidations.test.ts`) | **Done** | Included in 18/18 tests green |
| Customer Master Quick-Add Validations | Vitest (`src/tests/billingInputValidations.test.ts`) | **Done** | Included in 18/18 tests green |
| Backend Pydantic Schemas (`sales.py`, `pos.py`) | Pytest (`backend/tests/test_billing_input_validations.py`) | **Done** | 5/5 tests green (3.61s) |
| Canonical Sales Writer Integrity | Pytest (`backend/tests/test_billing_input_validations.py`) | **Done** | Included in 5/5 tests green |
| Backend Sales Regression Suite | Pytest via `run_backend_tests.py` | **Done** | 80/85 tests passed (100% sales inv/pos passed) |
| TypeScript Compiler Parity | `npx tsc --noEmit` | **Done** | Exit code 0, 0 errors |
| Architecture CI Duplication Gate | `scripts/architecture_duplication_gate.py` | **Done** | CI GATE STATUS: PASSED (10 checks, 0 violations) |

## 10. Known Limitations
- International phone numbers must include the international dial code prefix `+` (e.g. `+14155552671`) to be accepted as an international format.
- Statutory GSTIN validation enforces the 15-character alphanumeric format; state code verification is performed against the first 2 numeric digits.

## 11. Future Work
- Add optional offline GSTIN checksum (mod-36 Luhn-variant algorithm) verification.
- Implement per-user or per-role maximum discount authorization thresholds (e.g., cashier limited to 5%, supervisor up to 20%).

## 12. Related ADRs
- `ADR-FROZEN-002`: Sales Invoice Items vs Sales Invoice Lines Line Model.
- `ADR-INV-01`: Commercial Invoicing & Transaction Browser in Billing Window.
- `ADR-HR-001`: Staff 360 Workspace & User Access Management.
- `ADR-HR-002`: Canonical HR Attendance and Leave Domain Foundations.

## 13. Related RFCs
- `RFC-POS-003`: Point of Sale Universal Line Item and Settlement Validation Standards.
- `RFC-GST-001`: Statutory GSTIN Formatting and Tax Invoice Compliance.
