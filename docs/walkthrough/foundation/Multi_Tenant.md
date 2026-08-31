<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Multi-Tenant Sales Contract & Workspace Themes Remediation — v3.26.0

## 1. Purpose
Resolve remaining regression test failure clusters in the SMRITI multi-tenant platform architecture:
1. Workspace themes and user persona profile resolution in `smritisys`.
2. Multi-tenant sales invoice routing, cross-tenant isolation, FEFO batch stock allocation, and idempotency protection across `smriti001` and `smriti002`.
3. Non-canonical database clean-up preserving authoritative business truth (Tax Invoices 18–106).

---

## 2. Scope
- `backend/app/db/ctrl_seeder.py`: Sentinel platform company insertion (`comp-default`) to satisfy `smriti_themes.company_id` foreign key constraints on the Control Plane.
- `backend/app/schemas/sales.py`: Pydantic `SalesInvoiceBase.is_interstate` field nullability normalization (`Optional[bool]`).
- `backend/tests/t_sales_contract.py`: Multi-tenant routing target alignment (`COMP-002`), suite-level test DB cleanup, stock initialization, and tax-exclusive pricing assertion.
- PostgreSQL Control & Data Planes: `smriti002` provisioning and migration up to `v1370_tcb_status (head)`.

---

## 3. Files Created
- `docs/walkthrough/foundation/Multi_Tenant.md`

---

## 4. Files Modified
- `backend/app/db/ctrl_seeder.py`
- `backend/app/schemas/sales.py`
- `backend/tests/t_sales_contract.py`
- `docs/architecture/PLATFORM.md`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
1. **Control Plane Sentinel Company:** Because `smriti_themes` and `smriti_workspace_profiles` reside in `smritisys` with a foreign key constraint pointing to `companies.id`, a sentinel platform company (`comp-default` / "SMRITI Platform Control Plane") is seeded directly into `smritisys.companies` prior to theme creation.
2. **Authoritative Fail-Closed Tenant Resolution:** `resolve_company_database_name()` enforces that every accessed tenant company ID must be actively registered in `smritisys.company_database_registries` with status `READY`. Test tenant `COMP-002` is persistently registered pointing to `smriti002`.
3. **Pydantic Response Nullability:** Legacy database records without explicit `is_interstate` values default to `None` in the database; Pydantic v2 requires `Optional[bool]` to avoid `ResponseValidationError`.

---

## 6. Design Rationale
- Tests must never bypass tenant routing or mock away real database constraints. Provisioning `smriti002` and registering `COMP-002` ensures end-to-end multi-tenant connection routing executes through the exact same path in automated tests as in production.
- Suite setup cleanup must execute once per test suite rather than before each test function to allow chained contract workflows (create invoice in test 04 → inspect detail in test 06 → render HTML/PDF in test 07–09).

---

## 7. Implementation Summary
- Added `ControlPlaneSeeder.seed_platform_company()` and executed seeder, populating 1 theme, 2 variants, and 5 workspace profiles.
- Migrated `smriti002` database to Alembic head `v1370_tcb_status`.
- Registered `COMP-002` in `smritisys.company_database_registries`.
- Corrected `SalesInvoiceBase.is_interstate` field definition.
- Updated `t_sales_contract.py` with one-time cleanup fixture and explicit tax-exclusive item configuration.

---

## 8. Tests Executed
```bash
python -m pytest tests/t_menu_registry.py -v --tb=short
python -m pytest tests/t_sales_contract.py -v --tb=short
python -m pytest tests/ --no-header -q
```

---

## 9. Verification Results

### `t_menu_registry.py` (6/6 Passed)
```text
tests/t_menu_registry.py::test_themes_and_variants_api PASSED
tests/t_menu_registry.py::test_workspace_profiles_api PASSED
tests/t_menu_registry.py::test_my_workspace_profile_persona_resolution PASSED
tests/t_menu_registry.py::test_resolved_menus_sysadmin_full_access PASSED
tests/t_menu_registry.py::test_resolved_menus_cashier_pruning_and_security PASSED
tests/t_menu_registry.py::test_database_backed_workspace_templates PASSED
======================== 6 passed, 5 warnings in 7.45s ========================
```

### `t_sales_contract.py` (10/10 Passed)
```text
tests/t_sales_contract.py::test_01_multi_tenant_routing_company_a PASSED
tests/t_sales_contract.py::test_02_multi_tenant_routing_company_b PASSED
tests/t_sales_contract.py::test_03_header_tampering_and_cross_tenant_isolation_forbidden PASSED
tests/t_sales_contract.py::test_04_create_invoice_and_verify_stock_deduction PASSED
tests/t_sales_contract.py::test_05_create_invoice_outbox_event PASSED
tests/t_sales_contract.py::test_06_get_invoice_detail_authoritative PASSED
tests/t_sales_contract.py::test_07_get_html_preview_matches_db PASSED
tests/t_sales_contract.py::test_08_get_pdf_rendered_successfully PASSED
tests/t_sales_contract.py::test_09_print_preview_structure PASSED
tests/t_sales_contract.py::test_10_double_submit_idempotency_semantics PASSED
======================= 10 passed, 5 warnings in 9.75s ========================
```

### Full Regression Suite
```text
435 passed, 18 failed, 3 errors in 198.98s (was 418 passed / 35 failed / 3 errors)
Net Delta: +17 tests turned GREEN
```

---

## 10. Known Limitations
- The remaining 18 failures are in test suites requiring batch on-disk PDF files (`exports/tt_batch_74_103/` artifacts) or item variant collection attributes.

---

## 11. Future Work
- Execute batch invoice PDF export generator to populate the physical disk artifact directories for `t_canonical_tax.py` and `t_tt_batch_74_103.py`.
- Reconcile item master variant collection attribute mapping in `t_univ_item.py`.

---

## 12. Related ADRs
- `docs/adr/ADR-0021-Multi-Tenant-Database-Routing.md`
- `docs/adr/ADR-0033-Control-Plane-Tenant-Registry.md`

---

## 13. Related RFCs
- `docs/rfc/RFC-0012-Sales-Invoice-Contract-Alignment.md`
