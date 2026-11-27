# Control Plane Database Assessment — `smritisys`

## Scope and evidence

This is a **source/model/migration assessment only**. No PostgreSQL service was queried. Therefore, the report does not claim an actual inventory of live tables, columns, constraints, indexes, views, functions, triggers, sequences, permissions, migration versions, orphan records or duplicate records.

Evidence inspected: `backend/app/db/session.py`, `backend/app/db/ownership.py`, `backend/app/models/ui_control_plane.py`, `backend/app/models/tenant.py`, `backend/app/models/auth.py`, `backend/app/models/company_registry.py`, `backend/alembic/env.py`, selected migration files and startup/guard code.

## Intended responsibilities represented in code

The ownership registry assigns Control Plane ownership to:

- Company, branch and company-database registry metadata.
- Users, roles, refresh-token blacklist and company/branch/store assignments.
- Menus, permissions, audit logs, legacy menu map and numbering registry.
- System configuration, capabilities, workspace templates and system parameters.
- Themes, workspace profiles, screen/field/action/layout definitions and icon registry.
- Integration provider/connector/registry/policy/version metadata and credential references.
- Workflow/formula/business-rule definitions and architecture governance metadata.
- Control-plane `alembic_version` history.

Model files represent tables such as `smriti_themes`, `smriti_theme_variants`, `smriti_workspace_profiles`, `screen_definitions`, `field_definitions`, `action_definitions`, `layout_definitions`, `icon_registry`, `provider_registry`, `connector_registry` and identity/numbering registries. ORM declarations are not evidence that these tables exist in the accessible database.

## Independence and boundary mechanisms

Positive evidence in the source:

- `session.py` creates a dedicated Control Plane engine from `settings.DATABASE_URL` and caches separate tenant engines/session factories.
- `resolve_company_database_name()` reads `company_database_registries`, requires a `READY` status and rejects an invalid resolved database name.
- `TenantDBContext` rejects `smritisys` for operational use.
- `ownership.py` declares explicit table owners and the startup Control Plane guard checks for tenant-owned table contamination.

Limitations:

- No live database mapping, registry row, status, connection configuration or table placement was examined.
- Control Plane status/registry cache invalidation and revocation latency were not tested.
- Control Plane and tenant migrations were not applied or compared.

## Inconsistency requiring resolution — EA-DB-02

`ownership.py` classifies `companies`, `branches`, `users`, `roles` and assignments as Control Plane-owned. The original `include_object()` filter excluded tenant-owned tables for the `"control"` target but did not symmetrically exclude Control Plane-owned names for the `"tenant"` target. The working-tree remediation now applies both exclusions using canonical ownership metadata. Focused target-scope tests passed; no Alembic autogenerate run or live schema comparison was performed.

This was an autogenerate filtering inconsistency, not proof that a deployed tenant schema contains these tables. Inspect fresh isolated Control Plane and tenant schemas before release.

## Data integrity and security

Not measurable without a read-only live connection and approved scope. No claims are made about actual foreign keys, uniqueness, referential integrity, permissions, or data quality.

Source-level risk: the non-SYSADMIN `COMP-001` fallback has been removed and `get_company_db()` rejects an empty tenant company identifier (EA-SEC-01). Existing valid-company legacy users retain the existing conditional assignment compatibility behavior. Focused mocked tests passed; no live request was submitted.

## Score and recommendations

**Control Plane Architecture: 5.0/10. Database Integrity: 3.5/10.** The architectural intent and guardrails are visible; actual schema and data health are unknown, and the migration/ownership mismatch must be resolved.

Recommended, approval-gated work:

1. Provide an explicitly approved read-only account against an isolated copy or authorized environment.
2. Inventory schemas and migration versions separately for `smritisys` and every registered company database; do not dump row-level personal data.
3. Compare live table ownership with the canonical registry and migrations.
4. Run integrity checks using metadata/counts only, with customer identifiers redacted.
5. Verify backup/restore and Control Plane lifecycle in an isolated environment.

See [13_RISK_REGISTER_REMEDIATION_ROADMAP.md](./13_RISK_REGISTER_REMEDIATION_ROADMAP.md) for action sequencing.
