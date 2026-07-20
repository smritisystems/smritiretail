<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.3.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — High-Speed Billing Terminal & Offline Queue Engine (v4.3.0)

## 1. Objective
To implement **v4.3.0 — High-Speed Billing Terminal & Offline Queue Engine**, delivering an ultra-fast checkout flow (< 10 seconds) with client-side offline invoice queue persistence and seamless background synchronization to the FastAPI + PostgreSQL system of record upon network restoration.

## 2. Business Motivation
Retail checkout counters cannot afford downtime or sluggish network delays during peak billing hours. An offline billing queue ensures 100% counter uptime even during internet outages.

## 3. Scope
- **Backend Sync Engine**:
  - `OfflineSyncService` in `backend/app/services/offline_sync_service.py` to process batch offline invoices, prevent duplicate numbers, validate inventory stock levels, and issue sales receipts.
  - FastAPI router `/api/v1/pos/offline-sync` in `backend/app/api/v1/offline_sync.py`.
- **Frontend Queue**:
  - `src/layout_engine/offline_pos_queue.ts` managing client-side offline invoice queuing, automatic online status detection, and background sync retry.
- **Automated Test Suite**:
  - `backend/app/tests/test_v4_3_offline_pos_sync.py`.

## 4. Current State
v4.0—v4.2 established the SAEF adaptive workspace modes and Screen Studio layout customizer. v4.3.0 introduces high-speed offline resilience to POS billing operations.

## 5. Gap Analysis
Currently, billing requires an active connection to the backend REST API. If the network drops, counter sales stop. The offline queue eliminates network dependency.

## 6. Architecture Impact
```text
POS Checkout Terminal (Cashier)
             │
             ├── [Network Online]  ──> FastAPI /api/v1/sales/invoices
             │
             └── [Network Offline] ──> Local Offline Queue (storage)
                                                 │
                                                 ▼ (Background Re-connect)
                                        FastAPI /api/v1/pos/offline-sync
                                                 │
                                                 ▼
                                        PostgreSQL DB System-of-Record
```

## 7. Proposed Design
1. **Offline POS Queue (`src/layout_engine/offline_pos_queue.ts`)**: In-memory and local storage queue that captures offline transactions with client UUIDs.
2. **Offline Sync Router (`backend/app/api/v1/offline_sync.py`)**: Accepts array of offline invoices, deduplicates by client UUID, and executes atomic stock movements.

## 8. Files Created
- [NEW] [offline_sync_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/offline_sync_service.py)
- [NEW] [offline_sync.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/offline_sync.py)
- [NEW] [offline_pos_queue.ts](file:///f:/SMRITRretailNXmgrt/src/layout_engine/offline_pos_queue.ts)
- [NEW] [test_v4_3_offline_pos_sync.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_v4_3_offline_pos_sync.py)
- [NEW] [v4_3_High_Speed_Billing_And_Offline_Sync_Plan.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/v4_3_High_Speed_Billing_And_Offline_Sync_Plan.md)

## 9. Files Modified
- [MODIFY] [backend/app/api/v1/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/__init__.py)
- [MODIFY] [backend/app/main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py)
- [MODIFY] [docs/implementation/README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)
- [MODIFY] [docs/walkthrough/README.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, LocalStorage / IndexedDB API.

## 11. Risks
Duplicate invoice generation during client reconnects. Mitigation: Idempotency keys based on client-generated UUIDs.

## 12. Rollback Strategy
Fallback to direct online sync mode if offline storage fails.

## 13. Verification Plan
Run automated pytest suite verifying batch offline invoice submission, deduplication, and sales stock deduction.

## 14. Test Plan
Run `python -m pytest app/tests/test_v4_3_offline_pos_sync.py -v`.

## 15. Documentation Impact
Update master implementation index, walkthrough index, and produce v4.3.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `v4_0_Master_Architecture_Assessment_And_Evolution_Walkthrough.md`
