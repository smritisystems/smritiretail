# SMRITI Platform — Inventory Kernel SDK Specification (IKSDK v1.0.0)

**Status:** CONSTITUTIONALLY FROZEN SDK — Level 1 Contract Specification v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Principle

The **Inventory Kernel SDK (IKSDK v1.0.0)** defines the binding technical contract governing how every consumer business domain (Sales, Purchase, POS, WMS, Marketplace, Manufacturing, Mobile, AI) interacts with the Inventory Kernel.

No business domain module may construct custom SQL inventory queries or update stock tables directly. All inventory operations MUST consume **IKSDK v1.0.0**.

```text
CONSUMER BUSINESS DOMAINS (Sales, Purchase, POS, WMS, Marketplace, Manufacturing, Mobile)
                                         │
                                         ▼
                     INVENTORY KERNEL SDK (IKSDK v1.0.0)
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │                                           │
                   ▼                                           ▼
         InventoryCommandFacade v1                   InventoryQueryFacade v1
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         │
                                         ▼
                               INVENTORY KERNEL v1.0
```

---

## 1. Maturity Model (IK-L0 .. IK-L5)

| Maturity Level | Milestone Name | Milestone Technical Requirement | Status |
|---|---|---|---|
| **IK-L0** | Architecture | Architecture & Constitution Frozen | ✅ **FROZEN v1.0** |
| **IK-L1** | Data Model | Core Master Entities & ORM schemas built | ✅ **READY** |
| **IK-L2** | Core Engine | ITEX, IIE, Movement, ILE, Reservation built | ✅ **READY** |
| **IK-L3** | Public APIs | Facades `InventoryCommandFacade v1` & `QueryFacade v1` built | ✅ **READY** |
| **IK-L4** | Certified | Automated IK001..IK008 test suite 100% passed | ✅ **CERTIFIED** |
| **IK-L5** | Production | Production deployment & replay verified | 🟢 **STABLE** |

---

## 2. Command Facade API Contract (`InventoryCommandFacade v1`)

### `moveInventory(request: MoveInventoryDTO): Promise<MovementResultDTO>`
Executes an atomic directional movement between locations via `ITEX`.

### `transferInventory(request: TransferInventoryDTO): Promise<TransferResultDTO>`
Authorizes and executes an inter-location stock transfer order (`TransferOrder`).

### `reserveInventory(request: ReserveInventoryDTO): Promise<ReservationResultDTO>`
Creates a channel or order ATP reservation (`Reservation`).

### `releaseReservation(reservationId: string): Promise<boolean>`
Releases an existing stock reservation.

### `adjustInventory(request: AdjustInventoryDTO): Promise<AdjustmentResultDTO>`
Executes a physical stock reconciliation variance adjustment (`StockAdjustment`).

### `countInventory(request: CountInventoryDTO): Promise<CountResultDTO>`
Submits audit stock count sheet verification (`StockCount`).

### `replenishInventory(request: ReplenishInventoryDTO): Promise<ReplenishmentResultDTO>`
Generates automated reorder requests (`ReplenishmentRequest`).

---

## 3. Query Facade API Contract (`InventoryQueryFacade v1`)

### `getStock(productId: string, locationId?: string): Promise<StockStateDTO>`
Fetches on-hand, reserved, in-transit, and available stock.

### `getAvailable(productId: string, locationId?: string): Promise<number>`
Calculates real-time Available-to-Promise (ATP) stock.

### `getNetworkStock(productId: string): Promise<NetworkStockSummaryDTO>`
Calculates canonical network stock aggregated across all locations.

### `getLocationStock(locationId: string): Promise<LocationStockListDTO>`
Lists all SKU balances at a specified inventory location node.

### `getInventoryHistory(productId: string, filter?: HistoryFilterDTO): Promise<StockMovementHistoryDTO>`
Returns the audit trail movement stream for replay verification.

### `getInventoryKPIs(locationId: string): Promise<LocationKPIsDTO>`
Returns operational metrics (Days of Cover, Inventory Value, Accuracy %).

---

## 4. Standard DTO Contracts

```typescript
export interface MoveInventoryDTO {
  transaction_id: string;
  source_module: string;
  from_location_id: string;
  to_location_id?: string; // NULL for Inventory Exit (Consumer Sale)
  items: Array<{
    product_id: string;
    sku: string;
    quantity: number;
    batch_no?: string;
    serial_no?: string;
    unit_cost?: number;
  }>;
  movement_type: string;
  ownership_type: "COMPANY" | "PARTNER" | "CONSIGNMENT" | "MARKETPLACE" | "SUPPLIER" | "CUSTOMER" | "THIRD_PARTY";
  remarks?: string;
}
```

---

## 5. Automated Certification Suite (IK001..IK008)

- `IK001 Facade Entry Gate`: `test_ik001_facade_entry.py`
- `IK002 Single Balance Mutator Gate`: `test_ik002_single_balance_mutator.py`
- `IK003 Derived Availability Gate`: `test_ik003_derived_availability.py`
- `IK004 Network Stock Aggregation Gate`: `test_ik004_network_stock_aggregation.py`
- `IK005 Event Publication Gate`: `test_ik005_event_publication.py`
- `IK006 Replay Determinism Gate`: `test_ik006_replay_determinism.py`
- `IK007 Costing Isolation Gate`: `test_ik007_costing_isolation.py`
- `IK008 Engine Boundary Gate`: `test_ik008_engine_boundary.py`

---

## 6. Official Authoritative Documentation Suite

- **Level 1 Constitution**: [docs/constitution/INVENTORY_KERNEL_CONSTITUTION.md](file:///f:/SMRITRretailNXmgrt/docs/constitution/INVENTORY_KERNEL_CONSTITUTION.md)
- **Level 1 Master Architecture**: [docs/architecture/INVENTORY_KERNEL_ARCHITECTURE_V1.md](file:///f:/SMRITRretailNXmgrt/docs/architecture/INVENTORY_KERNEL_ARCHITECTURE_V1.md)
- **Level 1 SDK Specification**: [docs/sdk/INVENTORY_KERNEL_SDK_V1.md](file:///f:/SMRITRretailNXmgrt/docs/sdk/INVENTORY_KERNEL_SDK_V1.md)
- **Consumer Certification Matrix**: [docs/certification/CONSUMER_CERTIFICATION_MATRIX.md](file:///f:/SMRITRretailNXmgrt/docs/certification/CONSUMER_CERTIFICATION_MATRIX.md)
