<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Security Management — Menu Access Control & Security Configuration v6.16.0

## 1. Purpose
This release delivers the complete enterprise **Security Management System** (`Setup > Supervisory Functions > Security Management`), providing granular **Menu Access Control** (User / Group / Node level permissions matrix) and **Security Configuration** (Password policy enforcement & Housekeeping administration). It reuses the authoritative `smriti_menus` and `smriti_permissions` PostgreSQL tables directly in `smritisys` without creating any duplicate tables or engines.

---

## 2. Scope
- **Menu Access Control Workspace**:
  - Direct Subject switching: `User`, `Group`, `Node`.
  - Multi-level hierarchical expandable menu tree (`Sales`, `Cash`, `Stock`, `Reports`, `Housekeeping`, `Catalogue`, `Setup`, `Help`).
  - Granular operation matrix permissions (`NEW`, `VOID`, `RETURN`, `VOID RETURN`, `ADD`, `EDIT`, `DELETE`, `VIEW`).
  - Company-wise scoping (`Company Code: All / COMP-001`, `Company Name`).
- **Security Configuration Workspace**:
  - 2-pane category inspector (`Password Configuration` & `Housekeeping`).
  - Password policies (min/max length, uppercase, lowercase, numeric counts, history count, reset days, max invalid attempts).
  - Housekeeping parameters (log retention days, country code `+91`, patch update reminder, company-wise menu activation toggle, custom reports count, refresh interval).
- **Backend Architecture & Security Authority**:
  - FastAPI endpoints in `/api/v1/security/menu-access` and `/api/v1/security/config`.
  - Zero new database tables created — binds directly to existing PostgreSQL tables `smriti_menus`, `smriti_permissions`, `roles`, `system_configs`, and `smriti_audit_log`.
  - Action-level RBAC guard `require_permission(resource, action)` raising 403 Forbidden with structured business error code `SMRITI-AUTH-001`.
  - Tamper-evident audit logging in `smriti_audit_log` with SHA-256 cryptographic hashes.

---

## 3. Files Created
- [`src/components/security/types.ts`](file:///F:/SMRITRretailNX/src/components/security/types.ts)
- [`src/components/security/SmritiMenuAccessControlView.tsx`](file:///F:/SMRITRretailNX/src/components/security/SmritiMenuAccessControlView.tsx)
- [`src/components/security/SmritiSecurityConfigurationView.tsx`](file:///F:/SMRITRretailNX/src/components/security/SmritiSecurityConfigurationView.tsx)
- [`src/components/security/SmritiSecurityManagementModal.tsx`](file:///F:/SMRITRretailNX/src/components/security/SmritiSecurityManagementModal.tsx)
- [`src/services/securityManagementStore.ts`](file:///F:/SMRITRretailNX/src/services/securityManagementStore.ts)
- [`src/tests/securityMenuAccessControl.test.ts`](file:///F:/SMRITRretailNX/src/tests/securityMenuAccessControl.test.ts)
- [`backend/app/models/security.py`](file:///F:/SMRITRretailNX/backend/app/models/security.py)
- [`backend/app/schemas/security.py`](file:///F:/SMRITRretailNX/backend/app/schemas/security.py)
- [`backend/app/api/v1/security.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/security.py)
- [`backend/tests/test_security_menu_access.py`](file:///F:/SMRITRretailNX/backend/tests/test_security_menu_access.py)
- [`docs/walkthrough/security/Security_Management_Menu_Access_Control_And_Configuration_v6.16.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/security/Security_Management_Menu_Access_Control_And_Configuration_v6.16.0.md)

---

## 4. Files Modified
- [`src/App.tsx`](file:///F:/SMRITRretailNX/src/App.tsx)
- [`src/components/launchpad/launchpadCatalog.ts`](file:///F:/SMRITRretailNX/src/components/launchpad/launchpadCatalog.ts)
- [`src/tests/fioriLaunchpad.test.ts`](file:///F:/SMRITRretailNX/src/tests/fioriLaunchpad.test.ts)
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py)
- [`backend/app/api/deps.py`](file:///F:/SMRITRretailNX/backend/app/api/deps.py)
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md)
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md)

---

## 5. Architecture Decisions
- **AD-1: Direct Database Table Reuse**: Reused existing `smriti_menus` (34 items) and `smriti_permissions` tables instead of introducing separate tables, preserving database normalization and single-source-of-truth invariants.
- **AD-2: Unified Single Workspace**: Unified User, Group, and Node access controls within a single classic Windows ERP dialog frame with high-contrast borders and quick keyboard shortcuts (<kbd>Alt+O</kbd>, <kbd>Alt+C</kbd>, <kbd>Alt+X</kbd>).
- **AD-3: Backend Action Enforcement Guard**: Added `require_permission(resource, action)` dependency in FastAPI to ensure that UI button state is only a reflection of authoritative backend authorization.

---

## 6. Design Rationale
Retail supervisory operations require fine-grained authorization. A cashier may be granted permission to access the `Billing` menu (`VIEW = true`), create new invoices (`NEW = true`), but strictly prevented from voiding or deleting completed sales bills (`VOID = false`). By modeling operations as a matrix over canonical menu resources, administrators can enforce exact corporate governance standards across all counter nodes.

---

## 7. Implementation Summary
1. **API Layer**: `/api/v1/security/menu-access` and `/api/v1/security/config` endpoints backed by SQLAlchemy models `SmritiPermission` and `SmritiAuditLog`.
2. **State & Offline Cache Engine**: `securityManagementStore.ts` provides instant optimistic local state caching while asynchronously synchronizing with the FastAPI backend.
3. **UI Engine**: `SmritiSecurityManagementModal.tsx` integrates the classic ERP left navigation sidebar with responsive view switching, expand/collapse tree management, and granular checkbox propagation.

---

## 8. Tests Executed
- `python -m pytest backend/tests/test_menu_governance.py` (1/1 passed)
- `python -m pytest backend/tests/test_security_menu_access.py` (1/1 passed)
- `npx vitest run src/tests/securityMenuAccessControl.test.ts` (6/6 passed)
- `npx vitest run` (39/39 test suites passed, 288/288 tests passed)
- `npm run build` (compiled in 24.67s with 0 errors)

---

## 9. Verification Results
```text
Test Files  39 passed (39)
Tests       288 passed (288)
Vite Build  built in 24.67s (0 errors)
```

---

## 10. Known Limitations
- Node-specific IP auto-discovery requires agent hardware hooks; IP addresses currently resolve via configured node master records.

---

## 11. Future Work
- Biometric & supervisor override prompt when an operator attempts a restricted operation on a POS terminal.

---

## 12. Related ADRs
- `ADR-031`: Centralized Menu Governance & RBAC Authority
- `ADR-032`: Single Multi-Tenant Audit Journal Architecture

---

## 13. Related RFCs
- `RFC-2026-08-SEC`: Fine-Grained POS Operation Matrix & Housekeeping Policies
