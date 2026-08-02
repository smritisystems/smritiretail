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
  • Inventory Ledger Engine (ILE-L)             • Inventory Location Engine (ILE)
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
  • Immutable InventoryLedger                   • Read-Only Snapshots
  • Cost Layer Ledger                           • Document Posting Profiles
==================================================================================
  • (v2 Future Capability: Inventory Forecast Engine - IFE)
```

---

## 1. Six Immutable Architectural Rules

### Rule 1: ITEX Single Entry Rule
Only the **Inventory Transaction Engine (ITEX)** can orchestrate and create inventory movement directives. Consumer business modules MUST NOT directly insert stock movements.

### Rule 2: Single Balance Mutator Rule
Only the **Inventory Ledger Engine (ILE-L)** changes physical stock balances via `InventoryLedger`. No other module, service, or script is permitted to update stock quantities directly.

### Rule 3: Derived Availability Rule
Available-to-Promise (ATP) stock is NEVER stored as a static column. It is ALWAYS dynamically derived:
$$\text{Available} = \text{On Hand} - \text{Reserved} - \text{Blocked} - \text{Allocated}$$

### Rule 4: Derived Network Aggregation Rule
Network Stock is NEVER stored as a separate total field. It is ALWAYS dynamically calculated across all locations:
$$\text{NetworkStock}(\text{SKU}) = \sum_{i \in \text{Locations}} \text{LocationBalance}(\text{SKU}, i)$$

### Rule 5: Valuation & Costing Isolation Rule
Inventory Engine owns quantity. Costing Engine owns cost layers. Valuation Engine combines both:
$$\text{Inventory Value} = \text{Quantity} \times \text{Unit Cost}$$

### Rule 6: Ledger Immutability Rule
Inventory ledger entries are strictly **append-only**. Once posted, ledger entries MUST NEVER be updated, edited, or deleted. All corrections, cancellations, and returns MUST be executed via compensating (reversal) movements.

---

## 2. Implementation Certification Gates (IK001..IK009)

To enforce architectural integrity during platform execution, every implementation phase MUST satisfy 9 automated certification gates:

| Gate ID | Certification Requirement | Technical Verification Standard |
|---|---|---|
| **IK001** | Facade Entry Gate | All inventory updates execute via `InventoryCommandFacade v1`. |
| **IK002** | Single Balance Mutator Gate | Zero direct stock balance mutations outside `Inventory Ledger Engine`. |
| **IK003** | Derived Availability Gate | ATP availability is dynamically derived, never stored. |
| **IK004** | Network Stock Aggregation Gate | Network stock is dynamically aggregated across locations. |
| **IK005** | Event Publication Gate | Business & technical events published via `InventoryEventBus v1`. |
| **IK006** | Replay Determinism Gate | Replay engine reproduces balances with 100% mathematical accuracy. |
| **IK007** | Costing & Valuation Isolation Gate | Costing and valuation remain isolated from physical quantities. |
| **IK008** | Engine Boundary Gate | Engine boundary enforcement rules respected. |
| **IK009** | Ledger Replay Integrity Gate | Every balance is 100% reproducible by replaying `InventoryLedger` from the latest snapshot. |

---

## 3. Immutable Ledgers, Read-Only Snapshots & Posting Profiles

### A. Immutable `InventoryLedger`
The **Inventory Ledger Engine (ILE-L)** appends entries to an **immutable transactional `InventoryLedger`**. Current balances are derived projections from ledger entries.

### B. Read-Only `InventorySnapshot` Invariant
For high-performance queries and fast replay, periodic snapshots (`DailySnapshot`, `MonthlySnapshot`) store balance state caches. Snapshots are strictly **read-only cached projections** and MUST NEVER be manually edited or mutated.

### C. Explicit `CostLayerLedger`
Costing methods (FIFO, Moving Average, Specific Identification) write cost layers to a dedicated **`CostLayerLedger`**, keeping inventory valuation deterministic and auditable.

### D. Declarative `DocumentPostingProfiles`

| Document Type | Generated Ledger Movement Profile |
|---|---|
| `Purchase Receipt` | `Supplier Location ──► Warehouse Location` |
| `Sales Invoice` | `Warehouse Location ──► Inventory Exit (TO = NULL)` |
| `Inter-Branch Transfer` | `Warehouse A ──► Warehouse B` |
| `Reliance Dispatch` | `Warehouse Location ──► Reliance DC Location` |
| `Reliance Sale Report` | `Reliance DC Location ──► Inventory Exit (TO = NULL)` |

---

## 4. Dynamic Inventory Projections (`getProjectedStock`)

The `InventoryQueryFacade v1` provides real-time projected stock for planning and replenishment:

$$\text{ProjectedStock} = \text{On Hand} - \text{Reserved} + \text{Incoming PO} + \text{Transfer In} - \text{Transfer Out}$$

---

## 5. Internal Service Namespace Architecture (Modular Monolith Layout)

To avoid over-segmentation and microservice complexity, the kernel components are organized as clean internal namespaces within a single service container:

```text
backend/app/services/inventory/
  ├── document/         # IDE (Document Lifecycle)
  ├── workflow/         # IWE (Workflow State Machine)
  ├── transaction/      # ITEX (Transaction Directives)
  ├── identity/         # IIE (Identity Resolution)
  ├── movement/         # Inventory Ledger Engine (ILE-L & InventoryLedger)
  ├── location/         # ILE (Locations) & INE (Network Topology)
  ├── availability/     # Reservation & Availability Engines
  ├── costing/          # ICE (Costing) & CostLayerLedger
  ├── policy/           # IPE (Policies), ICOMP (Compliance), IRULE (Rules)
  ├── visibility/       # IVE (Dashboards & KPIs)
  └── facades/          # InventoryCommandFacade & InventoryQueryFacade
```

---

## 6. Ten-Step Executable Implementation Sequence

1. **Phase 1 Data Model**: Build `InventoryLocation`, `InventoryDocument`, `InventoryLedger`, `CostLayerLedger`, `Reservation`, `Allocation`, `InventorySnapshot`.
2. **Document Posting Profiles**: Configure declarative document-to-movement mappings.
3. **Public Platform APIs**: Implement `InventoryCommandFacade v1` and `InventoryQueryFacade v1`.
4. **Core Transaction Engine**: Build `InventoryTransactionEngine (ITEX)`.
5. **Inventory Ledger Engine (ILE-L)**: Build `InventoryLedgerEngine` and append-only ledger writer.
6. **Location & Network Engine**: Build `InventoryLocationEngine (ILE)` and `InventoryNetworkEngine (INE)`.
7. **Reservation & Availability Engine**: Build `ReservationEngine` and `AvailabilityEngine`.
8. **Event Infrastructure**: Deploy `InventoryEventBus (v1)`.
9. **Automated Certification Suite**: Run automated test suite verifying `IK001` through `IK009`.
10. **Consumer Domain Migration**: Migrate Sales ──► Purchase ──► POS ──► Marketplace ──► Partner/Retail Chain workflows to facade APIs.

---

## 7. Engine Boundary Enforcement Matrix

| Engine | Can Modify | Cannot Modify |
|---|---|---|
| **IDE (Document Engine)** | Inventory document lifecycle | Stock balances |
| **IWE (Workflow Engine)** | Document status transitions | Stock balances |
| **ITEX (Transaction Engine)** | Inventory movement directives | Stock balances |
| **IIE (Identity Engine)** | Identity resolution & validation | Quantities |
| **ILE-L (Ledger Engine)** | Stock ledger entries (`InventoryLedger`) | Costing & valuation |
| **ICE (Costing Engine)** | Unit costs & cost layers (`CostLayerLedger`) | Quantities |
| **Valuation Engine** | Financial ledger valuation entries | Stock ledger entries |
| **IPE (Policy Engine)** | Operational permissions | Stock balances |
| **ICOMP (Compliance Engine)** | Physical compliance status | Tax/GST ledgers |

---

## 8. Event Bus Architecture: Business vs Technical Events

### Business Events (Consumed by Accounting, CRM, Analytics, Notifications)
`GoodsReceived` | `GoodsIssued` | `GoodsTransferred` | `GoodsSold` | `GoodsReturned` | `GoodsDamaged` | `GoodsExpired`

### Internal Technical Events (Consumed within Inventory Kernel)
`InventoryReserved` | `InventoryReleased` | `AllocationCreated` | `CountCompleted` | `CostCalculated` | `ValuationUpdated`

---

## 9. Financial Ownership (`InventoryOwnership`)

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

## 10. Ten Disconnected Subsystems Replaced by Unified Architecture

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
