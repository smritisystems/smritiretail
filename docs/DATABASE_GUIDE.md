<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# SMRITI Retail OS Database Design Guide

This document describes the database schema patterns, indices, multi-tenant isolation, and Alembic migrations rules.

---

## 1. Database Engine Settings

* **Engine:** PostgreSQL (v16+).
* **Connection Pooling:** Managed via SQLAlchemy `AsyncEngine` with `pool_size=20` and `max_overflow=10` to support high-throughput cashier operations.
* **ORM:** SQLAlchemy 2.0 async driver (`asyncpg`).

---

## 2. Core Schema Groups

The tables in SMRITI are grouped into three primary domains:

### A. Authentication & Security
* `users`: Holds usernames, emails, hashed passwords, roles, and status flags.
* `refresh_token_blacklist`: Tracks revoked JWT tokens.
* `smriti_roles`, `smriti_permissions`, `smriti_policies`, `smriti_role_policies`: Mappings for RBAC policy checks.

### B. Tenancy Structures
* `companies`: Stores multi-tenant corporate groups.
* `branches`: Stores individual business stores and warehouses linked to a company.

### C. Retail Operations
* `products`: Product master list with SKU, cost, and HSN codes.
* `inventory_ledger`: Historical stock ledger log tracking inputs and outputs.
* `sales_invoices`: Transaction invoices with customer ID, tax amounts, and payment types.

---

## 3. Multi-Tenant Protection

Multi-tenancy is enforced using the `company_id` and `branch_id` columns.
* Query filters are automatically applied inside database sessions based on the requester's secure tenant context.
* Global SYSADMIN queries bypass tenant checks, but write constraints prevent assigning business transactions to a SYSADMIN.
