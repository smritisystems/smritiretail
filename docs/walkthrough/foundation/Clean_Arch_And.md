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

  * Version    : 3.0.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Walkthrough: Clean Architecture & Offline-First Sync Engine — v3.0.0

## 1. Purpose
This walkthrough documents the implementation of the Ports and Adapters (Hexagonal) clean architecture layout and the background database-backed Synchronization Engine for SMRITI Retail OS. These changes separate core retail business workflows from database-specific drivers and HTTP web frameworks.

---

## 2. Scope
- Define domain data structures and repository interfaces (Ports).
- Add the `sync_queue` table to the database schema for crash-safe local-first offline writes queueing.
- Implement Postgres Repository Adapters conforming to repository ports.
- Stub SQLite Repository Adapters for Android/Mobile targets.
- Stub IndexedDB Repository Adapters for Web/PWA targets.
- Build the background Sync Engine polling mechanism with retry logic.
- Build the Bootstrap DI Container mapping active providers.
- Move POS billing checkout business logic into a pure use-case service (`BillingService.ts`).
- Refactor Express routes inside `server.ts` to call repository ports.

---

## 3. Files Created
| File Path | Description |
| :--- | :--- |
| `src/core/domain/entities.ts` | Clean domain entities (Product, Customer, Invoice, Shift, Sync Queue) |
| `src/core/interfaces/db.ts` | Repository Ports definitions for all entities |
| `src/core/services/BillingService.ts` | Billing use-case class encapsulating POS checkout business rules |
| `src/core/sync/SyncEngine.ts` | Background polling sync coordinator with retry handling |
| `src/bootstrap/di.ts` | Platform Abstraction Layer DI Bootstrapper mapping repositories |
| `src/db/postgres/PostgresRepositories.ts` | PostgreSQL implementation of database ports |
| `src/db/sqlite/SqliteRepositories.ts` | SQLite stub repositories for Android |
| `src/db/indexeddb/IndexedDbRepositories.ts` | IndexedDB stub repositories for Web/PWA |

---

## 4. Files Modified
| File Path | Description |
| :--- | :--- |
| `src/db/schema.sql` | Added `sync_queue` table and its status lookup index |
| `server.ts` | Refactored products and checkout controllers to delegate to repositories and BillingService via DI container |

---

## 5. Architecture Decisions
- **Clean Architecture Isolation:** Business modules (POS, Billing, Inventory) now interact strictly with Interface Ports (`IProductRepository`, etc.) rather than calling `pool.query` or Express REST elements directly.
- **Crash-Resilient Database Queue:** Enforcing SQL table persistence (`sync_queue`) rather than in-memory queues prevents queued mutations from being deleted during power failures or server restarts.
- **Unified Boot DI Container:** Instantiates active repository implementations at startup using the `DATABASE_PROVIDER` configuration variable.

---

## 6. Design Rationale
Decoupling application code from database APIs ensures that SMRITI Retail OS can run on different platforms (Windows Server with Postgres, Android Tablet with SQLite, and Web PWA with IndexedDB) using the exact same billing, discounts, and inventory deduction business logic.

---

## 7. Implementation Summary
1. **Domain & Interfaces:** Defined clean TypeScript models and database transaction signatures.
2. **Postgres Repositories:** Mapped pg connection calls to repository interfaces.
3. **Billing Service Use Case:** Relocated tax, discount, coupon, and shift calculation engines into `BillingService.ts`.
4. **Sync Engine:** Integrated poll processor that dequeues and replicates mutations, handling offline failure retry rates.
5. **Express Adaptation:** Refactored REST routes in `server.ts` to act as pure delivery transport layers calling DI containers.

---

## 8. Tests Executed
```
Command: npm run lint
Output:
> smriti-retail-os@2.1.1 lint
> tsc --noEmit

(Exit code 0 — zero errors)
```

---

## 9. Verification Results
- **TypeScript compilation:** Verified clean build (zero errors).
- **Core Decoupling:** Checked that domain entities and use-cases have no database imports (`pg` or query pools).
- **Database Seeding Compatibility:** Schema migrator successfully runs the appended `sync_queue` table DDL.

---

## 10. Known Limitations
- The SQLite and IndexedDB repository classes are currently stubs, ready for target-specific platform bindings.
- Event PubSub triggers are in-memory; for cluster deployment, this will require a Redis/RabbitMQ message adapter.

---

## 11. Future Work
- Implement the actual SQLite database driver binding for Android client builds.
- Refactor remaining modules (Quotations, Purchase Orders, Reports) to call repositories.

---

## 12. Related ADRs
- None.

---

## 13. Related RFCs
- SMRITI Clean Architecture Implementation Plan (`Clean_Architecture_And_Offline_First_Plan_v3.0.0.md`).
