<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.19.0
  Created      : 2026-10-25
  Modified     : 2026-10-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Implementation Plan: Billing Invoice Prefix Statutory GST Rule 46(b) Configuration Plan v6.19.0

## 1. Objective
Enable saving and generating the exact invoice number format **`TT2026-2027/18`** in Prefix Management for the **Standard Sales** series (`documentType: "SALES_INVOICE"`):
- Prefix: `TT2026-2027/` (12 characters, preserving the trailing slash `/`)
- Sequence starting at: `18`
- Running length: `0` (no zero-padding, producing raw sequence `18`)
- Suffix: `""`
- Overall invoice number: `TT2026-2027/18` (14 characters, complying strictly with GST Rule 46(b)'s 16-character cap).

## 2. Business Motivation
Enterprise and retail stores operating under Indian GST statutory rules require invoice numbers formatted with full financial year stamps, such as `TT2026-2027/18`. While the complete invoice number (14 characters) complies strictly with GST Rule 46(b)'s 16-character maximum and allowed character set (`[A-Za-z0-9/-]`), previous validation capped prefix lengths at 10 characters and forced a minimum of 1 zero-padding digit (`running_length >= 1`), rejecting `TT2026-2027/` and zero padding.

## 3. Scope
- **Backend Schema Validation**: Update `backend/app/schemas/numbering.py`, `backend/app/schemas/documents.py`, and `backend/app/schemas/system.py` to allow prefixes up to 15 characters (`^[A-Z0-9\-\/]{1,15}$`) and `running_length >= 0`.
- **Database Schema & Constraints**: Alembic migration `v1545_document_series_prefix_and_padding_limits.py` to update check constraints `chk_document_series_prefix_format` (1 to 15 chars) and `chk_document_series_running_length` (0 to 10 chars).
- **Backend Services**: Update `NumberingService`, `DocumentsEngine`, and `PricingPaymentService` to handle `running_length == 0` without falsy default coalescence to 4 or 6, honor `start_number` during sequence allocation, and support `SALES_INVOICE` transaction type mapping.
- **Frontend Services & Studio**: Update `src/services/smritiBillPrefixService.ts` and `src/components/billing/SmritiDefineBillPrefixModal.tsx` to include `SALES_INVOICE`, support `runningLength === 0`, and add "0 (No padding)" to the studio UI dropdown.
- **Regression Tests**: Pytest tests in `backend/tests/test_bill_prefix.py` and Vitest tests in `src/tests/smritiBillPrefix.test.ts`.

## 4. Current State
- `backend/app/schemas/numbering.py` enforced regex `^[A-Z0-9\-\/]{1,10}$` and `runningLength ge=1`.
- PostgreSQL database enforced `CHECK (char_length(prefix) BETWEEN 1 AND 10)` and `CHECK (running_length BETWEEN 1 AND 10)`.
- Frontend `formatBillPreview` and `getAllPrefixes` coalesced `runningLength || 4`, turning `0` into `4`.
- Modal UI dropdown only allowed options 3, 4, 5, 6 for padding.

## 5. Gap Analysis
| Component | Existing Behavior | Required Behavior | Status |
|---|---|---|---|
| Prefix Length | Capped at 10 characters | Up to 15 characters (`^[A-Z0-9\-\/]{1,15}$`) | Remediated |
| Zero-Padding | Forced `running_length >= 1` | `running_length >= 0` (0 = no padding) | Remediated |
| Falsy Coalescence | `running_length || 4` turned 0 into 4 | Nullish coalescing `running_length ?? 4` | Remediated |
| DB Check Constraints | Rejected `len > 10` and `run_len < 1` | Updated to `BETWEEN 1 AND 15` and `BETWEEN 0 AND 10` | Remediated |
| Standard Sales Series | Omitted from default schemas | Added to `getDefaultDefinitions` and seeded in DB | Remediated |

## 6. Architecture Impact
Zero architectural degradation. Total invoice length remains bounded by the statutory 16-character GST Rule 46(b) limit. Allowed character set remains strictly `[A-Za-z0-9/-]`.

## 7. Proposed Design
1. **Pydantic Validation**: Prefix validator updated to `^[A-Z0-9\-\/]{1,15}$`. `runningLength` validator updated to `ge=0, le=10`.
2. **Alembic Migration**: `v1545` alters `chk_document_series_prefix_format` to `BETWEEN 1 AND 15` and `chk_document_series_running_length` to `BETWEEN 0 AND 10`.
3. **Sequence Formatting**: `zfill(run_len)` and `padStart(runLen, '0')` with `runLen=0` natively preserve the raw integer sequence without leading zeros.
4. **Studio Modal**: UI allows selecting "0 (No padding)" and entering up to 15 uppercase characters for prefix.

## 8. Files Created
- `backend/alembic/versions/v1545_document_series_prefix_and_padding_limits.py`
- `docs/implementation/billing/Billing_Invoice_Prefix_Statutory_GST46b_Configuration_Plan_v6.19.0.md`
- `docs/walkthrough/billing/Billing_Invoice_Prefix_Statutory_GST46b_Configuration_Walkthrough_v6.19.0.md`

## 9. Files Modified
- `backend/app/schemas/numbering.py`
- `backend/app/schemas/documents.py`
- `backend/app/schemas/system.py`
- `backend/app/services/numbering.py`
- `backend/app/services/documents_engine.py`
- `backend/app/services/pricing_payment.py`
- `backend/tests/test_bill_prefix.py`
- `src/services/smritiBillPrefixService.ts`
- `src/components/billing/SmritiDefineBillPrefixModal.tsx`
- `src/components/global/configs/documentSeries.con.tsx`
- `src/tests/smritiBillPrefix.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- PostgreSQL 15 `document_series` table
- Alembic migration pipeline (`-x target=control -x db=smritisys`)
- React 18 + Vite frontend
- FastAPI backend

## 11. Risks
- Risk: Inadvertently allowing invoices > 16 characters. Mitigation: `validate_gst_rule_46b` strictly enforces `length <= 16` across all assembly and preview paths.
- Risk: Inadvertently permitting prohibited characters. Mitigation: Regex `^[A-Z0-9\-\/]+$` remains strictly intact.

## 12. Rollback Strategy
- Revert git commit.
- Run `alembic -x target=control -x db=smritisys downgrade v1544`.

## 13. Verification Plan
- Run `pytest tests/test_bill_prefix.py -v`.
- Run `npx vitest run src/tests/smritiBillPrefix.test.ts`.
- Run `npx tsc --noEmit`.
- Run `npm run build`.

## 14. Test Plan
- Unit tests asserting `validate_gst_rule_46b("TT2026-2027/", "18", "")` returns valid length 14.
- Integration tests saving batch with prefix `TT2026-2027/`, start number 18, and running length 0.
- Sequence allocation tests verifying `allocate_voucher_number` produces `TT2026-2027/18` then `TT2026-2027/19`.

## 15. Documentation Impact
- Updated Implementation Index (`docs/implementation/README.md`).
- Created WGP Walkthrough (`docs/walkthrough/billing/Billing_Invoice_Prefix_Statutory_GST46b_Configuration_Walkthrough_v6.19.0.md`).
- Updated Master Walkthrough Index (`docs/walkthrough/README.md`).
- Updated `CHANGELOG.md`.

## 16. Deployment Plan
- Apply Alembic migration `v1545` to control plane database `smritisys`.
- Rebuild and restart `smriti-api` and `smriti-web` containers.
- Push to `origin/smritiNX` and pull into `F:\Smriti9`.

## 17. Status
**Completed**

## 18. Related ADRs
- `ADR-0042`: Shoper 9 Prefix & Document Serialization Architecture.
- `ADR-0046`: Statutory GST Rule 46(b) Serial Number Governance.

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Invoice_Prefix_Statutory_GST46b_Configuration_Walkthrough_v6.19.0.md`
