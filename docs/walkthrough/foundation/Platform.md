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

# Walkthrough: Multi-Tenant Ephemeral Database CI/CD Test Harness & Clean-Slate Migration Verification

## 1. Purpose
Provide an automated, isolated CI/CD testing harness that dynamically provisions ephemeral PostgreSQL tenant databases, executes symmetrical forward/downgrade Alembic migrations, validates clean-slate schema parity, seeds authoritative Chart of Accounts and baseline organizations, and guarantees clean teardown.

## 2. Scope
- Python backend test and provisioning harness (`backend/app/db/tenant_harness.py`).
- Subprocess-isolated Alembic migration upgrade (`head`) and symmetrical downgrade (`base`) execution.
- Fixes to legacy Alembic downgrade operations (`cc8a527deb42`, `931451e6eea2`, `8cf33df7b76a`, `a1b2c3d4e5f6`, `v1343_accounting_gl`) with cascading table drops.
- Registration of unified platform tables in `backend/alembic/env.py` (`include_object`).
- Dynamic session management with `NullPool` and Control Plane registry cache injection.
- End-to-end integration test suite (`backend/tests/t_tenant_migr.py`).

## 3. Files Created
- `backend/app/db/tenant_harness.py`: Core ephemeral database provisioning and migration lifecycle management class.
- `backend/tests/t_tenant_migr.py`: 6-scenario integration test suite verifying clean-slate schema parity, symmetrical migration downgrades, COA completeness, multi-currency FX posting, and concurrent tenant isolation.
- `docs/walkthrough/foundation/Platform.md`: This governance walkthrough document.

## 4. Files Modified
- `backend/alembic/env.py`: Added 18 canonical platform tables (`accounts`, `journal_vouchers`, `general_ledger_entries`, `account_balance_snapshots`, `fiscal_years`, `fiscal_periods`, `bank_statements`, `bank_statement_lines`, `currency_exchange_rates`, `pricing_rules`, `price_books`, `payment_transactions`, `approval_rules`, `communication_templates`, `integration_outbox_events`) to `include_object`.
- `backend/app/models/__init__.py`: Added `from .role import Role` for complete metadata dependency resolution.
- `backend/alembic/versions/cc8a527deb42_add_pos_shift_tables.py`: Fixed `downgrade()` to safely drop columns and tables with cascade.
- `backend/alembic/versions/931451e6eea2_add_companies_and_branches.py`: Aligned foreign key constraint names and added cascade drops.
- `backend/alembic/versions/8cf33df7b76a_add_users_and_token_blacklist.py`: Added safe cascade table and enum drops.
- `backend/alembic/versions/a1b2c3d4e5f6_add_missing_core_tables.py`: Added safe cascade table drops.
- `backend/alembic/versions/v1343_accounting_gl.py`: Implemented symmetrical `downgrade()` dropping accounting tables in reverse dependency order.
- `docs/walkthrough/README.md`: Appended entry to the master index.
- `docs/implementation/README.md`: Appended implementation plan reference.

## 5. Architecture Decisions
1. **Subprocess Alembic Execution**: Running Alembic inside pytest-asyncio event loops previously caused `RuntimeError: asyncio.run() cannot be called from a running event loop`. Alembic operations are now invoked via subprocess (`sys.executable -m alembic -x db=...`), ensuring clean, non-clashing execution.
2. **Cascading Downgrade Safety**: In PostgreSQL, dropping parent tables referenced by foreign keys fails without `CASCADE`. All root table downgrade routines were hardened with `CASCADE` drops.
3. **Control Plane Registry Cache Bypassing**: In dynamic test environments, ephemeral database names (`smriti<hex>`) are automatically added to `_verified_company_databases` to allow `get_company_async_engine` to instantiate pooled engines without requiring manual control-plane rows.

## 6. Design Rationale
In a multi-database multi-tenant ERP/Retail OS, testing solely against static pre-existing databases masks latent migration bugs (such as missing downgrade logic or unnamed foreign key constraints). The ephemeral test harness guarantees that any new tenant database provisioned in production will migrate flawlessly from scratch and seed standard accounting ledgers without manual intervention.

## 7. Implementation Summary
- `EphemeralTenantHarness.create_ephemeral_database(db_name)` creates a PostgreSQL database outside a transaction block using admin credentials against `postgres` maintenance DB.
- `EphemeralTenantHarness.run_alembic_upgrade(db_name, "head")` applies all 25+ revisions.
- `EphemeralTenantHarness.run_alembic_downgrade(db_name, "base")` drops all custom tables cleanly.
- `EphemeralTenantHarness.seed_baseline_tenant_environment(session, ...)` configures Company, Branch, System Users, and 22-account Chart of Accounts.
- `EphemeralTenantHarness.drop_ephemeral_database(db_name)` terminates all active backend connections and drops the ephemeral database with force.

## 8. Tests Executed
```bash
python -m pytest tests/t_tenant_migr.py -v
```
All 6 test cases passed:
1. `test_ephemeral_clean_slate_schema_verification`: All 24+ core tables and alembic head revision verified on fresh database.
2. `test_ephemeral_symmetrical_downgrade_and_reupgrade`: Downgrade to `base` drops all custom tables; re-upgrade to `head` recreates all tables cleanly.
3. `test_ephemeral_tenant_seeding_and_double_entry_transaction`: Seed baseline tenant, post ₹100,000 double-entry capital infusion JV, verify trial balance equality ($\sum \text{Debits} == \sum \text{Credits}$), and assert multi-tenant isolation against `smriti001`.
4. `test_ephemeral_chart_of_accounts_completeness`: Verify presence of all standard nominal, asset, liability, equity, income, expense, overage (`4050`), shortage (`5070`), and FX accounts (`4030`, `4040`, `5050`, `5060`).
5. `test_ephemeral_multi_currency_fx_in_clean_database`: Verify USD/INR rate insertion and foreign currency voucher posting.
6. `test_ephemeral_concurrent_tenants_isolation`: Concurrently provision two ephemeral databases (`smriti...a` and `smriti...b`) and verify strict physical data separation.

## 9. Verification Results
```text
117 passed, 19 warnings in 112.87s (0:01:52) across 19 test suites
```

## 10. Known Limitations
- Ephemeral databases require PostgreSQL superuser or database creation privileges on the local/test database cluster.

## 11. Future Work
- Integrate physical cash drawer denomination breakdown (counts of ₹500, ₹200, ₹100, etc.) on POS shift closing.
- Implement automated mid-shift cash drops / petty expense vouchers.

## 12. Related ADRs
- ADR-001: Sole FastAPI + PostgreSQL Backend System-of-Record
- ADR-003: Multi-Database Multi-Tenant Architecture

## 13. Related RFCs
- RFC-2026-08-01: Universal Accounting Ledger & Clean-Slate Migration Verification
