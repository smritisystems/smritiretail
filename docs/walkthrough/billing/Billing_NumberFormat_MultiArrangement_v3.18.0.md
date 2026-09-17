<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.18.0
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Billing — Multi-Arrangement Bill Number Format — v3.18.0

**WGP ID:** Billing_NumberFormat_MultiArrangement_v3.18.0
**Status:** Done
**Area:** Billing / Numbering
**Date:** 2026-09-17

## 1. Purpose
Replace the hardcoded {prefix}{num}{suffix} pattern with a configurable NumberFormat system.
Each document series can now carry one of four named segment arrangements persisted in the DB.

## 2. Scope
| Layer               | Scope                                                       |
|---------------------|-------------------------------------------------------------|
| Database            | New column number_format on document_series                 |
| Backend ORM         | DocumentSeries model                                        |
| Backend Schema      | All five numbering Pydantic schemas                         |
| Backend Service     | NumberingService._assemble_doc_no — centralised SSOT helper |
| Backend API         | /numbering/terminal-prefixes/report endpoint                |
| Frontend Service    | SmritiBillPrefixService — assembleBillNo, formatBillPreview |
| Frontend UI         | SmritiDefineBillPrefixModal — Format column with dropdown   |
| Tests Python        | backend/tests/test_bill_number_format.py — 10 tests        |
| Tests Vitest        | src/tests/smritiBillPrefix.test.ts — 15 tests total        |

## 3. Files Created
- backend/alembic/versions/v1461_document_series_number_format.py
- backend/tests/test_bill_number_format.py

## 4. Files Modified
- backend/app/models/numbering.py
- backend/app/schemas/numbering.py
- backend/app/services/numbering.py
- backend/app/api/v1/numbering.py
- src/services/smritiBillPrefixService.ts
- src/components/billing/SmritiDefineBillPrefixModal.tsx
- src/tests/smritiBillPrefix.test.ts

## 5. Architecture Decisions
Four named codes instead of free-form template strings:
  PREFIX_NUM_SUFFIX   -> {prefix}{num}{suffix}  (default / backward-compatible)
  PREFIX_YEAR_SEP_NUM -> {prefix}/{year}/{num}
  PREFIX_SEP_NUM      -> {prefix}/{num}
  NUM_ONLY            -> {num}

SSOT: _assemble_doc_no (Python) and assembleBillNo (TypeScript) contain identical logic.
Backward compat: migration DEFAULT 'PREFIX_NUM_SUFFIX' upgrades all existing rows without data migration.
DB CHECK constraint prevents invalid codes even if API validation is bypassed.

## 9. Verification Results

### py_compile (all 6 Python files)
Exit code: 0 — ALL OK

### pytest — backend/tests/test_bill_number_format.py
10 passed in 4.69s (10/10 green)
  test_prefix_num_suffix_default                              PASSED
  test_prefix_num_suffix_no_suffix                            PASSED
  test_prefix_year_sep_num                                    PASSED
  test_prefix_year_sep_num_no_fy                              PASSED
  test_prefix_sep_num                                         PASSED
  test_prefix_sep_num_no_prefix                               PASSED
  test_num_only                                               PASSED
  test_none_format_falls_back_to_prefix_num_suffix            PASSED
  test_unknown_format_falls_back_to_prefix_num_suffix         PASSED
  test_gst_rule_46b_all_formats_within_16_chars               PASSED

### Vitest — src/tests/smritiBillPrefix.test.ts
15 passed in 411ms (15/15 green)

### tsc --noEmit
Exit code: 0 — no type errors

## 10. Known Limitations
- PREFIX_YEAR_SEP_NUM without financial_year gracefully degrades to {prefix}/{num} — intentional and tested.

## 12. Related ADRs
- ADR-0042: Bill Number SSOT Assembly Pattern
- ADR-0031: GST Rule 46(b) Compliance Gateway

## 13. Related RFCs
- RFC-0018: Multi-Arrangement Document Numbering
