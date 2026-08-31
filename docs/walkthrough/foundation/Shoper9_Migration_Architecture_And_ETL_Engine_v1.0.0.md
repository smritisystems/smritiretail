<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Legacy Tally Shoper 9 Configuration Extractor, Retail Governance Policies & Tenant ETL Ingestion Engine

## 1. Purpose
To establish a robust, cloud-native long-term migration pathway for enterprise retail businesses transitioning from legacy Tally Shoper 9 POS/ERP to SMRITI Retail OS. This implementation extracts over 20 years of battle-tested retail domain parameters (`SysParam`, `ParamDef`), integrates standard retail operational policies into the SMRITI Control Plane, and delivers a transactional, zero-loss tenant data migration ETL engine.

---

## 2. Scope
- Parsing and indexing 185 `.S9Q` XML patch scripts and 596 UI parameter definition files from `D:\Shoper9\ini` and `D:\Shoper9\ParamDef`.
- Publishing the complete Shoper 9 configuration catalog (`SH9_CONFIG_CATALOG.json` and `SH9_CONFIG_SUMMARY.md`).
- Seeding 4 standard retail operational policies into `smritisys` via `ControlPlaneSeeder` (`POLICY_BILLING_CONTROLS`, `POLICY_BARCODE_COST_MASK`, `POLICY_INWARDS_PROCUREMENT`, `POLICY_CREDIT_MANAGEMENT`).
- Building the automated Shoper 9 tenant migration ETL engine (`scripts/admin/sh9_migrator.py`) with pre-flight ledger invariant verification.
- Publishing the definitive `docs/architecture/SHOPER9_MIGRATION_BLUEPRINT.md`.

---

## 3. Files Created
- [`scripts/admin/sh9_cfg_extract.py`](file:///F:/SMRITRretailNX/scripts/admin/sh9_cfg_extract.py) — Shoper 9 configuration and schema patch extraction engine.
- [`scripts/admin/sh9_migrator.py`](file:///F:/SMRITRretailNX/scripts/admin/sh9_migrator.py) — Transactional Shoper 9 tenant database ETL ingestion engine with dry-run support.
- [`docs/legacy/shoper/SH9_CONFIG_CATALOG.json`](file:///F:/SMRITRretailNX/docs/legacy/shoper/SH9_CONFIG_CATALOG.json) — Full structured JSON catalog of extracted system parameters.
- [`docs/legacy/shoper/SH9_CONFIG_SUMMARY.md`](file:///F:/SMRITRretailNX/docs/legacy/shoper/SH9_CONFIG_SUMMARY.md) — Categorized summary of retail parameters and legacy tables.
- [`docs/architecture/SHOPER9_MIGRATION_BLUEPRINT.md`](file:///F:/SMRITRretailNX/docs/architecture/SHOPER9_MIGRATION_BLUEPRINT.md) — Master migration strategy and entity mapping blueprint.
- [`docs/walkthrough/foundation/Shoper9_Migration_Architecture_And_ETL_Engine_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Shoper9_Migration_Architecture_And_ETL_Engine_v1.0.0.md) — This WGP Walkthrough.

---

## 4. Files Modified
- [`backend/app/db/ctrl_seeder.py`](file:///F:/SMRITRretailNX/backend/app/db/ctrl_seeder.py) — Enriched `seed_governed_logic()` to seed standard retail operational policies in `smritisys`.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Walkthrough entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Updated for `v3.63.0`.

---

## 5. Architecture Decisions
1. **Dynamic AST Governance vs. Static Booleans**: Legacy Shoper 9 stored raw flags in `sysparam` (`Boolean`, `Intg`, `Txt`). SMRITI stores these as versioned AST policy definitions in `smritisys.policy_definitions`, allowing tenants to configure overrides dynamically without database schema alterations.
2. **Universal Master Data Polymorphism**: Legacy customers and vendors are mapped into `Party` with `PartyRole`, `CustomerProfile`, and `SupplierProfile`. Items, Class combos, and barcodes are mapped into `Item`, `ItemVariant`, and `ItemBarcode`.
3. **Double-Entry Opening Balance Reconciliation**: All migrated accounts must satisfy the strict balance invariant $\sum \text{Debit} == \sum \text{Credit}$ with zero variance before committing.

---

## 6. Design Rationale
- **Zero Disruption for Existing Retailers**: Retail chains using specialized apparel workflows (e.g. hanging tag cost obfuscation `0->A, 1->B...`, recall-with-scan, return rate alteration policies) retain their exact operational workflows while gaining cloud synchronization and immutable audit trails.
- **Fail-Closed Migration Harness**: The migrator runs in a single transaction block and supports `--dry-run`, ensuring that schema validation or constraint failures trigger a clean rollback without corrupting tenant data planes.

---

## 7. Implementation Summary
- Extracted 78 core system parameters across 13 functional categories from 185 `.S9Q` scripts and 596 parameter definition files.
- Seeded `POLICY_BILLING_CONTROLS`, `POLICY_BARCODE_COST_MASK`, `POLICY_INWARDS_PROCUREMENT`, and `POLICY_CREDIT_MANAGEMENT` into `ControlPlaneSeeder`.
- Built `Shoper9TenantMigrator` with end-to-end migration handlers for Parties, Items, Variants, Barcodes, and Stock Movements.
- Verified dry-run execution against `smriti001` with clean rollback and invariant assertion.

---

## 8. Tests Executed
1. `python scripts/admin/sh9_cfg_extract.py`: Successfully extracted and generated `SH9_CONFIG_CATALOG.json` and `SH9_CONFIG_SUMMARY.md`.
2. `python scripts/admin/sh9_migrator.py --tenant-db smriti001 --company-id COMP-001 --dry-run`: Pre-flight migration dry-run completed with `Invariant Verification: Balanced=True`.
3. `python -m pytest backend/tests/t_gov_logic.py backend/tests/t_ctrl_ref.py`: 19/19 tests passed in 13.27s.
4. `python scripts/smriti_naming_guard.py`: 0 naming violations.
5. `npx tsc --noEmit`: 0 TypeScript errors.

---

## 9. Verification Results

```text
Implementation Status

✓ Code Complete
✓ Tests Passed (19/19 passed in 13.27s)
✓ Invariant Verification Passed (Balanced=True)
✓ Documentation Updated
✓ Wiki & Walkthrough Updated
✓ CHANGELOG Updated (v3.63.0)
✓ Architecture Blueprint Published
✓ Zero TypeScript Errors
✓ Naming Policy Passed (0 violations)

Evidence Level: A (Executable Automated Code & Invariant Proofs)
```

---

## 10. Known Limitations
- Live direct SQL Server / OLEDB connection streaming requires network reachability to legacy host servers; offline CSV/JSON extract ingestion is recommended for air-gapped stores.

---

## 11. Future Work
- Visual Store Policy Configuration Studio in React under Admin workspace to toggle and customize AST retail policies interactively.
- Direct Tally XML import hook in Integration Hub.

---

## 12. Related ADRs
- `ADR-001`: Multi-Tenant Control Plane vs. Tenant Data Plane Isolation.
- `ADR-014`: Universal Party & Item Master Convergence.
- `ADR-022`: Governed Logic AST Dynamic Rule Engine.

---

## 13. Related RFCs
- `RFC-034`: Legacy POS & ERP Migration Pipeline Specification.
- `RFC-045`: Control Plane Reference Data and Operational Policy Governance.
