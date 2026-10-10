<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.20.0
  Created      : 2026-09-28
  Modified     : 2026-09-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: IM-001 Two-Tier Controlled-Field Validation — System Parameters & System Master Lookup

**Plan ID:** IP-CATALOG-IM001-v6.20.0  
**Status:** Completed  
**Branch:** smritiNX  
**Commit:** a64f0a35  
**Date:** 2026-09-28

---

## 1. Objective

Align `IM-001` controlled-field validation in `preview_universal_import` with SMRITI's native control-plane mechanisms:
- **System Parameters** (`system_parameters` table via `SystemParameterService`) — govern whether each catalog dimension field is enforced as BLOCK or Advisory.
- **System Master Lookup** (`master_values`/`master_types` via `CatalogDimensionValidator`) — provide DB-resident approved values as the primary allowed-value source.

The workbook `Validation Lists` sheet (from `SMRITI_Item_Master_Creation_Standard_v2.1.xlsx`) is retained as the fallback when DB values are absent for a dimension.

---

## 2. Business Motivation

The prior implementation of `IM001ControlledFieldValidator` loaded allowed values exclusively from the Excel workbook and applied a fixed mandatory/advisory classification from the workbook's `From System Master Lookup` sheet. This bypassed:

1. The system parameter `ItemSubClass1HasCat` (Shoper 9 legacy: "Maintain look-up for Sub-classification1 (Style)") which is the architectural switch that determines whether style lookup is enforced.
2. The system parameter `ItemSubClass2HasCat` (Shade/Color) which gates color enforcement.
3. The system parameters `SuperClass1Present` (Department) and `ItemSizePresent` (Size).
4. The `ValidateDataDuringPMImport` global gate parameter.
5. The `master_values` registry in the control plane — which is the authoritative single source of truth for all catalog dimensions per SMRITI architecture.

The item master standard's `From System Master Lookup` sheet literally maps columns to "System Parameter Assigned" fields (Col B header: `"System Parameter Assigened "`), making this wire-up a mandatory architectural requirement, not an enhancement.

---

## 3. Scope

**In scope:**
- `backend/app/api/v1/universal_import.py` — `IM001ControlledFieldValidator` class and `preview_universal_import` call site only.

**Out of scope (explicitly preserved):**
- `price_mode` handling
- Database write path (`commit_universal_import`)
- Template-generation code near line 1150 (Excel dropdown ranges)

---

## 4. Current State (Before)

```
IM001ControlledFieldValidator.validate_row_controlled_fields()
  ├─ Synchronous (not async)
  ├─ Loads allowed values from workbook Validation Lists only
  ├─ Mandatory/Advisory classification from workbook From System Master Lookup only
  └─ No system parameter consultation
      → ItemSubClass1HasCat, ItemSubClass2HasCat, SuperClass1Present,
        ItemSizePresent, ValidateDataDuringPMImport ignored entirely
```

---

## 5. Gap Analysis

| Gap | Impact | Resolution |
|-----|--------|------------|
| System parameters not consulted | Enforcement level may contradict operator-configured catalog policy | Read 5 params from control plane per request |
| master_values not used | Approved values in DB registry not applied | CatalogDimensionValidator.get_approved_values() as primary source |
| Workbook-only allowed list | DB seeding and workbook diverge silently | DB-first; workbook as fallback |
| Synchronous method | Cannot be awaited in async FastAPI endpoint (masked bug) | Made async |

---

## 6. Architecture Impact

- `IM001ControlledFieldValidator.validate_row_controlled_fields` promoted from `classmethod` (sync) to `async classmethod`.
- Two new async classmethods added: `_load_sysparam_enforcement_flags()` and `_get_db_approved_values_for_field()`.
- Two new class-level maps added: `FIELD_TO_DIMENSION_MAP` and `FIELD_TO_SYSPARAM_MAP`.
- `CatalogDimensionValidator` and `SystemParameterService` imported into `universal_import.py`.
- `async_session` (control plane) imported for system parameter queries.

---

## 7. Proposed Design

### Resolution Chain

```
validate_row_controlled_fields(row, row_num, company_id)
  │
  ├─ Tier 1: _load_sysparam_enforcement_flags(company_id)
  │           async_session → system_parameters table
  │           Reads: ValidateDataDuringPMImport, ItemSubClass1HasCat,
  │                  ItemSubClass2HasCat, SuperClass1Present, ItemSizePresent
  │           → validate_enabled: bool
  │           → field_enforcement: {field: bool}
  │           → On failure: defaults to enforce-all (safe fallback)
  │
  ├─ (per field) Tier 2: _get_db_approved_values_for_field(std_field)
  │           CatalogDimensionValidator.get_approved_values(dimension)
  │           → control plane master_values (+ tenant fallback)
  │           If returns values → use as effective_allowed (source_label: "System Master Lookup")
  │
  └─ (per field) Tier 3: Workbook Validation Lists (fallback)
              val_lists / norm_lists from mtime-cached workbook
              Source label: "Standard Validation List (workbook fallback)"

Enforcement:
  is_mandatory = workbook_mandatory AND sysparam_enforced AND validate_enabled
  System parameters can only DOWNGRADE enforcement, never upgrade.
```

### System Parameter Map

| std_field | System Parameter | Meaning |
|-----------|-----------------|---------|
| ARTICLE_STYLE_CODE | ItemSubClass1HasCat | Maintain Style lookup |
| COLOR | ItemSubClass2HasCat | Maintain Shade/Color lookup |
| MERCHANDISE_DEPARTMENT | SuperClass1Present | Department classification present |
| SIZE | ItemSizePresent | Size classification present |

---

## 8. Files Created

None.

---

## 9. Files Modified

| File | Change |
|------|--------|
| `backend/app/api/v1/universal_import.py` | +187 lines / -28 lines — IM001 two-tier integration |

---

## 10. Dependencies

- `backend/app/services/catalog_validation.py` — `CatalogDimensionValidator.get_approved_values()` (existing)
- `backend/app/services/system_parameter.py` — `SystemParameterService.resolve_parameter()` (existing)
- `backend/app/db/session.py` — `async_session` (control plane session, existing)
- `system_parameters` table — must have catalog classification params seeded (verified: COMP-001 has all 5)
- `master_types` / `master_values` — control plane; DB values used when seeded

---

## 11. Risks

| Risk | Mitigation |
|------|-----------|
| DB control plane unreachable | `_load_sysparam_enforcement_flags()` catches all exceptions; defaults to enforce-all (safe) |
| `master_values` empty for a dimension | Falls back to workbook Validation Lists transparently |
| Per-field DB query per row (N×M queries) | Acceptable for preview (not commit path); future optimization: batch-load all dimensions once per preview call |
| BRAND_NAME: only 1 DB value (SND) | Workbook fallback provides full list; as master_values is seeded, it will take over |

---

## 12. Rollback Strategy

Revert commit `a64f0a35`:
```
git revert a64f0a35
```
The synchronous behavior is fully restored. No DB schema changes are involved.

---

## 13. Verification Plan

1. Syntax check: `ast.parse()` — PASSED
2. Run `scratch/run_tattly_preview_v2.py` against 615-row Tattly file:
   - System parameter flags resolved correctly
   - DB values vs. workbook fallback decision reported per field
   - Affected rows: 546/615

---

## 14. Test Plan

| Test | Expected | Actual |
|------|----------|--------|
| Syntax check | SYNTAX OK | SYNTAX OK |
| System param resolution (COMP-001) | ItemSubClass1HasCat=True, ItemSubClass2HasCat=True, SuperClass1Present=True, ItemSizePresent=True, ValidateDataDuringPMImport=2 | All correct |
| DB values: BRAND_NAME | 1 value (SND) | 1 value (SND) |
| DB values: COLOR, SIZE, DEPT, CAT | 0 (fallback to workbook) | 0 each |
| Affected rows (Tattly 615 rows) | 546 (matches prior sanity check) | 546 |
| Clean rows | 69 | 69 |

---

## 15. Documentation Impact

- Walkthrough: `docs/walkthrough/catalog/Catalog_IM001_Two_Tier_Validation_System_Params_And_Master_Lookup_v6.20.0.md`
- CHANGELOG: `CHANGELOG.md` entry [6.46.0]
- Implementation Index: `docs/implementation/README.md`

---

## 16. Deployment Plan

1. `git pull` from `F:\Smriti9` after confirming FastAPI server is stopped
2. Restart FastAPI (`uvicorn backend.app.main:app`)
3. Re-run preview endpoint against Tattly file via API

---

## 17. Status

**Completed** — commit `a64f0a35`, branch `smritiNX`, 2026-09-28.

---

## 18. Related ADRs

- ADR-042: Dual-Key Resolution for System Parameters

---

## 19. Related Walkthroughs

- `docs/walkthrough/catalog/Catalog_IM001_Two_Tier_Validation_System_Params_And_Master_Lookup_v6.20.0.md`
- `docs/walkthrough/catalog/Catalog_Item_Master_Schema_Governance_And_Import_Pipeline_v1.0.0.md`
