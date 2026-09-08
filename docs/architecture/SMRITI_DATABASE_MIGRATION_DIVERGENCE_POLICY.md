<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-09-08
  Modified     : 2026-09-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Multi-Tenant Database Migration Divergence Policy

**Policy ID:** SMRITI-POL-DB-MIG-001  
**Status:** MANDATORY — ACTIVE — ALL AGENTS, ALL SESSIONS  
**Effective Date:** 2026-09-08  
**Governing Documents:** `AGENTS.md` (Rules 11, 12), SMRITI Multi-Tenant Architecture Standard  

---

## 1. Executive Summary & Purpose

SMRITI Retail OS operates on an authoritative **two-plane database architecture**:
1. **Control Plane (`smritisys`):** Tenant registry, company databases routing, authentication/security policies, global menus, system configurations, and platform metadata.
2. **Company Databases (`smriti001`, `smriti002`, ...):** Fully isolated operational data planes hosting all transactional records, customer accounts, master catalogues, inventory ledger, billing, and customer purchase orders.

Because operational transactional tables must never be instantiated on the Control Plane, migration revisions between `smritisys` and company operational databases are **intentionally diverged**. This document establishes the formal governing policy for database-scoped migrations, revision boundaries, and automated fleet orchestration.

---

## 2. Definitive Revision Scoping Standard

| Database Plane | Database Name Standard | Revision Ceiling | Allowed Model Domains | Strictly Prohibited Domains |
|---|---|---|---|---|
| **Control Plane** | `smritisys` | `v1415_scope_master_values` | Tenant registries, Companies, Branches, Users, Auth tokens, Global Master Types, Global Policies | Operational Sales, Invoices, Customer POs, Delivery Locations, Stock Movements, Ledger Entries |
| **Company Data Plane** | `smriti[a-z0-9]{3,12}` (e.g. `smriti001`) | `head` (`v1416_customer_po_billing`+) | Operational Customers, Products, Sales Invoices, Customer Purchase Orders, Allocations, Inventory | Platform Control Registry, Global Tenant Routing, Master System Blacklists |

---

## 3. Mandatory Governance Rules

### Rule 1: Zero Operational Mutations on `smritisys`
No operational transaction tables (e.g., `customer_purchase_orders`, `customer_purchase_order_lines`, `customer_po_invoice_allocations`, `sales_invoice_allocations`) may ever exist on `smritisys`.
- Any presence of operational tables on `smritisys` constitutes a critical architectural defect.
- If detected, operational tables must be purged from `smritisys` immediately.

### Rule 2: Revision Divergence Invariant
- The Control Plane `smritisys` revision ceiling is frozen at `v1415_scope_master_values`.
- Company databases advance through all operational migrations (`v1416_customer_po_billing` and beyond).
- Revision divergence (`smritisys` = `v1415`, `smriti001` = `v1416`) is **by design** and represents the physical manifestation of plane isolation.

### Rule 3: Automated Fleet Migration Governance
Company databases must never be migrated via uncoordinated loops or bare `alembic upgrade head`. All company database migrations must execute via the **SMRITI Fleet Migrator** (`backend/tools/migrate_fleet.py`), which guarantees:
1. **Authoritative Registry Validation:** Verifies tenant status is `READY` in `smritisys.company_database_registries`.
2. **Catalog Physicality Verification:** Validates database existence in `pg_database` before attempting connections (skipping unprovisioned registrations safely).
3. **Database Name Whitelisting:** Enforces regex `^smriti(?!000)(?!sys)[a-z0-9]{3,12}$` and unconditionally blocks `smritisys`.
4. **Session-Level Advisory Locking:** Derives a deterministic 32-bit lock (`pg_try_advisory_lock`) to prevent concurrent race conditions across cluster nodes.
5. **Per-Database Transaction Isolation:** Executes each tenant migration in an independent process boundary. Failure in tenant $N$ generates an isolated audit incident without aborting or contaminating tenant $N+1$.
6. **Resumable Failure Telemetry:** Generates machine-readable JSON logs and tabular audit reports.

---

## 4. Test Fixture Governance

### Rule 4: Prohibition of `Base.metadata.create_all` Against Control Plane
Test runners and fixtures (e.g., `conftest.py`) must never run unrestricted `Base.metadata.create_all()` against `settings.DATABASE_URL` when pointing to `smritisys`.
- Test fixtures must explicitly filter out tenant operational models (`customer_purchase_orders`, etc.) when binding to `smritisys`.
- Tenant transactional tests must always connect to an explicitly resolved company database (e.g., `smriti001`).

---

## 5. Audit & Compliance Sign-Off

```
Policy ID            : SMRITI-POL-DB-MIG-001
Control Plane Ceiling: v1415_scope_master_values
Company DB Target    : v1416_customer_po_billing (head)
Enforcement Tool     : backend/tools/migrate_fleet.py
Audit Verification   : backend/tools/verify_schema_parity_deep.py
Sign-off Architect  : Jawahar Ramkripal Mallah
Classification       : Internal Architecture Standard
```
