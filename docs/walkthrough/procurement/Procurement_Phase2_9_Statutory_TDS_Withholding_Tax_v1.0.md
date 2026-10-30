<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Document ID: WT-PROC-009
  * Version    : 1.0.0
  * Created    : 2026-10-02
  * Modified   : 2026-10-02
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI Procurement Phase 2.9 — Statutory Withholding Tax (TDS on Purchase & Payments — Section 194Q / 194C / 194J) & GL Account 2030 Integration

> **Document ID:** `WT-PROC-009`  
> **Topic:** Statutory Withholding Tax (TDS) on Purchase & Payments & GL Account 2030 Integration  
> **Area:** Procurement / Finance / Taxation  
> **Version:** `v1.0.0` (Target SSOT: `v6.51.0`)  
> **Status:** Completed  
> **Related Implementation Plan:** [`Procurement_Phase2_9_Statutory_TDS_Withholding_Tax_Plan_v1.0.md`](../../implementation/procurement/Procurement_Phase2_9_Statutory_TDS_Withholding_Tax_Plan_v1.0.md)

---

## 1. Purpose

The objective of Phase 2.9 is to establish full Indian Statutory Withholding Tax (Tax Deducted at Source — TDS) compliance under the Income Tax Act, 1961, within the SMRITI Retail OS procurement and accounts payable lifecycle.

Prior to Phase 2.9, supplier payments and purchase bills handled gross trade payables (Account 2010 AP) and advance liabilities (Account 2050) without automatic withholding tax deduction or penal rate branching. Phase 2.9 introduces `StatutoryTdsEngine` to automatically compute withholding across Sections 194Q, 194C, 194J, and 194H, strictly enforce Section 206AA penal rates for invalid/missing PAN, register `Account 2030 (TDS / Withholding Tax Payable)`, and generate balanced, symmetrical double-entry General Ledger journal vouchers with zero cash leakage.

---

## 2. Scope

1. **Statutory TDS Computation Engine (`StatutoryTdsEngine`)**:
   - PAN regex validation (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`).
   - 4th character PAN entity classification (`C` = Company, `P` = Individual, `H` = HUF, `F` = Partnership/LLP, `T` = Trust, `A`/`B`/`L`/`J`/`G` = Other).
   - Standard statutory rates: Section 194Q (0.10%), Section 194C (1.00% Ind/HUF, 2.00% Company/Firm), Section 194J (2.00% technical, 10.00% professional), Section 194H (5.00%).
   - Section 206AA penal rates: 5.00% for Section 194Q; 20.00% for Sections 194C, 194J, 194H if PAN is missing or invalid.
   - Threshold tracking for Section 194Q (₹50,00,000 in a financial year).
2. **Chart of Accounts 2030 Integration**:
   - Registered `Account 2030: TDS / Withholding Tax Payable` under Current Liabilities (`2000`) in `DEFAULT_CHART_OF_ACCOUNTS` and company DB seeding.
3. **Double-Entry GL Posting & Reversal Extensions**:
   - Purchase Bill booking: `DR 1040/GST = CR 2010 (Net AP) + CR 2030 (TDS Withheld)`. Supplier outstanding increments strictly by Net AP.
   - Symmetrical Purchase Bill reversal: cancels `2030` and `2010` credit lines.
   - Supplier Payment disbursement: `DR 2010 (Gross Settled) = CR 1010/1020 (Net Disbursement) + CR 2030 (TDS Withheld)`.
   - Symmetrical Payment reversal: reverses `2030` and cash accounts.
   - Standalone TDS adjustment vouchers: `DR 2010 (AP) = CR 2030 (TDS Payable)` with ₹0.00 cash movement.
4. **REST APIs & DTOs**:
   - `POST /api/v1/vendors/tds/calculate` and `POST /api/v1/purchase/vendors/tds/calculate`.
   - `GET /api/v1/vendors/{vendor_id}/tds-summary` and `GET /api/v1/purchase/vendors/{vendor_id}/tds-summary`.
   - Extended `SupplierPaymentCreate` and `SupplierPaymentResponse` with `tds_amount`, `tds_section`, and `tds_rate`.
5. **Frontend UI Integration**:
   - 4-column summary ribbon in `VendorPayablesTab.tsx` and `StandaloneVendorPayablesPreview.tsx` displaying Gross AP (2010), Supplier Advances (2050), Net Settlement Position, and Statutory TDS Withheld (Account 2030).
   - Real-time badges for statutory rate (`Sec 194Q (0.10%)` or `Sec 206AA (5%)`) and PAN validation indicator.

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/schemas/tds.py` | Pydantic schemas for calculation request/result and vendor FY summary response |
| `backend/app/services/tds_engine.py` | Canonical `StatutoryTdsEngine` with PAN validation, entity classification, and Section 206AA branching |
| `backend/app/tests/test_statutory_tds_engine.py` | Complete automated pytest suite (10/10 tests green) |
| `scripts/capture_vendor_360_statutory_tds_headless.py` | Headless Playwright capture script for visual evidence |
| `docs/walkthrough/procurement/evidence/vendor_360_statutory_tds_overview.png` | Programmatic visual evidence: full studio overview |
| `docs/walkthrough/procurement/evidence/vendor_360_statutory_tds_card_focus.png` | Programmatic visual evidence: focused 4-card financial ribbon |

---

## 4. Files Modified

| File | Changes Made |
|---|---|
| `backend/app/schemas/supplier_payment.py` | Added `tds_amount`, `tds_section`, `tds_rate` to payment create and response DTOs |
| `backend/app/services/supplier_payment.py` | Added note tag serialization `__TDS_AMOUNT__`, GL forwarding, and response field attachment |
| `backend/app/services/unified_ledger.py` | Added Account 2030 to `DEFAULT_CHART_OF_ACCOUNTS`, integrated TDS into `post_purchase_bill_to_gl`, `reverse_purchase_bill_gl`, `post_supplier_payment_to_gl`, `reverse_supplier_payment_gl`, added standalone TDS deduction methods and `get_vendor_tds_summary` |
| `backend/app/api/v1/vendor.py` | Mounted `/tds/calculate` and `/{vendor_id}/tds-summary` endpoints |
| `src/types/vendor.ts` | Added `TdsVendorSummary` interface and updated version to `6.51.0` |
| `src/components/vendor/tabs/VendorPayablesTab.tsx` | Added TDS summary fetching and Account 2030 Statutory TDS summary card in 4-card ribbon |
| `src/components/vendor/StandaloneVendorPayablesPreview.tsx` | Added Account 2030 Statutory TDS card and updated navigation badges |
| `package.json` | Bumped version to `6.51.0` |
| `src/config/version.ts` | Bumped application and billing suite versions to `6.51.0` |
| `CHANGELOG.md` | Added release notes for `6.51.0` |
| `docs/implementation/README.md` | Registered `IP-PROC-009` |
| `docs/walkthrough/README.md` | Registered `WT-PROC-009` |

---

## 5. Architecture Decisions

### AD-PROC-009-1: Dual Withholding Points (Invoice Booking vs Payment Disbursement)
- **Decision:** Allow TDS to be deducted either at the time of purchase bill booking (commercial invoice credit) or at supplier payment disbursement.
- **Rationale:** Under Indian Income Tax law (e.g. Section 194Q), tax is required to be deducted at the earlier of credit or payment. Accommodating both entry points prevents double deduction while guaranteeing compliance.

### AD-PROC-009-2: Net AP Allocation on Bill Booking
- **Decision:** When TDS is deducted on bill booking, `supplier.outstanding` increments strictly by `total_amount - tds_amount` (Net AP).
- **Rationale:** The supplier is only owed the net payable amount. The deducted tax represents an immediate government liability (`Account 2030: TDS / Withholding Tax Payable`) to be deposited via Challan 281.

### AD-PROC-009-3: Symmetrical Line Inspection on Cancellation
- **Decision:** GL reversal routines (`reverse_purchase_bill_gl`, `reverse_supplier_payment_gl`) query the original `GeneralLedgerEntry` lines for `account_id` matching Account 2030 to construct exact symmetrical reversal debits/credits.
- **Rationale:** Prevents drift or recalculation discrepancies if tax rates or vendor PAN profiles change after the voucher was posted.

---

## 6. Design Rationale

1. **Section 206AA Penal Enforcement:** Penal rates (5% on 194Q, 20% on others) are strictly applied in code if PAN is absent or invalid, preventing compliance failure during tax audits.
2. **Double-Entry Balance Invariant:** In all scenarios, $\sum \text{Debit} = \sum \text{Credit}$ is enforced at the database transaction boundary.
3. **Multi-Tenant Isolation:** All TDS computations and summary aggregations are strictly filtered by `company_id`.

---

## 7. Implementation Summary

### Mathematical Formulation of Ledger Postings

#### 1. Purchase Bill Booking with TDS
$$\text{Debit (1040 Inventory Asset + 1051/1052/1053 Input GST)} = \text{Credit (2010 Net AP)} + \text{Credit (2030 TDS Payable)} \pm \text{Roundoff (5030)}$$

#### 2. Supplier Payment Disbursement with TDS
$$\text{Debit (2010 Gross AP Settled)} = \text{Credit (1010/1020 Net Cash/Bank)} + \text{Credit (2030 TDS Payable)}$$

#### 3. Standalone TDS Deduction Voucher
$$\text{Debit (2010 AP)} = \text{Credit (2030 TDS Payable)}$$
$$\text{Net Cash Outflow} = ₹0.00$$

---

## 8. Tests Executed

Literal test command executed:
```bash
.venv\Scripts\pytest.exe backend/app/tests/test_statutory_tds_engine.py -v
```

Terminal execution output:
```text
backend\app\tests\test_statutory_tds_engine.py::test_pan_validation PASSED [ 10%]
backend\app\tests\test_statutory_tds_engine.py::test_entity_classification PASSED [ 20%]
backend\app\tests\test_statutory_tds_engine.py::test_statutory_tds_calculation_194q_standard_and_penal PASSED [ 30%]
backend\app\tests\test_statutory_tds_engine.py::test_statutory_tds_calculation_194c_individual_vs_company_vs_penal PASSED [ 40%]
backend\app\tests\test_statutory_tds_engine.py::test_statutory_tds_custom_override_rate PASSED [ 50%]
backend\app\tests\test_statutory_tds_engine.py::test_chart_of_accounts_2030_present PASSED [ 60%]
backend\app\tests\test_statutory_tds_engine.py::test_purchase_bill_gl_posting_and_reversal_with_tds PASSED [ 70%]
backend\app\tests\test_statutory_tds_engine.py::test_supplier_payment_gl_posting_and_reversal_with_tds PASSED [ 80%]
backend\app\tests\test_statutory_tds_engine.py::test_standalone_tds_deduction_and_reversal PASSED [ 90%]
backend\app\tests\test_statutory_tds_engine.py::test_vendor_tds_summary_fy_aggregation PASSED [100%]

====================== 10 passed, 18 warnings in 50.20s =======================
```

TypeScript compiler check:
```bash
npx tsc --noEmit
# Exit Code: 0 (Clean, 0 errors)
```

---

## 9. Verification Results

### Visual Verification Evidence

![Vendor 360 Statutory TDS Card Focus](../../../C:/Users/netma/.gemini/antigravity-ide/brain/aaff00e6-0df9-4455-9368-34989e066b42/vendor_360_statutory_tds_card_focus.png)

```
Implementation Status

✓ Code Complete
✓ Tests Passed (10/10 Pytest 100% Green)
✓ Documentation Updated
✓ CHANGELOG Updated
✓ Release Notes Updated
✓ Architecture Updated
✓ Evidence Captured

Evidence Level: Level A (Code diffs + 10/10 test terminal logs + Playwright visual evidence)
```

| Verification Claim | Status | Evidence |
|---|---|---|
| PAN validation regex & entity classification | Done | `test_pan_validation`, `test_entity_classification` PASSED |
| Section 194Q threshold & penal rate logic | Done | `test_statutory_tds_calculation_194q_standard_and_penal` PASSED |
| Section 194C Ind vs Co vs penal logic | Done | `test_statutory_tds_calculation_194c_individual_vs_company_vs_penal` PASSED |
| Chart of Accounts 2030 presence | Done | `test_chart_of_accounts_2030_present` PASSED |
| Purchase Bill GL posting & reversal with TDS | Done | `test_purchase_bill_gl_posting_and_reversal_with_tds` PASSED |
| Supplier Payment GL posting & reversal with TDS | Done | `test_supplier_payment_gl_posting_and_reversal_with_tds` PASSED |
| Standalone TDS deduction & reversal | Done | `test_standalone_tds_deduction_and_reversal` PASSED |
| Vendor FY TDS summary aggregation | Done | `test_vendor_tds_summary_fy_aggregation` PASSED |
| TypeScript Compilation | Done | `npx tsc --noEmit` exited code 0 |
| Headless Visual Evidence | Done | `vendor_360_statutory_tds_card_focus.png` |

---

## 10. Known Limitations

1. **Quarterly Return Filing (Form 26Q Export):** Phase 2.9 handles transaction-level calculation, withholding, and GL accounting. Generation of NSDL electronic Form 26Q text files will be delivered in Phase 2.10.
2. **Lower Deduction Certificate (Form 13):** Vendors with a Nil or Lower Deduction Certificate (Section 197) can currently use the custom override rate field, but formal certificate verification upload will be added in a future compliance phase.

---

## 11. Future Work

1. **Procurement Phase 2.10:** Form 26Q e-TDS return export and Challan 281 payment tracking.
2. **Procurement Phase 2.11:** Form 16A generation and vendor portal self-service certificate download.

---

## 12. Related ADRs

- `ADR-0045`: Unified Double-Entry Accounting Ledger Framework
- `ADR-0052`: Multi-Tenant Chart of Accounts & Subledger Architecture
- `ADR-0061`: Procurement Document Lifecycle & Cancellation Reversibility

---

## 13. Related RFCs

- `RFC-PROC-012`: Indian Statutory Withholding Tax (TDS) Compliance Architecture
- `RFC-FIN-008`: General Ledger Account 2030 Classification & Remittance Lifecycle
