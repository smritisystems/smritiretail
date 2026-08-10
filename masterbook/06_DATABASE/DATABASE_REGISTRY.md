<!--
  SMRITI Retail OS — Masterbook
  Document  : 06_DATABASE/DATABASE_REGISTRY.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Database Registry

---

## Core Tables Registry

| Table | Module | Company-Scoped | Notes |
|---|---|---|---|
| `companies` | Platform | ✗ | Top-level entities |
| `branches` | Platform | ✓ | Per company |
| `users` | Auth | ✗ | Cross-company; assignment via `user_company_assignments` |
| `user_company_assignments` | Auth | ✓ | User ↔ Company access matrix |
| `user_branch_assignments` | Auth | ✓ | User ↔ Branch access |
| `smriti_roles` | Security | ✗ | Platform-wide roles |
| `smriti_permissions` | Security | ✗ | Permission manifest |
| `smriti_permission_sets` | Security | ✗ | Permission set groupings |
| `customers` | CRM | ✓ | Customer aggregate root |
| `customer_addresses` | CRM | ✓ | Customer sub-entity |
| `customer_contacts` | CRM | ✓ | Customer sub-entity |
| `customer_tax_profiles` | CRM | ✓ | Customer sub-entity |
| `customer_credit_profiles` | CRM | ✓ | Customer sub-entity |
| `customer_groups` | CRM | ✓ | Customer segmentation |
| `suppliers` | Purchase | ✓ | Supplier aggregate root |
| `products` | Inventory | ✓ | Product aggregate root |
| `product_variants` | Inventory | ✓ | SKU variants |
| `product_barcodes` | Inventory | ✓ | Multiple barcodes |
| `stock_ledger` | Inventory | ✓ | Immutable movement ledger |
| `product_stock` | Inventory | ✓ | Materialized current stock |
| `sales_invoices` | Sales | ✓ | Invoice header |
| `sales_invoice_items` | Sales | ✓ | Invoice line items |
| `sales_invoice_payments` | Sales | ✓ | Payment records |
| `purchase_orders` | Purchase | ✓ | PO header |
| `purchase_order_items` | Purchase | ✓ | PO line items |
| `journal_entries` | Accounting | ✓ | Double-entry ledger |
| `journal_entry_lines` | Accounting | ✓ | Debit/credit lines |
| `chart_of_accounts` | Accounting | ✓ | Company accounts |
| `numbering_autonumber` | Platform | ✓ | Document sequence counters |
| `identity_rules` | Platform | ✓ | Auto-ID rules per entity |
| `variant_templates` | Inventory | ✓ | Template for variant creation |
| `master_values` | Platform | ✓ | Attribute value governance |
| `report_schedules` | Reports | ✓ | Scheduled report configs |

---

## Table Naming Convention

- All table names: lowercase with underscores (`snake_case`)
- Linking/pivot tables: `{entity_a}_{entity_b}s` (e.g. `user_company_assignments`)
- Sub-entity tables: `{parent}_{sub}s` (e.g. `customer_addresses`)
- Ledger tables: append `_ledger` or `_log` (e.g. `stock_ledger`)

---

## Index Strategy

Every company-scoped table must have:
```sql
INDEX idx_{table}_company    ON {table}(company_id)
INDEX idx_{table}_branch     ON {table}(branch_id)
INDEX idx_{table}_is_deleted ON {table}(is_deleted)
```

Composite index for common query patterns:
```sql
INDEX idx_{table}_company_active ON {table}(company_id, is_deleted)
```

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
