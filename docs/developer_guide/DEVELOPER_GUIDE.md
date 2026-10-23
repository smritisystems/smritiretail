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

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Author     : Jawahar Ramkripal Mallah
  * Designation: Chief Systems Architect & Creator
  * Email      : support@smritibooks.com
  * Version    : 6.99.1
  * Created    : 2026-07-11
  * Modified   : 2026-10-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Developer & Architecture Guide

Welcome to the SMRITI developer setup and reference guide. This document details the Clean Architecture rules, swappable database interfaces, and background synchronization engines powering SMRITI Retail OS.

## Shell navigation and workspace context — updated 2026-10-24

- `AppShell` owns the mobile navigation drawer and keeps the current module tree mounted when the presentation style changes.
- `GlobalHeader` is the shared entry point for workspace style, company and branch context, global search, notifications, and account actions. User identity is passed from the authenticated app state; missing identity uses a generic account label.
- `CompanySelector` reads the current persisted tenant and branch context, refreshes its selection after tenant context events, and only commits a switch after a successful response from the context-switch service.
- `EnterpriseMenuBar` measures its available header container with `ResizeObserver` and moves additional menu groups under **More**. The Regular contextual rail and Classic menu still use separate navigation definitions; a shared permission-aware source has not been established.
- `UxSwitcherModal` is a keyboard-operable dialog with focus trapping, Escape dismissal, and focus restoration. Changing styles leaves the active module selected.
- `WorkspaceStatusBar` reads current persisted tenant labels and reports browser network availability. It does not claim to verify an application or session connection.
- `useOptionalNotifications` lets the header render without a notification provider. The store has no seeded sample notices; it displays notifications added during the current provider session.

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

---

## Sales Channels & Party Stock Visibility (PSV) Architecture

### 1. Canonical Sales Channel Governance
Sales channels are defined centrally in `backend/app/core/sales_channels.py`:
- `MODERN_TRADE`: `requires_store_location = True`
- `GENERAL_TRADE`, `B2B_WHOLESALE`, `POS_RETAIL`, `ECOMMERCE`: `requires_store_location = False`

The capabilities can be inspected via `GET /api/v1/sales/channel-capabilities` and overridden per tenant via the SMRITI System Parameters engine (`sys_parameters`).

### 2. Idempotent PSV Store Account Resolution
`PSVProjectionService.resolve_or_create_store_psv_party` (`backend/app/services/psv_projection.py`):
- Resolves an active `CustomerDeliveryLocation` by ID.
- Enforces multi-tenant isolation (`location.company_id == company_id`).
- Verifies customer ownership (`location.customer_id == customer_id`).
- Verifies location active state (`is_active=True` and `is_deleted=False`).
- Queries existing `PSVParty` by `delivery_location_id` or `(host_customer_id, store_code)`.
- If an unlinked party exists, auto-links `delivery_location_id`.
- If no party exists, creates one inside a nested transaction savepoint (`session.begin_nested()`), gracefully handling `IntegrityError` in race conditions.
- Strictly adheres to the **Shadow-Only Invariant**: 0 entries are written to `stock_movements`.

### 3. Database Integrity & Partial Unique Indexes
Multi-tenant uniqueness on `psv_parties` is enforced via Alembic migration `v1535`:
- `uq_psv_parties_company_deliv_loc`: `UNIQUE (company_id, delivery_location_id) WHERE (delivery_location_id IS NOT NULL)`
- `uq_psv_parties_company_cust_store`: `UNIQUE (company_id, host_customer_id, store_code) WHERE (host_customer_id IS NOT NULL AND store_code IS NOT NULL)`

