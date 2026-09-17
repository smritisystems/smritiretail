<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.34.1
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Unified Identity Control Plane & Numbering Engine (Phase 1 - Revised & Frozen)

**Plan ID:** IP-FDN-ID-v1.0.0  
**Status:** In Progress  
**Area:** Foundation / Core Platform  
**Target Version:** v6.34.1  
**Blueprint Reference:** SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture v1.0  

---

## 1. Objective
Establish the platform-wide **SMRITI Identity Control Plane** (`smriti_identity_registry`, `smriti_numbering_registry`, `smriti_identity_alias`, `smriti_identity_allocation_log`) and core **Identity Engine** (RFC 9562 UUIDv7 generator, atomic row-locked Identity Code Generator, tenant-scoped Identity Resolver, registry-driven Identity Validator, and administrative REST APIs) without altering or re-keying any existing business table primary keys.

## 2. Business Motivation
The repository audit revealed 14+ ad-hoc backend ID generators (including 32-bit truncated hex `uuid.uuid4().hex[:8]`), redundant dual-key definitions (`id` varchar(50) + `uuid` varchar(36)), and frontend persistent ID creation (`SalesOrderTab.tsx:62`). SMRITI requires one unified, immutable technical identity (UUIDv7) paired with governed, human-friendly identity codes (`MST-ITM-00001245`) to enable reliable multi-branch, multi-tenant auditing, reporting, and offline-first synchronization.

## 3. Scope
- **Included:**
  - Control Plane Models: `SmritiIdentityRegistry`, `SmritiNumberingRegistry`, `SmritiIdentityAlias`, `SmritiIdentityAllocationLog`.
  - Core Services: `IdentityEngine` (UUIDv7), `IdentityCodeGenerator` (row-locked counter allocation), `IdentityResolver` (tenant-scoped, registry-driven resolution), `IdentityValidator` (registry-driven format & taxonomy verification).
  - Remediation of frontend persistent ID generation in `SalesOrderTab.tsx`.
  - API Schemas & FastAPI Router (`/api/v1/identity/*`) with administrative `/allocate` endpoint.
  - Alembic Migration `v1464_smriti_unified_identity_control_plane.py` creating the 4 control plane tables with NULL-safe unique constraints and seeding the 16-group taxonomy (`ORG`, `MST`, `INV`, `SAL`, `PUR`, `POS`, `FIN`, `TAX`, `CRM`, `RPT`, `FCT`, `COL`, `ACT`, `AUD`, `INT`, `SYS`).
  - Real PostgreSQL concurrency and unit test suite (`test_identity_engine.py`) verifying 100 simultaneous allocations.
- **Excluded:**
  - Business table schema changes or PK migrations (`items`, `products`, `sales_invoices`, etc.) are explicitly deferred to subsequent phases to ensure zero disruption.

## 4. Current State
- 268 base tables in `smritisys` with 312 foreign key constraints. 100% of FKs point to `*.id` (varchar(50) or integer), none to `*.uuid`.
- No central identity registry or numbering registry exists.
- Business identifiers (`item_code`, `order_no`, `sku`) exist as independent columns with no unified structure.

## 5. Gap Analysis
| Architecture Requirement | Current State | Phase 1 Remedy |
| :--- | :--- | :--- |
| Canonical UUIDv7 Generator | Fragmented `uuid.uuid4()` & `uuid4().hex[:8]` | RFC 9562 pure-Python UUIDv7 with millisecond timestamp + monotonic entropy |
| Governed Human Identity Code | Zero tables have `identity_code` | `IdentityCodeGenerator` allocating registry-governed `GROUP-ENTITY-SEQUENCE` |
| Identity Control Plane Registry | None | Table `smriti_identity_registry` seeded with all 16 platform groups |
| Governed Numbering Registry | `DocumentSeries` (Shoper 9 parity only) | Table `smriti_numbering_registry` managing platform-wide atomic sequence counters |
| Identity Resolver | Custom ad-hoc queries | Centralized `IdentityResolver` supporting tenant-scoped, registry-driven resolution |
| Frontend ID Discipline | `SalesOrderTab.tsx:62` generates `id: crypto.randomUUID()` | Remove client PK generation; backend owns persistent ID assignment |
| Provenance Audit Trail | No identity allocation log | Table `smriti_identity_allocation_log` records all code and technical ID issuances |

## 6. Architecture Impact
- Introduces `backend/app/services/identity/` as the platform authority for ID generation.
- Enforces strict separation: `id` (technical) ≠ `identity_code` (governed human code) ≠ `item_code`/`order_no` (business identifier) ≠ `barcode` (external/scannable).
- Zero impact on existing transactional writes during Phase 1.

## 7. Proposed Design
```text
                         SMRITI PLATFORM
                                │
                                ▼
                   ┌─────────────────────────┐
                   │ smriti_identity_registry│
                   └────────────┬────────────┘
                                │
                   Defines Group + Entity Rules
                                │
                                ▼
                   ┌─────────────────────────┐
                   │ smriti_numbering_registry│
                   └────────────┬────────────┘
                                │
                   SELECT FOR UPDATE Row Lock
                                │
                                ▼
                   ┌─────────────────────────┐
                   │ SMRITI Identity Engine  │
                   └────────────┬────────────┘
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
            TECHNICAL ID              HUMAN IDENTITY
               UUIDv7                 GROUP + ENTITY + SEQ
      (0198c7e4-8d42-7a...)             (MST-ITM-00001245)
                                             │
                                             ▼
                               ┌─────────────────────────┐
                               │smriti_identity_alloc_log│
                               └─────────────────────────┘
```

## 8. Files Created
1. `backend/app/models/identity_registry.py`
2. `backend/app/services/identity/__init__.py`
3. `backend/app/services/identity/uuid7.py`
4. `backend/app/services/identity/code_generator.py`
5. `backend/app/services/identity/resolver.py`
6. `backend/app/services/identity/validator.py`
7. `backend/app/services/identity/engine.py`
8. `backend/app/schemas/identity.py`
9. `backend/app/api/v1/identity.py`
10. `backend/alembic/versions/v1464_smriti_unified_identity_control_plane.py`
11. `backend/app/tests/test_identity_engine.py`
12. `docs/implementation/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md`

## 9. Files Modified
1. `backend/app/models/__init__.py` (exports new models)
2. `backend/app/main.py` (registers `/identity` router)
3. `src/components/sales/SalesOrderTab.tsx` (remediates client persistent ID generation)
4. `docs/implementation/README.md` (updates master index)

## 10. Dependencies
- Standard Python 3.13 (`time`, `os`, `uuid`, `re`, `threading`).
- SQLAlchemy 2.0.36 (`Column`, `String`, `Integer`, `Boolean`, `Text`, `DateTime`, `ForeignKey`, `UniqueConstraint`, `select`, `text`).
- FastAPI & Pydantic v2.

## 11. Risks & Mitigations
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Sequence contention under high concurrency | Medium | Row-level locks (`SELECT ... FOR UPDATE`) with short transactions; documented gap semantics for rolled-back allocations |
| Distributed UUIDv7 collision | Low | Millisecond timestamp + 12-bit monotonic sequence counter + 62-bit cryptographic entropy; DB primary key enforces final protection |
| PostgreSQL NULL uniqueness | Medium | Use `COALESCE` / empty-string sentinels on nullable scope columns in unique indexes |
| Destructive migration downgrade | High | Migration downgrade is guarded; aborts if runtime registry records or allocation logs exist |

## 12. Rollback Strategy
The Alembic migration `v1464` includes guarded `downgrade()` logic that prevents dropping tables if allocation logs exist, protecting audit history. Application router can be safely disabled without affecting core operations.

## 13. Verification Plan
- Unit tests for RFC 9562 bit layout (version 7, variant 10).
- Real PostgreSQL concurrency test (100 simultaneous allocations, zero duplicates).
- Resolver tenant-isolation and registry routing test.
- Alembic upgrade/downgrade safety verification.

## 14. Test Plan
- Run `pytest backend/app/tests/test_identity_engine.py -v`.
- Run `python scripts/architecture_duplication_gate.py`.

## 15. Documentation Impact
- Updates `docs/implementation/README.md`.
- Generates walkthrough upon completion (`docs/walkthrough/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md`).

## 16. Deployment Plan
1. Run `python -m alembic upgrade head` on `smritisys`.
2. Verify table creation and seed data.
3. Deploy updated FastAPI server.

## 17. Status
Completed & Verified.

## 18. Related ADRs
- ADR-001: Canonical PostgreSQL SoR.
- ADR-008: Universal Author Details Policy.
- ADR-015: SMRITI Unified Identity Architecture v1.0.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md`.
