<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Platform Architecture Refactor — Routing Boundary Hardening & Canonicalization (Milestone 1)

## 1. Purpose
Execute Milestone 1 of the SMRITI Master Architecture Blueprint v1.0: Canonicalize the Company, User, and Database Routing models, eliminate demo fallbacks, and harden the Universal Database Resolver into the sole, fail-closed path to company databases.

---

## 2. Scope
- Canonicalizing `Company`, `User`, and `CompanyDatabaseRegistry` models with compatibility adapters.
- Hardening `CompanyDatabaseResolver.resolve_company_database` in `backend/app/services/company_database_resolver.py`.
- Hardening `resolve_company_database_name` in `backend/app/db/session.py`.
- Adding automated verification tests in `backend/tests/test_routing_boundary_canonical.py`.

---

## 3. Files Created
- `backend/tests/test_routing_boundary_canonical.py`: 11 automated tests validating authorized routing, zero credential leaks in payloads, non-admin cross-company tenant isolation, 403 on unassigned users, 403 on suspended companies, fail-closed rejection on missing/unregistered entities, engine cache validation, and regex naming validation.
- `docs/implementation/foundation/Platform_Refactor_Controlled_Migration_Plan_v1.0.md`: Master 19-section implementation plan.
- `docs/walkthrough/foundation/Platform_Routing_Boundary_Hardening_v6.16.0.md`: This 13-section walkthrough.

---

## 4. Files Modified
- `backend/app/services/company_database_resolver.py`: Removed credential-bearing connection URLs from returned payloads, removed `"Tattly Threads"` demo fallbacks, enforced `companies` and `company_database_registries` lookup in `smritisys`, rejected empty/missing company context.
- `backend/app/db/session.py`: Hardened `resolve_company_database_name` to fail closed if company context is missing or database is not in `READY` status; hardened `get_company_async_engine` to reject unverified/arbitrary database names.
- `backend/app/api/deps.py`: Hardened `get_tenant_context` to reject missing tenant company context without defaulting.
- `backend/app/services/control_database_registry.py`: Migrated active usage from `ControlCompanyDatabase` to canonical `CompanyDatabaseRegistry` and aligned `READY`/`ACTIVE` status.
- `backend/app/db/company_router.py`: Replaced `ControlCompanyDatabase` import with canonical `CompanyDatabaseRegistry`.
- `backend/tests/test_get_company_db_wiring.py`: Updated `test_resolve_company_database_name` to verify fail-closed behavior on `None` input.
- `backend/tests/test_multi_company_database_architecture.py`: Updated assertion to check clean database metadata without exposed connection URLs.
- `docs/walkthrough/README.md`: Appended new walkthrough to master chronological table.

---

## 5. Architecture Decisions
1. **Freeze Invariants**:
   - `smritisys` owns platform metadata, identity, menus, capabilities, policies, and routing.
   - `smritiXXX` owns company masters, transactions, inventory, and accounting.
   - `stock_movements` and financial ledgers remain authoritative.
2. **Canonical Model per Concept**:
   - Company: `Company` (`companies` in `smritisys`)
   - User: `User` (`users` in `smritisys`)
   - Database Routing: `CompanyDatabaseRegistry` (`company_database_registries` in `smritisys`)
3. **Fail-Closed & Zero Credential Leaks**:
   - All tenant database requests must resolve strictly against verified entries in `companies` and `company_database_registries` with status `READY`.
   - Application payloads return sanitized database references; raw credential strings or database connection URLs are never exposed.
   - Missing or unverified company context fails closed immediately (`400 Bad Request` or `403 Forbidden`).
   - Zero hardcoded demo fallbacks or arbitrary database name inputs are permitted.

---

## 6. Design Rationale
A controlled migration protects live business data and continuous uptime by establishing a hardened routing boundary first. This stable foundation allows progressive vertical slice migrations (Party/Item masters, Sales/Inventory, Pricing/GST, Workflows) without disrupting running systems.

---

## 7. Implementation Summary
- **Universal Resolver**: `CompanyDatabaseResolver` connects to `smritisys` and enforces:
  1. Mandatory non-empty company context (`400 Bad Request` on empty/missing).
  2. Company registration in `companies` (where `is_active=true` and `is_deleted=false`).
  3. User authorization in `user_company_assignments` (or `SYSADMIN` role).
  4. Database entry in `company_database_registries` with status `READY`.
  5. Database naming conformity: `^smriti(?!000)(?!SYS)[A-Z0-9]{3}$`.
  6. Zero credential leakage: Payload returns metadata only (`database_name`, `company_name`, `status`, `schema_version`).
- **Session Layer**: `resolve_company_database_name` and `get_company_async_engine` in `session.py` delegate to `smritisys` registry lookup, reject arbitrary database names, and fail closed if unverified.

---

## 8. Tests Executed
1. `backend/tests/test_routing_boundary_canonical.py`:
   - `test_authorized_user_reaches_assigned_database` (Passed)
   - `test_zero_credential_exposure_in_resolver_response` (Passed)
   - `test_unauthorized_user_access_rejected_403` (Passed)
   - `test_normal_assigned_user_cross_company_isolation` (Passed)
   - `test_missing_or_empty_company_context_rejected_400` (Passed)
   - `test_unregistered_company_rejected_with_zero_demo_fallback` (Passed)
   - `test_suspended_company_database_access_denied_403` (Passed)
   - `test_resolver_rejects_arbitrary_database_names` (Passed)
   - `test_engine_cache_rejects_unregistered_arbitrary_database_names` (Passed)
   - `test_session_resolver_fails_closed_on_unregistered_company` (Passed)
   - `test_session_resolver_fails_closed_on_missing_company_context` (Passed)
2. Full Multi-Module Regression:
   - 61/61 automated tests across Routing Boundary, Runtime Routing, Naming Conventions, Engine Pooling, Provisioning, Menu Governance, Security Access, and WMS Phases 1–4 passed in 18.08s.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 61 items

backend\tests\test_routing_boundary_canonical.py ...........             [ 18%]
backend\tests\test_company_db_runtime_routing.py .......                 [ 29%]
backend\tests\test_company_db_naming_convention.py ......                [ 39%]
backend\tests\test_get_company_db_wiring.py .....                        [ 47%]
backend\tests\test_multi_company_database_architecture.py ......         [ 57%]
backend\tests\test_company_db_provisioning.py .....                      [ 65%]
backend\tests\test_menu_governance.py .                                  [ 67%]
backend\tests\test_security_menu_access.py ..                            [ 70%]
backend\tests\test_wms_phase1.py ....                                    [ 77%]
backend\tests\test_wms_phase2_grn_sales.py ...                           [ 81%]
backend\tests\test_wms_phase3_eway_bill.py .....                         [ 90%]
backend\tests\test_wms_phase4_audit_reconciliation.py ......             [100%]

======================= 61 passed, 1 warning in 18.08s ========================
```

---

## 10. Known Limitations
- Master and transactional models in subsequent vertical slices (Party/Item masters, Sales/Purchase ledgers) remain scheduled for subsequent migration phases per the roadmap.

---

## 11. Future Work
- **Slice 2**: Universal Party Master & Universal Item Master Canonicalization.
- **Slice 3**: Sales, POS, and Inventory Lifecycle & Ledger Unification.
- **Slice 4**: Pricing, GST/Tax, Payments, and Document Engine Unification.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture and Separation of Control Plane (`smritisys`) and Data Planes (`smritiXXX`).
- `ADR-002`: Authoritative Ledger Sourcing for Stock and Financial Transactions.

---

## 13. Related RFCs
- `RFC-001`: SMRITI Enterprise Business Operating Platform Master Architecture Blueprint v1.0.
