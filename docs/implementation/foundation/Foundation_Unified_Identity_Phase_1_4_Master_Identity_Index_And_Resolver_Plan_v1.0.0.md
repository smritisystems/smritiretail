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

# SMRITI Unified Identity Phase 1.4 — Master Identity Index & Universal Cross-Domain Entity Resolver Implementation Plan

**Plan ID:** `SMRITI-PLAN-20260918-ID-P14`  
**Target Module:** Foundation / SMRITI Unified Identity Control Plane  
**Downstream Dependency:** Phase 1.0, Phase 1.1, Phase 1.2, Phase 1.3 (All FROZEN)  
**Alembic Target Revision:** `v1468_phase1_4_master_identity_index_and_resolver`  
**Status:** In Progress (Discovery & Architecture Alignment)  

---

## 1. Objective

Design, formalize, and implement **Phase 1.4: Master Identity Index & Universal Cross-Domain Entity Resolver** of the SMRITI Unified Identity Architecture.

Phase 1.4 unifies the identity foundations built and frozen in Phases 1.0 through 1.3 into a centralized, high-throughput, cross-domain resolution and discovery plane. It establishes:
1. An exhaustive **Master Identity Index** cataloging all platform entities and ledger boundaries (`smriti_identity_registry`).
2. A high-performance, multi-tier, polymorphic **Universal Cross-Domain Entity Resolver** (`IdentityResolver`) with batch resolution, reverse identity lookups, and rich `IdentityEnvelope` hydration.
3. An in-memory, tenant-isolated **Resolution Cache** for high-frequency retail POS barcode scans, SKU lookups, and API transactions.
4. Seamless integration with the platform's omnichannel discovery layer (**`UniversalBrowseEngine`** / global `F2` lookup modal across 22 entities).

---

## 2. Business Motivation

In modern omnichannel retail operations, store associates, cashiers, logistics dispatchers, accountants, and external automated connectors constantly interact with entities using disparate, non-standardized identifiers:
- A POS cashier scans an EAN-13 barcode (`8901234567890`) or types an SKU (`TSHIRT-BLK-L`).
- A billing clerk searches by invoice number (`INV-2026-0042`) or legacy Shoper 9 document code (`SHP_INV_9012`).
- An e-commerce connector or payment gateway sends a transaction reference (`pay_29fa81bc7e10`).
- A logistics dispatcher enters an NIC E-Way Bill number (`123456789012`) or transporter vehicle number.
- A tax compliance auditor inspects a counterparty by GSTIN (`27ABCDE1234F1Z5`) or PAN.
- An internal background service or foreign key points to a canonical UUIDv7 (`0198c7e4-8d42-7a19-b231-1e2478ab0192`).
- A store manager searches for a customer by phone number or corporate party by legal name.

Without a unified cross-domain resolution plane, each subsystem must maintain its own ad-hoc SQL search queries, leading to:
- Redundant table scans and N+1 query overhead at POS checkouts.
- Inconsistent tenant-isolation enforcement across search dialogs.
- Inability to perform reverse identity lookups (e.g. displaying all historical aliases and statutory numbers belonging to an invoice or party).
- Fragmented UI search components with duplicated code and divergent keyboard behaviors.

Phase 1.4 provides the **single source of truth for identity resolution and indexing**, enabling any module to resolve any identifier into its canonical identity envelope in sub-millisecond time.

---

## 3. Scope

### In Scope
1. **Master Identity Index Catalog Alignment (Alembic `v1468`):**
   - Register high-throughput ledger boundaries in `smriti_identity_registry`:
     - `FIN` / `PAYMENT_TRANSACTION` (`payment_transactions`, PK `id`, `identity_code_enabled=False`, `system_id_strategy='UUIDv7'`).
     - `INV` / `STOCK_MOVEMENT` (`stock_movements`, PK `id`, `identity_code_enabled=False`, `system_id_strategy='UUIDv7'`).
   - Add reverse lookup indexes:
     - B-Tree index on `smriti_identity_allocation_log (canonical_id)` for reverse lookups.
     - Normalized functional index on `smriti_identity_alias (LOWER(alias_code))` for case-insensitive partner reference matching.
2. **Universal Cross-Domain Entity Resolver Enhancements (`IdentityResolver`):**
   - **Tier 1:** Governed SMRITI Identity Code resolution (`MST-ITM-*`, `SAL-INV-*`, `MST-PRT-*`, `TAX-EWB-*`, `ORG-CMP-*`, etc.) with strict tenant and company scoping.
   - **Tier 2:** Historical and external alias resolution (`smriti_identity_alias`) supporting filtering by `alias_type` and `source_system` (`RAZORPAY`, `NIC_EWAY`, `GSTN`, `SHOPER9`).
   - **Tier 3:** Technical UUIDv7 resolution without requiring entity-type hints (via allocation log index and core registry dispatch).
   - **Tier 4:** Sovereign business identifier resolution (`item_code`, `party_code`, `invoice_no`, `order_no`, `code`, `warehouse_code`).
   - **Batch Resolution (`resolve_batch`):** Resolve up to 100 identifiers in a single round-trip without N+1 query overhead.
   - **Reverse Identity Envelope (`get_identity_envelope`):** Given canonical `id` or `identity_code`, return the complete envelope (canonical ID, governed identity code, sovereign business code, active aliases, entity metadata, and deep link).
3. **High-Speed In-Memory Resolution Cache:**
   - Multi-tenant LRU/TTL cache layer for hot master entities (taxonomies, companies, branches, high-frequency lookup items) with programmatic invalidation hooks on entity modification.
4. **Omnichannel Cross-Domain Search Endpoint:**
   - `POST /api/v1/identity/search` & `POST /api/v1/identity/resolve-batch` supporting multi-entity discovery.
5. **Universal Browse Engine (F2) Alignment:**
   - Integrate backend multi-tier resolution into `UniversalBrowseEngine.tsx` and `LOOKUP_REGISTRY` (`src/services/f2LookupRegistry.ts`).

### Out of Scope (Frozen Boundaries)
- No alteration to Phase 1.1, 1.2, or 1.3 schema columns or numbering sequences.
- `payment_transactions` and `stock_movements` will NOT receive sequential `identity_code` columns.
- No client-supplied persistent IDs.

---

## 4. Current State

1. **Phases 1.0, 1.1, 1.2, 1.3 are FROZEN:**
   - Lineage head: `v1467`.
   - 10 core tables equipped with `identity_code` and database UNIQUE B-tree indexes (`uq_*_identity_code`, `indisunique=True`).
   - 2 high-throughput ledgers (`stock_movements`, `payment_transactions`) using UUIDv7 technical PKs.
   - 934 external aliases ingested into `smriti_identity_alias`.
   - 259 historical migration backfills audit-logged in `smriti_identity_allocation_log`.
2. **Current `IdentityResolver` (`backend/app/services/identity/resolver.py`):**
   - Implements single-item resolution across Tier 1, 2, 3, 4.
   - Requires `entity_type_hint` for Tier 3 (technical ID) and Tier 4 (business code).
   - Lacks batch resolution (`resolve_batch`), requiring repetitive single-query invocations.
   - Lacks reverse lookup / identity envelope aggregation (cannot ask: "what are all aliases for party X?").
   - Lacks resolution caching, incurring database queries on every lookup.
3. **Frontend Discovery (`UniversalBrowseEngine.tsx`):**
   - Operates against 22 distinct domain endpoints using specific search fields.
   - Does not have access to a cross-domain master identity search endpoint.

---

## 5. Gap Analysis

| Capability | Current State | Phase 1.4 Target State |
| :--- | :--- | :--- |
| **High-Throughput Ledger Registry** | `stock_movements` and `payment_transactions` not formally in `smriti_identity_registry` | Formally registered with `identity_code_enabled=False`, strategy `UUIDv7` |
| **Batch Resolution** | None (Caller must loop single `resolve()` calls) | `resolve_batch()` resolving array of identifiers in single SQL batch |
| **Reverse Identity Lookup** | None | `get_identity_envelope()` returning canonical ID, identity code, business code, aliases, deep link |
| **Unscoped Technical ID Lookup** | Requires `entity_type_hint` | Fast unscoped lookup via `allocation_log.canonical_id` index and registry map |
| **External Reference Case Sensitivity** | Exact match on `alias_code` | Functional lowercase index on `LOWER(alias_code)` for resilient matching |
| **Resolution Caching** | Direct PostgreSQL query every time | Tenant-isolated in-memory LRU/TTL cache with invalidation hooks |
| **Cross-Domain Search API** | Separate search endpoints per module | `POST /api/v1/identity/search` searching across governed entities |
| **F2 Universal Browse Integration** | Domain-specific API routing only | Cross-domain identity search adapter for `UniversalBrowseEngine` |

---

## 6. Architecture Impact

```text
                               ┌───────────────────────────────────────────────┐
                               │           CLIENT / CONSUMER LAYER             │
                               │  POS Terminal / F2 Browse / API Integrations  │
                               └───────────────────────┬───────────────────────┘
                                                       │
                                                       ▼
                               ┌───────────────────────────────────────────────┐
                               │           FASTAPI ROUTER LAYER                │
                               │          /api/v1/identity/*                   │
                               │  • /resolve           • /resolve-batch        │
                               │  • /envelope/{id}     • /search               │
                               └───────────────────────┬───────────────────────┘
                                                       │
                                                       ▼
                               ┌───────────────────────────────────────────────┐
                               │     UNIVERSAL CROSS-DOMAIN RESOLVER           │
                               │            (IdentityResolver)                 │
                               │                                               │
                               │   ┌───────────────────────────────────────┐   │
                               │   │ In-Memory Multi-Tenant LRU/TTL Cache  │   │
                               │   └───────────────────┬───────────────────┘   │
                               │                       │ cache miss            │
                               │   ┌───────────────────▼───────────────────┐   │
                               │   │ Tier 1: Governed SMRITI Identity Code │   │
                               │   │ Tier 2: Historical & External Alias   │   │
                               │   │ Tier 3: Canonical Technical ID (UUID) │   │
                               │   │ Tier 4: Sovereign Business Identifier │   │
                               │   └───────────────────┬───────────────────┘   │
                               └───────────────────────┼───────────────────────┘
                                                       │
                                                       ▼
                               ┌───────────────────────────────────────────────┐
                               │       MASTER IDENTITY INDEX & REGISTRY        │
                               │  • smriti_identity_registry (18 taxonomies)   │
                               │  • smriti_identity_alias (934+ cross-system)  │
                               │  • smriti_identity_allocation_log (audit)     │
                               │  • PostgreSQL Base Domain Tables (10 tables)  │
                               └───────────────────────────────────────────────┘
```

---

## 7. Proposed Design

### 7.1 Schema Evolution (Alembic `v1468`)
- Register `PAYMENT_TRANSACTION`:
  - `entity_type`: `PAYMENT_TRANSACTION`, `group_code`: `FIN`, `entity_code`: `PAY`, `database_table`: `payment_transactions`, `primary_key_field`: `id`, `business_code_field`: `transaction_no`, `identity_code_enabled`: `False`, `system_id_strategy`: `UUIDv7`, `status`: `ACTIVE`.
- Register `STOCK_MOVEMENT`:
  - `entity_type`: `STOCK_MOVEMENT`, `group_code`: `INV`, `entity_code`: `MOV`, `database_table`: `stock_movements`, `primary_key_field`: `id`, `business_code_field`: None, `identity_code_enabled`: `False`, `system_id_strategy`: `UUIDv7`, `status`: `ACTIVE`.
- Create performance indexes:
  - `CREATE INDEX ix_smriti_alloc_log_canonical_id ON smriti_identity_allocation_log (canonical_id);`
  - `CREATE INDEX ix_smriti_alias_lower_code ON smriti_identity_alias (LOWER(alias_code));`

### 7.2 Core Resolver Enhancements (`backend/app/services/identity/resolver.py`)
1. **`resolve_batch()`:**
   - Input: List of identifiers (`List[str]`), optional `entity_type_hint`, tenant/company context.
   - Algorithm:
     - Group identifiers by likely tier (SMRITI pattern regex -> Tier 1, UUID pattern -> Tier 3, others -> Tier 2/4).
     - Execute batched `IN (...)` queries across allocation log, alias registry, and target domain tables.
     - Return map of `identifier -> IdentityResolutionResult`.
2. **`get_identity_envelope()`:**
   - Resolves the canonical entity.
   - Fetches all active aliases from `smriti_identity_alias`.
   - Fetches allocation audit trail from `smriti_identity_allocation_log`.
   - Returns rich `IdentityEnvelope`:
     - Canonical UUIDv7 ID
     - Governed Identity Code
     - Business identifier (e.g. `party_code`, `invoice_no`)
     - Display name / title
     - List of aliases with source systems (`GSTN`, `NIC_EWAY`, `RAZORPAY`, `SHOPER9`)
     - UI deep link URL
3. **In-Memory LRU/TTL Cache (`IdentityResolutionCache`):**
   - High-concurrency, tenant-isolated cache with configurable TTL (default 300s for master entities, 60s for transactional).
   - Invalidation hooks: `IdentityEngine.invalidate_cache(entity_type, entity_id)`.

### 7.3 Omnichannel Cross-Domain Search
- `search_entities(query: str, entity_types: Optional[List[str]], company_id: Optional[str], limit: int)`
- Searches prefix and full-text matches across:
  - `smriti_identity_alias.alias_code`
  - Governed `identity_code`
  - Core business codes (`item_code`, `barcode`, `invoice_no`, `party_code`)
- Returns ranked search matches with entity badge and deep link.

---

## 8. Files Created

1. `backend/alembic/versions/v1468_phase1_4_master_identity_index_and_resolver.py`: Alembic migration registering `PAYMENT_TRANSACTION` and `STOCK_MOVEMENT` taxonomies and creating reverse-lookup indexes.
2. `backend/app/services/identity/cache.py`: High-performance tenant-isolated resolution cache.
3. `backend/app/tests/test_phase1_4_master_resolver.py`: Dedicated 8-test suite for Phase 1.4 verification.
4. `scripts/verify_phase1_4_parity.py`: Automated multi-database AST parity and resolver benchmark script.
5. `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_4_Master_Identity_Index_And_Resolver_v1.0.0.md`: Formal verification walkthrough.

---

## 9. Files Modified

1. `backend/app/services/identity/resolver.py`: Upgraded to universal cross-domain resolver with batch resolution, envelope hydration, unscoped UUID resolution, and search.
2. `backend/app/services/identity/engine.py`: Integrated cache invalidation hooks and envelope extraction.
3. `backend/app/schemas/identity.py`: Added `IdentityEnvelopeResponse`, `IdentityBatchResolveRequest`, `IdentityBatchResolveResponse`, `IdentitySearchRequest`, `IdentitySearchResponse`.
4. `backend/app/api/v1/identity.py`: Added `/resolve-batch`, `/envelope/{identifier}`, and `/search` endpoints.
5. `src/services/f2LookupRegistry.ts`: Added cross-domain identity lookup adapter.
6. `CHANGELOG.md`: Documented Phase 1.4 under `[6.38.0]`.
7. `docs/implementation/README.md`: Updated master index.
8. `docs/walkthrough/README.md`: Updated walkthrough index.

---

## 10. Dependencies

- Phase 1.0, 1.1, 1.2, 1.3 migrations must be applied (`v1467` head).
- Python 3.11+, SQLAlchemy 2.0+ async engine, PostgreSQL 15+.
- Pydantic v2 schemas.

---

## 11. Risks

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Cache Staleness** | Stale entity code or alias returned after update | Explicit cache invalidation in `IdentityEngine.register_alias()` and domain update services; conservative TTL. |
| **Cross-Domain Search Latency** | Full-table scans across multiple large tables | Restrict search to indexed fields (`identity_code`, `alias_code`, business codes); enforce query limit (default 20). |
| **Tenant Isolation Leak in Unscoped Search** | Tenant A sees Tenant B's entities | Mandatory `company_id` filter applied at SQL level on all searchable tables. |

---

## 12. Rollback Strategy

1. Revert migration `v1468` to `v1467` (`alembic downgrade v1467`).
2. The schema changes in `v1468` are strictly additive (indexes and catalog rows in `smriti_identity_registry`), zero domain table modifications.
3. Revert code changes via `git revert`.

---

## 13. Verification Plan

1. **Rule 12 Parity Audit:** Column, index, and registry diff across `smritisys`, `smriti001`, and `smriti002`.
2. **Dedicated Test Suite:** Run `pytest backend/app/tests/test_phase1_4_master_resolver.py -v`.
3. **Combined Identity Regression:** Run all Phase 1.0–1.4 tests (34+ tests).
4. **Architecture Gate:** Run `python scripts/architecture_duplication_gate.py` (11/11 checks, 0 P0/P1).
5. **Compilation Gates:** Run `npx tsc --noEmit` and `python -m py_compile`.

---

## 14. Test Plan (Dedicated 8 Tests)

1. `test_tier_1_governed_identity_code_resolution_all_domains`: Verify Tier 1 resolution across ORG, MST, CRM, PUR, SAL, POS, TAX.
2. `test_tier_2_external_alias_case_insensitive_resolution`: Verify Tier 2 resolution of external partner references (`RAZORPAY`, `NIC_EWAY`, `GSTN`, `SHOPER9`) with case-insensitivity.
3. `test_tier_3_unscoped_technical_uuidv7_resolution`: Verify Tier 3 resolution without entity type hints.
4. `test_tier_4_sovereign_business_code_resolution`: Verify Tier 4 resolution of business codes (`item_code`, `party_code`, `invoice_no`).
5. `test_batch_resolution_performance_and_parity`: Verify `resolve_batch` matches individual `resolve` results with 1 round-trip.
6. `test_identity_envelope_hydration_and_aliases`: Verify `get_identity_envelope` returns canonical ID, identity code, business code, and all registered aliases.
7. `test_resolution_cache_hit_miss_and_invalidation`: Verify cache hits, cache misses, and invalidation on alias updates.
8. `test_omnichannel_cross_domain_search`: Verify multi-entity search with ranking, prefix matching, and strict tenant boundary.

---

## 15. Documentation Impact

- Update `CHANGELOG.md` under `[6.38.0]`.
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Create formal walkthrough `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_4_Master_Identity_Index_And_Resolver_v1.0.0.md`.

---

## 16. Deployment Plan

1. Execute Alembic migration `v1468` across `smritisys`, `smriti001`, and `smriti002`.
2. Run automated multi-database parity audit script.
3. Deploy updated FastAPI backend service.
4. Deploy frontend with updated `F2` lookup adapter.

---

## 17. Status

**FROZEN — Implementation Complete, Verified Across 3 DBs, 34/34 Tests Green, 0 P0/P1 Architecture Violations.**

---

## 18. Related ADRs

- `ADR-008`: SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture v1.0.
- `ADR-015`: SMRITI Unified Identity Control Plane & Numbering Engine v1.0.

---

## 19. Related Walkthroughs

- [Foundation Unified Identity Control Plane (Phase 1)](../../walkthrough/foundation/Foundation_Unified_Identity_Control_Plane_Phase_1_v1.0.0.md)
- [Foundation Unified Identity Phase 1.1 — Business Entity Identity](../../walkthrough/foundation/Foundation_Unified_Identity_Phase_1_1_Business_Entity_Integration_v1.0.0.md)
- [Foundation Unified Identity Phase 1.2 — Transactional Identity](../../walkthrough/foundation/Foundation_Unified_Identity_Phase_1_2_Transactional_Identity_v1.0.0.md)
- [Foundation Unified Identity Phase 1.3 — External & Partner Identity](../../walkthrough/foundation/Foundation_Unified_Identity_Phase_1_3_External_And_Partner_Identity_v1.0.0.md)
