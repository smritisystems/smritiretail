<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Shoper9 Template Blueprint Integration v3.33.0

## 1. Purpose
To extract, normalize, audit, and document legacy Shoper9 template blueprints (`D:\Shoper9\Templates`) into first-class SMRITI Retail OS architectural models without executing raw legacy SQL on live database instances (`smritisys`, `smriti001`, `smriti002`) and without modifying original source files.

## 2. Scope
- Safe, headless extraction of 21 legacy Shoper9 template files (`Template.inf`, `*.Sy`, `*.Gl`, `*.Lu`, `*.Dbs`, `*.Mns`, `*.TW`).
- Encoding-safe parser supporting `cp1252`, `latin1`, and `utf-8-sig`.
- Automated anomaly detection: quarantined temporary files (`*_tmp.txt`), empty files, duplicate SQL statements, and hardcoded Windows paths.
- Generation of normalized JSON blueprints and markdown documentation in `docs/legacy_blueprints/shoper9/`.
- Mapping of Retail and Distributor profiles to SMRITI Launchpad tiles, system parameters, and workflow engines.
- Comprehensive headless automated test coverage across Vitest and Pytest.

## 3. Files Created
- `scripts/shoper9_blueprint_parser.py`
- `docs/legacy_blueprints/shoper9/README.md`
- `docs/legacy_blueprints/shoper9/template_manifest.json`
- `docs/legacy_blueprints/shoper9/retail_blueprint.json`
- `docs/legacy_blueprints/shoper9/distributor_blueprint.json`
- `docs/legacy_blueprints/shoper9/menus.json`
- `docs/legacy_blueprints/shoper9/parameters.json`
- `docs/legacy_blueprints/shoper9/general_lookups.json`
- `docs/legacy_blueprints/shoper9/display_layouts.json`
- `docs/legacy_blueprints/shoper9/review_report.md`
- `backend/tests/test_shoper9_blueprint_parser.py`
- `src/tests/shoper9BlueprintMapping.test.ts`
- `docs/walkthrough/foundation/Shoper9_Template_Blueprint_Integration_v3.33.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Blueprint Model, Not Database Injection**: Legacy Shoper9 files represent historical ERP parameter blueprints. They are parsed into structured JSON schemas rather than executed directly as destructive database DDL/DML.
2. **Quarantine of Temp & Binary Files**: `*_tmp.txt` files and compiled `.TW` binaries are inventoried in `template_manifest.json` under quarantined status to prevent polluting operational tenant parameters.
3. **Reviewed SQL Deduplication**: Redundant statements (such as duplicate `vavertable` inserts in `Distributor.Mns`) are pruned in the reviewed AST layer.

## 6. Design Rationale
Converting legacy proprietary formats into declarative JSON models enables SMRITI to apply tenant-specific policy defaults (Retail vs Distributor profiles) during tenant onboarding while maintaining audit traceability back to source configuration hashes.

## 7. Implementation Summary
- Developed `scripts/shoper9_blueprint_parser.py` with multi-encoding support, CSV parsing, and SQL statement tokenization.
- Generated 7 core JSON blueprint artifacts and 2 Markdown documentation files under `docs/legacy_blueprints/shoper9/`.
- Isolated 30 hardcoded Windows paths and 26 Retail vs Distributor parameter variances.
- Mapped 5 Distributor delivery & procurement workflows (`Sales DC`, `Approval Issue DC`, `Transport Receipt`, `DC Conversion`, `PO Consolidation`) to canonical SMRITI modules.
- Created and executed 10 automated test cases (5 Pytest, 5 Vitest) with 100% pass rate.

## 8. Tests Executed
- `pytest backend/tests/test_shoper9_blueprint_parser.py`: 5 passed.
- `vitest run src/tests/shoper9BlueprintMapping.test.ts`: 5 passed.
- Full Vitest suite: 44 test files, 343 tests passed.
- `tsc --noEmit`: 0 errors.
- `vite build`: SMRITI production bundle built in 28.41s.
- `git diff --check`: 0 whitespace errors.

## 9. Verification Results
- Status: **Done** — fully verified with deterministic test outputs and schema validations.

## 10. Known Limitations
- Legacy `.TW` binary wrappers from 2010 are preserved as reference artifacts but not decompiled since `.Sy`/`.Gl`/`.Lu`/`.Dbs`/`.Mns` provide complete text-based definitions.

## 11. Future Work
- Integration of `parameters.json` into tenant initialization wizards for automatic profile preset provisioning.
- UI mapping of `ACCEPTDISPLAYDTLS` column definitions into customizable user table views.

## 12. Related ADRs
- `ADR-0042`: FastAPI PostgreSQL Canonical System of Record.
- `ADR-0056`: Unified Accounting Ledger & Dual-Case Normalization.

## 13. Related RFCs
- `RFC-2026-08-02`: Shoper9 Legacy Blueprint Ingestion and Profile Policy Mapping.
