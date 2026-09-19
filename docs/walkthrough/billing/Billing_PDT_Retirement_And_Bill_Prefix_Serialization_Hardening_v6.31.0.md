<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.31.0
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Billing PDT Retirement & Bill Prefix Batch-Save 500 Serialization Hardening (v6.31.0)

## 1. Purpose
This release accomplishes two critical operational imperatives:
1. **Retirement of Legacy PDT Import Module:** Completely removes the obsolete Portable Data Terminal (PDT) import dialogs, UI actions, and handlers from the retail POS and distributor billing interfaces in favor of the canonical Barcode CSV Import Engine (`BarcodeCSVImportModal.tsx`). Re-assigns the global `Alt+I` hotkey directly to the CSV Import Engine.
2. **Resolution of HTTP 500 on Bill Prefix Batch Save:** Diagnoses and eliminates the 500 Internal Server Error occurring on `POST /api/v1/numbering/bill-prefixes/save-batch` by fixing Pydantic v2 `AliasChoices` mapping and default value coercion between SQLAlchemy ORM snake_case models and camelCase API response schemas (`DocumentSeriesResponse` and `NumberingAuditLogResponse`).

---

## 2. Scope
- **Frontend Retail POS (`ProPosBillingTerm.tsx`):**
  - Removed `SmritiPdtImportDlg` modal rendering and imports.
  - Removed `showPdtImportModal` state and `handlePdtImportSuccess` callback.
  - Re-routed `Alt+I` keyboard shortcut and escape modal cleanup to `showCsvImportModal`.
  - Replaced the overflow menu PDT button with `<kbd>Alt+I</kbd>` on the CSV Import action.
- **Frontend Distributor Billing (`BillingTerm.tsx`):**
  - Removed `PdtImportModal` import and modal JSX.
  - Removed `showPdtImportModal` state and `handleImportPdtItems` handler.
  - Removed legacy "Import" button from the action bar.
- **Frontend Modal File Deletion:**
  - Deleted obsolete `src/components/billing/propos/ProPosPdtImportDlg.tsx`.
  - Deleted obsolete `src/components/billing/PdtImportModal.tsx`.
- **Keyboard Shortcuts Dialog (`ProPosHotkeysDlg.tsx`):**
  - Updated `Alt + I` description to `"Open CSV Import window"`.
- **Backend Numbering Schemas (`backend/app/schemas/numbering.py`):**
  - Added `AliasChoices` to `DocumentSeriesResponse` for all ORM attributes (`document_type`, `running_length`, `reset_rule`, `current_number`, `last_reset_key`, `financial_year`, `company_code`, `is_active`, `terminal_id`, `is_common_across_terminals`, `transaction_group`, `start_number`, `is_void_unified`).
  - Added `@field_validator` hooks with `mode="before"` to ensure `None` or missing values safely coerce to defaults.
  - Added `AliasChoices` and timestamp formatter to `NumberingAuditLogResponse` for `created_at`, `series_id`, `series_name`, `operator`, `document_no`, `old_value`, `new_value`.
  - Added safe integer and boolean validators on `BillPrefixBatchSaveItem`.
- **Backend Service Hardening (`backend/app/services/numbering.py`):**
  - Hardened `save_bill_prefixes_batch` with safe integer casting before string padding (`zfill`), transaction rollback on database exceptions, and descriptive error messages.
- **Backend Unit Testing (`backend/tests/test_bill_prefix.py`):**
  - Added test `test_document_series_response_serialization_with_orm` and `test_save_batch_with_null_and_missing_attributes`.

---

## 3. Files Created
1. `docs/walkthrough/billing/Billing_PDT_Retirement_And_Bill_Prefix_Serialization_Hardening_v6.31.0.md`

---

## 4. Files Modified
1. `src/components/billing/propos/ProPosBillingTerm.tsx`
2. `src/components/billing/propos/ProPosHotkeysDlg.tsx`
3. `src/components/billing/BillingTerm.tsx`
4. `src/tests/proPosKeys.test.ts`
5. `backend/app/schemas/numbering.py`
6. `backend/app/services/numbering.py`
7. `backend/tests/test_bill_prefix.py`
8. `docs/walkthrough/README.md`
9. `CHANGELOG.md`

### Files Deleted
1. `src/components/billing/propos/ProPosPdtImportDlg.tsx`
2. `src/components/billing/PdtImportModal.tsx`

---

## 5. Architecture Decisions
1. **Single Universal Import Standard:** Retires fragmented PDT import tools in favor of the canonical Barcode CSV Import Engine (`BarcodeCSVImportModal`), which provides 7-tier auto-detection (including delimited PDT format), real-time product database validation, Legal Metrology Act MRP checks, and HREP error codes.
2. **Pydantic v2 Dual-Direction Alias Strategy:** When using `from_attributes=True` in Pydantic v2, response schemas must map ORM snake_case columns via `validation_alias=AliasChoices("snake_case", "camelCase")` while exporting camelCase JSON via `serialization_alias="camelCase"`.
3. **Graceful Default Coercion:** Database columns that are nullable or omitted on ad-hoc series must not fail FastAPI response serialization; `@field_validator(..., mode="before")` ensures that `None` attributes fall back to sensible business defaults.

---

## 6. Design Rationale
- The legacy PDT dialog was built for physical serial/USB barcode batch guns that dumped raw text files. The unified Barcode CSV Engine already supports PDT format while adding database catalog validation. Retaining two import modals caused operator confusion and clutter in the POS interface.
- The 500 error on `/bill-prefixes/save-batch` occurred after successful database persistence when FastAPI attempted to validate the returning ORM model list against `DocumentSeriesResponse`. Missing `validation_alias` caused Pydantic to raise `ResponseValidationError`, which FastAPI surfaced as an unhandled 500 error.

---

## 7. Implementation Summary
- **PDT Purge:** Removed all traces of `SmritiPdtImportDlg` and `PdtImportModal`. Rerouted `Alt+I` hotkey to open `BarcodeCSVImportModal`.
- **Response Schema Fix:** Re-architected `DocumentSeriesResponse` and `NumberingAuditLogResponse` with `AliasChoices` and before-validators.
- **Service Resilience:** Added transaction rollback and safe integer casting in `NumberingService.save_bill_prefixes_batch`.
- **Test Automation:** Added automated verification verifying ORM serialization and null-safe batch saving.

---

## 8. Tests Executed
1. `python -m pytest tests/test_bill_prefix.py` (5/5 passed in 4.54s)
2. `python -m pytest tests/test_stage5_2_domain_writer_integration.py tests/test_postgres_outbox_worker.py tests/test_platform_event_service.py` (26/26 passed in 16.61s)
3. `npx vitest run src/tests/proPosKeys.test.ts src/tests/billingTerm.test.ts` (23/23 passed in 376ms)
4. `npx vitest run` (136/136 test files passed, 904/904 tests passed in 28.85s)
5. `npx tsc --noEmit` (0 errors)
6. `python scripts/validate_version_ssot.py` (Passed, 6.31.0)

---

## 9. Verification Results
- All unit, integration, and regression suites passed with zero failures.
- TypeScript compiler passed with zero diagnostics.
- `POST /api/v1/numbering/bill-prefixes/save-batch` returns HTTP 200 with complete camelCase JSON payload.
- `Alt+I` in POS opens the CSV Import Engine modal.

---

## 10. Known Limitations
- None.

---

## 11. Future Work
- Add custom CSV template export generator directly from `BarcodeCSVImportModal`.

---

## 12. Related ADRs
- `ADR-005`: Canonical Table Convergence & Statutory Snapshot Rule
- `ADR-FROZEN-001`: SMRITI Sole Backend System of Record (FastAPI + Postgres)

---

## 13. Related RFCs
- `RFC-2026-09-001`: Shoper 9 Competitive Parity & Billing Modernization
