<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Classification: Architecture Decision Record — DRAFT (NOT COMMITTED TO DB)
Created      : 2026-09-03
-->

# ADR-WMS-002-DRAFT: Wave Picking Capability Split — Planning vs Execution

**Status:** DRAFT — not inserted into `smritisys.architecture_decisions` until approved  
**Domain:** `wms`  
**Date:** 2026-09-03  
**Author:** Jawahar Ramkripal Mallah  

---

## Context

The original governance registration (`warehouse.wave_picking`) conflated two distinct operational phases into a single capability entry, and mapped them to the wrong entity (`stock_movement`).

### Phase 1: Wave Planning
**Component:** `WavePickingStudioModal.tsx`  
**Engine:** `wavePickingOptimiser.ts` (zone and bin optimisation algorithm)  
**Input:** Order IDs, zones, picker assignments  
**Output:** WavePickList — a planned batch of items to be picked, sorted by zone  
**Nature:** LOCAL_ENGINE — pure algorithmic computation, no backend API call  

### Phase 2: Wave Execution
**Component:** `WarehouseWavePickingModal.tsx`  
**Engine:** None (RFID scanner interaction, no algorithmic optimizer)  
**Input:** waveId, RFID bin tag scans, SKU verifications  
**Output:** PickedWave — a completed physical picking record  
**Nature:** LOCAL_EXECUTION — UI state management only, no engine, no API  

These are not the same capability. They differ in:
- Component, file, engine, input/output contract
- Whether an optimizer engine is involved
- Whether the operation is planning (pre-pick) or execution (during-pick)

## Decision

Split `warehouse.wave_picking` into two distinct capabilities:

| Capability | Entity | integration_type | backend_api_status |
|---|---|---|---|
| `warehouse.wave_planning` | `warehouse` | `LOCAL_ENGINE` | `NONE` |
| `warehouse.wave_execution` | `warehouse` | `LOCAL_EXECUTION` | `NONE` |

Both belong to the `warehouse` entity (not `stock_movement`). Wave operations are warehouse-scoped, not stock-ledger-scoped.

## Deferred Decision: `pick_wave` Entity

A `pick_waves` database table does not yet exist. When the WMS picks module is fully implemented, a `pick_wave` entity should be registered as the canonical wave document. At that point, these capabilities should be re-pointed from `warehouse` → `pick_wave`. Until then, `warehouse` serves as the correct proxy entity.

## Implementation Status

- `warehouse.wave_picking` has been renamed to `warehouse.wave_planning` and its entity corrected to `warehouse` (v1395, 2026-09-03).
- `warehouse.wave_execution` has been inserted as a new capability (v1395, 2026-09-03).
- No `pick_wave` entity or table has been created — this is deferred.

## Consequences

- The governance registry no longer has a single `wave_picking` capability that conflates planning and execution.
- `wavePickingOptimiser.ts` is correctly identified as the planning engine.
- `WarehouseWavePickingModal.tsx` is correctly identified as LOCAL_EXECUTION (no engine).
- When a `pick_waves` table is implemented, a single migration and data correction can re-point these capabilities.

## Related ADRs

- ADR-WMS-001 (warehouse entity registration)
