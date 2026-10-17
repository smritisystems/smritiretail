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

  * Version    : 6.52.0
  * Created    : 2026-10-02
  * Modified   : 2026-10-02
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI Procurement Phase 2.10 — Government Challan 281 TDS Remittance Lifecycle & Electronic Form 26Q Quarterly Return Filing

**Document ID:** `WT-PROC-010`  
**Area:** Procurement / Accounts Payable / Statutory Compliance & Government Remittance  
**Phase:** Procurement Phase 2.10  
**Version:** `6.52.0`  
**Date:** 2026-10-02  
**Implementation Plan:** [Procurement Phase 2.10 Plan](../../implementation/procurement/Procurement_Phase2_10_Challan_281_Form26Q_Return_Plan_v1.0.md)  
**Status:** Completed & Verified  

---

## 1. Purpose

The objective of Procurement Phase 2.10 is to complete the Indian Statutory Taxation and Withholding Tax lifecycle established in Phase 2.9 by introducing authoritative government remittance via **Challan ITNS 281** and automated quarterly electronic return compilation for **Form 26Q** under Section 200(3) of the Income Tax Act, 1961.

This phase provides retail organizations and enterprise finance controllers with:
1. Double-entry general ledger discharge of accrued withholding tax liabilities in `Account 2030 (TDS / Withholding Tax Payable)` into `Account 1020 (Bank Accounts)` with explicit 7-digit BSR bank branch validation and tender tracking.
2. Full statutory accounting for late filing fees (Section 234E) and statutory interest (Section 201(1A)) in `Account 5090: Statutory Interest, Penalties & Compliance Fees`.
3. Symmetrical compensating reversal on Challan 281 cancellation (`CHALLAN_281_CANCEL`).
4. Automated quarterly aggregation of domestic non-salary deductees across purchase bills, supplier payments, and standalone TDS adjustment vouchers.
5. Compliant NSDL ASCII e-TDS text file export (`FH`, `BH`, `CD`, `DD` records) conforming to Income Tax Department specifications with automated Section 206AA penal rate flagging (`'C'`).
6. A responsive React 18 compliance studio modal (`VendorChallan281Modal.tsx`) integrated directly into the Vendor 360 Payables workspace.

---

## 2. Scope

| Dimension | In Scope | Out of Scope |
|---|---|---|
| **Statutory Remittance** | Challan ITNS 281 tracking, BSR code validation (7 numeric digits), Major Head (0020/0021), Minor Head (200/400), Challan serial numbering. | Salary TDS (Form 24Q / Challan ITNS 280), TCS (Form 27EQ). |
| **General Ledger** | Discharge `Account 2030 (TDS Payable)` via `DR 2030 / CR 1020 (Bank)`; charge late fee/interest via `DR 5090`; compensating reversal `DR 1020 / CR 2030, CR 5090`. | Direct payment gateway bank settlement APIs (manual netbanking/counter deposit recorded). |
| **Quarterly Return** | Form 26Q quarterly reconciliation, deductee audit trail, NSDL e-TDS ASCII text file export (`FH`, `BH`, `CD`, `DD`). | Third-party NSDL FVU binary execution (external utility validates generated text file). |
| **Section 206AA** | Automatic deductee reason code `'C'` flag for invalid or missing PAN with 5%/20% penal rate verification. | Automatic Form 16A PDF generation (deferred to Phase 2.11). |
| **User Interface** | Vendor 360 Payables tab integration, Challan 281 recording drawer, live double-entry preview, Form 26Q summary cards, ASCII layout inspector. | Bulk Excel import of legacy historical challans. |

---

## 3. Files Created

1. `backend/app/schemas/challan_281.py`: Pydantic V2 schemas for Challan 281 creation and responses with strict 7-digit numeric BSR code validation and Q1-Q4 normalization.
2. `backend/app/schemas/form26q.py`: Pydantic V2 schemas for Form 26Q deductee lines, challan lines, quarterly summary responses, and NSDL ASCII export models.
3. `backend/app/services/challan_281.py`: `Challan281Service` managing Challan 281 remittance recording, symmetrical compensating reversal, metadata serialization, and outbox event dispatching.
4. `backend/app/services/form26q_generator.py`: `Form26QGeneratorService` resolving quarter date ranges, aggregating deductee and challan lines, calculating unallocated shortfalls, and generating standard NSDL ASCII e-TDS text files.
5. `backend/app/api/v1/tds_compliance.py`: FastAPI router implementing `/api/v1/tax/tds/challan281`, `/cancel`, `/form26q/summary`, and `/form26q/export`.
6. `backend/app/tests/test_challan281_form26q_engine.py`: Comprehensive test suite containing 7 rigorous test vectors verifying BSR validation, GL posting, late fees, cancellations, Form 26Q compilation, Section 206AA penal flags, and NSDL formatting.
7. `src/components/vendor/tabs/VendorChallan281Modal.tsx`: React 18 compliance studio modal with 4 financial KPI cards, Challan 281 deposit recording drawer, Form 26Q deductee register, and NSDL ASCII inspection preview.
8. `scripts/capture_vendor_360_challan281_form26q_headless.py`: Playwright Chromium automation script capturing 4 headless visual evidence artifacts.

---

## 4. Files Modified

1. `backend/app/services/unified_ledger.py`:
   - Registered `Account 5090: Statutory Interest, Penalties & Compliance Fees` under Expenses (`5000`) in `DEFAULT_CHART_OF_ACCOUNTS` and company DB seeding.
2. `backend/app/api/v1/__init__.py`:
   - Imported and mounted `tds_compliance.router` under `/tax/tds` and `/purchase/tax/tds`.
3. `backend/app/main.py`:
   - Registered `tds_compliance.router` in `_ROUTER_REGISTRY`.
4. `src/components/vendor/tabs/VendorPayablesTab.tsx`:
   - Added `Landmark` icon and `VendorChallan281Modal` import.
   - Added `isChallanModalOpen` state and action button `🏛️ Challan 281 & Form 26Q`.
   - Made Card 4 ("Statutory TDS (Account 2030)") interactive to trigger the Challan 281 compliance studio.
5. `src/components/vendor/StandaloneVendorPayablesPreview.tsx`:
   - Wired `VendorChallan281Modal` into standalone vendor preview studio with action button and interactive Card 4.
   - Updated header badges to `Procurement Phase 2.10` and `SSOT v6.52.0`.
6. `package.json`:
   - Bumped SSOT application version to `6.52.0`.
7. `src/config/version.ts`:
   - Bumped `APP_VERSION` and `ENTERPRISE_BILLING_SUITE_VERSION` to `6.52.0`.
8. `CHANGELOG.md`:
   - Documented `[6.52.0]` release notes.
9. `docs/implementation/README.md`:
   - Prepended `IP-PROC-010` to the master implementation plan index.
10. `docs/walkthrough/README.md`:
    - Prepended `WT-PROC-010` to the master walkthrough index.

---

## 5. Architecture Decisions

### ADR-CHL-001: General Ledger Account 5090 for Statutory Interest and Fees
- **Context:** Government TDS remittance via Challan ITNS 281 frequently includes statutory interest under Section 201(1A) for delayed deductions or late filing fees under Section 234E. These amounts do NOT reduce the tax liability in `Account 2030 (TDS Payable)`, as they are non-recoverable compliance expenses.
- **Decision:** Registered `Account 5090: Statutory Interest, Penalties & Compliance Fees` under Operating Expenses (`5000`). When Challan 281 deposits include interest or late filing fees, the voucher posts:
  $$\text{DR } 2030 \text{ (Tax Component)} + \text{DR } 5090 \text{ (Interest/Fees)} = \text{CR } 1020 \text{ (Bank)}$$
  preserving exact mathematical balance across all journal lines.

### ADR-CHL-002: Deductee Resolution and Section 206AA Reason Flagging
- **Context:** NSDL Form 26Q e-TDS file validation requires every deductee line (`DD`) to state a valid reason code if standard rates are not applied. If a deductee does not furnish a valid PAN, Section 206AA mandates penal rate deduction (5% for Section 194Q or 20% for 194C/J/H) and must be flagged with reason code `'C'` ("Higher rate due to non-availability of PAN").
- **Decision:** The `Form26QGeneratorService` inspects the vendor's PAN via `StatutoryTdsEngine.is_valid_pan()`. If invalid or absent, the deductee record is automatically stamped with `reason_code = 'C'` and `deductee_code = '02'` (or `'01'` if company), guaranteeing NSDL file validator compliance.

### ADR-CHL-003: NSDL ASCII e-TDS Text File Structure
- **Context:** Income Tax Department File Validation Utilities (FVU) accept ASCII delimited text files (`^` delimiter, `\r\n` line endings) containing structured hierarchical records.
- **Decision:** Structured `generate_form26q_text` into 4 canonical record levels:
  1. `FH` (File Header): Software details, TAN, and Form identifier (`26Q`).
  2. `BH` (Batch Header): Quarter, Financial Year, Deductor Details, and batch totals.
  3. `CD` (Challan Detail): BSR code, Challan serial number, Date, Major/Minor Head, Tax, Interest, Fee.
  4. `DD` (Deductee Detail): Deductee PAN, Name, Date of Credit, Amount Paid, TDS Deducted, Rate, Reason Code.

---

## 6. Design Rationale

1. **Strict BSR Code Guard:** Indian bank branches are issued an authoritative 7-digit Basic Statistical Return (BSR) code by the Reserve Bank of India. Validating `^\d{7}$` at the Pydantic schema layer prevents malformed government challans from entering the General Ledger.
2. **Reversal Symmetrical Compensating GL Voucher:** In the event a Challan 281 is entered in error or a bank cheque is dishonored, the system generates an exact compensating reversal voucher (`CHALLAN_281_CANCEL`) crediting `2030` and `5090` and debiting `1020 (Bank)`. The original voucher is marked `is_cancelled = True` and preserved permanently for immutable audit compliance.
3. **Double-Entry Preview in UI:** Before committing a government remittance, the operator is presented with a live visual preview of the exact debits and credits to be posted to Accounts `2030`, `5090`, and `1020`, with real-time green badge validation ($\sum \text{Debit} == \sum \text{Credit}$).

---

## 7. Implementation Summary

### Double-Entry Accounting Matrix
```text
Challan 281 Remittance Voucher (TDS_CHALLAN_281):
  DR Account 2030 (TDS / Withholding Tax Payable)    : ₹10,900.00 (Tax + Surcharge + Cess)
  DR Account 5090 (Statutory Interest & Penalties)   : ₹   350.00 (Interest + Fee)
  CR Account 1020 (Bank Accounts — Current Account)  : ₹11,250.00
  Net Cash Discharged                                : ₹11,250.00

Challan 281 Reversal Voucher (CHALLAN_281_CANCEL):
  DR Account 1020 (Bank Accounts — Current Account)  : ₹11,250.00
  CR Account 2030 (TDS / Withholding Tax Payable)    : ₹10,900.00
  CR Account 5090 (Statutory Interest & Penalties)   : ₹   350.00
  Net Position Restored                              : ₹11,250.00
```

---

## 8. Tests Executed

Automated test suite `backend/app/tests/test_challan281_form26q_engine.py` was executed with `.venv\Scripts\pytest.exe`:

```powershell
.venv\Scripts\pytest.exe backend/app/tests/test_challan281_form26q_engine.py -v --tb=short
```

Literal terminal output:
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 7 items

backend\app\tests\test_challan281_form26q_engine.py::test_challan_281_validation_bsr_and_quarter PASSED [ 14%]
backend\app\tests\test_challan281_form26q_engine.py::test_challan_281_gl_posting_standard PASSED [ 28%]
backend\app\tests\test_challan281_form26q_engine.py::test_challan_281_gl_posting_with_interest_and_late_fee PASSED [ 42%]
backend\app\tests\test_challan281_form26q_engine.py::test_challan_281_cancellation_reversal PASSED [ 57%]
backend\app\tests\test_challan281_form26q_engine.py::test_form26q_quarterly_deductee_aggregation_and_summary PASSED [ 71%]
backend\app\tests\test_challan281_form26q_engine.py::test_form26q_penal_rate_flag_c_for_missing_pan PASSED [ 85%]
backend\app\tests\test_challan281_form26q_engine.py::test_form26q_text_file_formatting_fhu_bhu_cdu_ddu PASSED [100%]

======================= 7 passed, 18 warnings in 57.67s =======================
```

TypeScript compilation check executed with `npx tsc --noEmit`:
```powershell
npx tsc --noEmit
# Exit code: 0 (Clean, 0 errors)
```

---

## 9. Verification Results & Visual Evidence

Programmatic headless Playwright Chromium automation (`scripts/capture_vendor_360_challan281_form26q_headless.py`) captured 4 visual evidence artifacts stored under `docs/walkthrough/procurement/evidence/`:

| Artifact | Description |
|---|---|
| `vendor_360_challan281_overview.png` | Vendor 360 Payables workspace with Card 4 Statutory TDS and top action button `🏛️ Challan 281 & Form 26Q`. |
| `vendor_360_challan281_form26q_modal.png` | Form 26Q Compliance Studio showing the 4 KPI health cards and Deductee Register. |
| `vendor_360_challan281_deposit_drawer.png` | Challan 281 Remittance recording drawer with BSR code, interest, late fee, and live balanced GL preview. |
| `vendor_360_form26q_nsdl_preview.png` | NSDL ASCII text inspector displaying formatted `FH`, `BH`, `CD`, and `DD` records. |

### Visual Artifact Carousel

````carousel
![Overview](file:///F:/SMRITRretailNX/docs/walkthrough/procurement/evidence/vendor_360_challan281_overview.png)
<!-- slide -->
![Compliance Studio](file:///F:/SMRITRretailNX/docs/walkthrough/procurement/evidence/vendor_360_challan281_form26q_modal.png)
<!-- slide -->
![Challan Deposit Drawer](file:///F:/SMRITRretailNX/docs/walkthrough/procurement/evidence/vendor_360_challan281_deposit_drawer.png)
<!-- slide -->
![NSDL ASCII Preview](file:///F:/SMRITRretailNX/docs/walkthrough/procurement/evidence/vendor_360_form26q_nsdl_preview.png)
````

---

## 10. Known Limitations

1. **NSDL FVU Binary Verification:** SMRITI generates compliant NSDL ASCII e-TDS files; direct execution of the proprietary Java-based NSDL File Validation Utility (FVU) binary requires local Java JRE installation and is run externally by filing accountants.
2. **Form 16A PDF Generation:** Quarterly TDS certificates (Form 16A) for distribution to vendors are scheduled for Procurement Phase 2.11.

---

## 11. Future Work

- **Procurement Phase 2.11:** Form 16A Vendor TDS Certificate PDF Generation with digital signature block and email dispatch.
- **Procurement Phase 2.12:** GST 2B vs Purchase Register 3-Way ITC Matching and Reconciliation Studio.

---

## 12. Related ADRs

- `ADR-CHL-001`: General Ledger Account 5090 for Statutory Interest and Fees.
- `ADR-CHL-002`: Deductee Resolution and Section 206AA Reason Flagging.
- `ADR-CHL-003`: NSDL ASCII e-TDS Text File Structure.
- `ADR-VEND-01`: Vendor 360 Specialized UI Component Architecture.

---

## 13. Related RFCs

- `RFC-INCOME-TAX-1961`: Indian Income Tax Act Sections 194Q, 194C, 194J, 201(1A), 206AA, 234E.
- `RFC-NSDL-FORM26Q-v4`: NSDL Electronic TDS File Format Specifications for Quarterly Return Form 26Q.
