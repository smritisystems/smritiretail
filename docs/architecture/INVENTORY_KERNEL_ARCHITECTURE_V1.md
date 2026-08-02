# SMRITI Platform — Inventory Kernel Architecture v1.0.0

**Status:** PERMANENTLY FROZEN ARCHITECTURE — Level 1 Master Specification v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **inventory management** across owned warehouses, retail chains (Reliance, DMart, Croma), distributors, franchises, institutions, marketplaces (Amazon FC), goods in transit, and production lines is NOT a collection of separate modules.

It is a **Unified Enterprise Platform Kernel**, structured into Core Orchestrators, Document & Workflow Engines, Service Engines, Public Platform APIs, and Infrastructure Services:

```text
                               INVENTORY KERNEL v1.0

================================== CORE ENGINES ==================================
  • Inventory Document Engine (IDE)             • Inventory Workflow Engine (IWE)
  • Inventory Transaction Engine (ITEX)         • Inventory Identity Engine (IIE)
  • Inventory Movement Engine                   • Inventory Location Engine (ILE)
  • Inventory Network Engine (INE)              • Reservation Engine
  • Availability Engine
==================================================================================
                                         │
                                         ▼
================================= SERVICE ENGINES ================================
  • Inventory Visibility Engine (IVE)           • Inventory Allocation Engine (IAE)
  • Inventory Replenishment Engine (IRE)        • Inventory Policy Engine (IPE)
  • Inventory Rules Engine (IRULE)              • Inventory Costing Engine (ICE)
  • Inventory Compliance Engine (ICOMP)
==================================================================================
                                         │
                                         ▼
================================= PUBLIC APIS v1 =================================
  • InventoryCommandFacade v1                   • InventoryQueryFacade v1
==================================================================================
                                         │
                                         ▼
================================ PLATFORM SERVICES ===============================
  • Replay Engine                               • Audit Engine
  • Valuation Engine                            • Inventory Event Bus (v1)
==================================================================================
  • (v2 Future Capability: Inventory Forecast Engine - IFE)
```

---

## 1. Document Lifecycle & Workflow Orchestration Pipeline

```text
Business Module  ──►  Document Engine (IDE)  ──►  Workflow Engine (IWE)  ──►  ITEX  ──►  Movement Engine
```

- **Inventory Document Engine (IDE)**: Manages standard inventory document lifecycles (`TransferOrder`, `TransferReceipt`, `StockCount`, `StockAdjustment`, `Reservation`, `Allocation`, `ReplenishmentRequest`, `ReplenishmentSuggestion`, `GoodsIssue`, `GoodsReceipt`).
- **Inventory Workflow Engine (IWE)**: Configurable document state transitions (`Draft ──► Pending ──► Approved ──► Picking ──► Packed ──► Dispatched ──► In Transit ──► Received ──► Completed`).
- **Inventory Rules Engine (IRULE)**: Configurable business allocation & packaging rules (FEFO/FIFO allocation, minimum dispatch quantities, batch picking thresholds).

---

## 2. Refined Scope: Inventory Compliance vs Business Compliance

- **Inventory Compliance Engine (ICOMP)**: Focuses strictly on **inventory-level physical compliance** (Batch, Serial, Expiry, Quarantine, Cold Chain, Hazard Storage).
- **External Layers**: Tax and legal compliance (GST, e-way bills, e-invoicing, import/export duties) belong strictly to Accounting, Sales, and Legal platform layers.

---

## 3. Ten-Step Executable Implementation Sequence

1. **Phase 1 Data Model**: Build `InventoryLocation`, `InventoryMovement`, `InventoryDocument`, `Reservation`, `Allocation`.
2. **Public Platform APIs**: Implement `InventoryCommandFacade v1` and `InventoryQueryFacade v1`.
3. **Core Transaction Engine**: Build `InventoryTransactionEngine (ITEX)`.
4. **Physical Movement Engine**: Build `InventoryMovementEngine`.
5. **Location & Network Engine**: Build `InventoryLocationEngine (ILE)` and `InventoryNetworkEngine (INE)`.
6. **Reservation & Availability Engine**: Build `ReservationEngine` and `AvailabilityEngine`.
7. **Event Infrastructure**: Deploy `InventoryEventBus (v1)`.
8. **Costing & Valuation Engine**: Build `InventoryCostingEngine (ICE)` and `ValuationEngine`.
9. **Visibility Dashboards**: Build `InventoryVisibilityEngine (IVE)` real-time dashboards.
10. **Consumer Domain Migration**: Migrate Sales ──► Purchase ──► POS ──► Marketplace ──► Partner/Retail Chain workflows to facade APIs.

---

## 4. Five Immutable Architectural Rules

### Rule 1: ITEX Single Entry Rule
Only the **Inventory Transaction Engine (ITEX)** can orchestrate and create inventory movement directives. Consumer business modules (Sales, Purchase, POS, WMS, Marketplace) MUST NOT directly insert stock movements.

### Rule 2: Single Balance Mutator Rule
Only the **Inventory Movement Engine** changes physical stock balances. No other module, service, or script is permitted to update stock quantities directly.

### Rule 3: Derived Availability Rule
Available-to-Promise (ATP) stock is NEVER stored as a static column. It is ALWAYS dynamically derived:
$$\text{Available} = \text{On Hand} - \text{Reserved} - \text{Blocked} - \text{Allocated}$$

### Rule 4: Derived Network Aggregation Rule
Network Stock is NEVER stored as a separate total field. It is ALWAYS dynamically calculated across all locations:
$$\text{NetworkStock}(\text{SKU}) = \sum_{i \in \text{Locations}} \text{LocationBalance}(\text{SKU}, i)$$

### Rule 5: Valuation & Costing Isolation Rule
Inventory Engine owns quantity. Costing Engine owns cost. Valuation Engine combines both:
$$\text{Inventory Value} = \text{Quantity} \times \text{Unit Cost}$$

---

## 5. Implementation Certification Gates (IK001..IK008)

| Gate ID | Certification Requirement | Technical Verification Standard |
|---|---|---|
| **IK001** | Facade Entry Gate | All inventory updates execute via `InventoryCommandFacade v1`. |
| **IK002** | Single Balance Mutator Gate | Zero direct stock balance mutations outside `Movement Engine`. |
| **IK003** | Derived Availability Gate | ATP availability is dynamically derived, never stored. |
| **IK004** | Network Stock Aggregation Gate | Network stock is dynamically aggregated across locations. |
| **IK005** | Event Publication Gate | Business & technical events published via `InventoryEventBus v1`. |
| **IK006** | Replay Determinism Gate | Replay engine reproduces balances with 100% mathematical accuracy. |
| **IK007** | Costing & Valuation Isolation Gate | Costing and valuation remain isolated from physical quantities. |
| **IK008** | Engine Boundary Gate | Engine boundary enforcement rules respected. |

---

## 6. Engine Boundary Enforcement Matrix

| Engine | Can Modify | Cannot Modify |
|---|---|---|
| **IDE (Document Engine)** | Inventory document lifecycle | Stock balances |
| **IWE (Workflow Engine)** | Document status transitions | Stock balances |
| **ITEX (Transaction Engine)** | Inventory movement directives | Stock balances |
| **IIE (Identity Engine)** | Identity resolution & validation | Quantities |
| **Movement Engine** | Stock ledger entries | Costing & valuation |
| **ICE (Costing Engine)** | Unit costs & cost layers | Quantities |
| **Valuation Engine** | Financial ledger valuation entries | Stock ledger entries |
| **IPE (Policy Engine)** | Operational permissions | Stock balances |
| **ICOMP (Compliance Engine)** | Physical compliance status | Tax/GST ledgers |

---

## 7. Event Bus Architecture: Business vs Technical Events

### Business Events (Consumed by Accounting, CRM, Analytics, Notifications)
`GoodsReceived` | `GoodsIssued` | `GoodsTransferred` | `GoodsSold` | `GoodsReturned` | `GoodsDamaged` | `GoodsExpired`

### Internal Technical Events (Consumed within Inventory Kernel)
`InventoryReserved` | `InventoryReleased` | `AllocationCreated` | `CountCompleted` | `CostCalculated` | `ValuationUpdated`

---

## 8. Financial Ownership (`InventoryOwnership`)

| InventoryOwnership | Commercial Description | Accounting & Financial Treatment |
|---|---|---|
| `COMPANY` | Company physical stock | Company balance sheet inventory asset. |
| `PARTNER` | Sold stock held by partner | Invoice posted; revenue recognized. |
| `CONSIGNMENT` | Goods held at partner site | Company inventory asset until reported sold. |
| `MARKETPLACE` | Channel fulfillment stock | Channel asset; revenue on customer dispatch. |
| `SUPPLIER` | Vendor drop-ship stock | Supplier-owned stock until GRN/dispatch. |
| `CUSTOMER` | Customer stock held for service | RMA/Service stock; off-balance sheet. |
| `THIRD_PARTY` | 3PL stock held for fulfillment | Non-company stock; off-balance sheet. |

---

## 9. Ten Disconnected Subsystems Replaced by Unified Architecture

1. ✅ Consignment Module
2. ✅ Marketplace Stock Module
3. ✅ Franchise Stock Module
4. ✅ Distributor Stock Module
5. ✅ Branch Stock Module
6. ✅ Company Stores Module
7. ✅ Institutional Stock Module
8. ✅ Van Sales Module
9. ✅ Mobile Sales Module
10. ✅ Transit Stock Module
