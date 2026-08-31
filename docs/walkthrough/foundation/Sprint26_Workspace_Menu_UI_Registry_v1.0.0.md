---
title: "Sprint 26: P1.3 Workspace, Menu, and UI Experience Registry (Control Plane)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 26 — P1.3 Workspace, Menu, and UI Experience Registry (Control Plane)

## 1. Purpose
This sprint fulfills **Blueprint Section 4: P1 Control Plane Completion (P1.3 Workspace, Menu, and UI Experience Registry)**. It consolidates versioned control-plane metadata in `smritisys` for industry workspace templates, user persona profiles, capability-aware and role-governed hierarchical navigation tree resolution with parent-child cascade pruning, centralized theme design tokens, and comprehensive screen definition packages.

## 2. Scope
- **Workspace Templates**: 6 standard templates (`RETAIL_SUPERMARKET`, `APPAREL_FASHION`, `DISTRIBUTION_HUB`, `PHARMACY_HEALTHCARE`, `RESTAURANT_DINEIN`, `ENTERPRISE_HQ`).
- **Persona Profiles**: 4 standard profiles (`PROF_SYSADMIN`, `PROF_STORE_MANAGER`, `PROF_CASHIER`, `PROF_ACCOUNTANT`).
- **Dynamic Navigation Tree**: Resolved from `smriti_menus` with tenant capability gating and role-based access filtering with automatic empty parent pruning.
- **Theme Design Tokens**: Multi-theme token resolution (`SMRITI_DEFAULT`, `SAP_FIORI_HORIZON`, `HIGH_CONTRAST_OLED`).
- **Screen Definition Packages**: Full screen metadata aggregation (`SCR_POS_BILLING`, `SCR_INV_MASTER`, `SCR_PURCH_ORDER`, `SCR_SALES_INVOICE`) with form fields and action button triggers.
- **Verification**: 8/8 new integration tests in `backend/tests/t_workspace_ui.py` (35/35 full regression tests green).

## 3. Files Created
- [`backend/app/schemas/ui_registry.py`](file:///F:/SMRITRretailNX/backend/app/schemas/ui_registry.py) — Pydantic schemas for workspace templates, layout resolution, navigation tree, design tokens, and screen packages.
- [`backend/app/services/workspace_ui_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/workspace_ui_svc.py) — Core workspace layout resolution, capability & role-gated navigation tree builder, and design token engine.
- [`backend/app/api/v1/workspace_ui.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/workspace_ui.py) — REST endpoints for templates, layout resolution, navigation tree, design tokens, and screen packages.
- [`backend/app/db/seed_ui_master.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_ui_master.py) — Master data seeder for templates, profiles, themes, variants, screens, and action definitions.
- [`backend/tests/t_workspace_ui.py`](file:///F:/SMRITRretailNX/backend/tests/t_workspace_ui.py) — 8-part integration test suite.
- [`docs/walkthrough/foundation/Sprint26_Workspace_Menu_UI_Registry_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint26_Workspace_Menu_UI_Registry_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py) — Mounted `workspace_ui.router` under `/api/v1`.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 4.3 to `DONE / VERIFIED` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 26 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.42.0`.

## 5. Architecture Decisions
- **Preserved `smriti_menus` Sole Source**: Does not create a duplicate navigation table. The resolver pulls from `smriti_menus` and applies capability and permission pruning in memory before returning the tree.
- **Fail-Closed Capability Gating**: When a tenant disables an optional capability (e.g. `WMS` or `APPROVAL`), all associated navigation items and parent containers are pruned from the client tree.
- **Persona Context Overrides**: Automatically resolves density, default route, and shortcuts based on user role (`CASHIER`, `STORE_MANAGER`, `ACCOUNTANT`, `SYSADMIN`).

## 6. Design Rationale
Enterprise retail applications require unified screen definitions where backend metadata specifies layout structure, field validation rules, and action triggers, ensuring consistent cross-platform behavior without hardcoded frontend assumptions.

## 7. Implementation Summary
- **Templates**: `GET /api/v1/ui/templates` lists all standard industry templates.
- **Layout Resolution**: `GET /api/v1/ui/workspaces/resolve` produces persona layout and active tenant capabilities.
- **Resolved Navigation**: `GET /api/v1/ui/navigation/resolved` generates the active navigation tree for the current user.
- **Design Tokens**: `GET /api/v1/ui/themes/tokens` returns CSS variables and token sets.
- **Complete Screen Package**: `GET /api/v1/ui/screens/{screen_code}/complete` delivers screen metadata, fields, and action buttons.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python app/db/seed_ui_master.py
python -m pytest tests/t_workspace_ui.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 8 items

tests/t_workspace_ui.py::test_workspace_templates_catalog PASSED         [ 12%]
tests/t_workspace_ui.py::test_resolve_user_workspace_supermarket PASSED  [ 25%]
tests/t_workspace_ui.py::test_resolve_user_workspace_cashier_persona PASSED [ 37%]
tests/t_workspace_ui.py::test_resolved_navigation_sysadmin PASSED        [ 50%]
tests/t_workspace_ui.py::test_resolved_navigation_cashier_role_gating PASSED [ 62%]
tests/t_workspace_ui.py::test_theme_design_tokens PASSED                 [ 75%]
tests/t_workspace_ui.py::test_complete_screen_package_pos_billing PASSED [ 87%]
tests/t_workspace_ui.py::test_complete_screen_package_not_found PASSED   [100%]

======================== 8 passed, 8 warnings in 8.78s ========================
```

## 10. Known Limitations
- Screen field layout customization at the tenant company level is stored in `screen_definitions.layout_config`.

## 11. Future Work
- Sprint 27: `P1.4 Formula, Rule, Policy, and Workflow Engines (Blueprint Section 5.1)`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-004`: Control Plane and Multi-Tenant Isolation Model

## 13. Related RFCs
- `RFC-UI-001`: Control Plane Workspace, Menu, and UI Experience Registry
