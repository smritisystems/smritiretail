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

# SMRITI Walkthrough: Billing Invoice Prefix Statutory GST Rule 46(b) Configuration Walkthrough v6.19.0

## 1. Purpose
Remediate invoice prefix configuration across frontend, backend schemas, database constraints, and sequence allocation engines so users can save and generate the exact invoice format **`TT2026-2027/18`** in Prefix Management for the **Standard Sales** series (`documentType: "SALES_INVOICE"`).

## 2. Scope
- Prefix: `TT2026-2027/` (12 characters, preserving the trailing slash `/`).
- Sequence starting at: `18`.
- Running length: `0` (no zero-padding).
- Resulting document number: `TT2026-2027/18` (14 characters, within statutory GST Rule 46(b) 16-character limit).
- Tracing and updating all validation paths in frontend and backend.
- Alembic database migration `v1545` to update PostgreSQL check constraints.

## 3. Files Created
- `backend/alembic/versions/v1545_document_series_prefix_and_padding_limits.py`
- `docs/implementation/billing/Billing_Invoice_Prefix_Statutory_GST46b_Configuration_Plan_v6.19.0.md`
- `docs/walkthrough/billing/Billing_Invoice_Prefix_Statutory_GST46b_Configuration_Walkthrough_v6.19.0.md`

## 4. Files Modified
- `backend/app/schemas/numbering.py`: Expanded `validate_prefix` regex to `^[A-Z0-9\-\/]{1,15}$` and `runningLength ge=0`.
- `backend/app/schemas/documents.py`: Updated `running_length ge=0` in `DocumentSeriesCreateRequest`.
- `backend/app/schemas/system.py`: Updated `validate_running_length` in `NumberingSeriesConfig` to allow `>= 0`.
- `backend/app/services/numbering.py`: Preserved `running_length=0` in `allocate_voucher_number`, `create_series`, `resolve_bill_prefix`, and added `SALES_INVOICE` transaction type mapping.
- `backend/app/services/documents_engine.py`: Preserved `running_length=0` in `allocate_next_number` and `preview_next_number`.
- `backend/app/services/pricing_payment.py`: Preserved `running_length=0` in sequence formatting.
- `backend/tests/test_bill_prefix.py`: Added 2 regression tests covering schema validation and end-to-end saving/allocating `TT2026-2027/18`.
- `src/services/smritiBillPrefixService.ts`: Added `SALES_INVOICE` transaction type and Standard Sales default schema with `runningLength: 0`.
- `src/components/billing/SmritiDefineBillPrefixModal.tsx`: Added "0 (No padding)" option, widened prefix input to 15 characters, and fixed zero-coalescing.
- `src/components/global/configs/documentSeries.con.tsx`: Fixed zero-coalescing in live preview and table view.
- `src/tests/smritiBillPrefix.test.ts`: Added 3 unit tests verifying `TT2026-2027/18` preview, GST Rule 46(b) validation, and offline fallback.
- `docs/implementation/README.md`: Appended plan entry.
- `docs/walkthrough/README.md`: Appended walkthrough entry.
- `CHANGELOG.md`: Logged release changes.

## 5. Architecture Decisions
- **Max Prefix Limit = 15 Characters**: Under statutory GST Rule 46(b), the complete invoice number must not exceed 16 characters. Since every serial sequence requires at least 1 numeral, the theoretical maximum prefix length is 15 characters (`16 - 1 = 15`). The allowed character set `[A-Za-z0-9/-]` remains unchanged.
- **Running Length = 0 for Unpadded Sequences**: Sequences configured with `running_length = 0` are formatted as raw decimal strings (`str(seq).zfill(0)` in Python and `seq.toString().padStart(0, '0')` in JavaScript), omitting leading zeros while preserving numbers like `18` or `105`.

## 6. Design Rationale
Previously, `running_length` enforced `ge=1` in Pydantic and `BETWEEN 1 AND 10` in PostgreSQL. Multiple code paths used falsy coalescing `running_length || 4`, silently converting `0` to `4` (`0018`). By introducing `running_length >= 0` and nullish coalescing `running_length ?? 4`, `0` is treated as a valid first-class configuration representing unpadded sequential numbering.

## 7. Implementation Summary
1. Created Alembic migration `v1545` altering `chk_document_series_prefix_format` to `BETWEEN 1 AND 15` and `chk_document_series_running_length` to `BETWEEN 0 AND 10`.
2. Applied migration `v1545` to control plane database `smritisys` in `smriti-db`.
3. Updated Pydantic schemas in `backend/app/schemas/numbering.py`, `documents.py`, and `system.py`.
4. Updated sequence formatting in `backend/app/services/numbering.py`, `documents_engine.py`, and `pricing_payment.py`.
5. Updated Prefix Management Studio modal and services in `src/components/billing/SmritiDefineBillPrefixModal.tsx` and `src/services/smritiBillPrefixService.ts`.
6. Seeded `Standard Sales` invoice series in `document_series` with prefix `TT2026-2027/`, start number `18`, and running length `0`.

## 8. Tests Executed
1. **Pytest (`backend/tests/test_bill_prefix.py`)**:
   - `test_gst_rule_46b_validation` (PASSED)
   - `test_bill_prefix_resolution_hierarchy` (PASSED)
   - `test_year_end_rollover_process` (PASSED)
   - `test_document_series_response_serialization_with_orm` (PASSED)
   - `test_save_batch_with_null_and_missing_attributes` (PASSED)
   - `test_bill_prefix_batch_save_item_prefix_validation` (PASSED)
   - `test_save_and_generate_tt2026_2027_18_standard_sales` (PASSED)
   - **Result**: 7/7 passed.
2. **Vitest (`src/tests/smritiBillPrefix.test.ts`)**:
   - 18/18 tests passed.
3. **TypeScript Typecheck (`npx tsc --noEmit`)**:
   - Zero errors.
4. **Production Build (`npm run build`)**:
   - Built cleanly in 1m 15s.

## 9. Verification Results
- **Evidence Level**: A (Direct observable database, pytest, vitest, and build outputs)
- Database constraints verified via `pg_constraint`:
  - `chk_document_series_prefix_format`: `char_length(prefix) BETWEEN 1 AND 15`
  - `chk_document_series_running_length`: `running_length BETWEEN 0 AND 10`
- Invoice number preview: `TT2026-2027/18` (length 14 / 16)
- Allocation test: sequence 1 -> `TT2026-2027/18`, sequence 2 -> `TT2026-2027/19`.

## 10. Known Limitations
- Total document number length must not exceed 16 characters per GST Rule 46(b). Prefixes of length 15 only leave room for 1-digit numbers (1–9).

## 11. Future Work
- Support dynamic multi-tier prefix token expansions for terminal, store, and financial year placeholders.

## 12. Related ADRs
- `ADR-0042`: Shoper 9 Prefix & Document Serialization Architecture.
- `ADR-0046`: Statutory GST Rule 46(b) Serial Number Governance.

## 13. Related RFCs
- `RFC-2026-09-01`: Enterprise Bill Prefix Configuration & Studio Integration.
