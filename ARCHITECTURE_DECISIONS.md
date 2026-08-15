<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Architecture Decision — 2026-08-15

## v3.25.0 Authoritative Baseline

`56b5fb46b477aa81166680f60ad7030fe1493e5e` is the authoritative
SMRITI Retail OS v3.25.0 User Training baseline.

The current main/smritiNX lineage is intentional and is NOT treated
as a rollback or corrupted merge.

Inventory Kernel, SPK/SWSDK and SXP remain preserved on:
`origin/feat/physically-isolated-company-dbs`

They are experimental/next-generation architecture candidates and
must not be merged into v3.25.0 unless explicitly approved for v3.26.0+.

## Frozen v3.25.0 Rule

DO NOT modify main for experimental architecture recovery.

Any future Inventory Kernel / SWSDK / SXP integration must occur on
a dedicated feature branch with full regression, build, security,
database and architecture validation before merge.

## Master Baseline Hardening & Migration Governance (v3.25.0)

1. **Control Plane & Company DB Separation**: `smritisys` is the permanent Control Plane database. Each company maintains its own separate Company Business DB (`smriti001`). No transactional company data resides in `smritisys`. No `smriti002-smriti999` databases are automatically created during tests or audits.
2. **Immutable Migration History**: Historical applied migrations (such as `v1333`) are immutable. All new table additions and schema alignments are implemented in subsequent migrations (`v1334_add_v325_enterprise_tables.py`).
3. **Read-Only Schema Audit**: `scripts/audit_sqlalchemy_schema_drift.py` performs pure read-only inspection against PostgreSQL `information_schema` without calling `create_all()`.
4. **ORM Table Classifications**:
   - `REQUIRED_IN_V3_25` (31 Tables): Created via migration `v1334` (`commission_*`, `referral_*`, `loyalty_*`, `promotion_*`, `packing_slips`, `dispatches`, `transaction_cost_*`, `report_*`, `smriti_*`).
   - `PARKED_EXPERIMENTAL_ARCHITECTURE` (7 Tables): Multi-tenant isolated DB control plane models (`control_companies`, `control_company_databases`, `control_users`, `control_psv_configs`, `psv_stock_*`, `integration_outbox_events`) remain preserved on `origin/feat/physically-isolated-company-dbs`.
