# SMRITI Retail OS — Inventory Kernel v1.0
## Architecture Specification (FROZEN — RC2)

**Status:** FROZEN  
**Version:** 1.0  
**Date:** 2026-08-02  
**Owner:** Chief Systems Architect — Jawahar Ramkripal Mallah  
**Classification:** Internal

---

> [!IMPORTANT]
> **Platform Rule #1 — Immutable Stock Pipeline**
> No engine may update `products.stock` directly except through the
> Inventory State reconciliation pipeline (`trg_inventory_state_reconciliation`).
> Any code path that updates `products.stock` directly is a critical architectural
> violation. All changes to physical on-hand stock flow through the DB trigger.

> [!IMPORTANT]
> **Platform Rule #2 — Migration-Only Trigger Evolution**
> The Inventory State reconciliation trigger (`trg_inventory_state_reconciliation`)
> and its function (`inventory_state_reconciliation_trigger()`) may only be modified
> via Alembic migrations.
> `fix_stock_trigger.py` is an emergency recovery tool only, never a development workflow step.

---

## Engine Hierarchy

```
Inventory State Engine         (canonical state surface — products.stock, reserved_stock)
        ▲
        │ consumes
        ├── Trace Engine           (immutable movement log — stock_movements)
        ├── Timeline Engine        (temporal state view — by date range)
        ├── Availability Engine    (can_fulfill check — available qty)
        └── Reservation Engine     (soft/hard reserve — reserved_stock column)

Movement Registry              (behavior metadata — movement_taxonomy.py)
        ▲
        └── MovementProvider (ABC)
                ├── CoreMovementProvider   (RC2 frozen standard taxonomy)
                ├── MedicalMovementProvider  (SDK — RC3+)
                ├── JewelleryMovementProvider (SDK — RC3+)
                └── FootwearMovementProvider  (SDK — RC3+)

DB Trigger                     (trg_inventory_state_reconciliation)
        ▲
        └── inventory_state_reconciliation_trigger()
                └── Reads stock_movements INSERT/UPDATE/DELETE
                └── Writes products.stock ONLY
```

---

## State Equations (FROZEN)

### Physical On Hand

```
On Hand  =  Opening
         +  Receipts (PURCHASE, PURCHASE_RETURN, SALE_RETURN, IN, RETURN, PRODUCTION, TRANSFER_IN)
         -  Issues   (SALE, SALE_RETURN, OUT, TRANSFER_OUT, TRANSFER)
         ±  Adjustments (ADJUSTMENT — signed quantity)
```

> On Hand is maintained exclusively by `trg_inventory_state_reconciliation`.
> No Python service may write to `products.stock` directly.

### Available

```
Available  =  On Hand
           -  Reserved
           -  In Transit
           -  Marketplace Reserved
           -  Blocked
           -  Quality Hold
           -  Damaged
           -  Repair
           -  Return Pending
           -  Consignment Out

           (floored at zero — Available ≥ 0 always)
```

### Reservable

```
Reservable  =  Available
```

> Reservations are **business state**, not inventory state.
> Reserved stock is deducted from Available but does not change On Hand.

---

## Canonical State Fields

All UI components and APIs must consume these canonical fields from the
Inventory State Engine. UI must never independently recalculate these values.

| Field                 | Type    | Description                                              |
|-----------------------|---------|----------------------------------------------------------|
| `on_hand`             | decimal | Physical quantity present in warehouse                   |
| `available`           | decimal | On Hand minus all holds (see equation above)             |
| `reserved`            | decimal | Soft-reserved against Sales Orders / quotations          |
| `allocated`           | decimal | Hard-allocated to pick tasks / shipments                 |
| `in_transit`          | decimal | Goods dispatched but not yet received at destination     |
| `consignment_out`     | decimal | Stock placed on consignment with external parties        |
| `consignment_in`      | decimal | Consignment stock received (not yet owned)               |
| `marketplace_reserved`| decimal | Channel-locked stock on marketplace platforms            |
| `blocked`             | decimal | Blocked / on administrative hold                         |
| `damaged`             | decimal | Damaged stock pending write-off or repair                |
| `repair`              | decimal | Stock under repair / refurbishment                       |
| `quality_hold`        | decimal | Stock pending QC inspection                              |
| `return_pending`      | decimal | Customer returns received, awaiting processing           |

---

## Movement Taxonomy (FROZEN — RC2)

### Physical Movements — affect `products.stock` (On Hand)

| movement_type    | direction | affects_physical | affects_reservation | affects_transit | affects_inv_value | Notes                              |
|------------------|:---------:|:----------------:|:-------------------:|:---------------:|:-----------------:|------------------------------------|
| PURCHASE         |    +1     |        ✅         |          ❌          |        ❌        |        ✅          | GRN from supplier                  |
| PURCHASE_RETURN  |    -1     |        ✅         |          ❌          |        ❌        |        ✅          | Return to supplier                 |
| SALE             |    -1     |        ✅         |          ❌          |        ❌        |        ✅          | Sales Invoice / POS issue          |
| SALE_RETURN      |    +1     |        ✅         |          ❌          |        ❌        |        ✅          | Customer return received           |
| TRANSFER_OUT     |    -1     |        ✅         |          ❌          |        ✅        |        ❌          | Dispatched for inter-branch xfer   |
| TRANSFER_IN      |    +1     |        ✅         |          ❌          |        ✅        |        ❌          | Received from inter-branch xfer    |
| ADJUSTMENT       |   ±1*     |        ✅         |          ❌          |        ❌        |        ✅          | Cycle count variance reconciliation|
| PRODUCTION       |    +1     |        ✅         |          ❌          |        ❌        |        ✅          | Finished goods from manufacturing  |
| OPENING          |    +1     |        ✅         |          ❌          |        ❌        |        ✅          | Opening balance at go-live         |
| IN *(legacy)*    |    +1     |        ✅         |          ❌          |        ❌        |        ✅          | Use PURCHASE or TRANSFER_IN        |
| OUT *(legacy)*   |    -1     |        ✅         |          ❌          |        ❌        |        ✅          | Use SALE or TRANSFER_OUT           |
| TRANSFER *(legacy)* | -1   |        ✅         |          ❌          |        ✅        |        ❌          | Use TRANSFER_OUT + TRANSFER_IN     |
| RETURN *(legacy)*|    +1     |        ✅         |          ❌          |        ❌        |        ✅          | Use SALE_RETURN or PURCHASE_RETURN |
| SALES *(legacy)* |    -1     |        ✅         |          ❌          |        ❌        |        ✅          | Alias for SALE                     |

*ADJUSTMENT: direction=+1, but caller supplies signed quantity. Positive qty = stock gain; negative qty = stock loss.

### Business Movements — do NOT affect `products.stock`

| movement_type    | direction | affects_physical | affects_reservation | affects_channel | affects_transit | affects_inv_value | Notes                          |
|------------------|:---------:|:----------------:|:-------------------:|:---------------:|:---------------:|:-----------------:|--------------------------------|
| RESERVE          |    +1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | Soft-reserve against SO        |
| UNRESERVE        |    -1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | Release soft-reservation       |
| ALLOCATE         |    +1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | Hard-allocate to pick task     |
| DEALLOCATE       |    -1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | Release hard allocation        |
| PICK             |     0     |        ❌         |          ❌          |        ❌        |        ❌        |        ❌          | WMS pick confirmation (audit)  |
| PACK             |     0     |        ❌         |          ❌          |        ❌        |        ❌        |        ❌          | WMS pack confirmation (audit)  |
| SHIP             |     0     |        ❌         |          ❌          |        ❌        |        ✅        |        ❌          | Shipment dispatched            |
| DISPATCH         |     0     |        ❌         |          ❌          |        ❌        |        ✅        |        ❌          | Generic dispatch event         |
| CHANNEL_DISPATCH |    -1     |        ❌         |          ❌          |        ✅        |        ❌        |        ❌          | Marketplace channel dispatch   |

---

## Behavior Dispatch Pattern (FROZEN)

The Inventory State Engine dispatches movement effects using declarative
behavior flags. There are **no switch statements** in the State Engine.

```python
# In InventoryStateService (state_engine.py):
behavior = MovementTypeRegistry.get(movement.movement_type)

if behavior.affects_transit:
    in_transit += abs(qty)

if behavior.affects_physical_stock and is_consignment:
    if behavior.direction == -1:
        consignment_out += abs(qty)
    elif behavior.direction == +1:
        consignment_in += abs(qty)

# ... etc.
```

---

## Regression Matrix

Every CI run must validate this matrix. Business movements must never affect
physical stock. Physical movements must never affect reservation state.

| Movement         | Physical ✅/❌ | Reserved ✅/❌ | Available (change) |
|------------------|:------------:|:------------:|:------------------:|
| PURCHASE         |      ✅       |      ❌       | ↑ (stock increases) |
| SALE             |      ✅       |      ❌       | ↓ (stock decreases) |
| TRANSFER_OUT     |      ✅       |      ❌       | ↓ (leaves location) |
| TRANSFER_IN      |      ✅       |      ❌       | ↑ (arrives at dest) |
| RESERVE          |      ❌       |      ✅       | ↓ (reserved increases) |
| UNRESERVE        |      ❌       |      ✅       | ↑ (reserved decreases) |
| PICK             |      ❌       |      ❌       | — (audit only)      |
| CHANNEL_DISPATCH |      ❌       |      ❌       | — (channel only)    |

---

## SDK Extensibility via MovementProvider

Industry packs extend the movement taxonomy without modifying the Inventory Kernel.
New movement types must only be registered **before** the kernel is sealed (application startup).

```python
# Example: Medical SDK
class MedicalMovementProvider(MovementProvider):
    def get_movement_behaviors(self) -> list[MovementBehavior]:
        return [
            MovementBehavior("QUARANTINE",         PHYSICAL, direction=-1, affects_physical_stock=True,  affects_inventory_value=False, ...),
            MovementBehavior("RELEASE_QUARANTINE",  PHYSICAL, direction=+1, affects_physical_stock=True,  affects_inventory_value=False, ...),
        ]

# Example: Jewellery SDK
class JewelleryMovementProvider(MovementProvider):
    def get_movement_behaviors(self) -> list[MovementBehavior]:
        return [
            MovementBehavior("MELTING",   PHYSICAL, direction=-1, affects_physical_stock=True,  affects_inventory_value=True,  ...),
            MovementBehavior("REFINING",  PHYSICAL, direction=+1, affects_physical_stock=True,  affects_inventory_value=True,  ...),
        ]

# SDK registration at startup (before kernel seal):
MovementTypeRegistry.register_provider(MedicalMovementProvider())
# After all providers registered, kernel seals automatically.
```

---

## RC2 Freeze Boundary

### Included in RC2 Inventory Kernel v1.0

- ✅ Inventory State Engine (`state_engine.py`)
- ✅ Availability Engine (`availability_engine.py`)
- ✅ Reservation Engine (`reservation_engine.py`)
- ✅ Trace Engine (`trace_engine.py`)
- ✅ Timeline Engine (`timeline_engine.py`)
- ✅ Movement Registry & Behavior Taxonomy (`domain/movement_taxonomy.py`)
- ✅ Inventory State Reconciliation Trigger (`trg_inventory_state_reconciliation`)
- ✅ Single Alembic Migration HEAD (`merge_rc2_inventory_kernel`)

### Deferred to RC3

- ❌ Decision Engine
- ❌ Inventory 360 Workspace
- ❌ Forecasting Engine
- ❌ AI / ML Optimization
- ❌ Advanced Analytics
- ❌ `inventory_kernel/` package migration (rename from `services/inventory/`)

---

## Alembic Migration Graph (Post-RC2)

```
12b68ccebec7 (baseline)
    └── ... (schema chain)
            ├── 35d215f3c4b8 (inventory trigger fix)
            │       ↘
            │        merge_rc2_inventory_kernel  ← SINGLE HEAD
            │       ↗
            └── v1332_gst_rate_slabs (GST constraint)
```

Verification command:
```bash
alembic heads
# Expected: exactly one line → merge_rc2_inventory_kernel (head)
```

---

*Document Owner: Chief Systems Architect, SmritiSys*  
*This document is governed by the SMRITI Three-Tier Governance Hierarchy (FROZEN v1.0)*
