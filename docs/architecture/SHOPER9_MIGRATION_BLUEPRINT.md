<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.63.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Enterprise: Legacy Tally Shoper 9 Migration Blueprint & Long-Term Strategy

**Status:** ARCHITECTURAL SPECIFICATION & PRODUCTION MIGRATION HARNESS  
**Version:** 1.0.0  
**Effective Date:** 2026-08-25  

---

## 1. Executive Summary & Objective

Tally Shoper 9 has served tens of thousands of Indian apparel, footwear, supermarket, and retail chain stores for over two decades. However, legacy desktop limitations (flat-file / local SQL Server setups, unversioned parameters, lack of cloud sync, manual polling, fragile point-to-point data synchronization) require a modern, cloud-native enterprise replacement.

**SMRITI Retail OS** provides a drop-in, 100% compliant replacement with:
1. **Control Plane Governance (`smritisys`)**: Zero-code AST business rules, GST statutory policies, dynamic themes, and vertical capability templates.
2. **Multi-Tenant Physical Isolation (`smritiXXX`)**: Pure PostgreSQL ACID transactional ledgers, immutable sales reproducibility snapshots, and double-entry accounting.
3. **Automated Zero-Loss Migration Pipeline**: Automated extraction from `D:\Shoper9\ini` and `ParamDef` into SMRITI Universal Master Data, Batch Stock, and General Ledger.

---

## 2. Legacy-to-Modern Entity Mapping Matrix

| Legacy Shoper 9 Entity | SMRITI Target Schema / Engine | Migration Mechanism | Verification Guarantee |
|---|---|---|---|
| **`CustMaster` / `VendorMaster`** | `parties`, `party_roles`, `customer_profiles`, `supplier_profiles` | `Shoper9TenantMigrator.migrate_parties_from_data()` | Zero duplication via unique party `code` index. |
| **`ItemMaster` / `Class1` / `Class2`** | `items`, `item_variants`, `item_barcodes` | `Shoper9TenantMigrator.migrate_items_from_data()` | Polymorphic JSONB attributes (`size`, `color`, `fit`) + Cartesian matrix variants. |
| **`SysParam` / `SysParamExtd`** | `smritisys.policy_definitions`, `business_rule_definitions` | `ControlPlaneSeeder.seed_governed_logic()` | AST Dynamic Formula Evaluation with Zero-Division Guards. |
| **`GenLookUp` / `GenLookupExtd`** | `smritisys.*_ref` & `lookup_master_registries` | Reference Data Seeder | Multi-language localized lookup catalog (English, Hindi, Marathi). |
| **Stock Ledger & Batch Balances** | `stock_movements`, `product_batch_stocks` | `Shoper9TenantMigrator.migrate_opening_stock_from_data()` | Invariant: $\sum \text{Stock Movements} == \text{Batch Physical Stock}$. |
| **Financial Balances (`AccountSummary`)** | `general_ledger_entries`, `account_balance_snapshots` | Double-Entry Opening Journal Voucher | Strict Invariant: $\sum \text{Debit} == \sum \text{Credit}$ with delta = 0.00. |

---

## 3. Battle-Tested Retail Governance Policies Seeded

The following policies extracted from `D:\Shoper9\ini` are now natively active in `smritisys`:

1. **`POLICY_BILLING_CONTROLS` (Version 1)**:
   - `allow_item_scanning_with_recalling`: Allows continuous barcode scanning while suspended transaction is loaded.
   - `enable_qty_only_editing`: Restricts cashier terminal to quantity adjustments only (prevents accidental price/discount tampering).
   - `allow_rate_alteration_sales_return_wor`: Controls return without invoice rate overrides.
   - `enforce_strict_stock_check`: Prevents billing of zero/negative stock unless explicitly authorized by store manager.

2. **`POLICY_BARCODE_COST_MASK` (Version 1)**:
   - Obfuscated Cost Encoding: `{"0":"A", "1":"B", "2":"C", "3":"D", "4":"E", "5":"F", "6":"G", "7":"H", "8":"I", "9":"J"}`.
   - Allows store associates to read encoded cost price directly off apparel hang-tags during negotiation without revealing wholesale margins to shoppers.

3. **`POLICY_INWARDS_PROCUREMENT` (Version 1)**:
   - Enforces automated purchase tax computation against predefined HSN slabs.
   - Mandates transporter details (E-Way bill number, vehicle number, LR date) on GRN receipts.

4. **`POLICY_CREDIT_MANAGEMENT` (Version 1)**:
   - Enforces customer credit limit threshold with automated POS checkout stop-billing.
   - Allows Store Manager cryptographic pin override.

---

## 4. End-to-End Execution Pipeline

To migrate any legacy Shoper 9 store into SMRITI:

```bash
# 1. Extract and update latest configuration catalog from Shoper 9 installation
python scripts/admin/sh9_cfg_extract.py

# 2. Perform pre-flight dry-run migration against target tenant database (e.g. smriti001)
$env:PYTHONPATH="F:\SMRITRretailNX\backend"; python scripts/admin/sh9_migrator.py --tenant-db smriti001 --company-id COMP-001 --dry-run

# 3. Execute live production migration
$env:PYTHONPATH="F:\SMRITRretailNX\backend"; python scripts/admin/sh9_migrator.py --tenant-db smriti001 --company-id COMP-001
```

---

## 5. Verification & Governance Quality Gates

1. **Transactional Atomicity**: All migration steps run inside a single PostgreSQL transaction block with automatic rollback on any constraint violation.
2. **Trial Balance Reconciliation**: Every migrated tenant must pass $\sum \text{Debit} == \sum \text{Credit}$ before go-live sign-off.
3. **Traceability**: All imported records carry `reference_type="SHOPER9_MIGRATION"` and historical source keys.
