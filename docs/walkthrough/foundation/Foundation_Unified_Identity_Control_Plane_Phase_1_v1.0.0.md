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
  Classification: Internal
-->

# Phase 1: SMRITI Unified Identity Control Plane & Numbering Engine Walkthrough

**Document Version:** v1.0.0  
**Date:** 2026-09-18  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal Core Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose
This walkthrough documents the complete implementation, hardening, and verification of **Phase 1: SMRITI Unified Identity Control Plane & Numbering Engine**.
Phase 1 establishes a centralized, transaction-safe identity control plane across the SMRITI platform. It introduces RFC 9562-compliant UUIDv7 technical identities, centrally governed human-readable `identity_code` identifiers (e.g. `MST-ITM-00000001`), atomic PostgreSQL `SELECT FOR UPDATE` numbering sequences, and multi-tier tenant-isolated resolution, while strictly preserving 100% of existing primary and foreign keys without disruptive schema re-keying.

---

## 2. Scope
- **Preserve Existing Business Tables:** Zero PK/FK schema modifications or re-keying on existing tables (`items`, `products`, `customers`, `sales_invoices`, etc.). All 268 tables and 312 existing foreign key constraints continue pointing to `*.id`.
- **Control Plane Schema:** 4 canonical singular tables deployed via Alembic migration `v1464`:
  - `smriti_identity_registry`
  - `smriti_numbering_registry`
  - `smriti_identity_alias`
  - `smriti_identity_allocation_log`
- **RFC 9562 UUIDv7 Implementation:** 48-bit Unix millisecond timestamp + sub-millisecond generator-specific monotonic entropy. Database primary key / unique constraints enforce final collision protection.
- **Identity Triad Separation:** Strict architectural isolation between:
  - Technical Identity (`id`: UUIDv7 canonical PK)
  - Governed Human Identity (`identity_code`: e.g. `MST-ITM-00001245`, never used as FK)
  - Business Identifiers (`item_code`, `invoice_no`, `order_no`, SKU, Barcode)
- **Transactional Numbering Engine:** High-concurrency, race-safe sequence allocator with atomic row-level locking (`SELECT FOR UPDATE`) and nested savepoint recovery for first-touch scope initialization.
- **Tenant-Scoped Identity Resolver:** Multi-tier entity resolution enforcing strict tenant and company scoping, preventing cross-tenant leakage.
- **Identity Contract & Client ID Rejection:** Complete prohibition of client-supplied persistent IDs. Frontend `crypto.randomUUID()` removed in `SalesOrderTab.tsx:62`. Backend `SalesOrderCreate` explicitly rejects client-supplied `id` with HTTP 422.
- **Service Integration:** `SalesService.create_sales_order` routes persistent ID creation strictly through `IdentityEngine.allocate_internal()`. Direct imports of `uuid7` outside `backend/app/services/identity/` are prohibited.
- **Preflight Certification & CI Architecture Gate:** 11/11 checks passed with 0 P0/P1 violations on `architecture_duplication_gate.py`, including the new Identity Generation Governance Gate (Rule 9).

---

## 3. Files Created
1. `backend/app/models/identity_registry.py` — SQLAlchemy ORM models for the 4 identity control-plane tables (`SmritiIdentityRegistry`, `SmritiNumberingRegistry`, `SmritiIdentityAlias`, `SmritiIdentityAllocationLog`).
2. `backend/alembic/versions/v1464_smriti_unified_identity_control_plane.py` — Canonical Alembic migration for PostgreSQL tables, indexes, and seed taxonomy.
3. `backend/app/services/identity/uuid7.py` — RFC 9562 UUIDv7 generator.
4. `backend/app/services/identity/code_generator.py` — Transactional Numbering Engine (`SELECT FOR UPDATE`).
5. `backend/app/services/identity/validator.py` — Governed syntax, 16-group taxonomy, and registry validator.
6. `backend/app/services/identity/resolver.py` — Tenant-isolated polymorphic identity resolver.
7. `backend/app/services/identity/engine.py` — Canonical `IdentityEngine` facade (`allocate_internal`, `generate_identity`, `validate_code`, `resolve_identifier`).
8. `backend/app/services/identity/__init__.py` — Package exports.
9. `backend/app/schemas/identity.py` — Pydantic v2 schemas for allocate, validate, and resolve operations.
10. `backend/app/api/v1/identity.py` — FastAPI router (`POST /api/v1/identity/allocate`, `/validate`, `/resolve`).
11. `backend/app/tests/test_identity_engine.py` — Comprehensive PostgreSQL concurrency and contract test suite (7 tests).
12. `scripts/deep_identity_audit.py` — Codebase-wide scanner for ID generation patterns.
13. `scripts/verify_v1464_tables.py` — Database schema and column parity validator (Rule 12).
14. `scripts/register_phase1_architecture.py` — Architecture preflight registration and certification issuer.
15. `docs/identity/IDENTITY_GENERATOR_INVENTORY.md` — Complete inventory of legacy and client ID generators.
16. `docs/identity/SMRITI_IDENTITY_AUDIT_REPORT.md` — Deep audit report for SMRITI identity architecture.
17. `docs/implementation/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md` — Phase 1 Implementation Plan.

---

## 4. Files Modified
1. `backend/app/models/__init__.py` — Exported `SmritiIdentityRegistry`, `SmritiNumberingRegistry`, `SmritiIdentityAlias`, `SmritiIdentityAllocationLog`.
2. `backend/alembic/env.py` — Registered `SmritiIdentityRegistry` metadata for Alembic autogenerate tracking.
3. `backend/app/main.py` — Registered `identity_router` under prefix `/api/v1/identity`.
4. `backend/app/core/config.py` — Hardened `.env` file discovery to search parent directories.
5. `backend/app/tests/conftest.py` — Injected test security keys and resolved `.env` loading.
6. `backend/app/schemas/sales.py` — Added `@field_validator("id")` on `SalesOrderCreate` explicitly rejecting client-supplied IDs.
7. `backend/app/services/sales.py` — Replaced direct `uuid7()` import with `IdentityEngine.allocate_internal()`.
8. `scripts/architecture_duplication_gate.py` — Added Rule 9 Identity Generation Governance check blocking direct `uuid7` imports outside `backend/app/services/identity/`.
9. `src/components/sales/SalesOrderTab.tsx` — Removed client-side `crypto.randomUUID()` persistent ID generation.
10. `docs/walkthrough/README.md` — Appended Phase 1 walkthrough record.
11. `docs/implementation/README.md` — Updated Phase 1 plan status to Completed.

---

## 5. Architecture Decisions
1. **Zero PK/FK Migration in Phase 1:** The database audit identified 268 tables and 312 FK constraints in `smritisys`, 100% of which point to `*.id` columns. Re-keying existing tables would introduce massive operational risk. Phase 1 establishes the control plane without touching existing primary keys or foreign keys.
2. **Identity Triad:** Technical identity (`id`), governed identity (`identity_code`), and business identity (`item_code`, `invoice_no`) are distinct orthogonal concepts. `identity_code` is human-readable, centralized, and strictly forbidden from being used as a foreign key.
3. **Internal-First Generation:** Production entities allocate identities internally via `IdentityEngine.allocate_internal()`. The HTTP endpoint `POST /api/v1/identity/allocate` is strictly restricted to administrative, preview, or testing workflows.
4. **Client ID Rejection:** In adherence to the Identity Contract, clients are prohibited from supplying persistent technical IDs. The backend validates and rejects payloads containing client IDs.
5. **PostgreSQL Row Locks (`SELECT FOR UPDATE`):** Sequence numbers are incremented atomically inside a database transaction with row-level locks, ensuring monotonic, serialized sequences for committed allocations.
6. **Rollback & Gap Policy:** Sequence increments roll back with their parent transaction when aborted. The numbering engine provides gapless sequences for committed workloads, while gaps arising from uncommitted transaction rollbacks are governed by business document policy.
7. **Nested Savepoints for First-Touch Concurrency:** To eliminate race conditions when multiple workers allocate sequence #1 for a new series simultaneously, dynamic row creation is isolated in `session.begin_nested()`, seamlessly catching `IntegrityError` and falling back to `SELECT FOR UPDATE`.
8. **Polymorphic Alias Mapping:** `smriti_identity_alias` maps legacy identifiers (e.g. Shoper 9 codes) to canonical technical UUIDs across heterogeneous entities without creating fragile cross-table foreign keys.
9. **Singular Table Naming:** All 4 control-plane tables follow uniform singular naming: `smriti_identity_registry`, `smriti_numbering_registry`, `smriti_identity_alias`, `smriti_identity_allocation_log`.

---

## 6. Design Rationale
- **Why UUIDv7 instead of UUIDv4:** UUIDv4 introduces index fragmentation in B-trees due to pseudo-random distribution. UUIDv7 prefixes the identifier with a 48-bit millisecond timestamp, providing time-ordered locality, improved B-tree cache hit rates, and sequential index insertions.
- **Why Identity Generation Gate:** Direct imports of `uuid7` create an architectural bypass. Funneling all identity generation through `IdentityEngine` guarantees that allocation auditing, numbering rules, and tenant scoping are always applied.
- **Why Savepoint Isolation in Resolver:** Probing physical tables for `identity_code` before those tables are migrated causes PostgreSQL to abort the transaction if the column is absent. Wrapping table queries in nested savepoints preserves transaction health.

---

## 7. Implementation Summary
### Control Plane Database Schema (Alembic v1464)
- **`smriti_identity_registry`**: Catalogs all registered entities, their domain groups, code prefixes, formatting rules, and target tables. Pre-seeded with 16 core entities (`ORG`, `COMP`, `BRCH`, `DEPT`, `USER`, `ROLE`, `ITM`, `CAT`, `UOM`, `BAR`, `INV`, `SO`, `CUS`, `VND`, `PO`, `RPT`).
- **`smriti_numbering_registry`**: Manages current sequence counters scoped by `(tenant_id, company_id, branch_id, group_code, entity_type, series_key, financial_year)`. Features partial unique indexes handling PostgreSQL `NULL` semantics.
- **`smriti_identity_alias`**: Provides polymorphic resolution mapping historical codes to canonical UUIDs.
- **`smriti_identity_allocation_log`**: Immutable audit ledger recording every allocation with timestamp, scope, purpose, and requesting actor.

### Identity Engine Core
- **`uuid7()`**: Generates 36-character hyphenated UUIDv7 strings conforming to RFC 9562 with millisecond ordering and 12-bit monotonic counter.
- **`IdentityCodeGenerator`**: Atomically claims the next sequence number using PostgreSQL row locking and formats the human-readable code (e.g., `MST-ITM-00000001`).
- **`IdentityValidator`**: Enforces strict format validation against approved groups and entity patterns.
- **`IdentityResolver`**: Resolves identifiers across 3 tiers (Tier 1A: Allocation Log; Tier 1B: Primary Table; Tier 2: Alias Registry) with mandatory tenant boundaries.

---

## 8. Tests Executed
The test suite `backend/app/tests/test_identity_engine.py` was executed against local PostgreSQL (`smritisys`):
```powershell
pytest app/tests/test_identity_engine.py -v
```

### Test Cases:
1. `test_uuid7_rfc9562_properties`: Validates 36-char string format, UUID version 7, variant 1 (RFC 9562), and monotonic ordering across 1,000 rapid allocations.
2. `test_identity_code_validator_taxonomy`: Tests valid codes across all 16 SMRITI domain groups and asserts rejection of invalid groups, bad formats, and malformed prefixes.
3. `test_postgresql_100_concurrent_allocations`: Spawns 100 simultaneous asynchronous transactions against PostgreSQL using a bounded connection pool. Asserts exactly 100 unique UUIDs, 100 unique identity codes, zero collisions, zero gaps (`00000001` through `00000100`) for committed transactions, and 100 audit ledger logs.
4. `test_transactional_rollback_policy`: Validates that a rolled-back allocation transaction does not permanently advance the committed database sequence.
5. `test_tenant_isolated_resolution`: Verifies that an entity allocated in Tenant A resolves successfully for Tenant A but is strictly invisible (found=False) to Tenant B.
6. `test_alias_polymorphic_resolution`: Verifies that a legacy Shoper 9 code mapped in `smriti_identity_alias` correctly resolves to the canonical UUIDv7 technical ID.
7. `test_client_id_rejection_and_internal_allocation`: Asserts that client payloads attempting to supply a persistent technical ID are rejected with validation errors, and verifies that `IdentityEngine.allocate_internal` generates canonical UUIDv7 + governed identity_code with audit logging.

---

## 9. Verification Results
- **Pytest Suite:** 7/7 tests passed (100% green).
- **Architecture Duplication Gate:** 11/11 checks executed, 0 P0/P1 violations, PASSED.
- **Alembic Migration:** Database `smritisys` migrated to head `v1464_smriti_unified_identity_control_plane`.
- **Schema Parity:** Full column-by-column, datatype, and constraint verification passed via `scripts/verify_v1464_tables.py`.

---

## 10. Known Limitations
- **Legacy Entities Not Yet Backfilled:** Historical records in existing tables (`items`, `sales_invoices`, `customers`) currently lack `identity_code` values. This is intentional per Phase 1 scope.
- **Physical Table Probing:** Until `identity_code` columns are added to business tables in subsequent phases, entity resolution relies primarily on Tier 1A (Allocation Log) and Tier 2 (Alias Registry).
- **Repository-Wide Migration Debt:** Sales Orders serve as the first production entity creation integration. Other legacy entity generation patterns across the repository remain cataloged debt for subsequent waves.

---

## 11. Future Work
- **Phase 1.1:** Backfill `identity_code` for core master data (`companies`, `branches`, `items`, `customers`, `suppliers`).
- **Phase 1.2:** Add `identity_code` column to transactional tables (`sales_invoices`, `purchase_orders`).
- **Phase 1.3:** Implement automated historical alias import from legacy Shoper 9 databases.

---

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + PostgreSQL Backend System of Record.
- `ADR-005`: One-Way Projections & Statutory Snapshot Rule.
- `ADR-008`: SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture v1.0.

---

## 13. Related RFCs
- `RFC 9562`: Universally Unique IDentifiers (UUIDs) — UUID Version 7.
- `RFC-SMRITI-014`: Centralized Identity Control Plane and Numbering Registry.
