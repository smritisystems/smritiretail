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

# SMRITI Retail OS System Architecture

This document describes the high-level architecture, subsystem boundaries, data-flow models, and technology structures of SMRITI Retail OS.

---

## 1. Subsystem Decomposition

SMRITI Retail OS is structured as a decoupled full-stack platform:

```text
┌───────────────────────────────────────────────────────────┐
│                     React SPA Frontend                    │
│  - Vite, Tailwind CSS v4, TypeScript                      │
│  - Layout Engine (SRLE), Print Engine (ZPL/TSPL)          │
└─────────────────────────────┬─────────────────────────────┘
                              │ HTTP JSON APIs
                              ▼
┌───────────────────────────────────────────────────────────┐
│                    Express API Proxy                      │
│  - Entry gateway (frozen router)                          │
│  - Proxies calls to FastAPI transactional endpoints        │
└─────────────────────────────┬─────────────────────────────┘
                              │ Proxied HTTP Request
                              ▼
┌───────────────────────────────────────────────────────────┐
│             Platform Abstraction Layer (PAL)              │
│  - Context wiring & multi-tenant isolation                │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│                 FastAPI (Python) Backend                  │
│  - Business logic services (Auth, Inventory, Sales, POS)  │
│  - SQLAlchemy ORM database queries                        │
└─────────────────────────────┬─────────────────────────────┘
                              │ SQL (Port 5432)
                              ▼
┌───────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                    │
│  - System configurations, transaction tables, auditlegder │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Platform Abstraction Layer (PAL)

The Platform Abstraction Layer (PAL) enforces dependency boundaries:
* All core business services are decoupled from the underlying database driver.
* Inward dependency rules ensure that database schema alterations or framework upgrades do not cascade into business workflows.
* Tenant contexts (Company & Branch) are extracted from the JWT token and stored in thread-local storage (`active_tenant_ctx`), preventing cross-tenant queries.

---

## 3. Data Storage & System of Record

* **PostgreSQL:** Acts as the single transactional system of record. Holds users, permissions, inventory ledgers, tax rules, invoice items, and security logs.
* **Express Store:** Transient caching and layout states reside in memory or `db_store.json` caching only for dev fallback. No business decisions or financial ledger calculations are made in the Express layer.
