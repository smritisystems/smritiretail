<!--
  SMRITI Retail OS — Masterbook
  Document  : 04_MASTER_DATA/APPLICABILITY.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Master Data Applicability Rules

---

## Company-Scoped vs Platform-Scoped Masters

| Master | Scope | Governed By |
|---|---|---|
| Customer | Company | `company_id` on every row |
| Supplier | Company | `company_id` on every row |
| Product | Company | `company_id` on every row |
| Price Lists | Company | `company_id` on price list rows |
| Customer Groups | Company | `company_id` |
| Tax Rates | Platform or Company | `company_id = NULL` for platform-wide |
| UOM (Unit of Measure) | Platform | Shared across all companies |
| Currencies | Platform | Shared |
| Countries | Platform | Shared |

---

## Applicability Decision Tree

```
Is this master data specific to one company?
    ├── YES → company_id must be set; query must filter by it
    └── NO  → platform-level (company_id = NULL or omitted)
              Used by: UOM, Currencies, Countries, Tax Rates (global)
```

---

## Master Data in Fresh Production Install (PROD-003)

On a clean production install, the database contains:
- ✅ System metadata: Company setup, Admin User, Config, Roles, Permissions
- ✅ Platform masters: Tax Rates, UOM, Currencies, Countries
- ❌ Zero business masters: No Customers, No Suppliers, No Products
- ❌ Zero transactions: No Invoices, No POs, No Stock movements

Dashboard metrics must honestly show **0 records** on first installation.

---

## Master Data Import

Bulk import via Excel is supported in the Spreadsheet Studio (item-master workspace).
Import validation uses `MasterValue` for attribute dropdowns (per AP-008).
Import never seeds production with sample/demo data unless explicitly requested.

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
