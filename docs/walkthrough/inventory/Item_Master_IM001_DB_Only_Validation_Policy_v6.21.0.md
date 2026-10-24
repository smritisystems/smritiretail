<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 6.21.0
  Created      : 2026-09-28
  Modified     : 2026-09-28
  Copyright    : c SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# IM-001 DB-Only Validation Policy -- Removal of Excel/Workbook Fallbacks

**Version:** v6.21.0
**Date:** 2026-09-28
**Area:** Inventory / Item Master Import Pipeline
**Commit:** `36dac2b1`
**Status:** Done

---

## 1. Purpose

Enforce the SMRITI Backend System-of-Record Policy: the `master_values` table
in PostgreSQL is the **sole and exclusive** source of truth for all
IM-001 controlled-field validation. No file on disk -- Excel, CSV, JSON, or
otherwise -- may be read at runtime for validation purposes.

Excel remains an **operator data-entry tool only**: operators download the
template, fill in item rows, and upload the file for import. The uploaded data
is then validated against DB values exclusively.

---

## 2. Scope

| Component | Change |
|---|---|
| `backend/app/api/v1/universal_import.py` | Removed all workbook fallback code from `IM001ControlledFieldValidator` |
| `IM001ControlledFieldValidator` class | Removed 4 cached class attributes, 2 methods, 1 path list; added `FIELD_MANDATORY_MAP` |
| Validation policy docstring | Rewritten to declare DB-only policy permanently |
| Inline comment at call site | Updated from "two-tier" to "DB-only" |

**Not in scope:** The `download_item_master_template` endpoint -- it intentionally
reads `v2.2.xlsx` to stream a populated template to the operator. This is
correct by design and was not touched.

---

## 3. Files Created

None.

---

## 4. Files Modified

`backend/app/api/v1/universal_import.py` -- Removed workbook fallback; added FIELD_MANDATORY_MAP; rewrote validator logic.

---

## 5. Architecture Decisions

### AD-1: DB-only, no fallback -- ever

When `CatalogDimensionValidator.get_approved_values()` returns 0 values for a
dimension, the field is SKIPPED with an explicit `IM-001-UNSEEDED` advisory,
not silently passed, and not resolved by reading any file.

### AD-2: FIELD_MANDATORY_MAP replaces workbook sheet

Mandatory/advisory classification is now a Python class-level constant, not
read from the Excel "From System Master Lookup" sheet.

| Field | Mandatory (BLOCK) |
|---|---|
| BRAND_NAME | Y |
| COLOR | Y |
| SIZE | Y |
| GENDER | N |
| MERCHANDISE_DEPARTMENT | Y |
| MERCHANDISE_CATEGORY | N |
| PRODUCT_TYPE | N |
| HEEL_TYPE | N |
| UPPER_MATERIAL | N |
| UOM | Y |
| DESIGN_ATTRIBUTE | N |
| OUTSOLE_MATERIAL | N |
| COLLECTION_TYPE | N |
| GST_RATE_PERCENT | Y |

### AD-3: System parameters still govern downgrade

System parameters can downgrade a BLOCK field to Advisory. They cannot
upgrade. Unchanged from prior design.

---

## 6. Design Rationale

Before (removed): Tier 1 system params -> Tier 2 DB -> Tier 3 Excel fallback + mand map from Excel.
After (current): Tier 1 system params -> Tier 2 DB (sole source). 0 values = IM-001-UNSEEDED advisory.

---

## 7. Implementation Summary

### Removed from IM001ControlledFieldValidator

- `_cached_mtime`, `_cached_validation_lists`, `_cached_normalized_lists`, `_cached_mandatory_map`
- `STANDARD_WORKBOOK_RELATIVE_PATHS`
- `_find_standard_workbook()` classmethod
- `load_standard_lists()` classmethod
- Tier 3 workbook fallback block in `validate_row_controlled_fields()`
- `workbook_mandatory` variable -- replaced with `base_mandatory = cls.FIELD_MANDATORY_MAP.get(...)`
- `source_label` variable -- hardcoded to "System Master Lookup (DB)"

### New behaviour when DB dimension has 0 values

```python
if not db_values:
    warnings.append(
        f"IM-001-UNSEEDED [Advisory]: Field '{std_field}' has no approved values "
        f"in master_values (type='{cls.FIELD_TO_DIMENSION_MAP.get(std_field, '?')}'). "
        f"Seed the dimension to enable BLOCK enforcement."
    )
    continue
```

---

## 8. Tests Executed

Command: `python -m pytest backend/tests/test_universal_import_item_master.py -v --tb=short`

```
collected 8 items
test_item_master_dry_run_preview_valid                    PASSED [ 12%]
test_item_master_dry_run_detects_conflicts                PASSED [ 25%]
test_item_master_commit_3tier_cascade                     PASSED [ 37%]
test_reconciliation_states_existing_match_vs_conflict     PASSED [ 50%]
test_commit_existing_match_modes                          PASSED [ 62%]
test_pricing_modes_coverage                               PASSED [ 75%]
test_multi_variant_matrix_colors_and_sizes                PASSED [ 87%]
test_dynamic_template_generation_endpoint                 PASSED [100%]
8 passed, 9 warnings in 22.28s
```

---

## 9. Verification Results

| Check | Result |
|---|---|
| Syntax | SYNTAX OK (exit 0) |
| Residual workbook code grep | 0 live code matches (3 comments only) |
| Test suite | 8/8 passed, 22.28s, exit 0 |
| Commit pushed | 93d5d877..36dac2b1 smritiNX |

---

## 10. Known Limitations

1. `FIELD_MANDATORY_MAP` is hardcoded. Changing mandatory status requires a code change.
2. `IM-001-UNSEEDED` advisory does not block the row -- if unseeded, values are accepted.

---

## 11. Future Work

- Move `FIELD_MANDATORY_MAP` into `system_parameters` table
- Add `/api/v1/master-data/dimensions/health` endpoint for seeding status
- Startup event warning if any BLOCK dimension has 0 DB values

---

## 12. Related ADRs

- SMRITI Backend System-of-Record Policy (FastAPI + PostgreSQL)
- IM-001 Controlled Master Field Lookup

---

## 13. Related RFCs

- Item Master Standard v2.2 -- Column Promotion & GST Governance (v6.17.0)
- IM-001 Two-Tier Validation -- System Parameters & System Master Lookup (v6.20.0)
