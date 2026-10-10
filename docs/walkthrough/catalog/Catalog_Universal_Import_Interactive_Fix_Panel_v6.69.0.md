<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.69.0
  Created      : 2026-10-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Technical Walkthrough
-->

# Walkthrough: Universal Import Pre-Import Validation & Interactive Fix Panel

**Topic:** Universal Item Master Pre-Flight Validation, Human-Readable Fuzzy Matching, and Interactive Correction Studio  
**Date:** 2026-10-04  
**Version:** 6.69.0  
**Area:** Catalog / Item Master (`catalog`)  

---

## 1. Purpose

When retail store managers or catalog operators import batches of inventory items via spreadsheets, imports frequently failed with technical HTTP 422 / 500 errors or rejected rows without giving clear, actionable guidance. The objective of this implementation was to:
1. Deliver comprehensive, human-readable pre-import dry-run validation so non-technical users see exactly what failed and why.
2. Provide an interactive inline fix panel in `ItemMasterStudio` with one-click suggestions (fuzzy-matched against approved DB dimensions), dropdowns populated with live approved values, and per-row skip options.
3. Eliminate duplicate / unapproved values before commit, preventing database poisoning or import failure.
4. Ensure the backend validation pipeline (`catalog_validation.py`, `universal_import.py`, and `item_master_validation.py`) preserves exact field failures and returns both `ITEM_MASTER_VALIDATION_ERROR` and `SMRITI-VAL-002` / `IM-001` governance standards.

---

## 2. Scope

- **Frontend (`src/components/itemMaster/ItemMasterStudio.tsx`):**
  - Interactive Fix Panel replacing static error tables.
  - Per-row fix cards for blocked rows (`BLOCK`, `DUPLICATE_IN_FILE`, `UNSEEDED_FAIL_CLOSED`).
  - Bad values rendered with red strikethrough styling.
  - Single-click "Use [Suggestion]" pill button pre-filled with fuzzy near-match.
  - Approved values dropdown for manual replacement.
  - "Skip this row" toggle to safely exclude invalid rows without editing the spreadsheet.
  - "Re-validate with fixes" button merging user overrides and re-running preview dry run.
  - Clean state reset on successful commit.
- **Backend Service Layer (`backend/app/services/catalog_validation.py`):**
  - Plain-English, business-friendly error strings for controlled master lookup failures.
  - Fuzzy near-match suggestion engine ("Did you mean “X”? Fix the spelling in your file and re-validate.").
  - Structured `field_failures` list returned alongside text messages.
- **Backend API Layer (`backend/app/api/v1/universal_import.py`):**
  - Preview endpoint embeds `approved_values_map` and per-row `field_failures`.
- **Backend Error Normalisation (`backend/app/core/item_master_validation.py`):**
  - Enriched `FIELD_LABELS`, `_DYN_LABEL_MAP`, and `FIELD_SECTIONS` with footwear controlled dimensions (`heel_type`, `upper_material`, `outsole_material`, `purchase_class`, `collection_type`).
  - Direct mapping of `field_failures` into canonical structured fields, eliminating fallback degradation to generic `style_code`.
  - Preserved standard `SMRITI-VAL-002` error code, `IM-001` reference ID, and field-level failure metadata.

---

## 3. Files Created

- None (All implementations enhanced existing core architectural modules).

---

## 4. Files Modified

1. `src/components/itemMaster/ItemMasterStudio.tsx`
2. `backend/app/api/v1/universal_import.py`
3. `backend/app/services/catalog_validation.py`
4. `backend/app/core/item_master_validation.py`
5. `backend/tests/test_universal_import_item_master.py`

---

## 5. Architecture Decisions

- **Two-Tier Validation Strategy:** Pre-import validation executes in dry-run mode via `POST /api/v1/universal/preview`, loading all DB-approved master dimensions in a single cached pass. No database mutations occur until the user clicks "Import Valid Rows".
- **Structured Error Preservation:** Rather than reducing validation errors to concatenated plain strings, the backend produces structured `field_failures` with `field`, `value`, and `near_match`. The centralized mapper in `item_master_validation.py` prioritizes these structured failures over regex parsing.
- **Statutory Tax Alignment:** Restored active state on standard statutory Indian retail GST rates in `master_values` to ensure zero false-positive validation blocks during retail product creation.

---

## 6. Design Rationale

Non-technical users should never need to parse Python tracebacks or raw database constraint violations. If a user enters "BLOCKS" instead of "BLOCK", or "LADIES FOOTWEAR" instead of "Footwear", the interface highlights the exact cell, displays the closest approved value, and allows in-browser correction without having to re-export and re-upload the spreadsheet.

---

## 7. Implementation Summary

1. **Interactive Correction State:** Added `approvedValuesMap`, `rowCorrections: Map<number, Record<string, string>>`, and `skippedByUser: Set<number>` state hooks to `ItemMasterStudio.tsx`.
2. **Re-Validation Pipeline:** Updated `buildImportRows()` to accept user corrections and exclusions, merging them cleanly into the payload before re-invoking `handlePreviewAndImport()`.
3. **Controlled Field Validation:** Added dictionary lookups and fuzzy Levenshtein near-matching in `catalog_validation.py`.
4. **422 Validation Normalizer:** Updated `ItemMasterValidationMapper` to output canonical `ITEM_MASTER_VALIDATION_ERROR` responses with `SMRITI-VAL-002` error code and `IM-001` governance tagging.

---

## 8. Tests Executed

1. `npm run build` — Frontend Vite production build verification.
2. `pytest backend/tests/test_unified_im001_governance.py` — IM-001 governance test battery.
3. `pytest backend/tests/test_universal_import_item_master.py` — 3-tier cascade commit and reconciliation battery.

---

## 9. Verification Results

- **Frontend Compilation:** `✓ built in 1m 1s` (3,687 modules transformed, zero TypeScript or build errors).
- **Backend IM-001 Governance Battery:** `6/6 passed` (negative invalid heel type, negative invalid upper material, positive onboarded footwear dimensions, dynamic registry loading, Tattly NEW sheet preview, Tattly commit).
- **Backend Universal Import Battery:** `11/11 passed` (dry-run preview, duplicate conflict detection, 3-tier cascade commit, price mode draft handling, matrix style code expansion, supplier code mapping, etc.).
- **Total Tests Green:** `17/17 passed` in 353.22s.

---

## 10. Known Limitations

- In-browser corrections are ephemeral to the current session; re-uploading the original uncorrected file without exporting will require re-applying fixes or updating the master source spreadsheet.

---

## 11. Future Work

- Provide an "Export Corrected Spreadsheet" button allowing users to download their spreadsheet with in-browser fixes applied.
- Add bulk "Apply All Suggestions" button for files with dozens of spelling near-matches.

---

## 12. Related ADRs

- `ADR-0024`: Centralized Item Master 422 Error Handling Standard.
- `ADR-0038`: IM-001 Controlled Dimension Catalog Governance Architecture.

---

## 13. Related RFCs

- `RFC-2026-IM001`: Universal Catalog Dimension Governance & System Master Lookup.
