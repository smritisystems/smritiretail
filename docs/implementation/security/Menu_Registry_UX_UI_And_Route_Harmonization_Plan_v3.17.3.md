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

# Implementation Plan: Menu Registry, UX, UI, and Route Harmonization v3.17.3

## 1. Objective
Achieve 100% end-to-end routing parity and operational harmony across the PostgreSQL Control Plane Menu Registry (`smritisys.smriti_menus`), dynamic menu resolver (`/api/v1/menus/resolved`), shell navigation (`TabRenderer.tsx`), and the Menu Manager Studio (`MenuManagerStudioTab.tsx`).

## 2. Business Motivation
In retail operations, administrators configuring navigation or cashiers opening workspaces must experience zero broken links, failed tabs, or unhandled routing dead-ends. When an administrator inspects a menu node in the Menu Studio, they require immediate 1-click test launching to verify the workspace in real-time.

## 3. Scope
- Audit of PostgreSQL database table `smriti_menus` (columns, constraints, sequences, parent-child topology).
- Remediation of 5 missing canonical route mappings in `src/components/shell/TabRenderer.tsx`'s `mapModuleId` (`menu-wiki`, `menu-about-smriti`, `menu-dev-tracker`, `menu-profiles`, `menu-security`).
- Integration of modern module route aliases (`menu-wms`, `menu-attendance`, `menu-dispatch-studio`, `menu-communicator`, `menu-propos`, `menu-doc-studio`).
- Integration of 1-click `[Test Launch]` button in `src/components/MenuManagerStudioTab.tsx` header card.
- Comprehensive unit test certification in `src/tests/menuRegistryRouting.test.ts`.

## 4. Current State
- `smriti_menus` table contains 39 canonical menu items across 8 functional modules.
- `TabRenderer.tsx`'s `mapModuleId` had mappings for 133 keys, but lacked 5 canonical menu IDs (`menu-wiki`, `menu-about-smriti`, `menu-dev-tracker`, `menu-profiles`, `menu-security`), causing unhandled fallthrough when canonical IDs were dispatched.
- `MenuManagerStudioTab.tsx` accepted `onNavigateTab` prop but did not render any button to trigger it.

## 5. Gap Analysis
- **Routing Gap:** Clicking remote database items with canonical IDs like `menu-wiki` failed to match switch cases in `TabRenderer`.
- **UX Gap:** In `MenuManagerStudioTab.tsx`, administrators had to leave the studio and manually search the launchpad to verify changes.
- **Test Gap:** No dedicated automated unit test asserted that 100% of the 39 canonical IDs resolve cleanly to valid workspace components.

## 6. Architecture Impact
- **Non-breaking:** Preserves existing database schemas, control plane APIs, and security matrix contracts.
- **Zero-drift:** Ensures backward compatibility with existing launchpad tile synthesizers.

## 7. Proposed Design
1. **Router Resolution:** Extend `mapModuleId` in `TabRenderer.tsx` with explicit mappings for all 39 canonical menu IDs.
2. **Studio Integration:** Wire `onNavigateTab` in `MenuManagerStudioTab.tsx` with an `ExternalLink` button styled cleanly in the node inspector header.
3. **Automated Verification:** Vitest test suite `menuRegistryRouting.test.ts` testing every canonical menu ID against router resolutions.

## 8. Files Created
- `src/tests/menuRegistryRouting.test.ts`
- `docs/implementation/security/Menu_Registry_UX_UI_And_Route_Harmonization_Plan_v3.17.3.md`
- `docs/walkthrough/security/Menu_Registry_UX_UI_And_Route_Harmonization_v3.17.3.md`

## 9. Files Modified
- `src/components/shell/TabRenderer.tsx`
- `src/components/MenuManagerStudioTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18, Lucide React, FastAPI, SQLAlchemy, PostgreSQL, Vitest.

## 11. Risks
- *Risk:* Accidental mutation of existing module routes.
  - *Mitigation:* Exhaustive regression testing of all 39 menu IDs in `menuRegistryRouting.test.ts`.

## 12. Rollback Strategy
Revert edits to `TabRenderer.tsx` and `MenuManagerStudioTab.tsx` via `git checkout`.

## 13. Verification Plan
- `npx vitest run src/tests/menuRegistryRouting.test.ts`: 3/3 passed.
- `npx tsc --noEmit`: 0 TypeScript compiler errors.
- `pytest backend/tests/t_menu_registry.py`: 6/6 passed.

## 14. Test Plan
- Unit tests asserting resolution of all 39 canonical IDs.
- Unit tests asserting resolution of formerly disconnected IDs (`menu-wiki`, `menu-about-smriti`, etc.).
- Unit tests asserting modern module aliases.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
Commit and push to `smritiNX` branch and sync to test environments per standard workflow.

## 17. Status
Completed

## 18. Related ADRs
- ADR-014: Control Plane Architecture & DB-Driven Menu Registry
- ADR-042: Parameter-Driven Governance & Dual-Key Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/security/Menu_Registry_UX_UI_And_Route_Harmonization_v3.17.3.md`
- `docs/walkthrough/security/Security_Menu_Registry_And_UX_Harmonization_v3.17.2.md`
