<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.73.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: ProPOS Offline-First Sync Engine & Edge Resiliency (v1.0.0-GA)

## 1. Objective
Establish an edge-resilient, offline-first point-of-sale synchronization engine for ProPOS client terminals, enabling continuous offline checkout, local transaction queuing, and automated upstream synchronization with the FastAPI + Postgres backend.

## 2. Business Motivation
Retail checkout lanes cannot stop due to temporary internet interruptions or WAN degradation. ProPOS cashiers must continue processing transactions offline without loss of data, while ensuring strict financial invariants, price preservation, and duplicate prevention when connectivity resumes.

## 3. Scope
- Edge client queue management (`ProPosOfflineSyncEngine`).
- Client transaction UUID generator (`tx-pos-{terminal}-{timestamp}-{rand}`).
- Batch sync dispatching to `/api/v1/sync/push`.
- Handling of server conflict classifications: `ACCEPTED`, `ACCEPTED_WARN`, `DEDUPLICATED`, `NEEDS_REVIEW`, `REJECTED`.
- Background auto-sync worker listening to browser online/offline network events.

## 4. Current State
The backend conflict resolution engine (`OfflineConflictResolutionEngine`) and transactional queue were defined on FastAPI (`/api/v1/sync/*`), but the browser-side client engine and queue orchestrator were incomplete.

## 5. Gap Analysis
- Missing client queue interface with state tracking (`QUEUED`, `SYNCING`, `SYNCED`, `NEEDS_REVIEW`, `REJECTED`, `FAILED`).
- Missing automatic network reconnection listener and batch flush worker.

## 6. Architecture Impact
- Enforces Rule 1 & Rule 2: Client terminals communicate exclusively via `apiFetchV1` (`/api/v1/sync/push`) to the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌─────────────────────────────────────────────────────────────┐
│                 PROPOS EDGE CLIENT TERMINAL                 │
├─────────────────────────────────────────────────────────────┤
│  1. Cashier Checkout -> Offline Transaction Payload         │
│  2. queueOfflineSale() -> Edge Queue (Local Storage)        │
│  3. AutoSync Worker -> Checks navigator.onLine              │
│  4. flushSyncBatch() -> POST /api/v1/sync/push              │
│  5. Status Update -> SYNCED / NEEDS_REVIEW / FAILED         │
└─────────────────────────────────────────────────────────────┘
```

## 8. Files Created
- `src/sync/ProPosOfflineSyncEngine.ts`
- `src/tests/proposOfflineSync.test.ts`
- `docs/implementation/pos/ProPOS_Offline_First_Sync_Engine_v1.0.0.md`
- `docs/walkthrough/pos/ProPOS_Offline_First_Sync_Engine_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Vitest 4.1+
- TypeScript 5.6+

## 11. Risks
- *Risk:* Network drop during middle of batch upload.
  *Mitigation:* Idempotency keys (`client_tx_uuid`) ensure safe retries with zero duplicate sales invoice records.

## 12. Rollback Strategy
Modular client service that can be deactivated or bypassed without altering transactional billing components.

## 13. Verification Plan
- Unit tests verifying UUID generation, queuing, batch flushing, conflict response parsing, and error recovery.
- Full Vitest suite pass rate (`352/352 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update Developer Guide for offline POS operations.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`352/352 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-019`: Offline-First POS Edge Synchronization Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/pos/ProPOS_Offline_First_Sync_Engine_v1.0.0.md`.
