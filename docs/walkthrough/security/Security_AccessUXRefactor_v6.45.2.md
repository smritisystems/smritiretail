# Security_AccessUXRefactor_v6.45.2

## 1. Purpose
Refactor the Security and Access Management UX from a legacy modal-in-tab
pattern (SecManageDlg) into a native full-page shell matching the architect
reference screenshots. All existing backend APIs, permission logic, business
rules, and test coverage are unchanged.

## 2. Scope
| In Scope | Out of Scope |
|---|---|
| SecurityAccessShell.tsx (new shell) | securityStore.ts (untouched) |
| UsersView.tsx (new Users listing) | MenuAccessView.tsx (untouched) |
| DataAccessView.tsx (new Data Access) | SecConfigView.tsx (untouched) |
| TabRenderer.tsx (3 case updates) | Backend API contracts (unchanged) |

## 3. Files Created
| File | Lines | Purpose |
|---|---|---|
| src/components/security/SecurityAccessShell.tsx | 353 | Full-page shell |
| src/components/security/UsersView.tsx | ~540 | Users listing page |
| src/components/security/DataAccessView.tsx | 215 | Data Access Control |
| docs/walkthrough/security/Security_AccessUXRefactor_v6.45.2.md | this | WGP walkthrough |

## 4. Files Modified
| File | Change |
|---|---|
| src/components/shell/TabRenderer.tsx | 3 cases: SecManageDlg -> SecurityAccessShell |
| CHANGELOG.md | [6.45.2] entry added |
| docs/walkthrough/README.md | v6.45.2 row prepended |

## 5. Architecture Decisions

**AD-1: Audit First.** Full implementation map produced before any code written.
All API endpoints, hooks, state and component boundaries verified.

**AD-2: Visual-Only Refactor.** securityStore.ts, MenuAccessView.tsx,
SecConfigView.tsx, types.ts not modified.

**AD-3: Shell Pattern (not Modal).** SecurityAccessShell renders inline inside
the Vite tab system. Removes the fixed-inset-0 modal anti-pattern (z-index
stacking and scroll-lock issues on mobile).

**AD-4: React.ElementType for Lucide Icons.** Lucide icons are
ForwardRefExoticComponent<LucideProps> not ComponentType<{size, className}>.
Used React.ElementType to avoid TS2322 errors.

**AD-5: Data Access Sync.** DataAccessView reads from
securityStore.getHousekeepingSecurityConfig() (same source as SecConfigView)
and persists via persistSecurityConfiguration. No new API endpoints created.

## 6. Design Rationale
Reference screenshots define:
- Dark navy (#0f172a) left sidebar with 4 grouped sections
- White content area with clean table/card layouts
- Blue (#1e40af) primary action color
- Rounded cards, subtle borders, badge-based role display
- Primary tab bar: Users | Roles & Groups | Menu Access | Data Access |
  Security Policies | Audit Log

## 7. Implementation Summary

**SecurityAccessShell** (353 lines)
- 4 NavGroups: Security & Access (5 items), Security Operations (2),
  My Account (2), Utilities (2)
- PRIMARY_TABS bar shown for top-level security sections only
- renderContent() switch: UsersView, MenuAccessView, DataAccessView,
  SecConfigView; remaining sections -> ComingSoonView stub
- Toast notification bus passed to children via onNotification prop

**UsersView** (~540 lines)
- GET /api/v1/users/?search&role&status&skip&limit=25
- Delete: PATCH /users/{id} status=Inactive with confirm dialog
- Unlock: PATCH /users/{id} status=Active with confirm dialog
- Export: CSV blob + revokeObjectURL
- Skeleton loading (6 rows), empty state, aria-* accessibility

**DataAccessView** (215 lines)
- 3 rules: Hide Cost Price, Restrict Products/Brands, Restrict Dashboard Reports
- Sync from backend on mount; persist via persistSecurityConfiguration
- WCAG role=switch toggle, save/discard bar, Reset to Default guard

## 8. Tests Executed
| Test File | Result |
|---|---|
| src/tests/menuAccess.test.ts | 6/6 passed |
| src/tests/salesAuditAndFormatters.test.ts | 12/12 passed |
| Total | 18/18 passed |

## 9. Verification Results

**Status: Partially Verified**

| Claim | Status | Evidence |
|---|---|---|
| TSC task-970 exit 0 | Done | System message exit code 0 |
| menuAccess.test.ts 6/6 | Done | Vitest stdout |
| salesAuditAndFormatters.test.ts 12/12 | Done | Vitest stdout |
| Commit 2b4d109d | Done | git log confirms 4 files, 1023 insertions |
| securityStore.ts unchanged | Done | Not in diff |
| MenuAccessView.tsx unchanged | Done | Not in diff |
| Runtime browser render | Unverified | Dev server not started |
| Mobile 320px layout | Unverified | No headless session |
| WCAG contrast | Unverified | No automated tool run |

## 10. Known Limitations
1. Roles & Groups, Locked Users, Audit Log, My Profile, Change Password,
   Menu Shortcuts render a ComingSoonView stub. Each needs a dedicated view.
2. New User button has no form implementation yet.
3. Runtime visual verification not performed this session.

## 11. Future Work
- Implement RolesGroupsView, LockedUsersView, AuditLogView, MyProfileView,
  ChangePasswordView, MenuShortcutsView.
- Add New/Edit User modal (POST/PATCH /api/v1/users/).
- Add Vitest component tests for SecurityAccessShell and UsersView.
- Run axe-core WCAG scan on all three new views.

## 12. Related ADRs
- ADR-008: Strangler-Fig Migration (FastAPI sole backend)
- ADR-022: WCAG 2.1 AA Accessibility Standard

## 13. Related RFCs
- RFC-120: Security & Access UX Refactor (2026-09-26)
