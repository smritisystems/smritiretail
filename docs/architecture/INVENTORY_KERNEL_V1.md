# SMRITI Retail OS — Inventory Kernel v1.0
## Architecture Specification (FROZEN — RC2)

**Status:** FROZEN  
**Version:** 1.0  
**Date:** 2026-08-02  
**Owner:** Chief Systems Architect — Jawahar Ramkripal Mallah  
**Classification:** Internal

---

> [!IMPORTANT]
> **Platform Rule #0 — Pipeline Flow Invariant & 1:1 Ledger Equivalence**
> Nothing may bypass this pipeline:
> `StockMovement` ──► `trg_inventory_state_reconciliation` ──► `products.stock` ──► `InventoryStateEngine` ──► `Availability / Reservation` ──► Consumers.
> Every physical stock change MUST produce exactly one `StockMovement` record (1:1 equivalence).
> No physical stock mutation without a ledger entry; no duplicate ledger entries for one physical movement.
> No Python service or Industry SDK may write to `products.stock` directly.

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

> [!IMPORTANT]
> **Platform Rule #3 — Sealed Movement Registry**
> MovementTypeRegistry is sealed after kernel initialization. No random string movement types
> are permitted. Industry SDK extensions must register providers via `MovementTypeRegistry.register_provider()`
> during container startup before registry sealing.

> [!IMPORTANT]
> **Platform Rule #4 — Single State Origin Invariant**
> Every inventory state exposed through REST APIs, WebSockets, or UI components MUST originate exclusively
> from `InventoryStateEngine` or its facade (`InventoryAvailabilityService` / `InventoryReservationService`).
> No consumer module (POS, Sales, Purchase, WMS, Mobile, SDKs) may independently calculate stock availability.

> [!IMPORTANT]
> **Platform Rule #5 — Deterministic State Calculation**
> Given identical `StockMovement` records + identical `reserved_stock` commitments + identical `MovementTypeRegistry`,
> `InventoryStateEngine` MUST always produce 100% identical state outputs.
> No timestamps, cache evaluation order, API request sequencing, or UI state may introduce non-determinism into inventory state calculation.

---

## Architecture Layers & Functional Separation

The SMRITI Platform strictly separates inventory calculation into three isolated data layers and three functional engine tiers:

### Data Layers

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Physical Ledger (Warehouse Reality)                           │
│   • products.stock (On Hand)                                           │
│   • Maintained exclusively by trg_inventory_state_reconciliation       │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Business Commitments (Operational Allocations)               │
│   • reserved_stock (SO soft reservations)                              │
│   • allocated (WMS hard allocations)                                   │
│   • in_transit, consignment_out, blocked, quality_hold                 │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Commercial Availability (Available to Promise / Sell)        │
│   • available = On Hand - Commitments (floored at zero)                │
│   • Evaluated dynamically by InventoryAvailabilityService               │
└────────────────────────────────────────────────────────────────────────┘
```

### Functional Engine Tiers

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Inventory State Engine (Facts & State Calculation)            │
│   • Pure state evaluation (On Hand, Reserved, In Transit, etc.)        │
│   • Never makes business decisions or routing choices                  │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Inventory Availability Service (ATP & Commitment Rules)       │
│   • Applies reservation rules and evaluates Commercial Availability    │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Inventory Decision Engine (RC3 Fulfillment & Routing)         │
│   • Business questions: warehouse fulfillment routing, split shipments,│
│     marketplace priority, FIFO vs FEFO batching, SKU substitution       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Engine Hierarchy

```text
StockMovement
        ↓
trg_inventory_state_reconciliation (DB Trigger)
        ↓
products.stock (Layer 1: Physical On-Hand Ledger)
        ↓
InventoryStateEngine (Tier 1: Fact Calculation Surface)
        ↓
InventoryAvailabilityService & InventoryReservationService (Tier 2: Commercial Availability & Commitments)
        ↓
InventoryDecisionEngine (Tier 3: RC3 Order Routing & Fulfillment — Optional Facade)
        ↓
Consumers (POS, Sales, Purchase, Transfer, WMS, Industry SDKs)
```

```text
Movement Registry              (behavior metadata — movement_taxonomy.py)
        ▲
        └── MovementProvider (ABC)
                ├── CoreMovementProvider   (RC2 frozen standard taxonomy — 23 types)
                ├── MedicalMovementProvider  (SDK — RC3+)
                ├── JewelleryMovementProvider (SDK — RC3+)
                └── FootwearMovementProvider  (SDK — RC3+)
```

---

## State Equations (FROZEN)

### Physical On Hand (Layer 1)

```text
On Hand  =  Opening
         +  Receipts (PURCHASE, PURCHASE_RETURN, SALE_RETURN, IN, RETURN, PRODUCTION, TRANSFER_IN)
         -  Issues   (SALE, SALE_RETURN, OUT, TRANSFER_OUT, TRANSFER)
         ±  Adjustments (ADJUSTMENT — signed quantity)
```

> On Hand is maintained exclusively by `trg_inventory_state_reconciliation`.
> No Python service may write to `products.stock` directly.

### Commercial Available (Layer 3)

```text
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

```text
Reservable  =  Available
```

> Reservations are **business commitments** (Layer 2), not physical inventory state.
> Reserved stock is deducted from Commercial Available (Layer 3) but does not change Physical On Hand (Layer 1).

---

## Canonical State Fields

All UI components and APIs must consume these canonical fields from the
Inventory State Engine. UI must never independently recalculate these values.

| Field                 | Layer | Type    | Description                                              |
|-----------------------|:-----:|---------|----------------------------------------------------------|
| `on_hand`             |   1   | decimal | Physical quantity present in warehouse                   |
| `reserved`            |   2   | decimal | Soft-reserved for open sales orders                      |
| `allocated`           |   2   | decimal | Hard-allocated to pick/pack tasks                        |
| `available`           |   3   | decimal | Quantity free to fulfill new orders (`on_hand - reserved`)|
| `in_transit`          |   2   | decimal | Dispatched from source, not yet received at destination  |
| `consignment_out`     |   2   | decimal | Stock placed on consignment with external parties        |
| `consignment_in`      |   2   | decimal | Consignment stock received (not yet owned)               |
| `marketplace_reserved`|   2   | decimal | Channel-locked stock on marketplace platforms            |
| `blocked`             |   2   | decimal | Blocked / on administrative hold                         |
| `damaged`             |   2   | decimal | Damaged stock pending write-off or repair                |
| `repair`              |   2   | decimal | Stock under repair / refurbishment                       |
| `quality_hold`        |   2   | decimal | Stock pending QC inspection                              |
| `return_pending`      |   2   | decimal | Customer returns received, awaiting processing           |

---

## Movement Taxonomy (FROZEN — RC2)

### Physical Movements — affect `products.stock` (On Hand / Layer 1)

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

### Business & Operational State Movements (Layer 2 & Layer 3)

| movement_type    | direction | affects_physical | affects_reservation | affects_channel | affects_transit | affects_inv_value | Category / Scope               | Notes                          |
|------------------|:---------:|:----------------:|:-------------------:|:---------------:|:---------------:|:-----------------:|--------------------------------|--------------------------------|
| RESERVE          |    +1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | Reservation Engine             | Soft-reserve against SO        |
| UNRESERVE        |    -1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | Reservation Engine             | Release soft-reservation       |
| ALLOCATE         |    +1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | Hard-allocate to pick task     |
| UNALLOCATE       |    -1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | Release hard-allocation        |
| PICK             |     0     |        ❌         |          ❌          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | WMS pick event audit           |
| PACK             |     0     |        ❌         |          ❌          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | WMS pack event audit           |
| SHIP             |     0     |        ❌         |          ❌          |        ❌        |        ✅        |        ❌          | WMS Operational Event          | In-transit dispatch event      |
| DISPATCH         |     0     |        ❌         |          ❌          |        ❌        |        ✅        |        ❌          | WMS Operational Event          | Generic dispatch event         |
| CHANNEL_DISPATCH |    -1     |        ❌         |          ❌          |        ✅        |        ❌        |        ❌          | Channel Visibility Event       | Channel allocation lock (no physical stock mutation) |

---

## SDK Extensibility Contract (RC3+)

Industry packs extend movement behavior without modifying kernel code by registering a `MovementProvider`:

```python
from app.domain.movement_taxonomy import MovementProvider, MovementBehavior, MovementCategory

class MedicalMovementProvider(MovementProvider):
    def get_movement_behaviors(self) -> list[MovementBehavior]:
        return [
            MovementBehavior(
                movement_type="COLD_CHAIN_DISPATCH",
                category=MovementCategory.PHYSICAL,
                direction=-1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=True,
                affects_inventory_value=True,
                description="Temperature-monitored pharmaceutical dispatch.",
            )
        ]

# Container startup phase:
MovementTypeRegistry.register_provider(MedicalMovementProvider())
```

---

## Post-RC2 Roadmap & Governance

| Phase | Subsystem Focus | Status | Key Deliverable |
|---|---|---|---|
| **Phase 1** | Inventory Kernel | ✅ **FROZEN** | Subsystem Exit Gate Passed — Rules 0–5 Sealed |
| **Phase 2** | SI_001 Integration | 🔄 **NEXT PRIORITY** | Sales consumes Availability ──► Reservation ──► State Engine |
| **Phase 3** | SDK Stabilization | 🔄 Next | Industry Pack extension contracts sealed |
| **Phase 4** | Inventory 360 Workspace | ⏳ Future | Pure read-only UI consumer workspace |
| **GA Prep** | Continuous Health Check & Recovery Verification | ⏳ Future | Automated background reconciliation & `stock_movements` rebuild verification test |
