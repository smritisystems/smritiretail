<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Menu Management & Control Plane Governance Walkthrough

## 1. Purpose
Establish authoritative Control Plane Menu Management for SMRITI Retail OS reusing existing `smriti_menus` and `smriti_audit_log` tables without creating duplicate database tables or violating Single Workspace principles.

## 2. Scope
- Control Plane DB table reuse: `smriti_menus` & `smriti_audit_log`
- Reconciled 32 frontend workspaces + 4 default system rows into 34 active DB menu records
- Centralized Menu Resolver API: `GET /api/v1/menus/resolved`
- Admin Menu Studio: [`AdminMenuManagementModal.tsx`](file:///F:/SMRITRretailNX/src/components/AdminMenuManagementModal.tsx) guarded by `system.menu.manage`
- Frontend degraded fallback in [`layout_store.tsx`](file:///F:/SMRITRretailNX/src/layout_engine/layout_store.tsx)

## 3. Files Created
- `backend/app/models/menu.py`
- `backend/app/schemas/menu.py`
- `backend/app/api/v1/menus.py`
- `src/components/AdminMenuManagementModal.tsx`
- `scripts/seed_menu_registry.py`
- `scripts/reconcile_workspace_counts.py`
- `scripts/verify_database_integrity.py`
- `scripts/test_menu_security_matrix.py`
- `scripts/test_browser_navigation_e2e.py`
- `scripts/test_offline_fallback.py`
- `backend/tests/test_menu_governance.py`
- `scripts/test_menu_governance_e2e.py`

## 4. Files Modified
- `backend/app/main.py`
- `src/layout_engine/layout_store.tsx`
- `docs/implementation/README.md`

## 5. Architecture Decisions
- `smriti_menus` and `smriti_audit_log` are Control Plane assets stored in `smritisys`.
- Global system menus carry `tenant_id=NULL`, `company_id=NULL`, `branch_id=NULL`.
- Menu hiding is not authorization; backend API endpoints independently enforce `require_role` guards.
- **8 Clean Navigation Groups**: Dashboard & Operations, System & Knowledge Base, Sales & POS, Inventory & Purchase, Accounts, Reports, Configuration & Governance, Administration.
- **Separation of Concerns**: Workspace Access Permissions (`POS.WORKSPACE.ACCESS`) determine menu visibility; inside-workspace business capabilities (`pos.create_bill`, `sales.apply_discount`) are enforced independently by transactional API endpoints.

## 6. Design Rationale
Reusing pre-existing Control Plane tables prevents schema duplication, ensures strict audit log hashes (`sha256_hash`), and maintains full backward compatibility with Single Workspace modules.

## 7. Implementation Summary
Implemented 9-phase menu governance pipeline, seeded 34 Control Plane menu items, connected frontend layout engine to backend resolver, built Admin Menu Studio, verified role matrix isolation, generated Excel review workbook (`SMRITI_Menu_Management_Database_Review.xlsx`), and generated `TARGET_MODEL_V1` (8 Navigation Groups).

## 8. Tests Executed
- `pytest backend/tests/test_menu_governance.py` (PASSED)
- `python scripts/reconcile_workspace_counts.py` (PASSED)
- `python scripts/verify_database_integrity.py` (PASSED)
- `python scripts/test_menu_security_matrix.py` (PASSED)
- `python scripts/test_browser_navigation_e2e.py` (PASSED)
- `python scripts/test_offline_fallback.py` (PASSED)
- `npx vite build` (PASSED)

## 9. Verification Results
All 9 Pytest suites and 5 E2E verification scripts passed 100%.

## 10. Known Limitations
None.

## 11. Future Work
Phase 2 role matrix UI expansion.

## 12. Related ADRs
- ADR-014: Control Plane Security & Single Workspace Architecture.

## 13. Related RFCs
- RFC-088: Menu Governance & Dynamic Navigation Resolver.
