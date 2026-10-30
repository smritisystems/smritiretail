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

# Walkthrough: Menu Registry & UX Control Plane Harmonization v3.17.2

## 1. Purpose
Provide complete verification evidence and technical documentation for the forensic audit and harmonization of the SMRITI Retail OS Menu Registry, dynamic resolution engine, and User Experience (UX) navigation layer across all 14 system roles and 5 workspace persona profiles.

## 2. Scope
- PostgreSQL `smriti_menus` catalog containing 39 canonical modules.
- `backend/app/core/security_matrix.py` Canonical Menu Matrix alignment.
- `backend/app/api/v1/ui_control_plane.py` Workspace persona profile resolution.
- `src/components/launchpad/FioriLaunchpad.tsx` Control plane hydration fix.
- `src/components/shell/TabRenderer.tsx` Module routing parity for `menu-grn`.
- `src/services/securityStore.ts` Menu resource permission dictionary.
- Test suites: `backend/tests/t_menu_registry.py`, `backend/tests/t_rbac_roles.py`, `src/tests/fioriLaunchpad.test.ts`, `src/tests/menuAccess.test.ts`, `src/tests/userStaffCreation.test.ts`.

## 3. Files Created
- `docs/implementation/security/Security_Menu_Registry_And_UX_Harmonization_Plan_v3.17.2.md`
- `docs/walkthrough/security/Security_Menu_Registry_And_UX_Harmonization_v3.17.2.md`

## 4. Files Modified
- `backend/app/core/security_matrix.py`
- `backend/app/api/v1/ui_control_plane.py`
- `backend/tests/t_menu_registry.py`
- `src/components/launchpad/FioriLaunchpad.tsx`
- `src/components/shell/TabRenderer.tsx`
- `src/services/securityStore.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Decision 1: 39-Menu Single Source of Truth**: Unified the canonical security matrix with the 39 active entries in PostgreSQL `smriti_menus`, registering `menu-grn` (`/goods-receipt`) as a child of `menu-inventory` with permission `GRN.WORKSPACE.ACCESS`.
- **Decision 2: Safe Persona Fallback**: In `ui_control_plane.py`, unmapped roles now fall back to `PROF_DEFAULT` (`USER` persona) instead of granting `PROF_SYSADMIN` layout configuration.
- **Decision 3: Zero-Overhead Launchpad Sync**: In `FioriLaunchpad.tsx`, corrected the response unboxing for `apiFetchV1` so client-side launchpads consume dynamic PostgreSQL menu metadata while preserving resilient offline fallback to `LAUNCHPAD_CATALOG`.

## 6. Design Rationale
`apiFetchV1` directly deserializes JSON response bodies and returns the parsed payload rather than a browser `Response` object. Checking `res.ok` previously led to falsy evaluation, preventing `setRemoteMenus` from being invoked. Fixing this unwrapping allows runtime control plane menu reordering, badge updates, and tenant-level menu visibility to reflect immediately in the UI.

## 7. Implementation Summary
- Added `menu-grn` to `CANONICAL_36_MENU_MATRIX` in `security_matrix.py` and exported `CANONICAL_39_MENU_MATRIX`.
- Updated `role_to_code` in `ui_control_plane.py` to map `ADMIN` to `PROF_SYSADMIN` and default unmapped roles to `PROF_DEFAULT`.
- Added `menu-grn` to `mapModuleId` in `TabRenderer.tsx` mapping to `grn-studio`.
- Added missing entries (`menu-desktop-billing`, `menu-sales-promotions`, `menu-grn`, `menu-manager`, `menu-security`) to `MENU_PERMISSION_RESOURCES` in `securityStore.ts`.
- Updated `t_menu_registry.py` to assert 39 menus for `SYSADMIN`.

## 8. Tests Executed
```bash
pytest backend/tests/t_menu_registry.py backend/tests/t_rbac_roles.py
npx vitest run src/tests/fioriLaunchpad.test.ts src/tests/menuAccess.test.ts src/tests/userStaffCreation.test.ts
npx tsc --noEmit
```

## 9. Verification Results
- `backend/tests/t_menu_registry.py`: 6/6 passed (100% green).
- `backend/tests/t_rbac_roles.py`: 20/20 passed (100% green).
- Vitest (`fioriLaunchpad`, `menuAccess`, `userStaffCreation`): 34/34 passed (100% green).
- TypeScript Compiler (`tsc --noEmit`): 0 errors.

## 10. Known Limitations
None. All 14 system roles and 5 workspace profiles resolve valid menus and layouts.

## 11. Future Work
Add tenant-level custom menu overrides in the Menu Manager Studio tab for specialized franchisee branch configurations.

## 12. Related ADRs
- `docs/adr/ADR-004-FastAPI-Postgres-Sole-Backend.md`
- `docs/adr/ADR-018-Security-Matrix-And-Cascade-Pruning.md`

## 13. Related RFCs
- `docs/rfc/RFC-022-Centralized-Menu-Resolution.md`
