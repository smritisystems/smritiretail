<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-03
  Modified     : 2026-09-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough: SMRITI Architecture Governance Enforcement Layer v3.30.0

## 1. Purpose
Establish a permanent, automated Architecture Governance Enforcement Layer to guarantee Single Source of Truth (SSOT) across all business domains. This system prevents developers and AI agents from creating duplicate database tables, columns, backend models, API routes, or frontend components through both obvious naming collisions and semantic capability duplication under different names.

## 2. Scope
- PostgreSQL database control plane metadata schema (`architecture_domains`, `architecture_entities`, `architecture_capabilities`, `architecture_files`, `architecture_apis`, `architecture_decisions`).
- Additive non-breaking extensions to existing `field_definitions` and `screen_definitions`.
- Preflight CLI tool (`scripts/architecture_preflight.py` / `npm run architecture:preflight`).
- Semantic fingerprinter engine (`scripts/lib/semantic_fingerprinter.py`).
- CI / pre-commit duplication gate (`scripts/architecture_duplication_gate.py` / `npm run architecture:check`).
- Capability typing and decorators in TypeScript (`src/types/architecture.ts`) and Python (`backend/app/core/governance.py`).
- Deterministic seeder with frozen investigation ADRs for disputed areas.
- **STRICT SAFETY BOUNDARY:** Zero business data modified, zero business code refactored, zero components deleted.

## 3. Files Created
- `backend/app/models/architecture_governance.py`
- `backend/alembic/versions/v1394_architecture_governance_enforcement.py`
- `backend/app/db/seed_architecture_governance.py`
- `backend/app/core/governance.py`
- `scripts/apply_governance_migration.py`
- `scripts/architecture_preflight.py`
- `scripts/architecture_duplication_gate.py`
- `scripts/lib/semantic_fingerprinter.py`
- `src/types/architecture.ts`
- `src/tests/architectureGovernance.test.ts`
- `docs/walkthrough/foundation/Foundation_Architecture_Governance_Enforcement_v3.30.0.md`

## 4. Files Modified
- `backend/app/models/ui_control_plane.py` (Additive extensions to `ScreenDefinition` and `FieldDefinition`)
- `package.json` (Added `architecture:preflight` and `architecture:check` npm scripts)

## 5. Architecture Decisions
- **ADR-015:** Canonical Single Source of Truth & Architecture Governance Policy.
- **ADR-FROZEN-001:** `products` vs `items` locked in `ARCHITECTURE_DECISION_REQUIRED` (transitional store for 7-year audit).
- **ADR-FROZEN-002:** `sales_invoice_items` vs `sales_invoice_lines` locked in `ARCHITECTURE_DECISION_REQUIRED`.
- **ADR-FROZEN-003:** Customer Monolith vs Universal Party Model locked in `ARCHITECTURE_DECISION_REQUIRED`.
- **ADR-EXEMPT-004:** Physical stock immutable ledger (`stock_movements`) vs materialized balance cache (`products.stock`) approved under `CACHE`.
- **ADR-EXEMPT-005:** `UniversalBrowseEngine.tsx` vs `AdvancedCustSearch.tsx` approved under `SPECIALIZED_UI`.
- **ADR-EXEMPT-006:** `SalesOrderForm.tsx` approved under `COMPATIBILITY`.

## 6. Design Rationale
Duplication cannot be prevented simply by matching file or component names; an agent could introduce `UniversalCustomerFinder.tsx` instead of `CustomerLookup.tsx`. The governance layer implements a 3-vector semantic fingerprint (AST API routes called, models imported, form fields referenced) combined with mandatory `@SmritiCapability` declarations and the ironclad rule that `UNKNOWN ≠ CREATE_NEW`.

## 7. Implementation Summary
- Applied migration `v1394_arch_governance` to both `smritisys` and `smriti001`.
- Seeded 8 core domains, 8 canonical entities, 7 canonical capabilities, and 6 formal architecture decisions.
- Built `architecture:preflight` supporting 4 mandatory states: `REUSE_EXISTING`, `DUPLICATE_CANDIDATE`, `ARCHITECTURE_DECISION_REQUIRED`, and `CREATE_APPROVED`.
- Built `architecture:check` enforcing dual-folder prohibition, suffix collisions, unmounted backend routers, deprecated engine imports, and statutory audit shields.

## 8. Tests Executed
1. `python scripts/architecture_preflight.py --entity customer --capability lookup`: Verified `REUSE_EXISTING` (exit code 1).
2. `python scripts/architecture_preflight.py --entity customer --capability custom --name UniversalCustomerFinder.tsx`: Verified `DUPLICATE_CANDIDATE` (exit code 1).
3. `python scripts/architecture_preflight.py --entity inventory --capability modify --name products`: Verified `ARCHITECTURE_DECISION_REQUIRED` via `ADR-FROZEN-001` (exit code 2).
4. `python scripts/architecture_preflight.py --entity unknown_thing --capability do_something`: Verified `ARCHITECTURE_DECISION_REQUIRED` enforcing `UNKNOWN ≠ CREATE_NEW` (exit code 2).
5. `npm run architecture:check`: Verified 7 checks executed, 0 violations, exit code 0.
6. `npm run test`: Verified 101 test files, 620 tests, 100% green.
7. `npm run build`: Verified 3,526 modules transformed, 0 errors.

## 9. Verification Results
- Database schema parity confirmed: 6 new tables present in both `smritisys` and `smriti001`.
- Additive columns verified in `field_definitions` and `screen_definitions`.
- Full regression suite 100% green.
- Zero business data changed.
- Zero business components deleted.

## 10. Known Limitations
- Semantic AST scanning currently handles Python and TypeScript/TSX; other file formats must be verified via capability metadata.
- Preflight currently connects to local PostgreSQL instance (`smritisys`); a fallback offline cache will be introduced for disconnected environments.

## 11. Future Work
- Phase 2 Cleanup (upon explicit user approval): Migrate callers and tests for candidate modals (`ThreeWayMatchingModal`, `WavePickingStudioModal`, `InterBranchTransferModal`, `CommissionStudioModal`).
- Hydrate PostgreSQL `field_definitions` from `unifiedFieldCatalog.ts` and `globalFieldRegistry.ts`.

## 12. Related ADRs
- ADR-011: Legacy ID Mappings & 7-Year Statutory Audit Protection.
- ADR-015: SMRITI Single Source of Truth & Anti-Duplication Governance Policy.

## 13. Related RFCs
- RFC-042: UI Control Plane & Dynamic Workspace Architecture.
- RFC-089: Gate 11E Universal Item Master & SKU Resolution.
