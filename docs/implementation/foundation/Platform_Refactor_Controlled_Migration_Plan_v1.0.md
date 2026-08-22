<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Master Implementation Plan: SMRITI Platform Architecture Controlled Refactoring & Migration (v1.0)

## 1. Objective
Establish and execute the single canonical Master Architecture Blueprint v1.0 through controlled, vertical-slice migrations rather than destructive rewrites. Transform SMRITI into a single unified business operating platform governed by a centralized Control Plane (`smritisys`), tenant-isolated Transactional Data Planes (`smritiXXX`), and an Analytics/Intelligence Plane.

---

## 2. Business Motivation
SMRITI represents one configurable business operating platform — not separate, siloed POS, Distributor, Warehouse, eCommerce, or ERP products. Businesses activate one, several, or all composable capabilities. Controlled migration ensures 100% operational continuity, data preservation, zero downtime, and complete backward compatibility while eliminating duplication and hardening security boundaries.

---

## 3. Scope
- **Slice 1 (Current / Milestone 1)**: Identity, Company Access, and Database Routing Canonicalization & Hardening.
- **Slice 2**: Universal Party Master & Universal Item Master Canonicalization.
- **Slice 3**: Sales, POS, and Inventory Lifecycle & Ledger Unification.
- **Slice 4**: Pricing, GST/Tax, Payments, and Document Engine Unification.
- **Slice 5**: Approval Engine, Workflow Engine, and Communicator.
- **Slice 6**: Capability, Template, and Workspace Runtime Resolution.
- **Slice 7**: Outbox and Analytics Plane.

---

## 4. Current State
- Multiple legacy models and prototype tables existed (`companies` vs `control_companies`, `users` vs `control_users`, `company_database_registries` vs `control_company_databases`).
- Some resolver paths allowed demo fallbacks (`Tattly Threads` fallback for unseeded companies).
- Multiple URL builder variations existed across scripts and modules.

---

## 5. Gap Analysis
| Capability / Concept | Legacy Duplicate / Gap | Canonical Target | Action |
| :--- | :--- | :--- | :--- |
| **Company** | `companies` vs `control_companies` | `Company` (`companies` in `smritisys`) | Canonicalize model in `app.models.tenant`, maintain compatibility adapter for `control_companies`. |
| **Tenant** | Implicit company parameter usage | `TenantContext` + `companies` | Strict cryptographic JWT + assignment verification. |
| **User** | `users` vs `control_users` | `User` (`users` in `smritisys`) | Canonicalize model in `app.models.auth`, maintain compatibility alias for `control_users`. |
| **Database Routing** | `company_database_registries` vs `control_company_databases` | `CompanyDatabaseRegistry` (`company_database_registries` in `smritisys`) | Canonicalize model in `app.models.company_database_registry`, maintain compatibility adapter. |
| **Menus** | Static frontend fallback | `smriti_menus` in `smritisys` | 34 immutable system menu nodes in `smritisys` with dynamic cache. |
| **Roles / RBAC** | Role columns / scattered JSON | `Role` (`roles` in `smritisys`) + `SmritiPermission` | Unified RBAC model. |

---

## 6. Architecture Impact
- **Control Plane (`smritisys`)**: Solely governs global reference definitions, templates, capabilities, workspaces, menus, screens, formulas, rules, policies, workflows, permissions, and licensing.
- **Transactional Data Plane (`smritiXXX`)**: Holds company-specific masters, transactions, inventory batches, and authoritative ledgers (`stock_movements`, financial ledgers).
- **Resolver**: Universal single path to company databases. Rejects unverified companies, suspended tenants, and non-conforming database names.

---

## 7. Proposed Design
1. **Decision Table Enforcement**: Retain existing tables during migration, backfill to canonical models, update all read/write paths, and provide compatibility views.
2. **Fail-Closed Resolver**:
   - Query `companies` in `smritisys` with strict active status check.
   - Query `user_company_assignments` (or `SYSADMIN` role).
   - Query `company_database_registries` for status `READY`.
   - Validate database name against `^smriti(?!000)(?!SYS)[A-Z0-9]{3}$`.
   - Dynamic URL assembly using environment configuration.

---

## 8. Files Created
- `backend/tests/test_routing_boundary_canonical.py`: Automated tests proving authorized access, 403 on unassigned users, 403 on suspended databases, zero demo fallbacks, and regex database validation.
- `docs/implementation/foundation/Platform_Refactor_Controlled_Migration_Plan_v1.0.md`: Master 19-section implementation plan.
- `docs/walkthrough/foundation/Platform_Routing_Boundary_Hardening_v6.16.0.md`: Master 13-section walkthrough document.

---

## 9. Files Modified
- `backend/app/services/company_database_resolver.py`: Removed demo fallbacks, enforced canonical database registry lookup, unified dynamic connection URL building.
- `backend/app/db/session.py`: Hardened `resolve_company_database_name` to fail closed on unregistered or non-ready company databases.
- `backend/app/models/control/control_models.py`: Exported compatibility adapters for canonical models.
- `docs/walkthrough/README.md`: Updated master walkthroughs index table.

---

## 10. Dependencies
- FastAPI Core backend (`backend/app/`).
- PostgreSQL 16+ multi-database instance (`smritisys`, `smriti001`, `smriti002`, `smriti003`).
- Async SQLAlchemy + asyncpg connection pools.

---

## 11. Risks
- **Risk**: Legacy scripts calling deprecated helper functions with unseeded company codes.
- **Mitigation**: Comprehensive test suite with 56 automated tests verifying backward compatibility across all existing modules.

---

## 12. Rollback Strategy
- Versioned Git commits.
- Read adapters and compatibility views preserve existing schema structures without data loss.

---

## 13. Verification Plan
- Run automated unit and integration tests across routing boundary, naming conventions, multi-company architecture, menu governance, security access, and WMS phases 1–4.
- Verify 100% test pass rate with literal console output.

---

## 14. Test Plan
- `backend/tests/test_routing_boundary_canonical.py` (6 tests)
- `backend/tests/test_company_db_runtime_routing.py` (7 tests)
- `backend/tests/test_company_db_naming_convention.py` (6 tests)
- `backend/tests/test_get_company_db_wiring.py` (5 tests)
- `backend/tests/test_multi_company_database_architecture.py` (6 tests)
- `backend/tests/test_company_db_provisioning.py` (5 tests)
- Combined multi-module suite (56 tests total).

---

## 15. Documentation Impact
- Updated `docs/walkthrough/README.md` master index.
- Updated `docs/implementation/README.md`.
- Created formal walkthrough in `docs/walkthrough/foundation/`.

---

## 16. Deployment Plan
1. Apply canonical model compatibility in backend codebase.
2. Run database migration tests and verify clean execution.
3. Deploy updated FastAPI application.
4. Execute live smoke tests across all tenant companies.

---

## 17. Status
**In Progress — Milestone 1 (Routing Boundary Hardening & Model Canonicalization) Completed.**

---

## 18. Related ADRs
- `ADR-001`: Multi-Company Database Architecture and Separation of Control Plane (`smritisys`) and Data Planes (`smritiXXX`).
- `ADR-002`: Authoritative Ledger Sourcing for Stock and Financial Transactions.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_Routing_Boundary_Hardening_v6.16.0.md`
- `docs/walkthrough/wms/WMS_Phase4_Stock_Audit_Reconciliation_Barcode_v6.16.0.md`
