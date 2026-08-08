# SMRITI DATABASE CONSOLIDATION MAP V1 (RECONCILED & FROZEN)
## Authority Proof & Frozen Architecture Baseline

> **Status:** READ-ONLY ARCHITECTURAL AUDIT | RECONCILIATION ACCEPTED | REFACTORING FROZEN
> **Verified Physical Tables:** EXACTLY 269 PHYSICAL TABLES

### Governance Principles:
```text
CURRENT STATE:
All 269 physical tables are immutable during the audit/certification freeze.

FUTURE STATE:
No table may be deprecated, altered, merged, renamed, or dropped until an approved
Product Mode refactoring change is opened and the table passes dependency, reader,
writer, FK, migration, and runtime verification.
```

---

## Section 1: Non-Existent Claimed Table Reconciliation Matrix

| Reported Table Name | Exists Live? | Actual Physical Table | Source of Claim | Classification |
|---|---|---|---|---|
| `smriti_users` | **NO** | `users` (3 rows) | Code model `SmritiUser` in `app/models/platform.py` | **PROPOSED / NON-EXISTENT CODE MODEL** |
| `approval_requests` | **NO** | `smriti_approval_requests` (0 rows) | Draft architecture spec | **PROPOSED TABLE NAME** |
| `approval_rules` | **NO** | `smriti_approval_policies` (0 rows) & `smriti_approval_steps` (0 rows) | Draft architecture spec | **PROPOSED TABLE NAME** |
| `approval_logs` | **NO** | `approval_workflow_logs` (0 rows) & `smriti_approval_histories` (0 rows) | Draft architecture spec | **PROPOSED TABLE NAME** |
| `stock_ledger` | **NO** | `inventory_ledger_entries` (7 rows) & `stock_movements` (9 rows) | Legacy terminology | **HISTORICAL TABLE NAME** |
| `product_identity_barcodes` | **NO** | `product_barcodes` (0 rows) | Code model `ProductIdentityBarcode` in `app/models/product_identity.py` | **CODE MODEL ONLY** |

---

## Section 2: Targeted Dependency & Authority Proof Audit

### 1. `products.barcode` ↔ `product_barcodes` Authority Proof
```text
Product (Master Item SKU)
   │
   ├── products.barcode (Primary Canonical SKU Barcode Projection)
   │
   └── Product Identity Facade (product_identities)
          │
          └── Barcode Registry (product_barcodes)
                 ├── Primary
                 ├── Alternate / Alias
                 ├── GS1
                 ├── EAN / UPC
                 └── Historical / Vendor Barcode
```
- **Empirical Finding:** `products.barcode` acts as the primary SKU barcode projection referenced in single-item POS checkout and billing endpoints. `product_barcodes` stores secondary, multi-mode, and historical barcodes. Neither table will be consolidated during the freeze.

### 2. `stock_movements` ↔ `inventory_ledger_entries` Event Flow Proof
```text
Inventory Transaction / Event (Sale / Purchase / Adjustment / Transfer)
    │
    ├── Stock Movement (Immutable Event Audit Stream via DB Trigger: trg_sync_stock_movement_ledger)
    │   (stock_movements: 9 live rows)
    │
    └── Inventory Ledger Entry (High-Throughput Batch Balance Entry via Application Kernel)
        (inventory_ledger_entries: 7 live rows)
            │
            └── Snapshot / Checkpoint / Identity Projections
                (inventory_snapshot_records, inventory_checkpoint_records, etc.)
```
- **Architectural Principle:** One authoritative transactional event stream; derived ledgers and projections must not independently compete for stock truth. Both tables serve complementary roles and remain immutable.

### 3. `roles` ↔ `smriti_roles` and `user_roles` ↔ `smriti_user_roles` Dependency Proof
- **Empirical Finding for `roles` (0 rows):** Referenced in 155 files (legacy router imports, Alembic migrations, helper scripts). Classified as **`EMPTY / LEGACY CANDIDATE`**. NOT safe for immediate deprecation without complete runtime verification.
- **Empirical Finding for `smriti_roles` (11 rows):** Holds active built-in role definitions (`SUPER_ADMIN`, `COMPANY_ADMIN`, `STORE_MANAGER`, `CASHIER`, etc.) initialized in `seed.py`.
- **Empirical Finding for `user_roles` (0 rows):** Referenced in 54 files. Classified as **`EMPTY / LEGACY CANDIDATE`**.
- **Empirical Finding for `smriti_user_roles` (3 rows):** Holds active user-to-role assignment mappings.

### 5. `organizations` ↔ `tenants` / `companies` / `branches` Hierarchy Proof
- **Empirical Finding for `organizations` (0 rows):** Referenced in 111 migration scripts as the single-tenant legacy root. Classified as **`EMPTY / LEGACY CANDIDATE`**.
- **Empirical Finding for `tenants` (1 row), `companies` (1 row), `branches` (1 row):** Active 3-level Multi-Tenant Enterprise hierarchy.

---

## Section 3: Architecture Maturity Scorecard

| Area | Status | Governance Rationale |
|---|---|---|
| Live DB Inventory | 🟢 **ACCEPTED** | 269 physical PostgreSQL tables verified |
| 269-Table Count | 🟢 **VERIFIED** | Matches live database `smriti_retail_db` exactly |
| Non-Existent Table Reconciliation | 🟢 **FIXED** | 6 non-physical names corrected |
| IAM Authority | 🟢 **GOOD** | `users`, `smriti_roles`, `smriti_permissions` active |
| Approval Family Mapping | 🟢 **GOOD** | 12 `smriti_approval_*` tables verified |
| Product Family | 🟢 **CLARIFIED** | `products.barcode` (Primary), `product_barcodes` (Multi-barcode registry) |
| Inventory Ledger Family | 🟢 **CLARIFIED** | `stock_movements` (Trigger audit) ↔ `inventory_ledger_entries` (Batch balance) |
| Legacy `roles` | 🟡 **LEGACY CANDIDATE** | 0 rows, 155 code refs — Refactoring FROZEN |
| Database Changes | 🟢 **ZERO** | Read-only mandate strictly maintained |
| Refactoring Status | 🔴 **FROZEN** | No Strangler migrations allowed during freeze |
| Authority Map V1 | 🟢 **ACCEPTED** | Canonical schema baseline established |
| Consolidation Map V1 | 🟢 **ACCEPTED AS AUDIT ARTIFACT** | Reference roadmap for post-certification |
