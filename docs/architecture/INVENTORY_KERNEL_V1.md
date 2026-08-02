# SMRITI Retail OS — Inventory Kernel v1.0
## Architecture Specification & Public Contract (FROZEN — RC2)

**Status:** FROZEN  
**Specification Version:** 1.0.0 (SemVer Frozen)  
**SDK Version:** v1.0.0  
**Date:** 2026-08-02  
**Owner:** Chief Systems Architect — Jawahar Ramkripal Mallah  
**Classification:** Internal Architecture Standard

---

## PART 1 — INVENTORY KERNEL CONSTITUTION (Timeless Invariants)

> [!IMPORTANT]
> **Kernel Rule #0 — Pipeline Flow Invariant & 1:1 Ledger Equivalence**
> Nothing may bypass this pipeline:
> `StockMovement` ──► `Inventory State Reconciliation Pipeline` ──► `products.stock` ──► `InventoryStateEngine` ──► `Availability / Reservation` ──► Consumers.
> Every physical stock change MUST produce exactly one `StockMovement` record (1:1 equivalence).
> No physical stock mutation without a ledger entry; no duplicate ledger entries for one physical movement.
> No service or Industry SDK may write to `products.stock` directly.

> [!IMPORTANT]
> **Kernel Rule #1 — Immutable Stock Reconciliation Pipeline**
> No engine may update `products.stock` directly except through the authoritative
> Inventory State Reconciliation Pipeline.
> Any code path that updates `products.stock` directly is a critical architectural violation.
> All physical on-hand mutations flow through the reconciliation engine abstraction.

> [!IMPORTANT]
> **Kernel Rule #2 — Single State Origin Invariant**
> Every inventory state exposed through REST APIs, WebSockets, or UI components MUST originate exclusively
> from `InventoryStateEngine` or its facade (`InventoryAvailabilityService` / `InventoryReservationService`).
> No consumer module (POS, Sales, Purchase, WMS, Mobile, SDKs) may independently calculate stock availability.

> [!IMPORTANT]
> **Kernel Rule #3 — Deterministic State Calculation**
> Given identical `StockMovement` records + identical commitments + identical `MovementTypeRegistry`,
> `InventoryStateEngine` MUST always produce 100% identical state outputs.
> No timestamps, cache evaluation order, API request sequencing, or UI state may introduce non-determinism into inventory calculation.

> [!IMPORTANT]
> **Kernel Rule #4 — Read Model Separation Invariant**
> The Inventory State Engine and its calculation services MUST NEVER format, present, or aggregate state for specific UI components.
> The Engine produces raw, canonical state objects exclusively (`{on_hand, reserved, allocated, available, in_transit, ...}`).
> Consumers (Inventory 360, POS, Mobile, WMS, Reports) own their own presentation read models.
> The kernel engine code NEVER changes to accommodate presentation or UI formatting requirements.

> [!IMPORTANT]
> **Kernel Rule #5 — Event Completeness & Auditability**
> Every physical inventory event must produce exactly one canonical `StockMovement` record.
> Every `StockMovement` must be replayable to reconstruct system state identically.
> No hidden, unlogged, or unreferenced stock adjustments are permitted anywhere in the system.

---

## PART 2 — INVENTORY KERNEL PUBLIC CONTRACT (Frozen Surface v1.0.0)

> Every module inside SMRITI — including Sales (SI_001), Purchase, POS, WMS, Marketplace, Mobile, Reports, and Industry SDKs — MUST interact with inventory exclusively through these frozen public facade interfaces. Bypassing these public contracts or invoking internal engine helpers directly is strictly prohibited.

### Command Facade Surface (State Mutations & Commitments)

```python
class InventoryCommandFacade:
    """Read/Write Mutations & Commitment Management"""
    async def reserve_stock(self, product_id: str, qty: Decimal, reference_doc: str) -> ReservationResultDTO: ...
    async def release_reservation(self, product_id: str, qty: Decimal, reference_doc: str) -> ReservationResultDTO: ...
    async def create_movement(self, movement_in: StockMovementCreateDTO) -> StockMovementDTO: ...
    async def create_transfer(self, transfer_in: StockTransferCreateDTO) -> StockTransferDTO: ...
    async def reconcile_audit(self, count_id: str) -> StockAuditReconciliationDTO: ...
```

### Query Facade Surface (Facts, Availability & Audit)

```python
class InventoryQueryFacade:
    """Read-Only Facts, Commercial Availability & Audit Ledger Queries"""
    async def get_canonical_state(self, product_id: str) -> InventoryStateDTO: ...
    async def get_warehouse_breakdown(self, product_id: str) -> List[WarehouseStockDTO]: ...
    async def get_availability(self, product_id: str) -> ProductAvailabilityDTO: ...
    async def can_fulfill(self, product_id: str, requested_qty: Decimal) -> FulfillmentCheckDTO: ...
    async def get_stock_movements(self, product_id: str, limit: int = 100) -> List[StockMovementDTO]: ...
    async def get_stock_at_timestamp(self, product_id: str, as_of: datetime) -> InventoryStateDTO: ...
```

### Internal Classes Prohibited from External Consumption

> [!CAUTION]
> **Strict Encapsulation Warning:**
> The following internal classes are **PRIVATE IMPLEMENTATION DETAILS** and MUST NEVER be imported or called outside `app.services.inventory`:
> `InventoryStateEngine`, `MovementTypeRegistry`, `CoreMovementProvider`, `StateCalculator`, `WarehouseAggregator`.
> Only `InventoryCommandFacade` and `InventoryQueryFacade` constitute the public API.

---

## PART 3 — FROZEN DATA, EVENT & ERROR CONTRACT SPECIFICATION (v1.0.0)

### 3.1 DTO Contracts

```python
@dataclass(frozen=True)
class InventoryStateDTO:
    product_id: str
    on_hand: Decimal
    reserved: Decimal
    allocated: Decimal
    available: Decimal
    in_transit: Decimal
    consignment_out: Decimal
    consignment_in: Decimal
    marketplace_reserved: Decimal
    blocked: Decimal
    damaged: Decimal
    repair: Decimal
    quality_hold: Decimal
    return_pending: Decimal
    as_of: datetime

@dataclass(frozen=True)
class ProductAvailabilityDTO:
    product_id: str
    available_qty: Decimal
    is_orderable: bool
    tracking_mode: str

@dataclass(frozen=True)
class ReservationResultDTO:
    success: bool
    product_id: str
    reserved_qty: Decimal
    remaining_available: Decimal
    reference_doc: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
```

### 3.2 Canonical StockMovementEvent Schema (v1.0.0)

```python
@dataclass(frozen=True)
class StockMovementEvent:
    movement_id: str
    product_id: str
    warehouse_id: str
    movement_type: str        # Validated against MovementTypeRegistry
    quantity: Decimal          # Signed delta (+ inbound / - outbound / signed adjustment)
    unit_cost: Decimal
    reference_doc_type: str    # e.g., 'Purchase Order', 'Sales Invoice', 'Stock Transfer'
    reference_doc_id: str
    source_module: str         # POS, Sales, Purchase, Transfer, StockAudit, WMS
    tenant_id: str
    company_id: str
    branch_id: str
    performed_by: Optional[str]
    performed_at: datetime
    metadata: Dict[str, Any]   # Optional extra attributes (batch, serial, bin)
```

### 3.3 Frozen Error Taxonomy (`InventoryErrorCode` v1.0.0)

> Every exception or failure returned across `InventoryCommandFacade` or `InventoryQueryFacade` MUST map exclusively to these standardized error codes.

```python
class InventoryErrorCode(str, Enum):
    INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK"
    RESERVATION_CONFLICT = "RESERVATION_CONFLICT"
    SKU_NOT_FOUND = "SKU_NOT_FOUND"
    WAREHOUSE_NOT_FOUND = "WAREHOUSE_NOT_FOUND"
    INVALID_MOVEMENT_TYPE = "INVALID_MOVEMENT_TYPE"
    QUALITY_HOLD = "QUALITY_HOLD"
    BLOCKED_STOCK = "BLOCKED_STOCK"
    UNBALANCED_TRANSFER = "UNBALANCED_TRANSFER"
    NEGATIVE_STOCK_DISALLOWED = "NEGATIVE_STOCK_DISALLOWED"
```

### 3.4 Public Contract Stability & Compatibility Matrix

| Interface / Contract | Stability | Introduced | SemVer Target |
|----------------------|:---------:|:----------:|:-------------:|
| `InventoryQueryFacade` | **Stable** | v1.0.0 | Guarantees backwards compatibility |
| `InventoryCommandFacade` | **Stable** | v1.0.0 | Guarantees backwards compatibility |
| `InventoryStateDTO` | **Stable** | v1.0.0 | Frozen schema — no field deletion/renaming |
| `ProductAvailabilityDTO` | **Stable** | v1.0.0 | Frozen schema — no field deletion/renaming |
| `ReservationResultDTO` | **Stable** | v1.0.0 | Frozen schema — no field deletion/renaming |
| `StockMovementEvent` | **Stable** | v1.0.0 | Frozen canonical event contract |
| `InventoryErrorCode` | **Stable** | v1.0.0 | Standardized exception taxonomy |
| `MovementTypeRegistry.register_provider()` | **Stable** | v1.0.0 | Industry SDK extension entry point |

---

## PART 4 — IMPLEMENTATION & GOVERNANCE POLICIES (Current Engine Binding)

> [!NOTE]
> **Engineering Policy #1 — Alembic-Only Trigger Migration Policy**
> In the current PostgreSQL implementation, the Inventory State Reconciliation Pipeline is bound to
> DB trigger `trg_inventory_state_reconciliation` and function `inventory_state_reconciliation_trigger()`.
> Trigger DDL evolution is restricted exclusively to Alembic migrations.
> `fix_stock_trigger.py` is an emergency recovery tool only, never a development workflow step.

> [!NOTE]
> **Engineering Policy #2 — Sealed Movement Registry Lifecycle**
> `MovementTypeRegistry` is sealed after kernel initialization. No random string movement types
> are permitted. Industry SDK extensions must register providers via `MovementTypeRegistry.register_provider()`
> during container startup before registry sealing.

> [!NOTE]
> **Engineering Policy #3 — Static Analysis CI Guard Enforcement**
> `test_architecture_rule1.py` executes in CI on every commit to enforce zero direct `.stock =` mutations across all backend services outside the allowed reconciliation pipeline.

> [!NOTE]
> **Engineering Policy #4 — Contract Breaking-Change CI Guard Policy**
> Any modification to `InventoryQueryFacade`, `InventoryCommandFacade`, `InventoryStateDTO`, or `InventoryErrorCode` signatures in a non-major SemVer pull request will cause CI build failure.

---

## Architecture Layers & Functional Separation

The SMRITI Platform strictly separates inventory calculation into three isolated data layers and three functional engine tiers:

### Data Layers

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Physical Ledger (Warehouse Reality)                           │
│   • products.stock (On Hand)                                           │
│   • Maintained exclusively by Inventory State Reconciliation Pipeline  │
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
│   • Never makes business decisions, formatting, or routing choices     │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Inventory Availability & Reservation Services (ATP & Rules)   │
│   • Applies reservation rules and evaluates Commercial Availability    │
└────────────────────────────────────────────────────────────────────────┘
════════════════════════════ RC3 BOUNDARY ════════════════════════════════
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 3: Inventory Decision Engine (RC3 Fulfillment & Order Routing)   │
│   • Business questions: warehouse fulfillment routing, split shipments,│
│     marketplace priority, FIFO vs FEFO batching, SKU substitution       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Kernel Engine Topology

```text
               SMRITI Inventory Kernel v1.0.0
────────────────────────────────────────────────────────

StockMovement Ledger (Immutable Audit Log)
        │
        ▼
Inventory State Reconciliation Pipeline (Current DB Trigger: trg_inventory_state_reconciliation)
        │
        ▼
products.stock (Layer 1: Physical On-Hand Ledger)
        │
        ▼
InventoryStateEngine (Tier 1: Fact Calculation Surface)
        │
        ▼
InventoryQueryFacade & InventoryCommandFacade (Tier 2: Public Surface)
        │
     ════════════════════ RC3 BOUNDARY ════════════════════
        │
        ▼
InventoryDecisionEngine (Tier 3: RC3 Order Routing & Fulfillment — Optional Facade)
        │
        ▼
Read Models & Consumer Systems (Layer 3 & UI)
  ├── Sales / POS / Purchase
  ├── Warehouse / WMS
  ├── Marketplace Channels
  ├── Inventory 360 Workspace
  ├── Mobile & Web Apps
  └── Industry SDKs & Reports
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

> On Hand is maintained exclusively by the Inventory State Reconciliation Pipeline (`trg_inventory_state_reconciliation`).
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
| UNRESERVE        |    -1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | Release soft-reservation       |
| ALLOCATE         |    +1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | Hard-allocate to pick task     |
| UNALLOCATE       |    -1     |        ❌         |          ✅          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | Release hard-allocation        |
| PICK             |     0     |        ❌         |          ❌          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | WMS pick event audit           |
| PACK             |     0     |        ❌         |          ❌          |        ❌        |        ❌        |        ❌          | WMS Operational Event          | WMS pack event audit           |
| SHIP             |     0     |        ❌         |          ❌          |        ❌        |        ✅        |        ❌          | WMS Operational Event          | In-transit dispatch event      |
| DISPATCH         |     0     |        ❌         |          ❌          |        ❌        |        ✅        |        ❌          | WMS Operational Event          | Generic dispatch event         |
| CHANNEL_DISPATCH |    -1     |        ❌         |          ❌          |        ✅        |        ❌        |        ❌          | Channel Visibility Event       | Channel allocation lock (no physical stock mutation) |

---

## SDK Extensibility Contract (SemVer Frozen — v1.0.0)

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
| **Phase 1** | Inventory Kernel v1.0.0 | ✅ **FROZEN & SEALED** | Subsystem Exit Gate Passed — Rules 0–5, Error Taxonomy & Engineering Policy 4 Sealed |
| **Phase 2** | SI_001 Integration | 🔄 **NEXT PRIORITY** | Sales consumes `InventoryQueryFacade` & `InventoryCommandFacade` |
| **Phase 3** | SDK Stabilization | 🔄 Next | Industry Pack extension contracts sealed (v1.0.0) |
| **Phase 4** | Inventory 360 Workspace | ⏳ Future | Pure read-only UI consumer workspace |
| **GA Prep** | Continuous Health Check & Recovery Verification | ⏳ Future | Automated background reconciliation & `stock_movements` rebuild verification test |
