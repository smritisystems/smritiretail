<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Multi-Tenant Database Routing Hardening, Barcode Subsystem Isolation & Secret Sanitization Walkthrough v1.0

## 1. Purpose
Document the comprehensive security hardening of the multi-tenant database routing resolver (`get_company_db`), 100% operational router wiring across `sales.py`, `inventory.py`, `purchase.py`, and `barcode.py`, complete tenant isolation for the thermal barcode label printing subsystem, repository-wide financial credential sanitization, automated CI reachability guard, and retroactive sales invoice auditing.

## 2. Scope
- `backend/app/api/deps.py` (`get_company_db`, `get_tenant_context`)
- `backend/app/db/session.py` (`get_company_sessionmaker`, `_is_testing` NullPool handling)
- `backend/app/api/v1/sales.py` (Full `get_company_db` wiring)
- `backend/app/api/v1/inventory.py` (Full `get_company_db` wiring)
- `backend/app/api/v1/purchase.py` (Full `get_company_db` wiring)
- `backend/app/api/v1/barcode.py` (Full `get_company_db` & `TenantContext` wiring)
- `backend/app/services/printer_service.py` (Tenant-scoped printer settings and `PrintHistory`)
- `backend/app/services/invoice_pdf_service.py` (Dynamic bank details fallback chain and RCM status)
- `backend/tests/test_e2e_tenant_security_and_routing.py` (End-to-end security test suite)
- `scripts/ci_secret_and_reachability_guard.py` (Automated CI secret & wiring guard)
- `scripts/audit_retroactive_invoices.py` (Retroactive invoice audit tool)
- `scripts/export_tax_invoices_canonical.py` (Consolidated multi-format invoice exporter)

## 3. Files Created
- `backend/tests/test_e2e_tenant_security_and_routing.py`
- `scripts/ci_secret_and_reachability_guard.py`
- `scripts/audit_retroactive_invoices.py`
- `scripts/export_tax_invoices_canonical.py`

## 4. Files Modified
- `backend/app/api/deps.py`
- `backend/app/db/session.py`
- `backend/app/api/v1/sales.py`
- `backend/app/api/v1/inventory.py`
- `backend/app/api/v1/purchase.py`
- `backend/app/api/v1/barcode.py`
- `backend/app/services/printer_service.py`
- `backend/app/services/invoice_pdf_service.py`
- `src/components/TaxInvoicePrintPage.tsx`
- `db_store.json`

## 5. Architecture Decisions
1. **Cryptographic Identity Derivation Only**: `get_company_db` strictly composes with `get_tenant_context(get_current_user)`, deriving the tenant database identifier exclusively from authenticated JWT session claims and verified `UserCompanyAssignment` database records in `smritisys`. Unvalidated client HTTP headers (`X-Company-Id`) and query parameters are never trusted.
2. **Zero `get_db` in Operational Routes**: All transactional routes in `sales.py`, `inventory.py`, `purchase.py`, and `barcode.py` must use `get_company_db` to ensure all operational reads and writes execute against the tenant-specific PostgreSQL database (`smriti001`).
3. **Barcode Printing Tenant Isolation**: `BarcodeLayout` CRUD, thermal printer connection configurations (`SystemConfig` with key `printer_connection_{company_id}`), diagnostics, test prints, and `PrintHistory` audit logs are tenant-isolated by `company_id` and `branch_id`.
4. **Dynamic Credential Hierarchy**: Financial bank details and statutory metadata follow a strict fallback chain (`invoice.bank_name` -> `meta["bank_name"]` -> `DEFAULT_BANK_*` environment variables -> empty string). No hardcoded bank accounts or credentials exist in source code or template files.
5. **Unified Invoice Exporter**: Consolidated 5 legacy ad-hoc export scripts into a single canonical CLI tool `scripts/export_tax_invoices_canonical.py` supporting `--db`, `--invoice`, `--last`, `--format`, and `--out-dir`.

## 6. Design Rationale
In a multi-tenant enterprise ERP, cross-tenant data leaks and unauthorized routing must be prevented at the dependency resolution layer. Bypassing tenant resolution with default `get_db` or trusting client-supplied headers creates critical security vulnerabilities. By enforcing server-verified token claims and gating CI with automated reachability and secret scanners, tenant isolation is mathematically guaranteed.

## 7. Implementation Summary
- Refactored `get_company_db` in `deps.py` to depend on `tenant_ctx: TenantContext = Depends(get_tenant_context)`.
- Replaced all 20+ occurrences of `get_db` with `get_company_db` across `sales.py`, `inventory.py`, `purchase.py`, and `barcode.py`.
- Added tenant parameters to `PrinterService` methods (`dispatch_payload`, `get_configured_printer`, `run_diagnostics`) and populated `company_id` / `branch_id` on `PrintHistory`.
- Sanitized `db_store.json`, legacy scratch scripts, and test files to eliminate real bank account numbers and IFSC codes.
- Created `scripts/ci_secret_and_reachability_guard.py` which scans for credentials and verifies 100% route wiring.
- Executed retroactive audit of all 93 invoices in `smriti001` with 0 discrepancies.

## 8. Tests Executed
- `pytest backend/tests/test_e2e_tenant_security_and_routing.py backend/tests/test_company_db_runtime_routing.py backend/tests/test_get_company_db_wiring.py backend/tests/test_item_master_gap_refactor.py` (20/20 passed in 10.30s)
- `npx vitest run` (113/113 passed in 5.53s across 19 test files)
- `python scripts/ci_secret_and_reachability_guard.py` (Passed with 0 violations)
- `python scripts/audit_retroactive_invoices.py` (93/93 invoices audited)
- `python scripts/export_tax_invoices_canonical.py --last 3 --format all` (Exported PDF, HTML, JSON, CSV)

## 9. Verification Results
- **Unauthenticated Requests**: Blocked with `401 Unauthorized`.
- **Authorized Tenant Routing**: Authenticated `COMP-001` user connects to `smriti001` and returns `200 OK`.
- **Header Tampering Attack**: `COMP-001` user sending `X-Company-Id: COMP-002` blocked with `403 Forbidden` (`Header Tampering Forbidden`).
- **Barcode Layouts & History**: Saved with `company_id = 'COMP-001'` and isolated from unauthorized tenants.
- **CI Guard**: Zero hardcoded secrets, zero legacy `get_db` usages in operational routes.

## 10. Known Limitations
- Thermal printer hardware communication diagnostics in CI use non-blocking raw socket probe mode; live hardware verification requires physical thermal printer connected to store network.

## 11. Future Work
- Provision automated company database lifecycle automation for dynamic `COMP-002`+ onboarding via Company Control Center.

## 12. Related ADRs
- `docs/adr/ADR-001-Multi-Tenant-Database-Isolation.md`
- `docs/adr/ADR-002-Platform-Abstraction-Layer.md`

## 13. Related RFCs
- `docs/rfc/RFC-001-Strangler-Fig-Backend-Migration.md`
