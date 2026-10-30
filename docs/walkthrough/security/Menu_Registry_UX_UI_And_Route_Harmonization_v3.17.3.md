<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.3
  Created      : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Menu Registry, UX, UI, and Route Harmonization v3.17.3

## 1. Purpose
Document the comprehensive audit, verification, and end-to-end routing harmonization across the PostgreSQL Control Plane Menu Registry (`smritisys.smriti_menus`), dynamic menu resolver (`/api/v1/menus/resolved`), shell navigation router (`TabRenderer.tsx`), and the Menu Manager Studio (`MenuManagerStudioTab.tsx`).

## 2. Scope
- Audit of PostgreSQL database table `smriti_menus` (schema, columns, constraints, foreign keys, 39 rows).
- Full resolution mapping for all 39 canonical menu IDs in `src/components/shell/TabRenderer.tsx`'s `mapModuleId`.
- Remediation of 5 disconnected canonical routes (`menu-wiki`, `menu-about-smriti`, `menu-dev-tracker`, `menu-profiles`, `menu-security`).
- Integration of modern operational module route aliases (`menu-wms`, `menu-attendance`, `menu-dispatch-studio`, `menu-communicator`, `menu-propos`, `menu-doc-studio`).
- Integration of 1-click `[Test Launch]` button in `src/components/MenuManagerStudioTab.tsx`.
- Automated test coverage in `src/tests/menuRegistryRouting.test.ts`.

## 3. Files Created
- `src/tests/menuRegistryRouting.test.ts`
- `docs/implementation/security/Menu_Registry_UX_UI_And_Route_Harmonization_Plan_v3.17.3.md`
- `docs/walkthrough/security/Menu_Registry_UX_UI_And_Route_Harmonization_v3.17.3.md`

## 4. Files Modified
- `src/components/shell/TabRenderer.tsx`
- `src/components/MenuManagerStudioTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Canonical Routing Parity:** `mapModuleId` serves as the authoritative boundary adapter translating database menu identifiers into active React tab states. All canonical IDs (`menu-*`) must be explicitly mapped to eliminate router fallthrough.
- **Immediate Studio Interactivity:** Administrators editing menu hierarchy in `MenuManagerStudioTab` now have immediate test-launch execution without context switching out of the studio.

## 6. Design Rationale
Explicitly mapping all 39 canonical IDs guarantees that navigation commands from remote database hydration, command palettes, launchpad tiles, and third-party webhooks resolve to exact workspaces rather than falling through to default dashboard views.

## 7. Implementation Summary
- **TabRenderer Alignment:** Added explicit mappings for `menu-wiki -> wiki`, `menu-about-smriti -> about-smriti`, `menu-dev-tracker -> dev-tracker`, `menu-profiles -> profiles`, `menu-security -> security-management`, `menu-wms -> wms`, `menu-attendance -> attendance-workspace`, and related aliases.
- **Menu Studio UX:** Added `<ExternalLink />` `[Test Launch]` button in the node configurator header card of `MenuManagerStudioTab.tsx`, bound directly to `onNavigateTab`.
- **Unit Testing:** Authored `menuRegistryRouting.test.ts` testing 100% of the 39 canonical menu IDs.

## 8. Tests Executed
1. `npx vitest run src/tests/menuRegistryRouting.test.ts`: 3/3 passed (100% green).
2. `pytest backend/tests/t_menu_registry.py -v`: 6/6 passed (100% green).
3. `npx tsc --noEmit`: 0 TypeScript compiler errors.

## 9. Verification Results
```text
✓ mapModuleId maps all 39 canonical smriti_menus IDs without unhandled fallthrough
✓ menu-wiki, menu-about-smriti, menu-dev-tracker, menu-profiles, menu-security resolve cleanly
✓ MenuManagerStudioTab Test Launch button wired
✓ 6/6 backend tests passed
✓ 3/3 frontend vitest unit tests passed
✓ 0 tsc errors
```

## 10. Known Limitations
None. All 39 canonical menus in PostgreSQL `smriti_menus` resolve deterministically to their respective components.

## 11. Future Work
In a future major version, execute a database migration elevating the total registered menus in `smriti_menus` to 45 by adding dedicated database rows for the newly added modern modules (`menu-wms`, `menu-attendance`, etc.).

## 12. Related ADRs
- ADR-014: Control Plane Architecture & DB-Driven Menu Registry
- ADR-042: Parameter-Driven Governance & Dual-Key Architecture

## 13. Related RFCs
- RFC-088: Dynamic Menu Tree Resolution & Role Scoping
