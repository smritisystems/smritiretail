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

# Implementation Plan: Offline-First Clean Architecture — v3.0.0

This plan establishes the Ports and Adapters (Hexagonal) Clean Architecture for SMRITI Retail OS. It isolates business modules from framework-specific and database-specific dependencies (Express, React, pg, SQLite) using repository abstractions, introduces a background Sync Engine, and reorganizes the codebase to support future swappable database tiers (PostgreSQL, SQLite, IndexedDB).

---

## 1. Objective
Refactor the backend structure of SMRITI Retail OS to make business logic entirely independent of runtime frameworks and persistent storage engines. The same core module logic will run on PostgreSQL (Store Server/Desktop), SQLite (Android App), or IndexedDB (Web PWA), decoupled from Express HTTP details, and integrated with an offline-first Sync Engine.

---

## 2. Business Motivation
To support a 20-30 year software lifespan, technology stacks will inevitably change. Decoupling the database layer (PostgreSQL, SQLite, IndexedDB) and runtime frameworks (Express, React) from the core retail billing, accounting, and inventory rules ensures the system remains portable and maintainable. This allows replacing frameworks or database layers in the future with zero rewrites to core retail modules.

---

## 3. Scope
- Define Repository Ports (interfaces) for Products, Customers, Shifts, Invoices, and Audits.
- Add the `sync_queue` table to the database schema for crash-safe local-first offline writes queueing.
- Implement the PostgreSQL Adapter for these ports.
- Stub SQLite and IndexedDB Repository Adapters.
- Design and implement the background Synchronization Engine (managing sync queue, transaction conflicts, and incremental updates).
- Restructure the workspace directory layout to enforce clean separation.
- Adapt `server.ts` to boot up as an Express HTTP Adapter that calls the clean repository layer.

---

## 4. Current State
- The backend uses Express endpoints that directly execute SQL pool queries or read/write in-memory global arrays.
- Database logic is mixed with HTTP controllers inside `server.ts`.
- There is no unified synchronization model or database repository boundary.

---

## 5. Gap Analysis
| Current Monolithic Pattern | Target Clean Architecture Pattern |
| :--- | :--- |
| Endpoints in `server.ts` call `pool.query` directly | Endpoints call use cases/services, which interact with Repository Interfaces |
| DB configuration is PostgreSQL-only | DB configuration is injected at boot time (Postgres, SQLite, or IndexedDB) |
| Writes are committed directly to active DB | Writes are recorded to local-first DB and queued in the Sync Engine if offline |
| Imports of `pg` are scattered in routes | `pg` imports are isolated strictly in `src/db/postgres/` |

---

## 6. Architecture Impact
```text
           +---------------------------------------------+
           |                User Interface               |
           |             (React Web / PWA UI)            |
           +----------------------+----------------------+
                                  | (HTTP / RPC)
                                  v
           +----------------------+----------------------+
           |             Infrastructure Adapters         |
           |      (Express Server / API Controllers)     |
           +----------------------+----------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|                       Core Business Logic                         |
|   +-----------------------------------------------------------+   |
|   |                   Application Services                    |   |
|   |          (POS Billing, Inventory Control, Sync Use Cases) |   |
|   +-----------------------------+-----------------------------+   |
|                                 |                                 |
|                                 v                                 |
|   +-----------------------------+-----------------------------+   |
|   |                      Repository Ports                     |   |
|   |   (IProductRepo, ICustomerRepo, IInvoiceRepo, ISyncRepo)  |   |
|   +-----------------------------+-----------------------------+   |
+---------------------------------|---------------------------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------+-----------+                   +-----------+-----------+
| Postgres SQL Adapter  |                   |  SQLite Adapter       |
| (Store Desktop/Server)|                   |  (Android/Mobile DB)  |
+-----------------------+                   +-----------------------+
```

---

## 7. Proposed Design

### A. Repository Ports (`src/core/interfaces/`)
Define interfaces that accept and return clean TypeScript types:
- `IProductRepository`: `getById()`, `getAll()`, `create()`, `update()`, `delete()`, `addBarcode()`, `deleteBarcode()`.
- `ICustomerRepository`: `getById()`, `getAll()`, `updateOutstanding()`.
- `IShiftRepository`: `getById()`, `getOpenShift()`, `create()`, `updateStats()`.
- `ISalesInvoiceRepository`: `create()`, `getById()`, `getAll()`.
- `IAuditRepository`: `log()`, `getAll()`.

### B. Core Business Services / Use Cases
- `BillingService`: Coordinates inventory checks, price calculations, shift increments, ledger updates, and repository writes.
- `SyncService`: Manages a synchronized state ledger, offline write queues, conflict checks, and connection handlers.

### C. Folder Reorganization
```text
src/
├── core/
│   ├── domain/              ← Pure business models (Product, Customer, Invoice)
│   ├── interfaces/          ← Repository Ports (IProductRepository, etc.)
│   ├── services/            ← Business Use Cases (Billing, Inventory, Sync)
│   └── sync/                ← Resilient Sync Engine logs
├── db/
│   ├── postgres/            ← PostgreSQL Repository Adapter implementations
│   ├── sqlite/              ← SQLite Repository Adapter implementations
│   └── indexeddb/           ← IndexedDB Repository Adapter implementations
├── modules/                 ← Clean boundary configurations
├── bootstrap/               ← Initializer, Seeder, and runtime dependency injection
└── server.ts                ← Express infrastructure adapter (HTTP transport only)
```

---

## 8. Files Created
- `src/core/interfaces/db.ts` — Core repository interfaces.
- `src/core/domain/entities.ts` — Clean entity schemas.
- `src/db/postgres/PostgresRepositories.ts` — PostgreSQL implementation of database ports.
- `src/db/sqlite/SqliteRepositories.ts` — SQLite stub implementations.
- `src/db/indexeddb/IndexedDbRepositories.ts` — IndexedDB stub implementations.
- `src/core/sync/SyncEngine.ts` — Offline-first local-first write queue and reconciliation loops.
- `src/bootstrap/di.ts` — Bootstrapper injecting repositories into Express handlers at startup.

---

## 9. Files Modified
- `server.ts` — Refactored to act strictly as an Express HTTP Adapter, delegating logic to DI container and repositories.

---

## 10. Dependencies
- No new runtime dependencies. Uses current packages (`pg`, `dotenv`).

---

## 11. Risks
- **Data Desync:** Interrupted network sync can result in checkout updates failing to propagate.
  - *Mitigation:* The sync queue must use incremental timestamps and optimistic version locking on all records.
- **Boot Overheads:** Instantiating all repositories dynamically.
  - *Mitigation:* Use simple dependency-injection functions on server bootstrap, keeping initialization latency `<15ms`.

---

## 12. Rollback Strategy
Revert files to the last git state using `git checkout -- .` and clean out the new `src/core/` and `src/db/` subfolders.

---

## 13. Verification Plan
- Run `npm run lint` to assert compilation.
- Ensure backend startup successfully binds to PostgreSQL or falls back to stubs depending on configuration variables.

---

## 14. Test Plan
- Run POS checkout offline simulator (by temporarily disconnecting database mock) ➔ Check if invoice is written to local sync queue and safely reconciled once database connectivity is restored.

---

## 15. Documentation Impact
- Update `docs/developer_guide/DEVELOPER_GUIDE.md` to document Hexagonal clean structure and repositories mapping.
- Update consolidated plans and walkthrough index.

---

## 16. Deployment Plan
Commit files to development workspace `D:\Smriti_Retail_OS` and push to test environment.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- None.

---

## 19. Related Walkthroughs
- [Clean Architecture & Sync Engine Walkthrough](../../walkthrough/foundation/Clean_Architecture_And_Offline_First_Walkthrough_v3.0.0.md)
