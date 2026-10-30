<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.43.5
  Created      : 2026-09-20
  Modified     : 2026-09-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: System Parameters Studio UX Integration & Universal Navigation Wiring

## 1. Purpose
The purpose of this implementation is to provide 1-click discovery and seamless access to the **System Parameters Studio** ([SmritiSystemParametersStudio.tsx](file:///f:/SMRITRretailNX/src/components/setup/SmritiSystemParametersStudio.tsx)). While the Studio itself was fully implemented with 828 governed architectural switches, category browsing, inline editing, batch saving, and blueprint profile seeding, it was not previously registered as a tile in the **Fiori Launchpad**, mapped in the **Navigation Rail**, or linked in the **Global Header User Menu** and **Shortcut Context**. This update integrates the System Parameters Studio across all platform navigation channels.

## 2. Scope
* **Launchpad Integration**: Register `"system-parameters"` in `LAUNCHPAD_CATALOG` under the `"System & Operations"` group for `SYSADMIN` and `MANAGER` roles with primary badge, parameter tag, and `Alt+Y` shortcut hint.
* **Navigation Rail Resolution**: Map `system-parameters` into the `system` context navigation items and set proper icon and labels in [navigationResolver.ts](file:///f:/SMRITRretailNX/src/components/shell/navigationResolver.ts).
* **Context Arbitration**: Update `mapModuleToContext` in [AppShell.tsx](file:///f:/SMRITRretailNX/src/components/shell/AppShell.tsx) so `"system-parameters"`, `"parameters-studio"`, `"sys-params"`, and `"database-manager"` automatically resolve to the `system` BusinessContext.
* **Global Header User Dropdown**: Add a direct entry button for "System Parameters Studio" in [GlobalHeader.tsx](file:///f:/SMRITRretailNX/src/components/shell/GlobalHeader.tsx).
* **Breadcrumb Hierarchy**: Register `system-parameters`, `parameters-studio`, and `store-policies` under `system` in `DEFAULT_PARENT_MAP` within [BreadcrumbRegistry.ts](file:///f:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbRegistry.ts).
* **Layout Engine Registry**: Seed `system-parameters` and `database-manager` into the default `registeredWorkspaces` list in [layout_store.tsx](file:///f:/SMRITRretailNX/src/layout_engine/layout_store.tsx).
* **Keyboard Navigation**: Assign `Alt+Y` global shortcut in [ShortcutContext.tsx](file:///f:/SMRITRretailNX/src/contexts/ShortcutContext.tsx) and add `Escape` key close handling inside [SmritiSystemParametersStudio.tsx](file:///f:/SMRITRretailNX/src/components/setup/SmritiSystemParametersStudio.tsx).
* **Automated Test Validation**: Update `REGISTERED_APP_TABS` and add automated test cases in [fioriLaunchpad.test.ts](file:///f:/SMRITRretailNX/src/tests/fioriLaunchpad.test.ts).

## 3. Files Created
* `docs/walkthrough/foundation/Foundation_System_Parameters_Studio_UX_Integration_v6.43.5.md` (This document)
* `scripts/test_param_ux.py` (Automated headless Playwright verification suite)

## 4. Files Modified
* [src/components/launchpad/launchpadCatalog.ts](file:///f:/SMRITRretailNX/src/components/launchpad/launchpadCatalog.ts) — Added `system-parameters` tile configuration.
* [src/components/shell/navigationResolver.ts](file:///f:/SMRITRretailNX/src/components/shell/navigationResolver.ts) — Added `system-parameters` item under `system` context navigation.
* [src/components/shell/AppShell.tsx](file:///f:/SMRITRretailNX/src/components/shell/AppShell.tsx) — Mapped `system-parameters`, `parameters-studio`, `sys-params`, `database-manager` to `system` context.
* [src/components/shell/GlobalHeader.tsx](file:///f:/SMRITRretailNX/src/components/shell/GlobalHeader.tsx) — Added direct button in User Menu dropdown.
* [src/contexts/ShortcutContext.tsx](file:///f:/SMRITRretailNX/src/contexts/ShortcutContext.tsx) — Registered `Alt+Y` shortcut for System Parameters Studio.
* [src/navigation/breadcrumb/BreadcrumbRegistry.ts](file:///f:/SMRITRretailNX/src/navigation/breadcrumb/BreadcrumbRegistry.ts) — Mapped `system-parameters`, `parameters-studio`, `store-policies` to `system` parent.
* [src/layout_engine/layout_store.tsx](file:///f:/SMRITRretailNX/src/layout_engine/layout_store.tsx) — Added `system-parameters` and `database-manager` to initial `registeredWorkspaces`.
* [src/components/setup/SmritiSystemParametersStudio.tsx](file:///f:/SMRITRretailNX/src/components/setup/SmritiSystemParametersStudio.tsx) — Added `Escape` key handler, enhanced seed feedback messaging, and updated author header per UADHP.
* [backend/app/services/system_parameter.py](file:///f:/SMRITRretailNX/backend/app/services/system_parameter.py) — Hardened legacy blueprint resolution across host and containerized Docker environments (`SDIC_REPOSITORY_ROOT`), safeguarded against company foreign-key errors, and updated author header to 6.43.5.
* [backend/app/api/v1/system_parameters.py](file:///f:/SMRITRretailNX/backend/app/api/v1/system_parameters.py) — Updated author header and version to 6.43.5.
* [src/tests/fioriLaunchpad.test.ts](file:///f:/SMRITRretailNX/src/tests/fioriLaunchpad.test.ts) — Added `system-parameters` to `REGISTERED_APP_TABS` and added integration test assertions.

## 5. Architecture Decisions
* **SSOT Canonical Routing**: Kept `"system-parameters"` as the canonical route ID, while retaining `"parameters-studio"` and `"sys-params"` as backward-compatible aliases in `TabRenderer.tsx`.
* **Role-Based Access Control**: Restricted the Launchpad tile to `SYSADMIN` and `MANAGER` roles in `launchpadCatalog.ts`.
* **Zero-Latency In-Memory Resolution**: Parameters continue to use `smritiSystemParameterService.ts` 0ms in-memory cache with dual-key resolution (legacy keys + ADR-042 `SMRITI.DOMAIN.FEATURE` canonical keys).
* **Container-Resilient Blueprint Discovery**: Resolved legacy Shoper 9 blueprints using environment candidates (`SDIC_REPOSITORY_ROOT`, `/workspace`, host relative paths) guaranteeing 100% reliability in Docker production containers.

## 6. Design Rationale
System administrators and store managers frequently need to adjust operational policies (such as invoice numbering, tax calculation methods, terminal hardware flags, and billing switches). Having to type hidden URLs or run scripts is unacceptable for enterprise software. Adding the studio to the Fiori Launchpad, Navigation Rail, User Menu, and assigning `Alt+Y` makes it discoverable and efficient.

## 7. Implementation Summary
1. Registered `system-parameters` in `launchpadCatalog.ts` with description, `tune` icon, and role guards.
2. Verified launchpad catalog consistency with `node scripts/validate-launchpad-registry.mjs` (PASSED: 45/45 unique tiles with 83 app render cases).
3. Connected navigation resolution in `navigationResolver.ts` and `AppShell.tsx`.
4. Registered `Alt+Y` in `ShortcutContext.tsx` and Escape key listener in `SmritiSystemParametersStudio.tsx`.
5. Fixed containerized blueprint resolution in `backend/app/services/system_parameter.py` for `/api/v1/system-parameters/seed-profile`.
6. Added automated headless Playwright test suite `scripts/test_param_ux.py` verifying full end-to-end UX, keyboard shortcuts, seeding, and modal lifecycle.

## 8. Tests Executed
* `node scripts/validate-launchpad-registry.mjs` — Registry validation script (45/45 tiles green).
* `python scripts/architecture_duplication_gate.py` — Architecture gate (11/11 checks passed, 0 violations).
* `python scripts/smriti_breadcrumb_guard.py` — Breadcrumb guard (619 files scanned, 100% compliant).
* `python scripts/validate_version_ssot.py` — Version consistency across 4 boundaries (6.43.5).
* `pytest backend/tests/test_system_parameters.py` — Backend parameter service and API tests (8/8 passed).
* `pytest backend/tests/test_shoper9_blueprint_parser.py` — Legacy blueprint parser tests (6/6 passed).
* `npm test src/tests/fioriLaunchpad.test.ts` — Fiori Launchpad canonical routing & catalog integrity suite (11/11 passed).
* `npm test src/tests/smritiSystemParameters.test.ts` — Parameter service 0ms accessor & governance suite (8/8 passed).
* `python scripts/test_param_ux.py` — Headless Playwright UI validation suite (5/5 steps passed, 5 visual screenshots captured).
* `npx tsc --noEmit` — TypeScript compilation check (0 errors).

## 9. Verification Results
* **Launchpad Registry**: 45 unique tiles; all tiles mapped to valid render cases; 0 duplicates.
* **Vitest & Pytest Suites**: 33/33 total tests passing across backend and frontend.
* **Headless Playwright End-to-End**: 5/5 assertions green; `Alt+Y` triggered modal, search filtered instantly, Seed Profile executed successfully (200 OK), Escape key closed modal.
* **Visual Artifacts Produced**:
  - `01_fiori_launchpad_with_param_tile.png`: Launchpad view showing System Parameters Studio tile with `Alt+Y` hint.
  - `02_system_parameters_studio_opened.png`: Studio modal opened upon pressing `Alt+Y`.
  - `03_system_parameters_search_filter.png`: Dynamic parameter search filtering.
  - `03b_system_parameters_seeded_toast.png`: Seed Retail (POS) action success toast notification.
  - `04_modal_dismissed_on_escape.png`: Clean modal dismissal returning to dashboard upon pressing `Escape`.

## 10. Known Limitations
None. All 828 parameters load dynamically from `/api/v1/system-parameters/map` and save atomically via `/api/v1/system-parameters/save-batch`.

## 11. Future Work
* Add parameter audit revision history diff modal in the studio.
* Support exporting active system parameter configurations to encrypted JSON/Excel for multi-branch provisioning.

## 12. Related ADRs
* **ADR-042**: SMRITI Canonical Parameter Namespace and Dual-Key Resolution Architecture.

## 13. Related RFCs
* **RFC-019**: SMRITI System Governance & Mutability Control Plane.
