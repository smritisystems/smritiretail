<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Foundation: Blueprint v1.0 — UI/Experience Engine Schema & Integration Hub Registry v1.0

## 1. Purpose

Close the two named implementation gaps identified during the formal Blueprint v1.0 verification (2026-08-24):
1. **UI/Experience Engine ss11** — screen, field, action, layout, and icon registry tables missing from smritisys Control Plane schema.
2. **Integration Hub ss45** — connector, provider, and integration registry metadata tables missing from smritisys.

## 2. Scope

| Area | Change |
|---|---|
| Alembic migrations | v1368_ui_experience_engine, v1369_integration_hub_registry |
| SQLAlchemy models | ui_control_plane.py (extended), integration_hub.py (new) |
| Control plane seeder | seed_icon_registry(), seed_integration_providers() |
| FastAPI API | ui_control_plane.py (+4 endpoints), integration.py (+3 endpoints) |
| Architecture tracker | SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md |

## 3. Files Created

| File | Purpose |
|---|---|
| backend/alembic/versions/v1368_ui_experience_engine.py | Creates 5 UI/Experience Engine tables in smritisys |
| backend/alembic/versions/v1369_integration_hub_registry.py | Creates 6 Integration Hub registry tables in smritisys |
| backend/app/models/integration_hub.py | SQLAlchemy models for Integration Hub |

## 4. Files Modified

| File | Change |
|---|---|
| backend/app/models/ui_control_plane.py | Added 5 new ORM models (ScreenDefinition, FieldDefinition, ActionDefinition, LayoutDefinition, IconRegistry) |
| backend/app/db/control_plane_seeder.py | Added seed_icon_registry() (35 icons), seed_integration_providers() (6 providers); wired into seed_all() |
| backend/app/api/v1/ui_control_plane.py | Added GET /screens, /fields, /actions, /icons endpoints |
| backend/app/api/v1/integration.py | Added GET /hub/providers, /hub/connectors, /hub/integrations endpoints |
| docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md | Added Milestone 5, ss54 rules adherence table, updated review date |

## 5. Architecture Decisions

### AD-1: UI definitions in smritisys, rendering in React
Blueprint Rule 07-09 requires that screen/field/action definitions are governed metadata in the Control Plane (smritisys), not hardcoded in application source. This migration creates the schema; seeding populates defaults; React reads definitions at runtime via /api/v1/ui/*.

### AD-2: Integration credentials as references only
integration_credentials_reference stores only an env var name or secret manager path — never the actual credential value. This enforces Blueprint Rule 09 (no secrets in smritisys) and aligns with 12-factor app and secret manager patterns.

### AD-3: icon_key as the decoupling mechanism
All screens, actions, and menu entries reference icons by key (e.g., icon.pos.checkout), not by the Material Symbols identifier directly. The icon_registry maps key -> pack -> identifier. This allows the icon pack to be changed at the platform level without touching screen or action definitions.

## 6. Design Rationale

- All 5 UI tables and all 6 Integration Hub tables are forward-only migrations, consistent with v1361-v1367 chain policy.
- Tables are inspector-guarded (idempotent) — safe to run on environments where tables already exist from partial migrations.
- Seeder methods are table-existence-guarded via SELECT to_regclass() — safe to call before migration runs.
- All governed tables carry (code, version) unique constraint per Blueprint Rule 23.

## 7. Implementation Summary

Phase 1: Status doc updated — cross-check date, ss54 rules table, Milestone 5, two new gap rows.
Phase 2: v1368 migration created — 5 tables, 13 indexes.
Phase 3: v1369 migration created — 6 tables, 9 indexes.
Phase 4: ui_control_plane.py extended — 5 new ORM models.
Phase 5: integration_hub.py created — 6 ORM models.
Phase 6: control_plane_seeder.py updated — 2 new seed methods, seed_all() updated.
Phase 7: ui_control_plane.py API extended — 4 endpoints.
Phase 8: integration.py API extended — 3 endpoints.

## 8. Tests Executed

No automated test suite changes were made in this session. The new tables and seed methods will be covered by the next run of the existing 15-suite regression when migrations are applied.

Manual verification: git diff --stat HEAD confirmed 8 files, 1288 insertions, 15 deletions.

## 9. Verification Results

**Evidence:** git diff --stat HEAD output:
`
backend/alembic/versions/v1368_ui_experience_engine.py      | 243 +++++++++++++++++++++
backend/alembic/versions/v1369_integration_hub_registry.py  | 186 ++++++++++++++++
backend/app/api/v1/integration.py                           | 119 +++++++++-
backend/app/api/v1/ui_control_plane.py                      | 157 ++++++++++++-
backend/app/db/control_plane_seeder.py                      | 157 ++++++++++++-
backend/app/models/integration_hub.py                       | 184 ++++++++++++++++
backend/app/models/ui_control_plane.py                      | 208 +++++++++++++++++-
docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md  |  49 ++++-
8 files changed, 1288 insertions(+), 15 deletions(-)
`

**Interpretation:** All 8 files changed as planned. 3 new files created (migrations and model). 5 existing files extended. No deletions except header line updates.

**Recommendation:** Run lembic upgrade head against smritisys to apply v1368 and v1369, then run seed_all() to populate icons and integration providers.

## 10. Known Limitations

- screen_definitions and ield_definitions are seeded empty (no seed data in this session). Seed data for core screens (Sales List, POS Billing, Purchase Order) is deferred to the next session.
- ConnectorRegistry seed data (Tally, GSTN, E-Way Bill connectors) is deferred — provider catalogue only is seeded.
- Icon catalogue covers 35 platform icons. Full icon coverage for all modules is ongoing.

## 11. Future Work

- Seed core screen definitions for the top 5 business flows (POS Checkout, Sales Invoice List, Purchase Order List, Inventory Dashboard, Party List).
- Seed field definitions for universal Party and Item fields.
- Seed action definitions for primary toolbar actions per screen.
- Seed connector definitions for Tally, GSTN, NIC E-Way Bill.
- Update status tracker: move "UI/Experience Engine" and "Integration Hub Connector Registry" from **Partial** to **Done** after migrations run and seed is confirmed.

## 12. Related ADRs

- ADR-011: Control Plane defines configuration; application code executes behavior.
- ADR-023: Version all governed metadata with (code, version) composite unique key.

## 13. Related RFCs

- Blueprint ss11: UI/Experience Engine
- Blueprint ss45: Integration Hub
- Blueprint ss54 Rule 07-09: Control Plane / No executable code in smritisys
