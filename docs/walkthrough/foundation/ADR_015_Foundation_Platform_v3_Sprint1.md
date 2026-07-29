<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Version      : 7.1.0
  Created      : 2026-07-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# ADR-015: SMRITI Foundation Platform v3.0 — Sprint 1 Walkthrough

## What Was Built

Sprint 1 of ADR-015 (Foundation Platform v3.0) implements the full database layer for the reusable Foundation Engines that replace entity-specific satellite tables across all SMRITI modules.

## Files Created / Modified

| File | Action | Description |
| :--- | :---: | :--- |
| `backend/app/models/foundation.py` | NEW | 13 ORM model classes for all Foundation Engines |
| `backend/app/models/company_master.py` | NEW | Organization, CompanyTaxProfile, CompanyFinancialYear |
| `backend/app/models/tenant.py` | EXTEND | Additive ADR-015 columns on Company + Branch (AOP-004) |
| `backend/app/models/__init__.py` | EXTEND | Exports all 16 new model classes |
| `backend/app/db/versions/v1217_adr015_foundation_platform_v3.py` | NEW | Alembic migration — 13 DDL groups |

## Tables Created (20 new tables)

| Engine | Table | Key Feature |
| :--- | :--- | :--- |
| Identity | `organizations` | Optional enterprise root |
| Identity | `smriti_entity_registry` | Master anchor — all engines FK here |
| Address | `smriti_addresses` | Polymorphic + logistics fields |
| Contact | `smriti_contacts` | Polymorphic + notification prefs |
| Bank | `smriti_banks` | Master with 20 Indian bank seeds |
| Bank | `smriti_bank_accounts` | Encrypted account numbers |
| Communication | `smriti_comm_channels` | Unified + health monitoring |
| Settings | `smriti_settings` | Self-validating key/value |
| Branding | `smriti_themes` | Multi-theme support |
| Branding | `smriti_theme_variants` | LIGHT/DARK/HIGH_CONTRAST/PRINT |
| Branding | `smriti_branding` | Asset rows (LOGO, FAVICON, etc.) |
| Branding | `smriti_report_templates` | Per-document HTML templates |
| Social | `smriti_social_profiles` | Platform/URL rows |
| Tax | `company_tax_profiles` | GSTIN, PAN, TAN, CIN, MSME, IEC |
| Financial | `company_financial_years` | FY lifecycle (OPEN→CLOSED→LOCKED) |
| Audit | `smriti_audit_log` | INSERT-ONLY, SHA-256 hash-chained |

## Columns Extended (AOP-004 — Additive Only)

**companies**: organization_id, company_code, legal_name, short_name, company_type, industry_type, is_default, is_gst_registered, incorporation_date, fiscal_year_start_month, currency_code, country_code, timezone, language_code, description

**branches**: branch_type, gstin, phone, email, manager_user_id

## Import Validation

```
foundation.py: OK
company_master.py: OK
```

## Next Steps (Sprint 2)

- `EntityRegistryService`, `AddressEngineService`, `ContactEngineService`
- `BankEngineService` (encrypt/mask), `CommChannelService` (.test_smtp/.test_sms/.test_whatsapp)
- `SettingsEngineService` (.validate_and_set()), `AuditEngineService` (INSERT-ONLY)
- Full Pytest suite for all 8 engine services
