<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-03
  Classification: Architecture Manifest
-->

# SMRITI Inventory Kernel v1.0.0 — Platform Manifest

**Status:** FROZEN & ARCHITECTURALLY CLOSED — v1.0.0 Manifest  
**Date:** 2026-08-03  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect)  
**Target Environment:** Docker PostgreSQL Engine (`smriti-db` / `smriti-api`)

---

## 1. Engine Index (Level 1 Engines)

| Engine ID | Engine Name | Responsibility | Module Location |
|---|---|---|---|
| **ILGE** | **Inventory Ledger Engine** | Single balance mutator & append-only physical stock ledger. | [ilg_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/inventory/ilg_engine.py) |
| **ITEX** | **Inventory Transaction Engine** | Atomic multi-item movement execution pipeline & profile mapping. | [itex_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/inventory/itex_engine.py) |
| **ILE** | **Stock Location Engine** | Location graph hierarchy & node capabilities. | [location_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/inventory/location_engine.py) |
| **ILE-Lock** | **Inventory Lock Engine** | Multi-scope operational stock locks (`CYCLE_COUNT`, `AUDIT`, `RECALL`). | [lock_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/inventory/locks/lock_engine.py) |
| **IDM** | **Platform Idempotency Service** | Platform-wide request hash deduplication & replay protection. | [idempotency_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/inventory/idempotency/idempotency_service.py) |
| **TLE** | **Timeline Engine** | Unified filter-based event projection across SKU, Batch, Serial, Location. | [timeline_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/inventory/timeline/timeline_service.py) |
| **CKP** | **Inventory Checkpoint Engine** | Certified recovery point checkpoints for fast balance replay. | [checkpoint_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/inventory/checkpoint/checkpoint_engine.py) |

---

## 2. Public SDK Surface (`IKSDK v1.0.0`)

### Command Facade (`InventoryCommandFacade`)
- `move_inventory()`
- `issue_sale()`
- `return_sale()`
- `receive_purchase()`
- `return_purchase()`
- `issue_pos_sale()`
- `adjust_stock()`
- `transfer_out()`
- `transfer_in()`
- `reserve_stock()`
- `release_reservation()`
- `acquire_lock()`
- `release_lock()`
- `create_checkpoint()`

### Query Facade (`InventoryQueryFacade`)
- `get_canonical_state()`
- `get_stock()`
- `get_available()` (ATP = On Hand - Reserved - Locked)
- `get_network_stock()`
- `get_projected_stock()`
- `can_fulfill()`
- `get_timeline()`
- `get_latest_checkpoint()`
- `fast_replay_balance()`

---

## 3. Public Documents & Events

| Type | Identifier | Schema / Handler |
|---|---|---|
| **Document Profile** | `DocumentPostingProfileRecord` | Pre-seeded with 10 standard enterprise profiles (`GRN-INBOUND`, `SALE-OUTBOUND`, `POS-OUTBOUND`, `TRANSFER-OUTBOUND`, `ADJUSTMENT`, etc.) |
| **Domain Event** | `GoodsIssued.v1` | Published on physical stock dispatch |
| **Domain Event** | `GoodsReceived.v1` | Published on physical stock receipt |
| **Domain Event** | `StockReserved.v1` | Published on ATP commercial reservation |

---

## 4. Certification Gates (16 Executable Gates)

| Gate ID | Scope | Verification Requirement |
|---|---|---|
| **IK001–IK009** | Core Architecture | Facade entry, Single balance mutator, Derived ATP, Network aggregation, Replay determinism, Snapshot integrity. |
| **IK010** | Locks | Multi-scope lock acquisition, release & ATP exclusion. |
| **IK011** | Idempotency | Platform-wide request hash deduplication & cached response return. |
| **IK012** | Timeline | Chronological event stream ordering & filter accuracy. |
| **IK013** | Concurrency | Duplicate request retry safety & balance versioning. |
| **IK014** | Checkpoints | Fast-replay starting from certified recovery checkpoint. |
| **IK015** | Lock Lifecycle | Lock release re-evaluation & ATP restoration. |
| **IK016** | Failure Recovery | Cross-domain crash & retry recovery integrity. |

---

## 5. Immutable Governance Rules
1. **Rule LIM-006 (Ledger Immutability Rule)**: `inventory_ledger_entries` is strictly append-only. DB triggers block `UPDATE` and `DELETE`.
2. **Rule 2 (Single Balance Mutator Rule)**: Only `ILGE` creates ledger entries. Direct `UPDATE products SET stock` by business modules is prohibited.
3. **Inventory Kernel Closure Rule**: Inventory Kernel v1.x is closed. No new engines, core layers, or breaking SDK changes permitted.
