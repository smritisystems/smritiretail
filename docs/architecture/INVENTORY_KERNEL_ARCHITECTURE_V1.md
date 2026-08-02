# SMRITI Platform — Inventory Kernel Architecture v1.0.0

**Status:** PERMANENTLY FROZEN ARCHITECTURE — Level 1 Master Specification v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **inventory management** across owned warehouses, retail chains (Reliance, DMart, Croma), distributors, franchises, institutions, marketplaces (Amazon FC), goods in transit, and production lines is NOT a collection of separate modules.

It is a **Unified Enterprise Platform Kernel**, structured into Core Orchestrators, Service Engines, Public Platform APIs, and Platform Infrastructure Services:

```text
                               INVENTORY KERNEL v1.0

================================== CORE ENGINES ==================================
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
  • Inventory Costing Engine (ICE)              • Inventory Compliance Engine (ICOMP)
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

## 1. Five Immutable Architectural Rules

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
Valuation Engine MUST NEVER mutate stock quantities or stock ledger entries.

---

## 2. Implementation Certification Gates (IK001..IK008)

To enforce architectural integrity during platform execution, every implementation phase MUST satisfy 8 automated certification gates:

| Gate ID | Certification Requirement | Technical Verification Standard |
|---|---|---|
| **IK001** | Facade Entry Gate | All inventory updates execute exclusively via `InventoryCommandFacade v1`. |
| **IK002** | Single Balance Mutator Gate | Zero direct stock balance mutations outside `Movement Engine`. |
| **IK003** | Derived Availability Gate | ATP availability is dynamically derived, never stored. |
| **IK004** | Network Stock Aggregation Gate | Network stock is dynamically aggregated across locations, never stored. |
| **IK005** | Event Publication Gate | Business & technical inventory events published correctly via `InventoryEventBus v1`. |
| **IK006** | Replay Determinism Gate | Replay engine reproduces GL and stock balances with 100% mathematical accuracy. |
| **IK007** | Costing & Valuation Isolation Gate | Costing and valuation engines remain isolated from physical quantities. |
| **IK008** | Engine Boundary Gate | Engine boundary enforcement rules respected with zero boundary bleed. |

---

## 3. Six-Phase Implementation Roadmap

```text
Phase 1: Core Data Model  ──►  Phase 2: Public APIs v1  ──►  Phase 3: Core Engines
                                                                    │
                                                                    ▼
Phase 6: Consumer Migration  ◄──  Phase 5: Infrastructure  ◄──  Phase 4: Service Engines
```

- **Phase 1 — Core Data Model**: `InventoryLocation`, `InventoryIdentity`, `InventoryMovement`, `InventoryDocument`, `Reservation`, `Allocation`, `InventoryOwnership`, `LocationRole`.
- **Phase 2 — Public APIs v1**: `InventoryCommandFacade v1` & `InventoryQueryFacade v1`.
- **Phase 3 — Core Engines**: `ITEX`, `IIE`, `Movement Engine`, `ILE`, `Reservation Engine`, `Availability Engine`.
- **Phase 4 — Service Engines**: `IVE`, `IAE`, `IRE`, `IPE`, `ICE`, `ICOMP`.
- **Phase 5 — Infrastructure**: `InventoryEventBus v1`, `Replay Engine`, `Audit Engine`, `Valuation Engine`.
- **Phase 6 — Consumer Migration**: Migrate Sales, Purchase, POS, WMS, Marketplace, Manufacturing, and Partner/Retail Chain flows to facade APIs.

---

## 4. Engine Boundary Enforcement Matrix

| Engine | Can Modify | Cannot Modify |
|---|---|---|
| **ITEX (Transaction Engine)** | Inventory documents & directives | Stock balances |
| **IIE (Identity Engine)** | Identity resolution & validation | Quantities |
| **Movement Engine** | Stock ledger entries | Costing & valuation |
| **ICE (Costing Engine)** | Unit costs & cost layers | Quantities |
| **Valuation Engine** | Financial ledger valuation entries | Stock ledger entries |
| **IPE (Policy Engine)** | Movement permissions | Stock balances |
| **ICOMP (Compliance Engine)** | Regulatory validation status | Movement history |

---

## 5. Complete Execution Lifecycle Pipeline

$$\text{Transaction} \xrightarrow{\text{ITEX}} \text{IIE (Identity)} \xrightarrow{\text{Movement}} \text{ILE (Location)} \xrightarrow{\text{Availability}} \text{Allocation} \xrightarrow{\text{Costing}} \text{Valuation} \xrightarrow{\text{Accounting}}$$

---

## 6. Public Platform Inventory Facades v1.0.0

Consumer business modules interact exclusively through stable public platform facades:

```text
       CONSUMER DOMAINS (Sales, Purchase, POS, WMS, Marketplace, Consignment)
                                         │
                  ┌──────────────────────┴──────────────────────┐
                  │                                             │
                  ▼                                             ▼
       InventoryQueryFacade v1                        InventoryCommandFacade v1
  • getStock()                                    • moveInventory()
  • getAvailable()                                • transferInventory()
  • getNetworkStock()                             • reserveInventory()
  • getLocationStock()                            • releaseReservation()
  • getInventoryHistory()                         • adjustInventory()
  • getInventoryKPIs()                            • replenishInventory()
```

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
