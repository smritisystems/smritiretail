# SMRITI RETAIL OS — MEGA REFACTOR ARCHITECTURE GAP MATRIX
**Document ID:** MBOOK-ARCH-GAP-001  
**Version:** 1.0.0 (Phase 0 Audit)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Internal Architectural Governance — FROZEN BASELINE  

---

## Executive Summary

This document establishes the comprehensive Phase 0 Architecture Gap Matrix for migrating SMRITI Retail OS from a **Shared PostgreSQL Database with Row-Level Security (RLS)** to a **Physically Isolated Multi-Database Architecture** (Control DB, Secondary Master DB, and Independent Per-Company Operational DBs).

---

## 1. Current Architecture Baseline

```text
CURRENT ARCHITECTURE (SHARED DATABASE WITH LOGICAL RLS ISOLATION)

               Client Request (FastAPI / SPA)
                             │
                             ▼
              TenantContext (company_id, branch_id)
                             │
                             ▼
            Shared PostgreSQL Database (`smriti_prod`)
  ┌─────────────────────────────────────────────────────────┐
  │  Row-Level Security (RLS) / RowSecuredMixin             │
  │  WHERE company_id = active_company_id                   │
  ├─────────────────────────┬───────────────────────────────┤
  │  Global Platform Data   │  All Operational Company Data │
  │  (Users, Roles, Config) │  (Company A, B, C... Invoices)│
  └─────────────────────────┴───────────────────────────────┘
```

- **Database Topology:** Single shared PostgreSQL database (`smriti_prod`).
- **Isolation Mechanism:** Logical filtering via `company_id` and `tenant_id` columns on 184 operational tables, backed by `RowSecuredMixin` and optional Postgres Row Level Security (RLS) policies.
- **Vulnerability / Limitation:** Single database instance failure affects all tenants; query filtering omission (e.g., missing `where(company_id == ...)` in custom SQL queries) creates potential cross-tenant data leak risks.

---

## 2. Target Architecture Baseline

```text
TARGET ARCHITECTURE (PHYSICALLY ISOLATED MULTI-DATABASE TOPOLOGY)

                           SMRITI PLATFORM
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
            CONTROL DB    SECONDARY MASTER DB    PLATFORM
          (Registry & Auth) (Exchange Hub)        CONFIG
                 │                │
                 │         Master Exchange
                 │                │
      ┌──────────┼──────────┬─────┴────┬──────────┐
      ▼          ▼          ▼          ▼          ▼
   Company A  Company B  Company C  Company D  Company N
     DB         DB         DB         DB         DB
```

- **Control Database (`smriti_control`):** Central authority for Users, Passwords, Roles, Permissions, Company Registry, Database Credentials/Registry, User-Company Assignments, System Configurations, and Security Audit Logs.
- **Secondary Master Database (`smriti_master_hub`):** Master Exchange Hub for publishing and fetching shared product taxonomies, barcode standards, and supplier/customer identities across companies via policy-controlled opt-in.
- **Company Operational Databases (`smriti_company_{company_code}`):** Physically separate PostgreSQL databases per company, containing 100% of the operational masters, stock ledgers, sales invoices, purchase orders, financial journals, POS sessions, and WMS state.

---

## 3. Shared Database Dependencies

Currently, the shared database hosts 226 tables in a single schema. The primary shared dependencies that must be decoupled include:
- **Foreign Key Constraints across Tiers:** FKs between operational items (e.g., `sales_invoices.user_id`) and central identity tables (`users.id`). These must transition from relational FK constraints to logical application-level UUID validation.
- **Global Table Shared Lookups:** Lookups against `companies`, `branches`, and `tenants` directly in business logic queries.

---

## 4. Company-Scoped Tables (Company DB Tier — 184 Tables)

All transactional, operational, and company-owned master tables are isolated to individual Company DBs:
- **Sales Domain:** `sales_invoices`, `sales_invoice_items`, `sales_orders`, `sales_order_items`, `sales_quotations`, `sales_returns`, `credit_notes`.
- **Purchase Domain:** `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_requisitions`, `vendor_contracts`, `three_way_matches`.
- **Inventory & WMS Domain:** `products`, `product_barcodes`, `stock_movements`, `inventory_ledger_entries`, `warehouses`, `warehouse_bins`, `stock_transfers`, `stock_adjustments`.
- **CRM Domain:** `customers`, `customer_addresses`, `customer_contacts`, `customer_credit_profiles`, `crm_leads`, `crm_opportunities`.
- **Supplier Domain:** `suppliers`, `supplier_addresses`, `supplier_contacts`, `supplier_payments`, `supplier_scorecards`.
- **Accounting & Tax Domain:** `journal_vouchers`, `journal_ledger_entries`, `gst_return_filings`, `eway_bills`, `tds_entries`, `cost_centers`.
- **POS Domain:** `pos_sessions`, `pos_transactions`, `pos_transaction_items`, `pos_offline_sync_queue`, `cash_registers`.

---

## 5. Global Tables (Control DB Tier — 34 Tables)

Centralized platform authority tables residing exclusively in the Control DB:
- **Authentication & Users:** `users`, `refresh_token_blacklist`, `smriti_service_accounts`.
- **RBAC & Authorization:** `roles`, `permissions`, `smriti_roles`, `smriti_permissions`, `smriti_user_roles`, `smriti_permission_sets`, `smriti_role_permission_sets`, `smriti_permission_set_permissions`.
- **Multi-Tenant Assignment:** `tenants`, `companies`, `branches`, `user_company_assignments`, `user_branch_assignments`, `user_store_assignments`.
- **Security & API Keys:** `smriti_api_keys`, `smriti_api_key_logs`, `smriti_api_key_permission_sets`, `smriti_security_audits`.
- **System Configuration:** `system_configs`, `system_bootstrap_states`, `tenant_settings`.
- **Approval Workflows:** `smriti_approval_matrices`, `smriti_approval_policies`, `smriti_approval_steps`, `smriti_approval_delegations`, `smriti_approval_conditions`, `smriti_approval_actions`, `smriti_approval_histories`, `smriti_approval_comments`, `smriti_approval_requests`, `smriti_approval_assignments`, `smriti_approval_escalations`, `smriti_approval_outbox`.

---

## 6. Secondary Master DB Tables (Master Exchange Hub — 8 Tables)

Master metadata publishing and resolution tables:
- `smriti_universal_identities`
- `smriti_identity_rules`
- `smriti_identity_rule_versions`
- `smriti_identity_outbox`
- `master_types`
- `master_values`
- `attribute_definitions`
- `attribute_groups`

---

## 7. User & RBAC Dependencies

- **User Authentication:** Handled 100% in Control DB.
- **Company Access Resolution:** `User` -> `user_company_assignments` -> `companies` -> `Company DB credentials`.
- **Role & Permission Resolution:** Evaluated centrally in Control DB before executing queries against the resolved Company DB.

---

## 8. API Routing Dependencies

- **Current Behavior:** Routers accept request -> `TenantContext` extracts `company_id` from JWT or header -> query runs against shared DB.
- **Target Behavior:** Routers accept request -> `TenantContext` validates JWT against Control DB -> `DatabaseResolverService` looks up active `company_code` -> injects dynamic `AsyncSession` connected to that specific Company DB.

---

## 9. Repository & Service Dependencies

- Repositories (`BaseRepository`, `SalesRepository`, `InventoryRepository`) must accept an `AsyncSession` bound to the active target database connection instead of relying on a single static session factory (`async_session_maker`).

---

## 10. Background Worker Dependencies

- Background jobs (Celery / Async Tasks / Schedulers) MUST explicitly carry `company_id` and `company_code` in every message payload.
- Worker tasks resolve DB connection dynamically via `DatabaseResolverService.get_company_session(company_code)` before executing.

---

## 11. Cache Dependencies

- Redis / In-memory caches must prefix keys with `company_code` (e.g., `cache:{company_code}:product:{product_id}`).
- Company switch actions immediately trigger key pattern invalidation for that user's session cache.

---

## 12. File & Storage Dependencies

- File/Blob storage paths must strictly enforce company namespaces: `/storage/companies/{company_code}/documents/{doc_id}.pdf`.

---

## 13. Migration Dependencies

- Control DB schema managed by standard Alembic migrations (`alembic/control_versions`).
- Company DB schemas managed by Alembic fan-out migrations (`alembic/company_versions`).

---

## 14. Backup & Restore Dependencies

- Independent per-company PostgreSQL database dumps (`pg_dump -d smriti_company_SMR001`).
- Ability to restore a single company's database without affecting other operational companies or the Control DB.

---

## 15. Consolidation Dependencies

- Multi-company financial and inventory reports execute via `ConsolidationEngine`.
- Consolidation Engine queries each company's isolated database concurrently via async fan-out, injecting `company_code` into every aggregate row, and combining results in memory.

---

## 16. RLS Dependencies (Defense-in-Depth)

- RLS policies and `company_id` / `tenant_id` columns remain intact inside Company DBs as defense-in-depth security layer.

---

## 17. Known Security Vulnerabilities Audit

- **Audit Result:** No unauthenticated or open RLS fail-open security vulnerabilities present in current main line. Security commits `31887166` and `8715bef7` successfully resolved all B1–B8 endpoint and isolation gaps.

---

## 18. Data Migration Complexity

- **Existing Data Partitioning:** High complexity for legacy multi-company shared databases.
- **Data Partitioning Tooling Required:** Extract scripts to split `smriti_prod` rows by `company_id` into distinct `smriti_company_{company_code}` databases.

---

## 19. Estimated Blast Radius

- **High Impact:** Session management, database connection dependency injection (`get_db`), Alembic migration runner, test fixture setups.
- **Low Impact:** Core business logic in domain engines (POS, Sales, Purchase, Inventory formulas remain unchanged).

---

## 20. Recommended Migration Order

1. **Phase 0:** Audit & Matrix (Completed in this directive).
2. **Phase 1:** Control DB Schema & Models.
3. **Phase 2:** Company DB Template Schema & Migration scripts.
4. **Phase 3:** Database Resolver & Registry Service.
5. **Phase 4:** Provisioning Engine for Company DBs.
6. **Phase 5:** Auth & Dynamic Database Session Injection (`get_company_db`).
7. **Phase 6:** Service & Repository Adaptation.
8. **Phase 7:** Secondary Master Exchange Hub.
9. **Phase 8:** Consolidation Engine.
10. **Phase 9:** Migration Fan-Out & Drift Detection Orchestrator.
11. **Phase 10:** Independent Backup & Restore Verification.
12. **Phase 11:** Test Environment Multi-DB Provisioning.
13. **Phase 12:** Full Regression & Security Verification.
14. **Phase 13:** Production Cutover & Delta Migration.

---

## 21. STOP / GO Recommendation & Verdict

### VERDICT: **CONDITIONAL GO**

**Rationale:**
1. The architectural objective is clear, sound, and fully compliant with SMRITI Enterprise SaaS Principles.
2. The current codebase has clean architectural boundaries (80 routers, 93 services, 15 repositories, 226 BaseEntity tables).
3. The refactoring can be executed cleanly without destroying existing production data or modifying domain business formulas.

**Prerequisite Safety Rules Before Execution (Phase 1+):**
- **RULE 1:** The shared database `smriti_prod` MUST NOT be deleted or mutated until Phase 13 production cutover.
- **RULE 2:** All database resolvers MUST use server-side credentials; frontend requests may ONLY supply `company_code` intent.
- **RULE 3:** Every phase MUST be verified with real PostgreSQL database tests.
