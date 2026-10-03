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

  * Document ID: IP-PROC-010
  * Version    : 1.0.0
  * Created    : 2026-10-02
  * Modified   : 2026-10-02
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: SMRITI Procurement Phase 2.10 — Government Challan 281 TDS Remittance Lifecycle & Electronic Form 26Q Quarterly Return Filing

> **Document ID:** `IP-PROC-010`  
> **Topic:** Government Challan 281 TDS Remittance & Form 26Q e-TDS Return Generation  
> **Area:** Procurement / Accounts Payable / Statutory Taxation & Compliance  
> **Target Release:** `v6.52.0`  
> **Status:** Completed  
> **Related Walkthrough:** [`WT-PROC-010`](../../walkthrough/procurement/Procurement_Phase2_10_Challan_281_Form26Q_Return_v1.0.md)  
> **Supersedes:** None (New Phase)  
> **Predecessor:** [`IP-PROC-009` (Phase 2.9 Statutory TDS Engine)](./Procurement_Phase2_9_Statutory_TDS_Withholding_Tax_Plan_v1.0.md)

---

## 1. Objective

To implement a complete, authoritative Indian Government Tax Deducted at Source (TDS) remittance lifecycle via **Challan ITNS 281** and automated **Quarterly Electronic Form 26Q Return File Generation** in SMRITI Retail OS.

This guarantees:
1. Authoritative double-entry discharge of `Account 2030 (TDS / Withholding Tax Payable)` upon remitting tax to the Income Tax Department via Challan 281.
2. Proper general ledger accounting for statutory interest (Section 201(1A)) and late filing fees (Section 234E) under a new expense account `Account 5090 (Statutory Interest, Penalties & Compliance Fees)`.
3. Symmetrical compensating GL reversal on Challan 281 cancellation (`CHALLAN_281_CANCEL`).
4. Automated quarterly aggregation of deductee records across purchase bills, payments, and standalone TDS vouchers.
5. Generation of compliant, standardized NSDL e-TDS ASCII text files (Form 26Q) ready for File Validation Utility (FVU) verification and TIN-NSDL submission.
6. Intuitive frontend compliance studio for quarterly reconciliation, Challan 281 recording, and 1-click Form 26Q export.

---

## 2. Business Motivation

In Phase 2.9, SMRITI Retail OS achieved automated TDS calculation and deduction at the purchase bill and payment booking stages, crediting government liability to `Account 2030`. However, business operations require:
1. **Monthly Tax Remittance (Due by 7th of following month):** Deducted TDS must be deposited into authorised banks via Challan ITNS 281. Without this remittance recording, `Account 2030` continuously accumulates liability indefinitely without being discharged.
2. **Quarterly e-TDS Return Filing (Form 26Q):** Section 200(3) of the Income Tax Act mandates quarterly filing of Form 26Q (due by July 31 for Q1, October 31 for Q2, January 31 for Q3, and May 31 for Q4). Manual compilation of deductee records and challan allocations from spreadsheets is error-prone, labor-intensive, and incurs heavy statutory penalties under Section 234E (₹200/day).
3. **Statutory Penal Rate Compliance:** Deductees without valid PANs subjected to Section 206AA penal rates must be explicitly flagged with reason code `C` in Form 26Q returns.

---

## 3. Scope

1. **Chart of Accounts Expansion**:
   - Register `Account 5090: Statutory Interest, Penalties & Compliance Fees` under Expenses (`5000`) in `DEFAULT_CHART_OF_ACCOUNTS` and company DB seeding.
2. **Challan 281 Accounting Engine (`backend/app/services/challan_281.py`)**:
   - Recording Challan 281 deposits: BSR Code (7 digits), Challan Serial No (5 digits), Deposit Date, Tender Date, Minor Head (`200` for Taxpayer, `400` for Assessment), Section, Tax Amount, Surcharge, Cess, Interest, Fee, Penalty, Total Amount, Cheque/UTR No, Bank Account Code.
   - Symmetrical double-entry postings:
     - Standard Challan: `DR 2030 (TDS Payable) = CR 1020 (Bank)`.
     - Challan with Interest/Fee: `DR 2030 (Tax) + DR 5090 (Interest/Fee) = CR 1020 (Bank)`.
   - Symmetrical compensating reversal on cancellation: `DR 1020 (Bank) = CR 2030 (TDS Payable) + CR 5090 (Interest/Fee)`.
3. **Electronic Form 26Q Generator (`backend/app/services/form26q_generator.py`)**:
   - Quarterly aggregation of all domestic non-salary deductions (Sections 194Q, 194C, 194J, 194H).
   - Mapping deductees to company PAN, TAN, address, and responsible person.
   - Formatting standardized ASCII e-TDS text file: `FH` (File Header), `BH` (Batch Header), `CD` (Challan Detail), `DD` (Deductee Detail).
   - Computing quarterly reconciliation metrics: Total Deducted, Total Deposited via Challan 281, Unallocated Shortfall.
4. **REST APIs & Schemas**:
   - `POST /api/v1/tax/tds/challan281`: Record and post Challan 281 voucher.
   - `GET /api/v1/tax/tds/challan281`: List Challan 281 records.
   - `POST /api/v1/tax/tds/challan281/{id}/cancel`: Symmetrical cancellation reversal.
   - `GET /api/v1/tax/tds/form26q/summary`: Form 26Q reconciliation summary.
   - `GET /api/v1/tax/tds/form26q/export`: Generate compliant Form 26Q text file.
5. **Frontend UI Integration**:
   - Create `src/components/vendor/tabs/VendorChallan281Modal.tsx`.
   - Add trigger in `VendorPayablesTab.tsx` and `StandaloneVendorPayablesPreview.tsx`.
6. **Automated Verification**:
   - 100% green pass on `test_challan281_form26q_engine.py`.
   - Clean `tsc --noEmit` check.
   - Playwright headless visual evidence capture.

---

## 4. Current State

- `DEFAULT_CHART_OF_ACCOUNTS` contains `Account 2030: TDS / Withholding Tax Payable` under Liabilities.
- Purchase bills and supplier payments can deduct TDS and post credit lines to Account 2030.
- No mechanism currently exists to debit Account 2030 to record tax payment to the government via Challan 281.
- No automated Form 26Q generation or deductee line mapping exists.

---

## 5. Gap Analysis

| Requirement | Current State | Phase 2.10 Implementation |
|---|---|---|
| Challan 281 Tax Deposit GL | None (Account 2030 liability stays open) | `DR 2030 (TDS) = CR 1020 (Bank)` with zero cash leakage |
| Statutory Late Fees & Interest GL | No dedicated account | `Account 5090: Statutory Interest, Penalties & Compliance Fees` |
| Challan 281 Cancellation | None | Symmetrical `CHALLAN_281_CANCEL` compensating reversal voucher |
| Form 26Q Return File Export | None | Fully structured NSDL ASCII e-TDS text file (`FH`, `BH`, `CD`, `DD`) |
| Quarterly Compliance Summary | None | Real-time summary API comparing deducted vs deposited tax |
| Vendor 360 UI Compliance Action | TDS card displays withheld amount only | 1-Click modal to record Challan 281 & download Form 26Q |

---

## 6. Architecture Impact

1. **Double-Entry Ledger Integrity:**
   - Discharging liability: $\text{Debit (2030)} + \text{Debit (5090)} = \text{Credit (1020)}$.
   - Symmetrical cancellation: $\text{Debit (1020)} = \text{Credit (2030)} + \text{Credit (5090)}$.
   - No orphan entries; all vouchers enforce $\sum \text{Debit} = \sum \text{Credit}$.
2. **Deterministic Data Contracts:**
   - Pydantic models for Challan 281 and Form 26Q guarantee field-level validation (e.g. 7-digit BSR code, 5-digit Challan no, 10-digit PAN/TAN).

---

## 7. Proposed Design

### Mathematical Formulation of Ledger Postings

#### 1. Challan 281 Deposit
$$\text{Debit (2030 TDS Payable)} + \text{Debit (5090 Interest/Fees)} = \text{Credit (1020 Bank)}$$

#### 2. Challan 281 Cancellation Reversal
$$\text{Debit (1020 Bank)} = \text{Credit (2030 TDS Payable)} + \text{Credit (5090 Interest/Fees)}$$

### Form 26Q Record Structure

```
FH (File Header)
  └── BH (Batch Header - Deductor Info, Quarter, FY, Totals)
        ├── CD 1 (Challan 281 - BSR Code, Challan No, Tax Amount, Date)
        │     ├── DD 1.1 (Deductee 1 - PAN, Name, Bill Date, Tax Deducted, Rate)
        │     └── DD 1.2 (Deductee 2 - PAN, Name, Bill Date, Tax Deducted, Rate)
        └── CD 2 (Challan 281)
              └── DD 2.1 (Deductee 3 - ...)
```

---

## 8. Files Created

1. `backend/app/schemas/challan_281.py`: Pydantic schemas for Challan 281 requests and responses.
2. `backend/app/schemas/form26q.py`: Pydantic schemas for Form 26Q quarterly summary and export.
3. `backend/app/services/challan_281.py`: Core service for Challan 281 GL posting, querying, and cancellation.
4. `backend/app/services/form26q_generator.py`: Canonical Form 26Q text generator and quarterly deductee reconciler.
5. `backend/app/api/v1/tds_compliance.py`: REST router for Challan 281 and Form 26Q endpoints.
6. `backend/app/tests/test_challan281_form26q_engine.py`: Complete automated pytest battery.
7. `src/components/vendor/tabs/VendorChallan281Modal.tsx`: React 18 modal for Challan 281 deposit recording and Form 26Q download.
8. `scripts/capture_challan281_form26q_headless.py`: Playwright headless screenshot capture script.

---

## 9. Files Modified

1. `backend/app/services/unified_ledger.py`: Added `Account 5090` to `DEFAULT_CHART_OF_ACCOUNTS` and company seeding.
2. `backend/app/main.py`: Mounted `/api/v1/tax/tds` router.
3. `src/components/vendor/tabs/VendorPayablesTab.tsx`: Added Challan 281 & Form 26Q trigger button and modal wiring.
4. `src/components/vendor/StandaloneVendorPayablesPreview.tsx`: Added Challan 281 studio trigger and preview modal.
5. `package.json`: Bumped version to `6.52.0`.
6. `src/config/version.ts`: Bumped version to `6.52.0`.
7. `CHANGELOG.md`: Added release entry for `6.52.0`.
8. `docs/implementation/README.md`: Appended `IP-PROC-010`.
9. `docs/walkthrough/README.md`: Appended `WT-PROC-010`.

---

## 10. Dependencies

- FastAPI, SQLAlchemy, Pydantic v2.
- `UnifiedAccountingLedgerService` for journal vouchers and GL entries.
- React 18, Tailwind CSS, Lucide icons.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Incomplete BSR code or invalid Challan Serial No | Enforce strict regex validation (`^[0-9]{7}$` for BSR, `^[0-9]{5}$` for Challan No) |
| Negative or unbalanced GL entry | Strict validation that `total_amount == tax + surcharge + cess + interest + fee + penalty` |
| Over-remittance or double-cancellation | Database row-locks and idempotent `is_cancelled` check |

---

## 12. Rollback Strategy

- All database mutations occur within an atomic session context. Any error during voucher creation or GL entry generation triggers `await session.rollback()`.
- Cancellation creates a separate compensating reversal voucher, preserving immutable historical audit records.

---

## 13. Verification Plan

1. **Unit & Integration Tests:**
   - Execute `pytest backend/app/tests/test_challan281_form26q_engine.py -v`.
   - Assert 100% green pass across all test cases.
2. **TypeScript Compilation:**
   - Run `npx tsc --noEmit` and confirm exit code 0.
3. **Headless Visual Capture:**
   - Capture screenshot of the Challan 281 & Form 26Q compliance modal.
4. **Git Verification:**
   - Produce verifiable git diffs and commit hash.

---

## 14. Test Plan

1. `test_challan_281_gl_posting_standard`: Verify `DR 2030 = CR 1020` with zero discrepancy.
2. `test_challan_281_gl_posting_with_interest_and_fee`: Verify `DR 2030 + DR 5090 = CR 1020`.
3. `test_challan_281_cancellation_reversal`: Symmetrical credit to 2030, credit to 5090, debit to 1020.
4. `test_form26q_quarterly_deductee_aggregation`: Verify deductees across purchase bills and standalone deductions.
5. `test_form26q_penal_rate_flag_c`: Verify Section 206AA missing PAN entries carry reason code `C`.
6. `test_form26q_text_file_formatting`: Assert `FH`, `BH`, `CD`, `DD` record line format matches NSDL specifications.
7. `test_api_endpoints`: Verify REST endpoints for Challan 281 creation, listing, cancellation, and Form 26Q export.

---

## 15. Documentation Impact

- Walkthrough `WT-PROC-010`: `docs/walkthrough/procurement/Procurement_Phase2_10_Challan_281_Form26Q_Return_v1.0.md`
- Master indexes updated: `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- `CHANGELOG.md` updated with full release details for `v6.52.0`.

---

## 16. Deployment Plan

1. Merge into `smritiNX`.
2. Sync to test environment via `git pull`.
3. Auto-seed `Account 5090` into existing tenant databases.

---

## 17. Status

**Completed** (Verified: 7/7 tests green in `test_challan281_form26q_engine.py`, 0 TypeScript errors, 4 headless Playwright visual evidence screenshots captured)

---

## 18. Related ADRs

- `ADR-0045`: Unified Double-Entry Accounting Ledger Framework
- `ADR-0052`: Multi-Tenant Chart of Accounts & Subledger Architecture
- `ADR-0061`: Procurement Document Lifecycle & Cancellation Reversibility

---

## 19. Related Walkthroughs

- `WT-PROC-009`: Statutory TDS Withholding Tax & Account 2030 Integration
- `WT-PROC-010`: Government Challan 281 TDS Remittance & Electronic Form 26Q Return
