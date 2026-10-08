<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.24
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Canonical 14 System Core Roles Convergence & Tattly Threads RBAC Integration

## 1. Purpose
Establish all 14 canonical system roles defined in the PostgreSQL role catalog (`roles`) as first-class System Core Roles available by default across the entire architecture. Harmonize database types, ORM models, Pydantic schemas, role inheritance dependencies, and user creation/management workspaces, and configure operational user access for Tattly Threads (Operations, Purchase, MD).

## 2. Scope
- PostgreSQL database enum `userrole` migration across control plane (`smritisys`) and tenant databases (`smriti001` through `smriti004`).
- Backend ORM models (`backend/app/models/auth.py`).
- Pydantic DTO schemas (`backend/app/schemas/user.py`).
- Backend user services (`backend/app/services/user.py`) with automatic `role_id` resolution.
- RBAC dependency guard and role inheritance hierarchy (`backend/app/api/deps.py`).
- Purchasing API domain permissions (`backend/app/api/v1/purchase.py`).
- Frontend Staff Master and Configuration dropdowns (`src/components/global/configs/staffMaster.config.tsx`, `src/components/staff/StaffMasterWs.tsx`).
- Tattly Threads user accounts (`operations@tattlythreads.com`, `purchase@tattlythreads.com`, `md@tattlythreads.com`) role synchronization and lifecycle verification.

## 3. Files Created
- `backend/scripts/migrate_userrole_enum.py` — Database enum migration script adding new labels to PostgreSQL `userrole` type across all 5 databases.
- `docs/walkthrough/foundation/System_Core_Roles_And_Tattly_Threads_RBAC_v1.0.0.md` — This walkthrough document.

## 4. Files Modified
- `backend/app/models/auth.py` — Expanded `UserRole` enum with all 14 core system roles.
- `backend/app/schemas/user.py` — Added `roleId` and `role_id` fields to `StaffUserCreate`, `StaffUserUpdate`, `StaffUserResponse`; updated `normalize_role` validator.
- `backend/app/services/user.py` — Implemented automatic `role_id` resolution mapping canonical role IDs; serialized `roleId` and `role_id` in responses.
- `backend/app/api/deps.py` — Implemented canonical role hierarchy inheritance in `require_role` guard (`ADMIN` -> `SYSADMIN`, `STORE_MANAGER`/`BRANCH_ADMIN` -> `MANAGER`, `SALES_EXECUTIVE` -> `CASHIER`).
- `backend/app/api/v1/purchase.py` — Granted `PURCHASE_EXECUTIVE` (and `INVENTORY_MANAGER` where applicable) access to PO creation, amendments, cancellation, suppliers, and GRN.
- `src/components/global/configs/staffMaster.config.tsx` — Added all 14 core roles to form field and filter options.
- `src/components/staff/StaffMasterWs.tsx` — Populated Create Staff Account dialog and Edit Role selector with all 14 core roles.
- `CHANGELOG.md` — Documented changes under release `6.70.24`.
- `docs/walkthrough/README.md` — Appended walkthrough to master index.

## 5. Architecture Decisions
- **AD-RBAC-014: Direct Enum-to-Database Role Alignment**: The database enum `userrole` was expanded using `ALTER TYPE userrole ADD VALUE IF NOT EXISTS` across all control plane and tenant databases, eliminating impedance mismatches between the `roles` table and the `users.role` enum column.
- **AD-RBAC-015: Automatic Canonical Role ID Resolution**: Rather than requiring client UI callers to know internal role IDs (`role-store-manager`, `role-purchase-executive`), `UserService` resolves and links `role_id` automatically based on the selected `UserRole`.
- **AD-RBAC-016: Hierarchical Role Inheritance**: The `require_role` guard was enhanced with canonical inheritance rules, allowing specialized roles (`STORE_MANAGER`, `BRANCH_ADMIN`, `ADMIN`, `SALES_EXECUTIVE`) to satisfy managerial and operational routes without breaking existing single-role checks.

## 6. Design Rationale
Previously, the system maintained a disjoint taxonomy: 15 records in the `roles` table, but only 5 allowed enum values in `UserRole`. When users selected roles like "Store Manager" or "Purchase Executive", the backend either fell back to `CASHIER` or failed with database constraint violations. Unifying the enum, ORM model, Pydantic schemas, and frontend selectors restores complete parity.

## 7. Implementation Summary
1. Migrated `userrole` enum across `smritisys`, `smriti001`, `smriti002`, `smriti003`, `smriti004`.
2. Expanded `UserRole` in `models/auth.py` with 14 distinct roles:
   `SYSADMIN`, `ADMIN`, `STORE_MANAGER`, `BRANCH_ADMIN`, `MANAGER`, `INVENTORY_MANAGER`, `PURCHASE_EXECUTIVE`, `SALES_EXECUTIVE`, `CASHIER`, `ACCOUNTANT`, `AUDITOR`, `HR_EXECUTIVE`, `REPORT_USER`, `VIEWER`.
3. Updated `UserService` to link `role_id` deterministically upon user creation and updates.
4. Updated `require_role` in `deps.py` to evaluate role hierarchy and wildcard permissions for `ADMIN` and `SYSADMIN`.
5. Updated `purchase.py` to grant `PURCHASE_EXECUTIVE` full purchase lifecycle authority.
6. Updated frontend configurations and UI selectors in `StaffMasterWs.tsx`.
7. Rebuilt frontend bundle (`npm run build`) and deployed to `smriti-web` container.
8. Configured Tattly Threads accounts (`operations`, `purchase`, `md`) and verified their logins and authorization scopes.

## 8. Tests Executed
1. `npm run build` — Frontend Vite production compilation (3,695 modules, 0 errors).
2. `scratch/verify_roles.py` — Creation, database persistence, and teardown of users across all new System Core Roles.
3. `scratch/test_tt_logins.py` — Authentication verification for Tattly Threads users using both username and email credentials.
4. `scratch/test_po_create_real.py` — End-to-end purchase lifecycle test verifying PO creation (`PUR-ORD-00000130`), authorization, and cancellation by `purchase@tattlythreads.com`.

## 9. Verification Results
- All 14 System Core Roles selectable in Staff Master UI and verified in PostgreSQL.
- `operations@tattlythreads.com` authenticates successfully, accesses inventory (2,764 items) and PO status.
- `purchase@tattlythreads.com` authenticates successfully, accesses inventory, creates POs (HTTP 201), and amends/cancels POs (HTTP 200).
- `md@tattlythreads.com` authenticates successfully with full system administrative access.
- `GET /api/v1/inventory/` returns HTTP 200 with 2,764 items.

## 10. Known Limitations
- Background email report scheduler (Phase 2) requires active SMTP gateway configuration in `.env`.

## 11. Future Work
- Implementation of Phase 2 automated monthly Sales & Purchase report dispatcher to `accounts@tattlythreads.com`.

## 12. Related ADRs
- `ADR-002`: Multi-Tenant PostgreSQL Isolation
- `ADR-009`: Domain-Driven FastAPI Architecture

## 13. Related RFCs
- `RFC-8594`: Deprecation and Sunset Controls
- `RFC-7519`: JSON Web Token (JWT)
