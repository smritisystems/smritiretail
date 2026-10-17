<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.2
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Menu Registry & UX Control Plane Harmonization v3.17.2

## 1. Objective
Perform a complete end-to-end audit and architectural harmonization of the SMRITI Retail OS Menu Registry and User Experience (UX) control plane across all 14 system roles and 5 workspace persona profiles. Align the PostgreSQL control plane database (`smriti_menus`), FastAPI menu resolver (`/api/v1/menus/resolved`), frontend security state store (`MENU_PERMISSION_RESOURCES`), and the SAP Fiori launchpad catalog synthesis engine.

## 2. Business Motivation
SMRITI Retail OS operates under strict multi-tenant, role-based access control. Enterprise terminals range from dedicated high-speed retail checkout counters to backoffice store management and executive reporting suites. Discrepancies between database menu definitions (39 active rows) and backend matrix contracts (previously 38 items omitting Goods Receipt `menu-grn`), along with client-side response unboxing issues in `FioriLaunchpad.tsx`, prevented remote database-backed menus from hydrating on client launchpads and caused route mapping failures.

## 3. Scope
- **Database Layer**: Validate all 39 active menus in `smriti_menus` across sequence, parents, routes, and baseline permission codes.
- **Backend API & Core Security**: Expand `CANONICAL_36_MENU_MATRIX` in `backend/app/core/security_matrix.py` to encompass `menu-grn` (39 items) and export `CANONICAL_39_MENU_MATRIX`. Remediate workspace profile persona resolution in `backend/app/api/v1/ui_control_plane.py` to securely fallback unmapped personas to `PROF_DEFAULT`.
- **Frontend State & Navigation**: Harmonize `MENU_PERMISSION_RESOURCES` in `src/services/securityStore.ts` with all 39 canonical modules; register `menu-grn` into `TabRenderer.tsx`'s `mapModuleId`; fix JSON response unwrapping in `FioriLaunchpad.tsx`.
- **Test Automation**: Update `backend/tests/t_menu_registry.py` to assert the 39 canonical menus, ensure 100% green suites for both Pytest and Vitest.

## 4. Current State
- `smriti_menus` PostgreSQL table contained 39 active entries.
- `CANONICAL_36_MENU_MATRIX` contained 38 items (`menu-grn` was missing).
- `t_menu_registry.py` asserted `len(menus) == 37`, causing an assertion failure against the 39-item database.
- `FioriLaunchpad.tsx` checked `if (res.ok)` on the array returned from `apiFetchV1`, which evaluated to undefined and prevented control plane synchronization.
- `ui_control_plane.py` defaulted unmapped non-admin roles to `PROF_SYSADMIN`.

## 5. Gap Analysis
| Component | Previous State | Target State | Parity Status |
|---|---|---|---|
| `CANONICAL_36_MENU_MATRIX` | 38 items (omitted `menu-grn`) | 39 items including `menu-grn` | 100% Parity |
| `MENU_PERMISSION_RESOURCES` | 34 items | 39 items matched to canonical matrix | 100% Parity |
| `TabRenderer.tsx` | Missing `menu-grn` route | Routes `menu-grn` to `grn-studio` | Resolved |
| `FioriLaunchpad.tsx` | Checked `res.ok` on parsed JSON | Direct array inspection on `apiFetchV1` | Synchronized |
| `ui_control_plane.py` | Defaulted unmapped roles to `PROF_SYSADMIN` | Securely defaults to `PROF_DEFAULT` | Secured |
| `t_menu_registry.py` | Hardcoded `len == 37` | Asserts `len == 39` | 6/6 Green |

## 6. Architecture Impact
- **Principle of Least Privilege**: Unmapped roles requesting workspace layouts now receive `PROF_DEFAULT` (`USER` persona) instead of `PROF_SYSADMIN`.
- **Zero-Drift Synchronization**: The Fiori Launchpad client now dynamically binds PostgreSQL control plane menus on mount while maintaining offline fallback to `LAUNCHPAD_CATALOG`.

## 7. Proposed Design
1. Update `backend/app/core/security_matrix.py` to register `"menu-grn": {"resource": "purchase_studio", "view_perm": "GRN.WORKSPACE.ACCESS", "parent_id": "menu-inventory"}`.
2. In `backend/app/api/v1/ui_control_plane.py`, update `role_to_code` to map `ADMIN` to `PROF_SYSADMIN` and default unmapped roles to `PROF_DEFAULT`.
3. In `src/components/launchpad/FioriLaunchpad.tsx`, inspect `Array.isArray(res)` directly.
4. In `src/components/shell/TabRenderer.tsx`, map `"menu-grn": "grn-studio"`.
5. In `src/services/securityStore.ts`, add `"menu-desktop-billing"`, `"menu-sales-promotions"`, `"menu-grn"`, `"menu-manager"`, and `"menu-security"` to `MENU_PERMISSION_RESOURCES`.

## 8. Files Created
- `docs/implementation/security/Security_Menu_Registry_And_UX_Harmonization_Plan_v3.17.2.md`
- `docs/walkthrough/security/Security_Menu_Registry_And_UX_Harmonization_v3.17.2.md`

## 9. Files Modified
- `backend/app/core/security_matrix.py`
- `backend/app/api/v1/ui_control_plane.py`
- `backend/tests/t_menu_registry.py`
- `src/components/launchpad/FioriLaunchpad.tsx`
- `src/components/shell/TabRenderer.tsx`
- `src/services/securityStore.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- PostgreSQL `smritisys` database at Alembic head `v1528_canonical_role_permissions_remediation`.
- FastAPI backend framework.
- React 18, Vite, and Vitest test framework.

## 11. Risks
- *Risk*: Disruption of launchpad layout if backend is unreachable during retail shifts.
  *Mitigation*: Retained `synthesizeLaunchpadCatalogWithRemoteMenus` with graceful offline fallback to `LAUNCHPAD_CATALOG`.

## 12. Rollback Strategy
Git revert commit cleanly restores previous matrix definitions and client fetch patterns without requiring schema alterations.

## 13. Verification Plan
1. Run `pytest backend/tests/t_menu_registry.py` and `pytest backend/tests/t_rbac_roles.py`.
2. Run `npx vitest run src/tests/fioriLaunchpad.test.ts src/tests/menuAccess.test.ts src/tests/userStaffCreation.test.ts`.
3. Run `npx tsc --noEmit` for zero compiler diagnostics.

## 14. Test Plan
- Unit tests: Menu resolution for SYSADMIN (all 39) and CASHIER (pruned tree).
- Regression tests: RBAC role creation and Option B sales executive invariant.
- Typecheck: Full TypeScript compiler pass.

## 15. Documentation Impact
- Implementation Plan appended to `docs/implementation/README.md`.
- Walkthrough document created and appended to `docs/walkthrough/README.md`.
- `CHANGELOG.md` updated with v3.17.2 entries.

## 16. Deployment Plan
Code change committed to `smritiNX` branch and synchronized with test environments.

## 17. Status
Completed

## 18. Related ADRs
- `docs/adr/ADR-004-FastAPI-Postgres-Sole-Backend.md`
- `docs/adr/ADR-018-Security-Matrix-And-Cascade-Pruning.md`

## 19. Related Walkthroughs
- `docs/walkthrough/security/Security_Menu_Registry_And_UX_Harmonization_v3.17.2.md`
- `docs/walkthrough/security/Security_Role_Template_Mapping_And_Staff_Creation_Audit_v3.17.1.md`
