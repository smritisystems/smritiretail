<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Core Architecture
-->

# SMRITI Unified Identity Phase 1.1 — Business Entity Identity-Code Integration & Legacy Alias Migration Implementation Plan

**Plan Identifier:** `IP-PHASE1-1-IDENTITY-v1.0.0`  
**Date:** 2026-09-18  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Core Architecture Implementation Plan  
**Status:** Completed  

---

## 1. Objective
Execute **Phase 1.1: Business Entity Identity-Code Integration & Legacy Alias Migration**.  
Following the successful freeze of the Phase 1 Identity Control Plane (`v1.1.0`), Phase 1.1 performs an additive adoption of `identity_code` across 5 core business entities:
1. `companies` (`ORG-CMP-...`)
2. `branches` (`ORG-BRN-...`)
3. `items` (`MST-ITM-...`)
4. `customers` (`CRM-CUS-...`)
5. `suppliers` (`PUR-SUP-...`)

Phase 1.1 backfills governed identity codes for historical records, links legacy Shoper 9 identifiers into `smriti_identity_alias`, updates read DTOs, and enables physical-table Tier 1B resolution, while **strictly preserving 100% of existing `*.id` primary keys and all 312 foreign key relationships**.

---

## 2. Business Motivation
- **Single SMRITI Human Identity Across Core Entities:** Retail operators, warehouse managers, accountants, and auditors require uniform, human-readable codes (e.g. `MST-ITM-00001245`, `CRM-CUS-00000520`) rather than disparate, truncated UUIDs or ad-hoc strings.
- **Legacy Shoper 9 Interoperability:** Historical Shoper 9 codes must remain instantly searchable and resolvable via `smriti_identity_alias` without polluting canonical identity codes.
- **Zero Disruption Guarantee:** Re-keying 268 tables and 312 foreign keys poses catastrophic operational risks. Phase 1.1 is strictly additive: business primary keys (`id`) and existing business codes (`item_code`, `code`) remain untouched.

---

## 3. Scope
- **Target Entities (5 core tables):**
  - `companies`
  - `branches`
  - `items`
  - `customers`
  - `suppliers`
- **Additive Database Schema:**
  - Alembic migration `v1465_phase1_1_business_entity_identity_code_integration.py` adding `identity_code VARCHAR(100) NULL` and B-tree indexes.
- **Deterministic Historical Backfill:**
  - Migration script allocating governed `identity_code` for existing rows using `IdentityEngine`.
  - Recording issuances in `smriti_identity_allocation_log` (`purpose="MIGRATION_BACKFILL"`).
  - Updating `smriti_numbering_registry.sequence_value`.
- **Legacy Alias Migration:**
  - Ingesting historical Shoper 9 codes (`item_code`, `code`, `legacy_code`) into `smriti_identity_alias` pointing to canonical technical IDs.
- **Service Layer Creation Integration:**
  - Ensuring entity creation services for Company, Branch, Item, Customer, and Supplier invoke `IdentityEngine.allocate_internal()` to assign `identity_code` upon creation.
- **Read Schemas & DTO Exposure:**
  - Exposing `identity_code: Optional[str] = None` on read schemas.
- **Exclusions (Out of Scope):**
  - No primary key or foreign key migration.
  - Transactional tables (`sales_invoices`, `purchase_orders`, etc.) deferred to Phase 1.2.

---

## 4. Current State
- Phase 1 Control Plane is frozen and verified:
  - 4 control-plane tables: `smriti_identity_registry`, `smriti_numbering_registry`, `smriti_identity_alias`, `smriti_identity_allocation_log`.
  - `IdentityEngine` is active and enforces RFC 9562 UUIDv7 and `SELECT FOR UPDATE` atomic numbering.
  - Architecture Gate Rule 9 actively blocks direct `uuid7` imports.
- Business tables (`companies`, `branches`, `items`, `customers`, `suppliers`) currently lack the `identity_code` column.
- Historical records in these 5 tables currently have legacy primary keys (`id`) and business codes (`item_code`, `company_code`, `code`) but zero SMRITI governed identity codes.

---

## 5. Gap Analysis

| Dimension | Current State (Post-Phase 1) | Target State (Post-Phase 1.1) |
|---|---|---|
| `companies` Schema | No `identity_code` | Has `identity_code VARCHAR(100)` + index |
| `branches` Schema | No `identity_code` | Has `identity_code VARCHAR(100)` + index |
| `items` Schema | No `identity_code` | Has `identity_code VARCHAR(100)` + index |
| `customers` Schema | No `identity_code` | Has `identity_code VARCHAR(100)` + index |
| `suppliers` Schema | No `identity_code` | Has `identity_code VARCHAR(100)` + index |
| Historical Records | No governed identity codes | 100% backfilled with sequential `identity_code` |
| Sequence Counters | Initial seed values | Advanced to match backfilled record counts |
| Allocation Audit | Only test allocations | Complete backfill ledger in `smriti_identity_allocation_log` |
| Shoper 9 Master Codes | Unlinked in business columns | Linked in `smriti_identity_alias` (`source_system="SHOPER9"`) |
| Entity Resolution (Tier 1B) | Falls back due to missing column | Sub-millisecond direct match on physical tables |

---

## 6. Architecture Impact
- **Database Plane:** 5 additive `ALTER TABLE ... ADD COLUMN identity_code VARCHAR(100)` statements with partial/full indexes. Zero FK impact.
- **Domain Services:** `ItemService`, `CustomerService`, `SupplierService`, `CompanyService` obtain `identity_code` through `IdentityEngine.allocate_internal()`.
- **Identity Resolver:** Tier 1B resolution activates on physical tables without nested savepoint failures.
- **Governance:** Preserves Rule 9 Gate compliance.

---

## 7. Proposed Design

```text
                                EXISTING DATABASE RECORD
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                  Existing PK/FK                       Existing Business Code
                   companies.id                              items.item_code
                     items.id                                customers.code
                   customers.id                              suppliers.code
                  suppliers.id                                branches.code
                        │                                     │
                        │ NO CHANGE                           │ PRESERVED
                        ▼                                     ▼
                  relational integrity                  business operations
                        │                                     │
                        └──────────────────┬──────────────────┘
                                           ▼
                                 PHASE 1.1 ADDITIONS
                                           │
                   ┌───────────────────────┴───────────────────────┐
                   ▼                                               ▼
          ADDITIVE COLUMN                                    ALIAS REGISTRY
       table.identity_code                              smriti_identity_alias
      (MST-ITM-00001245)                                (alias_code: "OLD-SKU-99")
               ▲                                                │
               │                                                ▼
        IdentityEngine                                  resolves to canonical
      (PostgreSQL Row Lock)                                 technical ID
```

---

## 8. Files Created
1. `backend/alembic/versions/v1465_phase1_1_business_entity_identity_code_integration.py` — Migration adding `identity_code` columns, creating indexes, and executing deterministic backfill with alias ingestion.
2. `backend/app/tests/test_phase1_1_entity_integration.py` — Test suite validating column presence, backfill sequence continuity, creation lifecycle, and Tier 1B resolution across all 5 entities.
3. `scripts/verify_phase1_1_parity.py` — Column-by-column Rule 12 verification script for the 5 modified tables.

---

## 9. Files Modified
1. `backend/app/models/tenant.py` — Add `identity_code = Column(String(100), nullable=True, index=True)` to `Company` and `Branch`.
2. `backend/app/models/item_master.py` — Add `identity_code = Column(String(100), nullable=True, index=True)` to `Item`.
3. `backend/app/models/crm.py` — Add `identity_code = Column(String(100), nullable=True, index=True)` to `Customer`.
4. `backend/app/models/purchase.py` — Add `identity_code = Column(String(100), nullable=True, index=True)` to `Supplier`.
5. `backend/app/schemas/item.py` — Add `identity_code: Optional[str] = None` to `ItemResponse`.
6. `backend/app/schemas/crm.py` — Add `identity_code: Optional[str] = None` to `CustomerResponse`.
7. `backend/app/schemas/supplier.py` — Add `identity_code: Optional[str] = None` to `SupplierResponse`.
8. `backend/app/schemas/tenant.py` — Add `identity_code: Optional[str] = None` to `CompanyResponse` and `BranchResponse`.
9. `backend/app/services/identity/resolver.py` — Optimize Tier 1B resolution for the 5 verified physical tables.
10. `docs/walkthrough/README.md` — Append Phase 1.1 walkthrough upon completion.
11. `docs/implementation/README.md` — Update status to Completed upon execution.

---

## 10. Dependencies
- Phase 1 Control Plane (`v1464_smriti_unified_identity_control_plane.py`).
- PostgreSQL database `smritisys` on localhost:5432.
- `IdentityEngine` facade and `SmritiNumberingRegistry`.

---

## 11. Risks & Mitigation
- **Risk 1: Sequence Counter Drift During Backfill.**  
  *Mitigation:* Backfill calculates total allocated count and performs an atomic update on `smriti_numbering_registry.sequence_value = MAX(allocated_sequence)`.
- **Risk 2: Duplicate Code Collision on Backfill.**  
  *Mitigation:* Backfill uses strict deterministic row ordering (`ORDER BY created_at ASC, id ASC`) and single-pass consecutive enumeration.
- **Risk 3: Performance Impact on Large Tables.**  
  *Mitigation:* Adding nullable columns in PostgreSQL 11+ is instant (metadata-only update). Backfill is executed in transactional batches.

---

## 12. Rollback Strategy
- Migration `downgrade()` drops indexes and columns:
  - `op.drop_index("ix_companies_identity_code", "companies")`
  - `op.drop_column("companies", "identity_code")`
  - (Repeated for `branches`, `items`, `customers`, `suppliers`)
- Rollback deletes backfill entries from `smriti_identity_allocation_log` where `purpose = 'MIGRATION_BACKFILL'`.
- Preserves all underlying `*.id` values, ensuring zero data loss on business tables.

---

## 13. Verification Plan
- **Column AST Parity (Rule 12):** Run `scripts/verify_phase1_1_parity.py` checking datatype, nullability, and index creation for `identity_code` across all 5 tables.
- **Backfill Audit Verification:** Query `smriti_identity_allocation_log` where `purpose = 'MIGRATION_BACKFILL'` and verify that every existing entity has exactly one logged allocation.
- **Sequence Continuity:** Verify `smriti_numbering_registry.sequence_value` equals the total count of backfilled entities for each group.
- **Alias Resolution:** Query `IdentityEngine.resolve_identifier()` with historical codes and verify resolution to canonical IDs.

---

## 14. Test Plan
- Run `pytest backend/app/tests/test_phase1_1_entity_integration.py -v`:
  - `test_company_identity_code_lifecycle`: Verify new company creation assigns `ORG-CMP-...` and resolves.
  - `test_branch_identity_code_lifecycle`: Verify new branch creation assigns `ORG-BRN-...` and resolves.
  - `test_item_identity_code_lifecycle`: Verify new item creation assigns `MST-ITM-...` and resolves.
  - `test_customer_identity_code_lifecycle`: Verify new customer creation assigns `CRM-CUS-...` and resolves.
  - `test_supplier_identity_code_lifecycle`: Verify new supplier creation assigns `PUR-SUP-...` and resolves.
  - `test_tier_1b_physical_table_resolution`: Verify Tier 1B sub-millisecond resolution on physical tables.
  - `test_legacy_alias_resolution_for_backfilled_items`: Verify historical Shoper 9 item codes resolve via alias.
- Run `python scripts/architecture_duplication_gate.py` (Rule 9 Gate must pass with 0 violations).
- Run `npm run lint` (`tsc --noEmit`).

---

## 15. Documentation Impact
- Create Walkthrough: `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_1_Business_Entity_Integration_v1.0.0.md`.
- Update Master Index: `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Update `CHANGELOG.md` with release notes for Phase 1.1.

---

## 16. Deployment Plan
1. Apply Alembic migration `v1465`: `python -m alembic upgrade head`.
2. Run parity validation script: `python scripts/verify_phase1_1_parity.py`.
3. Run test suite: `pytest backend/app/tests/test_phase1_1_entity_integration.py -v`.
4. Run CI architecture gate: `python scripts/architecture_duplication_gate.py`.

---

## 17. Status
Completed — Fully verified with direct observable evidence per AGENTS.md (12/12 tests green, AST & schema parity passed, Rule 9 Gate passed).

---

## 18. Related ADRs
- `ADR-001`: Sole FastAPI + PostgreSQL Backend System of Record.
- `ADR-008`: SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture v1.0.
- `ADR-015`: Zero Business Table PK/FK Rekey Invariant.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md` (Phase 1 Baseline).
- To be created upon execution: `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_1_Business_Entity_Integration_v1.0.0.md`.
