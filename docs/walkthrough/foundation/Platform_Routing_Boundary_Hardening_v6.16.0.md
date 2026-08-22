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
- `backend/tests/test_routing_boundary_canonical.py`: 6 automated tests validating authorized routing, 403 on unassigned users, 403 on suspended companies, fail-closed rejection on unregistered entities, and regex naming validation.
- `docs/implementation/foundation/Platform_Refactor_Controlled_Migration_Plan_v1.0.md`: Master 19-section implementation plan.
- `docs/walkthrough/foundation/Platform_Routing_Boundary_Hardening_v6.16.0.md`: This 13-section walkthrough.

---

## 4. Files Modified
- `backend/app/services/company_database_resolver.py`: Removed `"Tattly Threads"` demo fallback, enforced `companies` and `company_database_registries` lookup in `smritisys`, unified dynamic URL generation.
- `backend/app/db/session.py`: Hardened `resolve_company_database_name` to fail closed if company database is unregistered or not in `READY` status.
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
3. **Fail-Closed Routing Boundary**:
   - All tenant database requests must resolve strictly against verified entries in `companies` and `company_database_registries` with status `READY`.
   - Zero hardcoded demo fallbacks or arbitrary database name inputs are permitted.

---

## 6. Design Rationale
A controlled migration protects live business data and continuous uptime by establishing a hardened routing boundary first. This stable foundation allows progressive vertical slice migrations (Party/Item masters, Sales/Inventory, Pricing/GST, Workflows) without disrupting running systems.

---

## 7. Implementation Summary
- **Universal Resolver**: `CompanyDatabaseResolver` connects to `smritisys` and enforces:
  1. Company registration in `companies` (where `is_active=true` and `is_deleted=false`).
  2. User authorization in `user_company_assignments` (or `SYSADMIN` role).
  3. Database entry in `company_database_registries` with status `READY`.
  4. Database naming conformity: `^smriti(?!000)(?!SYS)[A-Z0-9]{3}$`.
- **Session Layer**: `resolve_company_database_name` in `session.py` delegates to `smritisys` registry lookup and fails closed if unverified.

---

## 8. Tests Executed
1. `backend/tests/test_routing_boundary_canonical.py`:
   - `test_authorized_user_reaches_assigned_database` (Passed)
   - `test_unauthorized_user_access_rejected_403` (Passed)
   - `test_unregistered_company_rejected_with_zero_demo_fallback` (Passed)
   - `test_suspended_company_database_access_denied_403` (Passed)
   - `test_resolver_rejects_arbitrary_database_names` (Passed)
   - `test_session_resolver_fails_closed_on_unregistered_company` (Passed)
2. Full Multi-Module Regression:
   - 56/56 automated tests across Routing Boundary, Runtime Routing, Naming Conventions, Engine Pooling, Provisioning, Menu Governance, Security Access, and WMS Phases 1–4 passed in 23.25s.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 56 items

backend\tests\test_routing_boundary_canonical.py ......                  [ 10%]
backend\tests\test_company_db_runtime_routing.py .......                 [ 23%]
backend\tests\test_company_db_naming_convention.py ......                [ 33%]
backend\tests\test_get_company_db_wiring.py .....                        [ 42%]
backend\tests\test_multi_company_database_architecture.py ......         [ 53%]
backend\tests\test_company_db_provisioning.py .....                      [ 62%]
backend\tests\test_menu_governance.py .                                  [ 64%]
backend\tests\test_security_menu_access.py ..                            [ 67%]
backend\tests\test_wms_phase1.py ....                                    [ 75%]
backend\tests\test_wms_phase2_grn_sales.py ...                           [ 80%]
backend\tests\test_wms_phase3_eway_bill.py .....                         [ 89%]
backend\tests\test_wms_phase4_audit_reconciliation.py ......             [100%]

======================= 56 passed, 1 warning in 23.25s ========================
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
