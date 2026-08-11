# SMRITI RETAIL OS — COMPANY DATABASE MIGRATION PLAN
**Document ID:** MBOOK-DB-MIG-002  
**Version:** 1.0.0 (Phase 0 Audit & Blueprint)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Proprietary Architectural Specification — FROZEN BASELINE  

---

## 1. Executive Summary & Purpose

This specification defines the execution blueprint for migrating SMRITI Retail OS from a single shared database to a physically isolated multi-database topology:
1. **Control Database (`smriti_control`):** Authority for Users, Auth, RBAC, Tenant/Company Registries, Database Routing Credentials, System Configs, and Audit Logs.
2. **Secondary Master Database (`smriti_master_hub`):** Master Exchange Hub for voluntary, policy-controlled master publishing and sharing.
3. **Company Databases (`smriti_company_{company_code}`):** Independent, physically isolated PostgreSQL databases per company containing 100% of operational masters and transactional ledgers.

---

## 2. Target Database Topology Specifications

### 2.1 Logical Database Classes

```text
 ┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
 │   CONTROL DATABASE     │      │ SECONDARY MASTER DB    │      │  COMPANY DATABASE A    │
 │   (`smriti_control`)   │      │ (`smriti_master_hub`)  │      │ (`smriti_company_A`)   │
 ├────────────────────────┤      ├────────────────────────┤      ├────────────────────────┤
 │ • users                │      │ • master_types         │      │ • products             │
 │ • roles                │      │ • master_values        │      │ • customers            │
 │ • permissions          │      │ • universal_identities │      │ • suppliers            │
 │ • tenants              │      │ • identity_rules       │      │ • sales_invoices       │
 │ • companies            │      │ • identity_outbox      │      │ • purchase_orders      │
 │ • company_databases    │      │ • attribute_defs       │      │ • stock_movements      │
 │ • user_assignments     │      │ • attribute_groups     │      │ • stock_ledger         │
 │ • system_configs       │      │ • variant_templates    │      │ • journal_entries      │
 │ • security_audits      │      │ • size_scales          │      │ • pos_sessions         │
 └────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## 3. Database Resolver & Registry Architecture

### 3.1 Registry Model in Control DB (`company_databases`)

```sql
CREATE TABLE company_databases (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL UNIQUE REFERENCES companies(id),
    company_code VARCHAR(32) NOT NULL UNIQUE,
    db_name VARCHAR(64) NOT NULL,
    db_host VARCHAR(128) NOT NULL,
    db_port INT NOT NULL DEFAULT 5432,
    db_user VARCHAR(64) NOT NULL,
    db_password_encrypted TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DRIFTED, MAINTENANCE, FROZEN
    schema_version VARCHAR(32) NOT NULL,
    schema_fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Dynamic Database Session Resolver (`DatabaseResolverService`)

- **Security Enforcement:** The frontend sends `X-Company-Code` header or JWT payload containing `active_company_code`. The backend verifies that the authenticated user is assigned to `active_company_code` in Control DB.
- **Session Dispatch:** `DatabaseResolverService.get_session(company_code)` fetches DB connection metadata from Control DB cache, initializes or retrieves the bounded SQLAlchemy AsyncEngine connection pool for `smriti_company_{company_code}`, and yields an `AsyncSession` to FastAPI router endpoints.

---

## 4. Connection Pooling & Resource Governance

For scaling to 10,000+ companies without exceeding PostgreSQL connection limits:
- **Pool Size:** `pool_size=5`, `max_overflow=10` per active company database connection engine.
- **Idle Timeout:** Automatically dispose engine connections idle for > 10 minutes (`pool_recycle=600`, `pool_timeout=30`).
- **LRU Engine Cache:** Maintain a maximum of 500 active `AsyncEngine` instances in memory per application node using an LRU eviction policy.

---

## 5. Master Exchange Hub Architecture (Secondary Master DB)

- **Publishing:** A company publishes a local item to Secondary Master DB:
  `Company A DB (Product P100) ──► Publish ──► Secondary Master DB (Universal Identity UID-100)`.
- **Fetching:** Company B opts in to fetch identity UID-100:
  `Secondary Master DB (UID-100) ──► Fetch ──► Company B DB (Local Product P100)`.
- **Independence:** Company B owns its local pricing, inventory policy, supplier linkages, and stock balances independently.

---

## 6. Consolidated Reporting Engine

- **Cross-Company Isolation:** Transaction ledgers are NEVER merged into a shared table.
- **Fan-Out Execution:** When a user requests a consolidated sales report across assigned Companies A, B, and C:
  1. `ConsolidationEngine` executes parallel queries against `Company A DB`, `Company B DB`, and `Company C DB`.
  2. Each query result is tagged with `company_code`.
  3. `ConsolidationEngine` aggregates metrics in memory and returns a unified report.

---

## 7. Migration Orchestrator & Drift Detection

### 7.1 Migration States
Every company database migration is tracked in Control DB:
`PENDING` ──► `RUNNING` ──► `SUCCESS` / `FAILED` ──► `DRIFTED` ──► `RECONCILING`.

### 7.2 Drift Detection Protocol
- On connection initialization, the system computes the current schema fingerprint:
  `SHA256(tables + columns + datatypes + constraints)`.
- If `actual_fingerprint != expected_fingerprint`:
  1. Set database status to `DRIFTED`.
  2. Freeze writes to that Company DB.
  3. Emit security audit event and alert administrators.

---

## 8. Backup & Restore Strategy

- **Per-Company Isolation:** Daily `pg_dump -Fc smriti_company_{company_code}` stored under encrypted object storage namespace `/backups/companies/{company_code}/{date}.dump`.
- **Recovery Targets:** RPO < 5 minutes, RTO < 15 minutes per company.
- **Independent Restore:** Restoring Company A DB does NOT disturb Control DB, Secondary Master DB, or Company B DB.

---

## 9. Phase 0 to Phase 15 Phased Execution Roadmap

| Phase | Title | Target Deliverables | Safety Gate |
|---|---|---|---|
| **Phase 0** | Audit & Strategy | Gap Matrix, Migration Plan, Execution Log | Conditional GO |
| **Phase 1** | Control DB Setup | Control DB models, migrations, auth isolation | Unit tests PASS |
| **Phase 2** | Company DB Template | Canonical company schema template (`v1503`) | Fingerprint verified |
| **Phase 3** | Database Resolver | `DatabaseResolverService`, connection pooler | Integration tests PASS |
| **Phase 4** | Provisioning Engine | Automated Company DB creation & seeding | Zero leak verification |
| **Phase 5** | Auth & Session Inject | `get_company_db` FastAPI dependency | 401/403 security PASS |
| **Phase 6** | Service Adaptation | Repositories accept dynamic `AsyncSession` | Domain test suite PASS |
| **Phase 7** | Master Hub Exchange | Publish / Fetch strategy implementation | Exchange tests PASS |
| **Phase 8** | Consolidation Engine | Async multi-DB reporting fan-out | Aggregation tests PASS |
| **Phase 9** | Migration Fan-Out | Alembic fan-out runner + drift detector | Drift quarantine PASS |
| **Phase 10** | Backup & Restore | Per-company dump/restore tool | Real restore test PASS |
| **Phase 11** | Staging Data Migration | Shared DB data extraction tool | Financial totals audit PASS |
| **Phase 12** | Full Regression | Complete 909-test suite on multi-DB | 0 regressions |
| **Phase 13** | Production Cutover | Final delta sync & DNS/DB switch | Zero downtime gate |
| **Phase 14** | Archive Shared DB | Decommission old shared `smriti_prod` DB | Post-cutover audit PASS |
| **Phase 15** | Post-Cutover Audit | Final certification & documentation freeze | Masterbook updated |
