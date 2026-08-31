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

  * Version    : 3.38.0
  * Created    : 2026-08-25
  * Modified   : 2026-08-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Sprint 22 — P0 Production Blockers Stabilization

## 1. Purpose
This document records the engineering certification, test hardening, and governance status transition of the three **P0 Production Blockers** identified in the SMRITI Retail OS platform blueprint:
- **P0.1**: POS Foreign Key Constraints & Financial Ledger Integrity (`v1360_pos_sct_fk_constraints`).
- **P0.2**: Secure eCommerce Omnichannel Routing, HMAC Ingress & Database Idempotency.
- **P0.3**: Fail-Closed Production Security & Dynamic Credential Binding.

## 2. Scope
- Verification of PostgreSQL foreign key constraints on `shift_cash_transactions` (`fk_sct_account_id` → `accounts.id`, `fk_sct_gl_voucher_id` → `journal_vouchers.id`) across active tenant databases (`smriti001`, `smriti002`, `smritisys`).
- Zero orphan GL reference assertions across all active tenant databases.
- Enforcement of ADR-POS-002 forward-only migration governance preventing financial state corruption.
- Verification of credential omission in `CompanyDatabaseResolver`.
- Verification of HMAC-SHA256 signature verification for external eCommerce connectors (Shopify, WooCommerce) and database-level idempotency via `integration_outbox_events`.
- Verification of fail-closed production startup security in `Settings.load_settings()`.
- Resolution of test fixture validation in `test_wms_phase1.py`.

## 3. Files Created
- `backend/tests/t_pos_sct_fk.py`: Dedicated test suite certifying POS SCT FK constraints, zero orphans, and forward-only downgrade governance.
- `scripts/audit_sct.py`: SCT schema inspection and orphan check script.
- `scripts/audit_all_dbs.py`: Multi-database Alembic version and constraint auditor.
- `docs/walkthrough/foundation/Sprint22_P0_Production_Blockers_v1.0.0.md`: This walkthrough document.

## 4. Files Modified
- `backend/tests/test_wms_phase1.py`: Added required `mrp`, `hsn_code`, and `reserved_stock` attributes to test `Product` fixture.
- `docs/architecture/BLUEPRINT_PENDING.md`: Transitioned Section 3 (P0.1, P0.2, P0.3) to `Done / Verified` with 3-part quantitative metrics, named mechanisms, and test citations per Rule 11.
- `docs/walkthrough/README.md`: Appended Sprint 22 walkthrough entry to the master index.
- `CHANGELOG.md`: Registered v3.38.0 release notes.

## 5. Architecture Decisions
- **DEFERRABLE INITIALLY DEFERRED Constraints**: Financial GL transactions are written across multiple entity flushes within a single ACID transaction; deferring constraint checking to transaction commit ensures atomic consistency without mid-transaction locking failures.
- **Forward-Only Financial Governance (ADR-POS-002)**: Reverting FK constraints on financial tables like `shift_cash_transactions` is strictly prohibited because removing constraints silently permits orphaned financial ledger records to accumulate.
- **Fail-Closed Production Security**: The application refuses to boot when `ENVIRONMENT=production` if default or weak passwords/keys are detected.

## 6. Design Rationale
By testing against live tenant PostgreSQL instances (`smriti001`, `smriti002`, `smritisys`) and verifying credential omission in memory, SMRITI achieves zero-trust isolation between control plane routing and company-local transaction engines.

## 7. Implementation Summary

| Subsystem | Target Mechanism | Quantitative Metric | Verification Status |
|---|---|---|---|
| **P0.1: POS FK Constraints** | `DEFERRABLE INITIALLY DEFERRED` on `shift_cash_transactions` | 4/4 tests green; 0 orphan records in all DBs | Done |
| **P0.2: eCommerce Ingress** | HMAC-SHA256 signature check + outbox correlation | 5/5 tests green; 0 credentials exposed; 100% auth enforcement | Done |
| **P0.3: Production Security** | `load_settings()` fail-closed guard + secret validation | 6/6 tests green; 0 dev credentials permitted | Done |
| **WMS Isolation** | Product schema compliance in test fixtures | 4/4 tests green in `test_wms_phase1.py` | Done |

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/t_pos_sct_fk.py tests/t_ecom_webhooks.py tests/t_prod_sec.py tests/test_wms_phase1.py -v
```

Terminal Output:
```text
tests/t_pos_sct_fk.py::test_pos_sct_fk_constraints_and_zero_orphans PASSED [  5%]
tests/t_pos_sct_fk.py::test_v1360_forward_only_migration_governance PASSED [ 10%]
tests/t_pos_sct_fk.py::test_pos_sct_fk_rejection_on_invalid_account_id PASSED [ 15%]
tests/t_pos_sct_fk.py::test_pos_sct_fk_rejection_on_invalid_gl_voucher_id PASSED [ 21%]
tests/t_ecom_webhooks.py::test_resolver_omits_credentials_and_connection_urls PASSED [ 26%]
tests/t_ecom_webhooks.py::test_ecom_webhook_ingress_requires_authentication PASSED [ 31%]
tests/t_ecom_webhooks.py::test_ecom_shopify_webhook_hmac_verification_and_idempotency PASSED [ 36%]
tests/t_ecom_webhooks.py::test_ecom_woocommerce_webhook_signature_and_cross_company_denial PASSED [ 42%]
tests/t_ecom_webhooks.py::test_production_security_configuration_fails_closed PASSED [ 47%]
tests/t_prod_sec.py::test_production_mode_fails_on_default_postgres_password PASSED [ 52%]
tests/t_prod_sec.py::test_production_mode_fails_on_default_jwt_secret PASSED [ 57%]
tests/t_prod_sec.py::test_production_mode_fails_on_default_internal_service_key PASSED [ 63%]
tests/t_prod_sec.py::test_production_mode_succeeds_with_strong_credentials PASSED [ 68%]
tests/t_prod_sec.py::test_development_mode_permits_local_credentials PASSED [ 73%]
tests/t_prod_sec.py::test_control_database_registry_dynamic_credential_binding PASSED [ 78%]
tests/test_wms_phase1.py::test_wms_phase1_tables_and_scoped_constraints PASSED [ 84%]
tests/test_wms_phase1.py::test_wms_batch_stock_mutation_and_fefo_allocation PASSED [ 89%]
tests/test_wms_phase1.py::test_wms_stock_transfer_lifecycle PASSED       [ 94%]
tests/test_wms_phase1.py::test_wms_service_async_lifecycle PASSED        [100%]
======================= 19 passed, 8 warnings in 10.44s =======================
```

## 9. Verification Results
- `19/19` tests passed across POS SCT FK, eCommerce webhooks, production security, and WMS lifecycle suites.
- All P0 items in `docs/architecture/BLUEPRINT_PENDING.md` transition to `Done / Verified`.
- NGP naming policy: `0 violations` across repository.

## 10. Known Limitations
- External channel connector live testing requires active merchant store credentials.

## 11. Future Work
- Proceed to P1/P2 milestones (Global reference data seeding, reports portal legacy gap closure).

## 12. Related ADRs
- `ADR-POS-002`: POS Shift Cash Transaction GL Reference Foreign Key Architecture.
- `ADR-SEC-001`: Fail-Closed Security Configuration and Secret Validation.
- `ADR-004`: PostgreSQL Sole System-of-Record Architecture.

## 13. Related RFCs
- `RFC-007`: Omnichannel eCommerce Webhook Ingress and Outbox Idempotency.
- `RFC-010`: POS Shift Financial Reconciliation Integrity.
