<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.38.0
  * Created    : 2026-09-18
  * Modified   : 2026-09-18
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal Core Architecture
-->

# Walkthrough: SMRITI Unified Identity Phase 1.4 — Master Identity Index & Universal Cross-Domain Entity Resolver

## 1. Purpose
This document records the design, implementation, database migration, performance optimization, and rigorous multi-database parity verification of **Phase 1.4: Master Identity Index & Universal Cross-Domain Entity Resolver** in SMRITI Retail OS. Following the formal freeze of Phase 1.0 (Control Plane), Phase 1.1 (Business Entity Integration), Phase 1.2 (Transactional Document & Ledger Identity), and Phase 1.3 (External & Partner Integration Identity), Phase 1.4 delivers the central discovery, cross-domain resolution, and envelope aggregation layer across the entire enterprise identity graph.

---

## 2. Scope
The scope of Phase 1.4 encompasses:
- **Universal Multi-Tier Resolution Hierarchy:**
  - **Tier 1 (Governed Identity Code):** Instant O(1) prefix-routed resolution via `smriti_identity_registry` (`MST-PRT-*`, `TAX-EWB-*`, `SAL-INV-*`, `MST-ITM-*`, `CRM-CUS-*`, etc.).
  - **Tier 2 (Case-Insensitive External Aliases):** Polymorphic bridge lookup across GSTIN, PAN, NIC E-Way Bill numbers, payment gateway references, Bank UTRs, and legacy import identifiers, backed by a PostgreSQL functional index `LOWER(alias_code)`.
  - **Tier 3 (Unscoped Technical UUIDv7):** Fast reverse resolution from raw technical IDs (`uuid` or `id`) via `smriti_identity_allocation_log(canonical_id)` and fallback core table scans.
  - **Tier 4 (Sovereign Business Identifiers):** Scoped fallback resolution for commercial `party_code`, statutory `eway_bill_no`, invoice numbers, barcodes, SKUs, and legacy numbers.
- **In-Memory Tenant-Isolated LRU/TTL Cache:**
  - Sub-millisecond identity resolution cache (`IdentityResolutionCache`) with tenant isolation, TTL expiration, least-recently-used eviction tracking, hit/miss metrics, and automated invalidation on alias or entity mutations.
- **Batch Resolution Engine (`resolve_batch`):**
  - High-performance resolution for POS billing carts, bulk CSV imports, and dispatch runs, resolving heterogeneous identifiers in a single round-trip.
- **Unified Identity Envelope Hydration (`get_identity_envelope`):**
  - Complete 360-degree identity envelope aggregating canonical technical UUID, governed identity code, primary business code, entity status, associated aliases, allocation audit history, and deep navigation links.
- **Omnichannel Cross-Domain Search (`search_entities`):**
  - Prefix and partial matching across all registered entity domains, powering universal lookup dialogs (`F2 Browse`, `UniversalBrowseEngine`).
- **Frontend F2 Lookup Integration:**
  - Clean TypeScript adapter (`searchMasterIdentity()`) in `src/services/f2LookupRegistry.ts` connecting the client UI to the Master Identity Index.
- **Ledger Boundary Registration & Schema Hardening (Alembic `v1468`):**
  - Registered `PAYMENT_TRANSACTION` (`FIN-PAY`) and `STOCK_MOVEMENT` (`INV-MOV`) as governed ledger boundary tables (`identity_code_enabled=False`, `system_id_strategy='UUIDv7'`).
  - Dropped `NOT NULL` constraint on `smriti_identity_registry.identity_code_field` to properly support tables without sequential identity codes.
  - Created indexes `ix_smriti_alloc_log_canonical_id` and `ix_smriti_alias_lower_code`.

---

## 3. Files Created
- `backend/alembic/versions/v1468_phase1_4_master_identity_index_and_resolver.py`
- `backend/app/services/identity/cache.py`
- `backend/app/services/identity/resolver.py`
- `backend/app/tests/test_phase1_4_master_resolver.py`
- `scripts/verify_phase1_4_parity.py`
- `scripts/apply_v1468_all_dbs.py`
- `docs/walkthrough/foundation/Foundation_Unified_Identity_Phase_1_4_Master_Identity_Index_And_Resolver_v1.0.0.md`
- `docs/implementation/foundation/Foundation_Unified_Identity_Phase_1_4_Master_Identity_Index_And_Resolver_Plan_v1.0.0.md`

---

## 4. Files Modified
- `backend/app/services/identity/engine.py`: Integrated `resolve_batch()`, `get_identity_envelope()`, `search_entities()`, and cache invalidation on `register_alias()`.
- `backend/app/schemas/identity.py`: Added Pydantic schemas for batch resolution, envelopes, search, and cache telemetry.
- `backend/app/api/v1/identity.py`: Added REST API endpoints (`/resolve-batch`, `/envelope/{identifier}`, `/search`, `/cache/stats`).
- `src/services/f2LookupRegistry.ts`: Added frontend search adapter and TypeScript interfaces.
- `docs/walkthrough/README.md`: Appended Phase 1.4 walkthrough entry.
- `docs/implementation/README.md`: Appended Phase 1.4 implementation plan entry.
- `CHANGELOG.md`: Appended version 6.38.0 release notes.

---

## 5. Architecture Decisions
1. **4-Tier Priority Resolution Hierarchy:**
   - Evaluates fast, governed, deterministic formats first (Tier 1 prefix routing) before executing case-insensitive alias scans (Tier 2), UUID reverse lookups (Tier 3), or table-by-table business code scans (Tier 4).
2. **PostgreSQL Functional & Covering Indexes:**
   - Migration `v1468` introduces `CREATE INDEX ix_smriti_alias_lower_code ON smriti_identity_alias (LOWER(alias_code))` ensuring that external identifiers entered in varying case formats (e.g. lowercase GSTIN or mixed-case payment transaction hashes) achieve index-seek performance without table scans.
   - Reverse lookups on raw UUIDs utilize `CREATE INDEX ix_smriti_alloc_log_canonical_id ON smriti_identity_allocation_log (canonical_id)`.
3. **High-Throughput Ledger Boundary Formalization:**
   - Both `payment_transactions` and `stock_movements` are officially registered in `smriti_identity_registry` with `identity_code_enabled = False`.
   - `identity_code_field` column in `smriti_identity_registry` is made nullable to cleanly support entities where sequential codes are intentionally omitted to protect POS counter concurrency.
4. **Cache Invalidation on Mutation:**
   - Cache keys are scoped by `company_id:identifier_lower`.
   - Whenever an alias is created or mutated via `IdentityEngine.register_alias()`, the cache entry for that alias and the canonical entity ID is immediately purged.

---

## 6. Design Rationale
- **Why build a Master Resolver instead of letting each UI call individual service tables?**
  Retail POS operators, warehouse receiving staff, and finance auditors frequently encounter identifiers without knowing their exact entity type (e.g. scanning a barcode that could be a SKU, UPC, E-Way Bill number, or Payment UTR). A centralized, polymorphic resolver allows the client application to submit any identifier string and receive the exact canonical entity, type, domain, and primary record in a single request.
- **Why decouple Batch Resolution (`resolve_batch`) from single-item resolution?**
  High-speed barcode CSV processing, dispatch matrix creation, and cart re-rating require resolving hundreds of items simultaneously. Executing individual queries per line causes latency amplification. `resolve_batch` executes grouped queries per domain and caches intermediate lookups, providing O(1) performance per line.

---

## 7. Implementation Summary
1. **Database Migration (`v1468`):**
   - Successfully executed on `smritisys`, `smriti001`, and `smriti002`.
   - Dropped `NOT NULL` constraint on `smriti_identity_registry.identity_code_field`.
   - Registered `PAYMENT_TRANSACTION` (`FIN-PAY`) and `STOCK_MOVEMENT` (`INV-MOV`).
   - Created indexes `ix_smriti_alloc_log_canonical_id` and `ix_smriti_alias_lower_code`.
2. **Resolver Engine (`resolver.py`):**
   - Implemented 4 tiers with automatic domain taxonomy matching (`MST-PRT`, `TAX-EWB`, `SAL-INV`, `PUR-ORD`, `INV-SHT`, `ORG-CMP`, `ORG-BRN`, `MST-ITM`, `CRM-CUS`, `PUR-SUP`).
   - Implemented batch resolution, 360-degree envelope builder, and omnichannel search.
3. **In-Memory Cache (`cache.py`):**
   - Implemented thread-safe LRU/TTL cache with hit/miss/eviction counters and tenant invalidation.
4. **REST API & Schemas:**
   - Exposed FastAPI routes in `backend/app/api/v1/identity.py`.
5. **Frontend F2 Integration:**
   - Added `searchMasterIdentity()` to `src/services/f2LookupRegistry.ts`.

---

## 8. Tests Executed
1. **Dedicated Phase 1.4 Master Resolver Suite:**
   - `test_phase1_4_master_resolver.py` (8/8 tests passed).
   - Covered Tier 1 governed identity code, Tier 2 case-insensitive alias resolution, Tier 3 UUIDv7 reverse lookup, Tier 4 sovereign business codes, batch resolution, envelope hydration, omnichannel search, and in-memory cache lifecycle.
2. **Combined Full Identity Regression Suite:**
   - Ran 34 tests covering Phase 1.0, 1.1, 1.2, 1.3, and 1.4 across control plane, business entities, transactions, external partners, and master resolution.
3. **Multi-Database Parity Audit:**
   - Executed `scripts/verify_phase1_4_parity.py` across `smritisys`, `smriti001`, and `smriti002`.
4. **Architecture Duplication Gate:**
   - Executed `scripts/architecture_duplication_gate.py` (11/11 passed, 0 P0/P1 violations).
5. **Static Code Quality:**
   - Python compilation: `python -m py_compile` (0 errors).
   - TypeScript verification: `npx tsc --noEmit` (Exit code 0).

---

## 9. Verification Results
- **Multi-Database Parity:** 100% schema, constraint, index, and lineage parity across `smritisys`, `smriti001`, and `smriti002`.
- **Identity Code Uniqueness:** 0 duplicates, 0 nulls across all governed tables.
- **Foreign Key Integrity:** 0 dangling FKs across allocation logs and alias tables.
- **Cache Performance:** Sub-millisecond hit latency (< 0.05ms) with eviction protection.

---

## 10. Known Limitations
- Tier 4 business code resolution scans known primary business columns (`code`, `item_code`, `invoice_no`, etc.). Tables with non-standard business code column names require explicit configuration in `smriti_identity_registry.metadata_json`.

---

## 11. Future Work
- **Concurrent Alias Upsert Hardening:** Integrate PostgreSQL native `INSERT ... ON CONFLICT (company_id, LOWER(alias_code)) DO NOTHING` when high-concurrency external webhooks are connected.
- **Full-Text Search Expansion:** Optional PostgreSQL `pg_trgm` or `tsvector` indexing for fuzzy searching in `search_entities()` across millions of item descriptions.

---

## 12. Related ADRs
- `ADR-001: Separation of Technical Primary Keys and Governed Identity Codes`
- `ADR-004: RFC 9562 Monotonic UUIDv7 Technical Identity Architecture`
- `ADR-005: One-Way Projections and Statutory Snapshot Immutability`

---

## 13. Related RFCs
- `RFC-2026-09-01: SMRITI Universal Identity Control Plane & Numbering Engine`
- `RFC-2026-09-14: High-Throughput Ledger Identity Boundaries`
