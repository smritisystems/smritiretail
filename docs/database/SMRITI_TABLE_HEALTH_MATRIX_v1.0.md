<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
-->

# SMRITI Table Health Matrix v1.0 — Tier 1 Tables


**Generated:** 2026-07-28  
**ADR Reference:** ADR-012 · DBP-001  
**Scope:** Tier 1 Core Business Transaction Tables (highest governance priority)

> **Note on BaseEntity:** All models inheriting `BaseEntity` or `RowSecuredMixin` automatically receive  
> soft-delete (`is_deleted`), audit fields (`created_at`, `modified_at`, `created_by`, `updated_by`),  
> tenant isolation (`tenant_id`, `company_id`, `branch_id`), and versioning (`version`).  
> The "BaseEnt" column reflects this inherited coverage.

---

## Scoring Formula

```
Score = (ModelExists + BaseEntityInherited + IndexDeclared + RelationshipsDeclared
         + RepositoryExists + APIRouteExists) / 6 × 100%
```

Each check is worth ~17%. A table achieving 100% has:
- ✅ SQLAlchemy model class defined
- ✅ Inherits BaseEntity (audit + tenant + soft-delete)
- ✅ At least one indexed column declared
- ✅ SQLAlchemy relationships declared
- ✅ A Repository file exists for its module
- ✅ An API route file exists for its module

---

## Tier 1 Health Matrix

| Table | Module | Model | BaseEnt | Index | Relations | Repo | API | Score |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `sales_invoices` | sales | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| `sales_invoice_items` | sales | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| `sales_orders` | sales | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** |
| `products` | inventory | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **83%** |
| `customers` | crm | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **83%** |
| `stock_movements` | inventory | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **83%** |
| `pos_sessions` | pos | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | **83%** |
| `pos_transactions` | pos | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | **83%** |
| `chart_of_accounts` | accounting | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | **83%** |
| `users` | auth | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **83%** |
| `smriti_roles` | security | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **83%** |
| `smriti_permissions` | security | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **83%** |
| `financial_year` | accounting | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | **83%** |
| `journal_vouchers` | accounting | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | **83%** |
| `suppliers` | purchase | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **67%** |
| `purchase_orders` | purchase | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **67%** |
| `purchase_receipts` | purchase | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **67%** |
| `ledger_entries` | accounting | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | **67%** |
| `companies` | tenant | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | **50%** |
| `branches` | tenant | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | **50%** |

**Average Tier 1 Score: 78%**

---

## Issues Requiring Action

### 🔴 Critical (Score < 70%)

| Table | Issue | Action |
|:---|:---|:---|
| `companies` | Does not inherit `BaseEntity` — uses raw `Base` | Extend `BaseEntity` or verify `RowSecuredMixin` |
| `branches` | Does not inherit `BaseEntity` — uses raw `Base` | Extend `BaseEntity` or verify `RowSecuredMixin` |
| `ledger_entries` | `__tablename__` not found by scanner — possible naming mismatch | Verify model class `__tablename__` declaration |

### 🟡 Medium (Score 67–82%)

| Table | Missing | Priority |
|:---|:---|:---|
| `suppliers` | No repository file for `purchase` module | Create `SupplierRepository` |
| `purchase_orders` | No indexes declared in `purchase.py` | Add `index=True` to `po_number`, `supplier_id`, `status` |
| `purchase_receipts` | No indexes declared | Add `index=True` to `po_id`, `grn_number` |
| `products` | No `InventoryRepository` file | Create `ProductRepository` |
| `customers` | No `CrmRepository` file | Create `CustomerRepository` |
| `pos_sessions` | No indexes on `terminal_id`, `status` | Add `index=True` |
| `pos_transactions` | No indexes on `session_id`, `receipt_no` | Add `index=True` |

### 🟢 Achieved 100%
`sales_invoices`, `sales_invoice_items`, `sales_orders` — full governance compliance.

---

## Recommended Improvement Sequence

1. **Verify `companies` / `branches` BaseEntity** — these are Tier 1 but scored 50%
2. **Verify `ledger_entries`** — table not detected by scanner (possible double quote vs single quote)
3. **Create `InventoryRepository`**, `CustomerRepository`, `SupplierRepository` — highest impact per-fix
4. **Add indexes to `purchase.py`** — `purchase_orders`, `purchase_receipts`, `suppliers`
5. **Add indexes to `pos.py`** — `pos_sessions`, `pos_transactions`

---

## Next Review
Update this document whenever a Tier 1 table reaches 100% or drops below 67%.
