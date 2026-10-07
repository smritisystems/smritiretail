<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-07
  Modified     : 2026-10-07
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan — SMRITI DataBridge Phase 10
-->

# Implementation Plan: SMRITI Transaction DataBridge Phase 10 — Real-Time WebSocket Streaming & Progress Telemetry Server

## 1. Objective
Establish an enterprise-grade real-time streaming communication channel for the SMRITI Transaction DataBridge using WebSockets (`/api/v1/databridge/ws/progress/{job_id}`). Deliver a tenant-isolated telemetry broadcaster (`DataBridgeBroadcaster`) integrated directly into the transactional outbox asynchronous task engine (`DataBridgeAsyncEngine`), providing sub-second visual progress updates, error notifications, and throughput metrics to client workspaces without HTTP polling overhead.

---

## 2. Business Motivation
High-volume retail imports (catalog migration from Tally/SAP/Shopify exceeding 50,000 to 200,000 rows) take several minutes to chunk, validate, and commit. Relying on HTTP polling (`GET /async/status/{job_id}` every 2 seconds):
1. Creates unnecessary network churn and database query overhead on high-concurrency multi-tenant clusters.
2. Introduces 1–2 second latency lag between chunk completion and UI progress visualization.
3. Provides no streaming capability for live logs or immediate failure alerts.
WebSockets establish a persistent, bidirectional, full-duplex socket delivering instantaneous updates and smooth 60fps UI progress bar animations.

---

## 3. Scope
1. **Telemetry Broadcaster (`DataBridgeBroadcaster`)**:
   - In-memory subscriber registry mapping `job_id -> Set[WebSocket]`.
   - Thread-safe / async-safe connection registration (`subscribe`) and cleanup (`unsubscribe`).
   - Granular event broadcasting (`broadcast_progress`) sending structured JSON telemetry frames.
   - Heartbeat ping-pong and dead-connection purge handling.
2. **WebSocket Endpoint**:
   - `websocket_endpoint` at `/api/v1/databridge/ws/progress/{job_id}`.
   - Sends immediate current status snapshot on connection.
   - Listens for client ping/close frames.
3. **Async Engine Integration**:
   - Hook broadcast notifications into `DataBridgeAsyncEngine.process_next_chunk` and status transitions (`PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`).
4. **Data Models**:
   - `DataBridgeProgressFrame`: Structured telemetry frame with `job_id`, `status`, `progress_percent`, `processed_rows`, `committed_count`, `error_count`, `current_chunk_index`, `total_chunks`, `elapsed_ms`, `estimated_remaining_ms`, and `timestamp`.
5. **Frontend Client Hook**:
   - React hook `useDataBridgeProgressStream` supporting WebSocket streaming with automatic polling fallback if connection drops.
6. **Zero Database Migrations**:
   - In-memory connection pub/sub layer requiring zero database migrations.

---

## 4. Current State
- Phase 4 provides asynchronous task submission and outbox processing (`DataBridgeAsyncEngine`), but status monitoring requires periodic HTTP polling via `GET /api/v1/databridge/async/status/{job_id}`.

---

## 5. Gap Analysis
| Current State (Phase 4–9) | Target State (Phase 10) |
|---|---|
| HTTP polling every 2,000ms | Real-time WebSocket streaming with <10ms frame latency |
| Multiple redundant GET requests to DB | Push notifications on chunk commit with zero database polling |
| Abrupt progress jumps (e.g. 0% -> 25% -> 50%) | Smooth progress frames per chunk execution |
| Polling failure on network jitter | Automatic socket reconnect with fallback to HTTP polling |

---

## 6. Architecture Impact
```text
Client (React Workspace)
   ▲                   │
   │ WebSocket Frame   │ Subscribes to job_id
   │ (/ws/progress)    ▼
┌──────────────────────────────────────────────┐
│  FastAPI WebSocket Route                     │
│  (/api/v1/databridge/ws/progress/{job_id})   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  DataBridgeBroadcaster (Pub/Sub)             │
│  - Active connections per job_id             │
│  - Heartbeat & disconnect cleanup            │
└──────────────────────▲───────────────────────┘
                       │ broadcast_progress()
┌──────────────────────┴───────────────────────┐
│  DataBridgeAsyncEngine                       │
│  - Chunks commit                             │
│  - Progress telemetry calculated             │
└──────────────────────────────────────────────┘
```

---

## 7. Proposed Design
- Implement `DataBridgeBroadcaster` in `backend/app/services/databridge/broadcaster.py`.
- Define `DataBridgeProgressFrame` in `backend/app/services/databridge/models.py`.
- Mount WebSocket route in `backend/app/api/v1/databridge.py`.
- Wire `broadcast_progress` in `DataBridgeAsyncEngine.process_next_chunk` and `submit_job`.
- Build frontend helper `useDataBridgeProgressStream` in `src/components/databridge/useDataBridgeProgressStream.ts`.

---

## 8. Files Created
1. `backend/app/services/databridge/broadcaster.py`: `DataBridgeBroadcaster` class.
2. `src/components/databridge/useDataBridgeProgressStream.ts`: React WebSocket hook with polling fallback.
3. `backend/tests/test_databridge_phase10_websocket.py`: Comprehensive automated test suite.
4. `docs/implementation/foundation/DataBridge_Phase10_WebSocket_Streaming_Plan_v1.0.0.md`: This document.
5. `docs/walkthrough/foundation/DataBridge_Phase10_WebSocket_Streaming_v1.0.0.md`: WGP Walkthrough.

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added `DataBridgeProgressFrame` Pydantic model.
2. `backend/app/services/databridge/__init__.py`: Exported `DataBridgeBroadcaster` and new models.
3. `backend/app/services/databridge/async_engine.py`: Integrated broadcast invocations on chunk processing.
4. `backend/app/api/v1/databridge.py`: Mounted WebSocket endpoint `/ws/progress/{job_id}`.
5. `docs/implementation/README.md`: Registered Phase 10 implementation plan.
6. `docs/walkthrough/README.md`: Registered Phase 10 walkthrough.
7. `CHANGELOG.md`: Added release notes under `## [6.70.15]`.

---

## 10. Dependencies
- FastAPI native `WebSocket`, `WebSocketDisconnect`.
- Starlette WebSocket protocol handlers.
- asyncio async locks.

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Memory leak from unclosed WebSocket connections | Medium | Explicit `WebSocketDisconnect` handling and weak/guarded set cleanup |
| Client firewall blocking WebSockets | Low | Automatic polling fallback in client hook |
| Reconnection flood on network reconnect | Low | Exponential backoff reconnect strategy |

---

## 12. Rollback Strategy
- The WebSocket endpoint is purely additive. If disabled, client falls back seamlessly to existing HTTP polling (`GET /api/v1/databridge/async/status/{job_id}`).

---

## 13. Verification Plan
1. Automated pytest verifying:
   - WebSocket connection establishment.
   - Initial snapshot transmission.
   - Chunk progress broadcasting.
   - Multiple concurrent subscribers to the same job.
   - Graceful client disconnect.
   - Job completion frame broadcast.
2. Full regression suite across Phases 1 through 10.
3. Architecture CI duplication gate (11/11 green).
4. TypeScript compiler (`npm run lint` / `tsc --noEmit`).

---

## 14. Test Plan
- `test_tc_ws_001_broadcaster_subscribe_unsubscribe`: Broadcaster subscription management.
- `test_tc_ws_002_broadcaster_broadcast_progress`: Telemetry frame formatting and dispatch.
- `test_tc_ws_003_websocket_initial_snapshot`: Connection snapshot receipt.
- `test_tc_ws_004_websocket_live_chunk_streaming`: Streaming frames across multiple chunks.
- `test_tc_ws_005_websocket_client_disconnect_cleanup`: Proper subscriber pruning on disconnect.
- `test_tc_ws_006_websocket_multiple_clients_same_job`: Fan-out broadcasting to multiple clients.
- `test_tc_ws_007_websocket_job_completion_frame`: Final completion frame signaling.

---

## 15. Documentation Impact
- Implementation Plan: `docs/implementation/foundation/DataBridge_Phase10_WebSocket_Streaming_Plan_v1.0.0.md`.
- Implementation Index: `docs/implementation/README.md`.
- Walkthrough: `docs/walkthrough/foundation/DataBridge_Phase10_WebSocket_Streaming_v1.0.0.md`.
- Walkthrough Index: `docs/walkthrough/README.md`.
- CHANGELOG: `CHANGELOG.md` under `[6.70.15]`.

---

## 16. Deployment Plan
1. Add `DataBridgeProgressFrame` to `models.py`.
2. Implement `DataBridgeBroadcaster` in `broadcaster.py`.
3. Export in `__init__.py`.
4. Integrate broadcast calls in `async_engine.py`.
5. Mount WebSocket route in `databridge.py`.
6. Implement frontend hook `useDataBridgeProgressStream.ts`.
7. Execute test suite and CI gates.
8. Commit and push to GitHub `smritiNX`.

---

## 17. Status
**Completed**

---

## 18. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-004`: Tenant Isolation & Multi-Tenancy Architecture.
- `ADR-DATABRIDGE-01`: Universal Multi-Source DataBridge Architecture.

---

## 19. Related Walkthroughs
- `DataBridge_Phase4_Async_Queue_v1.0.0.md`
- `DataBridge_Phase9_Scheduler_Webhook_v1.0.0.md`
