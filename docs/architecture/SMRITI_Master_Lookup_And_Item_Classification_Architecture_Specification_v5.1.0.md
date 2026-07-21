<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# SMRITI Retail OS — Master Lookup & Item Classification Architecture Specification (v5.1.0)

**Document Status:** FROZEN  
**Architecture Review:** APPROVED (10/10 ARCHITECTURE)  
**Implementation Status:** READY_FOR_PHASE_2B  
**Effective Date:** 2026-07-21  
**Scope:** Core Domain, Inventory, CRM, POS, Sales, and Master Data Subsystems  

---

## 1. System Layering & Relationship Architecture

Reference data, master classification, inventory, and transactional records follow a strict unidirectional dependency hierarchy. Lower layers NEVER depend on or reference higher layers.

```text
Master Lookup Framework (MLF)
    │  (System-seeded & tenant-created reference codes: PAYMENT_MODE, UOM, REASON_CODE)
    ▼
Item Classification (Variant Templates)
    │  (Category templates, HSN codes, GST tax policies, attribute schemas)
    ▼
Product Master (SKU Items)
    │  (Trackable stock items, barcoded variants, MRP, stock numbers)
    ▼
Inventory Engine
    │  (Stock ledgers, warehouses, bin movements, stock transfers)
    ▼
Transactional Systems
       (Sales Invoices, POS Bills, Purchase Orders, Returns, GST Reporting)
```

### Subsystem Boundaries Policy
- **Workflow & Approval Engines**: `Approval Status`, `Workflow State`, `FSM Transitions`, and `RBAC Roles` operate in dedicated security/workflow domains and **MUST NEVER** be created as Master Lookup entries.
- **Business System Masters**: `Customer`, `Vendor`, `Product`, `Warehouse`, `Company`, `Employee`, `Branch`, and `Brand` (with brand assets/manufacturers) are core domain entities and **MUST NEVER** be flattened into Master Lookups.

---

## 2. Master Lookup Framework (MLF) Governance Policy

### 2.1 Schema Architecture (`master_types` & `master_values`)
MLF utilizes PostgreSQL `master_types` (System Categories) and `master_values` (Lookup Entries):

```text
master_types (Pre-defined System Categories)
  ├── id (UUID — PRIMARY KEY)
  ├── code (VARCHAR 50 — UNIQUE, IMMUTABLE) e.g., 'PAYMENT_MODE'
  ├── label (VARCHAR 100)
  ├── category_type (VARCHAR 20 ENUM — 'SYSTEM' | 'REFERENCE' | 'BUSINESS')
  ├── field_schema (JSONB — Allowed UI/display hints only)
  └── is_system (BOOLEAN — DEFAULT True)

master_values (Lookup Entries)
  ├── id (UUID — PRIMARY KEY)
  ├── master_type_id (FK -> master_types.id)
  ├── code (VARCHAR 50 — IMMUTABLE) e.g., 'UPI'
  ├── name (VARCHAR 255 — EDITABLE display label)
  ├── parent_value_id (FK -> master_values.id — Hierarchical lookups)
  ├── data (JSONB — Sidecar flags, numbers, metadata)
  ├── supersedes_id (UUID — FK -> master_values.id for replacement versioning)
  ├── effective_from (TIMESTAMPTZ — DEFAULT NOW())
  ├── effective_to (TIMESTAMPTZ — NULLABLE for current active version)
  ├── active (BOOLEAN — DEFAULT True)
  └── sort_order (INTEGER)
```

### 2.2 Governance Metadata & `field_schema` Scope Boundaries
1. **Governance Metadata Only**: `category_type` is governance metadata used strictly for administrative policies (`'SYSTEM'`, `'REFERENCE'`, `'BUSINESS'`). Application code **MUST NEVER** branch runtime business logic on `category_type` (e.g., `if category_type == "BUSINESS":` is prohibited). Adding new enum values requires an architecture review.
2. **`field_schema` Scope Boundaries**:
   - **Allowed**: UI control types, input format regex hints, display labels, default sort orders, hierarchy display options.
   - **Prohibited**: Executable business logic, pricing formulas, approval workflows, state transitions.

### 2.3 Category Governance Matrix

| Category Type | Examples | Tenant Value Editable | Deletion / Mutation Policy |
| :--- | :--- | :--- | :--- |
| **System** | `PAYMENT_MODE`, `UOM`, `ITEM_TYPE` | No | System-seeded; immutable & protected |
| **Reference** | `CUSTOMER_GROUP`, `REASON_CODE`, `TAX_CATEGORY` | Yes (values only) | Tenant can add/deactivate values |
| **Business** | `CATEGORY` | Yes (values only) | Subject to tenant RBAC permissions |
| **Workflow / Security (Exclusion Category)** | `APPROVAL_STATUS`, `WORKFLOW_STATE`, `ROLE` | **Never** | **Prohibited from MLF**; managed by Workflow/RBAC engines |

*(Note: `Workflow / Security` is an architectural exclusion classification, not a valid `category_type` database enum value).*

### 2.4 Hierarchical Lookup Integrity Rules (`parent_value_id`)
1. **Same Category Constraint**: Parent (`parent_value_id`) and Child lookup records **MUST** belong to the same `master_type`.
2. **Acyclic Tree Guarantee**: Cyclic parent-child relationships are strictly prohibited and validated on insert/update.
3. **Maximum Hierarchy Depth**: Maximum supported hierarchy depth is capped at **3 levels** (e.g., Level 1: Country ➔ Level 2: State ➔ Level 3: City).

### 2.5 Lookup Code Immutability & Replacement Versioning Rules
1. `id`: Immutable.
2. `code`: **IMMUTABLE** upon creation. Prevents foreign key pointer corruption across transaction tables.
3. `name`, `description`, `data` (JSONB), `sort_order`, `active`: **EDITABLE**.
4. **Atomic Transactional Guarantees**: All mutating service methods (`create_value`, `update_value`, `replace_value`, `deactivate_value`) **MUST** execute within atomic database transactions (`AsyncSession.begin() / commit()`).
5. **Atomic `replace_value()` Execution**: Breaking policy or rate changes (e.g., UOM conversion factors, tax categories) **MUST NEVER** overwrite historical active lookup rows. `replace_value()` executes atomically within a single database transaction:
   - Sets old record `effective_to = NOW()` and `active = False`.
   - Inserts replacement record with `supersedes_id = old_id`, `effective_from = NOW()`, `effective_to = NULL`, `active = True`.
   - Writes immutable audit log entry.
   - Triggers real-time cache invalidation signal (`lookup.replaced`) to connected POS/terminal clients.

### 2.6 Authoritative Delete Enforcement Policy
Deletion shall be rejected if a database foreign key or application-level reference exists in any supported business entity.
- **Primary Enforcement**: Database Foreign Key constraints remain the authoritative integrity enforcement layer. Application validation in `LookupService.delete_value()` supplements—but NEVER replaces—database referential integrity.
- **Application Validation**: `LookupService.delete_value()` executes fallback query validation for entities utilizing string code keys before executing delete SQL.
- If referenced in any active record: Delete is rejected with business error `SMRITI-VAL-001` (*"Lookup code '{code}' is referenced in active records and cannot be deleted. You may deactivate it instead."*).

### 2.7 Audit Logging Policy
Any label/description rename, replacement versioning, or metadata change emits a structured, immutable audit log entry (`entity_type='MASTER_VALUE'`, `old_value`, `new_value`, `user_id`, `timestamp`, `ip_address`).

### 2.8 Canonical API Layering & Service Contract
Subsystem interactions with reference data follow the layered architecture:
`API / UI` ➔ `LookupService` (Business Rules, Audit Logs & Event Signals) ➔ `LookupRepository` (SQLAlchemy / Postgres Queries) ➔ `Database`.

```python
class LookupService:
    async def get_value(self, id_or_code: str) -> MasterValue: ...
    async def search_values(self, type_code: str, active_only: bool = True) -> list[MasterValue]: ...
    async def validate_value(self, type_code: str, code: str) -> bool: ...
    async def create_value(self, type_code: str, value_in: MasterValueCreate) -> MasterValue: ...
    async def update_value(self, value_id: str, value_in: MasterValueUpdate) -> MasterValue: ...
    async def deactivate_value(self, value_id: str) -> bool: ...
    async def replace_value(self, value_id: str, new_value_in: MasterValueCreate) -> MasterValue: ...
    async def get_audit_history(self, value_id: str) -> list[AuditLog]: ...
```

### 2.9 Standardized Cache Invalidation & Event Bus Signals (NFR)
Mutating operations on reference data emit standardized events across Redis/Memory Cache and Event Bus:
- `lookup.created`
- `lookup.updated`
- `lookup.replaced`
- `lookup.deactivated`

```text
Lookup Mutation (create / update / replace / deactivate)
    │
    ▼
LookupService (Commit Atomic Transaction)
    │
    ▼
Cache Eviction (Redis / Memory Cache Eviction)
    │
    ▼
Event Bus Signal Broadcast (lookup.created / lookup.updated / lookup.replaced / lookup.deactivated)
    │
    ▼
POS Terminal Clients (Background Refresh of Local Lookups)
```

### 2.10 Production Migration & Backfill Policy
Migration to MLF shall use **dual-write and backfill strategies** where existing string columns are upgraded to foreign-key references. Direct in-place destructive column replacement on production databases is strictly prohibited.

---

## 3. Item Classification vs. Item Master Split

### 3.1 Classification-Level Tax Single Point of Truth
- Tax rates and GST rules are defined at the **Item Classification / HSN Master** level (`VariantTemplate`), **NOT** independently defaulted on individual SKU rows (`gst_percentage DEFAULT 18.00`).
- Individual `Product` SKU rows inherit GST rules from their assigned Classification / HSN Code.

### 3.2 Measurable Classification Immutability Lock
- **Lock Trigger Condition**: Immutability lock applies **once a classification is referenced by any committed inventory or financial transaction**.
- Pre-transaction draft products permit classification edits. Once a committed transaction exists, modifications to `classification_code`, `hsn_code`, or GST tax rules are **LOCKED** and require a versioned migration event.

### 3.3 Product Operational Taxonomy (`item_type`)
Product SKU operational taxonomy distinguishes physical and operational identity:
1. `STOCK` — Standard billable physical inventory.
2. `SERVICE` — Billable non-physical service/charge (e.g., Alteration Charge, Delivery Fee).
3. `CONSIGNMENT` — Vendor-owned inventory paid upon point-of-sale.
4. `NON_STOCK` — Internal store consumable/asset tracked for usage, not for sale.

*(Note: Promotional "Free Goods" / Gift-with-purchase are transaction-time promotional rules governed by the Discount Engine, NOT intrinsic item identities).*

### 3.4 Multiple Pricing System-Wide Gating Switch
Multiple pricing strategy is governed by a global tenant setting `MULTIPLE_PRICING_MODE`:
- `OFF`: Single pricing across entire store catalog (SME standard).
- `SELECTIVE`: Multiple pricing enabled only for explicitly whitelisted Product + Brand classifications.
- `ALL_ITEMS`: Enterprise multi-price list enabled across all items.

### 3.5 Schema-Backed Classification Hierarchy
Classification hierarchy uses clean relational structure (`Classification` → `Hierarchy Definition` → `Metadata JSON`), ensuring metadata JSON describes display options rather than replacing relational SQL entities.

---

## 4. Actionable Technical Debt Register

| Severity | Domain | Debt Description | Remediation Plan | Status | Owner | Target Release |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **High** | Inventory | Per-SKU hardcoded `gst_percentage DEFAULT 18.00` on `products` table | Migrate tax resolution to Classification / HSN Registry | Open | Backend Core | Phase 2b (v5.2) |
| **High** | State Store | In-memory migration arrays in `src/state/store.ts` (`tallyExportQueue`, `partnersList`, etc.) | Complete FastAPI + Postgres endpoint migration | In Progress | Platform Team | Phase 2b (v5.2) |
| **Medium** | Security | Legacy fallback in `verifyPassword` accepting unhashed values | Enforce PBKDF2 hash format check across all auth paths | Open | Security Lead | Phase 3a (v5.3) |
| **Medium** | POS UI | Flat hardcoded `Category` selector without keyboard `F2`/`Ctrl+N` shortcuts | Upgrade `PosTerminalTab` to use `LookupPicker` | Open | Frontend Team | Phase 3a (v5.3) |
| **Low** | Compliance | Python 3.14 `utcnow()` deprecation warnings in test fixtures | Refactor `datetime.utcnow()` to `datetime.now(timezone.utc)` | Open | QA / Automation | Phase 3b (v5.4) |
| **Deferred** | Enterprise | Multi-level warehouse location hierarchy (Zone → Aisle → Rack → Bin) | Retain flat `branch_id` storage until multi-store phase | Deferred | Enterprise Arch | Phase 4.0 |
