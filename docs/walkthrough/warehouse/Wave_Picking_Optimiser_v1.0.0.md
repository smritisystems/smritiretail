<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.100.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Warehouse Wave Picking Optimiser (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Wave Picking Optimiser — a warehouse task management engine that creates batch pick waves from open order lines, assigns tasks to pickers by zone preference, optimises pick paths using a serpentine-routing sort key, records pick results (PICKED / SHORTED / SKIPPED), and computes per-wave metrics including completion rate, short rate, and picker utilisation.

## 2. Scope
- `WavePickingOptimiser` covering wave creation, task assignment, path optimisation, pick recording, and metrics computation.
- `WavePickingStudioModal` with task queue (zone/picker filter), per-picker progress panel, full/short pick action buttons, and metrics dashboard.
- 6 zones (A–F), serpentine aisle traversal, round-robin picker assignment with zone preference.
- 4 pick task statuses: PENDING, PICKED, SHORTED, SKIPPED.

## 3. Files Created
- `src/utils/wavePickingOptimiser.ts`
- `src/components/warehouse/WavePickingStudioModal.tsx`
- `src/tests/wavePickingOptimiser.test.ts`
- `docs/walkthrough/warehouse/Wave_Picking_Optimiser_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Serpentine sort key as single integer**: `zoneIdx × 100000 + aisle × 1000 + bayKey × 10 + level` — encodes full warehouse coordinates into a single comparable integer. Odd-aisle bays sort ascending (1→10); even-aisle bays sort descending (10→1), producing a serpentine path that eliminates backtracking.
2. **Zone-preference picker assignment**: Pickers with `currentZone` matching a task's zone are pooled separately; only if no zone-matched picker exists does the system fall back to all available pickers — minimising inter-zone travel.
3. **Round-robin within zone pool**: Distributes tasks evenly across zone-matched pickers, preventing one picker from being overloaded when multiple zone-matched pickers exist.
4. **Auto-SHORTED on partial pick**: `recordPick()` computes `shortQty = requestedQty - pickedQty` automatically; status becomes `SHORTED` when `0 < pickedQty < requestedQty` and `SKIPPED` when `pickedQty === 0`.
5. **Wave auto-completion**: After each `recordPick()`, the engine checks if all tasks are in a terminal state (PICKED / SHORTED / SKIPPED) and sets `status = "COMPLETED"` and `completedAt` automatically.

## 6. Design Rationale
Warehouse pickers spend 60–70% of their time walking. The serpentine sort key eliminates the most common inefficiency — backtracking across aisles — with a zero-overhead sort that works entirely in-memory. Zone preference further reduces inter-zone travel, which in garment warehouses with heavy/bulky stock represents a significant time cost.

## 7. Implementation Summary
- `createWave()`: Builds `PickTask[]` from order lines, computes `serpentineKey()` per task, sets all tasks to `PENDING`.
- `assignTasks()`: Groups tasks by zone, builds zone-preference picker pools, round-robin assigns `pickerId` per task, sets wave to `IN_PROGRESS`.
- `optimisePath()`: Returns a picker's zone tasks sorted by `sortKey` ascending — the actual walk sequence.
- `recordPick()`: Updates `pickedQty`, `shortQty`, `status`, `pickedAt`; recounts completed/shorted tasks; auto-completes wave.
- `computeMetrics()`: Aggregates counts, rates, unit totals, picker utilisation map, avgTasksPerPicker.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/wavePickingOptimiser.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 72/72 test files, 460/460 tests green in 12.02s, exit code 0.

## 10. Known Limitations
- Sort key assumes max 20 aisles, 10 bays, 5 levels per zone — sufficient for standard garment warehouse layouts; adjust constants for larger facilities.
- Multi-wave concurrency (two simultaneous waves for the same branch) is not guarded; production adds a Postgres `wave_lock` or status check at wave creation.
- `waveCounter` is a static class variable — resets on module reload in tests; production uses Postgres sequence for `waveNo`.

## 11. Future Work
- FastAPI `POST /api/v1/waves/`, `PUT /api/v1/waves/{id}/tasks/{taskId}/pick` backed by Postgres `pick_waves` and `pick_tasks` tables.
- RF scanner / mobile app integration: picker receives task list via WebSocket push on wave assignment.
- Auto-suggest reorder for SHORTED lines back to procurement module.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-034`: Warehouse Wave Picking Architecture, Serpentine Path Optimisation, and Picker Assignment Policy.

## 13. Related RFCs
- `RFC-103`: Wave Picking Batch Size Policy, Zone Configuration, and Short-Pick Escalation Workflow.
