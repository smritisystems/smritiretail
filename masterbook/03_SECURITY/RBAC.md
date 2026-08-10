<!--
  SMRITI Retail OS — Masterbook
  Document  : 03_SECURITY/RBAC.md
  Status    : FROZEN (USR Standard v1.0)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Role-Based Access Control (RBAC)

---

## Role Hierarchy

```
SYSADMIN      ← Platform administrator (bypasses all permission guards)
    └── OWNER     ← Business owner (all company permissions)
        └── ADMINISTRATOR ← Company admin
            └── MANAGER   ← Branch manager
                └── CASHIER  ← POS operator
                    └── VIEWER   ← Read-only
```

Roles inherit permissions from parent roles (upward chain).

---

## Permission Guard Implementation

### `require_permission(code)` — Dynamic Guard

```python
def require_permission(permission_code: str) -> Callable:
    async def _guard(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # SYSADMIN bypasses all permission checks
        if current_user.role == UserRole.SYSADMIN:
            return current_user
        # All others: check SecurityService
        service = SecurityService(db)
        is_allowed = await service.verify_user_permission(current_user.id, permission_code)
        if not is_allowed:
            raise HTTPException(status_code=403, ...)
        return current_user
```

**Critical:** SYSADMIN is the only role that bypasses `require_permission`. All other roles (including MANAGER, OWNER) must have the permission explicitly granted in `smriti_permissions`.

### `require_role(*roles)` — Simple Role Guard

```python
Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))
```

Used for coarse-grained endpoint access.

---

## Permission Code Convention

Format: `{DOMAIN}.{ACTION}`

| Permission Code | Meaning |
|---|---|
| `CRM.MANAGE_CUSTOMERS` | Create, update, delete customers |
| `CRM.VIEW_CUSTOMERS` | View customer list |
| `SALES.CREATE_INVOICE` | Create sales invoices |
| `SALES.APPROVE_INVOICE` | Approve/post invoices |
| `PURCHASE.CREATE_PO` | Create purchase orders |
| `INVENTORY.MANAGE_STOCK` | Adjust stock |
| `REPORTS.VIEW_FINANCIAL` | View financial reports |

---

## ABAC Extension (USR-003)

Attribute-Based Access Control policies execute through `SPK.security.policies`.

Use cases:
- A MANAGER can only approve invoices below ₹50,000
- A CASHIER can only view own-branch customers
- An OWNER sees all branches

---

## Security Scope (Record-Level)

`require_permission` resolves a `record_scope` for the current user:

| Scope | Meaning |
|---|---|
| `SELF` | Only own records |
| `TEAM` | Own + team records |
| `BRANCH` | All records in own branch |
| `COMPANY` | All records in own company |
| `ALL` | All records (global — SYSADMIN only) |

The resolved scope is attached to `SecurityContext` and used by service queries.

---

## Test Pattern for Permission-Protected Endpoints

In tests, use `UserRole.SYSADMIN` to bypass permission guards when the test is focused on business logic (not RBAC):

```python
user = User(role=UserRole.SYSADMIN, ...)  # bypasses require_permission
```

When testing RBAC itself, seed `smriti_permissions` and use the actual role under test.

---

*Status: FROZEN — USR Standard v1.0 | Version: 1.0.0 | 2026-08-10*
