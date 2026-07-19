<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.0.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Developer & Architecture Guide

Welcome to the SMRITI developer setup and reference guide. This document details the Clean Architecture rules, swappable database interfaces, and background synchronization engines powering SMRITI Retail OS.

---

## Clean Architecture (Ports & Adapters)

To achieve a 20-30 year software lifecycle, SMRITI Retail OS isolates core retail workflows (pricing, taxes, shift management, stock ledgers) from specific databases (PostgreSQL, SQLite, IndexedDB) and transport protocols (Express REST, WebSockets).

```text
               React Frontend / UI
                        │
             Express API Routing / HTTP
                        │
                        ▼
           Platform Abstraction Layer (PAL)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  Billing Service                  Sync Engine
  (Use Cases)                   (Queue Worker)
        │                               │
        └───────────────┬───────────────┘
                        ▼
            Database Repository Ports
         (IProductRepository, etc. Interfaces)
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Postgres SQL      SQLite        IndexedDB
     Adapter         Adapter        Adapter
  (Store Desktop)  (Mobile App)    (Web PWA)
```

### Dependency Rules
1. **No Outward Dependencies:** Core domain logic and interfaces (`src/core/`) must never import framework libraries (`express`, `react`) or database clients (`pg`).
2. **Ports and Adapters:** All database writes and queries must be routed through Repository Interfaces (`src/core/interfaces/db.ts`). Implementation classes (adapters) in `src/db/` are injected at runtime.
3. **Dependency Injection:** The bootstrapper container (`src/bootstrap/di.ts`) inspects the `DATABASE_PROVIDER` configuration variable at boot, instantiates the mapped repositories, and registers them.

---

## Directory Organization

Developers must maintain the following file system layout:

```text
src/
├── core/
│   ├── domain/              ← Pure data structures and schemas (Product, Customer)
│   ├── interfaces/          ← Repository Ports (IProductRepository, etc.)
│   ├── services/            ← Framework-independent business services (BillingService)
│   └── sync/                ← Background SyncEngine queue reconciliation loops
├── db/
│   ├── postgres/            ← Postgres Repository Adapter implementations
│   ├── sqlite/              ← SQLite Repository Adapter implementations (Android stub)
│   └── indexeddb/           ← IndexedDB Repository Adapter implementations (Web stub)
├── bootstrap/               ← PAL bootstrapper & DI container injection setup
└── server.ts                ← Express HTTP transport gateway
```

---

## Storage & Seeding Operations

### 1. PostgreSQL Standalone Connection Pool
- Connection pools are managed in `src/db/pool.ts` using `pg.Pool` configuration.
- Pool options limit client connection limits to `20` with a `30,000ms` idle timeout.

### 2. Auto-Migration & Seeding Lifecycle
- When the Express application starts, it executes `initializePostgres()` from `src/db/init.ts`.
- The initializer executes `src/db/schema.sql` to verify database structure.
- If the database is empty, the initializer reads initial configurations from `db_store.json` and seeds the Postgres tables inside safe database transactions.

---

## Synchronization Engine

SMRITI Retail OS is designed to function completely offline without internet connectivity.

### 1. Local-First Writes
Mutations are written locally to the local database repository immediately. At the same time, the event is saved to the persistent `sync_queue` table.

### 2. Resilient Sync Queue
- Persistent table `sync_queue` ensures sync records survive app crashes, power failures, or Windows restarts.
- Sync items are queued with incremental UUID tracking, payload JSON variables, and retry limit counts.

### 3. Background Synchronization Worker
- The `SyncEngine` (`src/core/sync/SyncEngine.ts`) runs a periodic poll checking for pending sync items.
- If transmitting to HQ fails (e.g. store is offline), the worker increments the retry count and backs off, preventing network failures from blocking store checkout flows.
