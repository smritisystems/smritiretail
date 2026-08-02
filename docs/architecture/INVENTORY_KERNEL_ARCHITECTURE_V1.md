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
  • Inventory Transaction Engine (ITEX)         • Inventory Movement Engine
  • Inventory Location Engine (ILE)             • Inventory Network Engine (INE)
  • Reservation Engine                          • Availability Engine
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
================================= PLATFORM APIS ==================================
  • InventoryCommandFacade                      • InventoryQueryFacade
==================================================================================
                                         │
                                         ▼
================================ PLATFORM SERVICES ===============================
  • Replay Engine                               • Audit Engine
  • Valuation Engine                            • Inventory Event Bus
==================================================================================
  • (v2 Future Capability: Inventory Forecast Engine - IFE)
```

---

## 1. Core Engine Suite (Foundational Orchestration)

1. **Inventory Transaction Engine (ITEX)**: Single entry orchestrator receiving all commercial business transactions (GRN, Invoice, POS, Transfer, Count) and converting them into atomic movement directives.
2. **Inventory Movement Engine**: Executes atomic location-to-location stock movements.
3. **Inventory Location Engine (ILE)**: Answers *"Where is inventory?"* (Locations, Balances, Node Hierarchy, Capacity, Status, Bins).
4. **Inventory Network Engine (INE)**: Answers *"How inventory moves."* (Network Graph, Routes, Distance, Supply Paths, Parent/Child Routing).
5. **Reservation Engine**: Manages ATP reservations and channel commitments.
6. **Availability Engine**: Calculates real-time Available-to-Promise (ATP) stock.

---

## 2. Service Engine Suite (Business Capabilities)

1. **Inventory Visibility Engine (IVE)**: Answers *"What is the current real-time state?"* (Universal single-pane-of-glass dashboards & KPIs).
2. **Inventory Allocation Engine (IAE)**: Answers *"Where should orders be fulfilled from?"* (FEFO/FIFO, nearest location, split fulfillment).
3. **Inventory Replenishment Engine (IRE)**: Answers *"How should stock be replenished?"* (Min/Max thresholds, Reorder Points, Suggested Transfers).
4. **Inventory Policy Engine (IPE)**: Answers *"What operational movements are permitted?"* (Location capabilities, movement rules).
5. **Inventory Costing Engine (ICE)**: Calculates item valuation using FIFO, Moving Average, Weighted Average, Standard Cost, Specific Identification, and Replacement Cost.
6. **Inventory Compliance Engine (ICOMP)**: Evaluates legal & regulatory constraints (Expiry, Batch/Serial tracking, Cold Chain, Drug License verification, Hazard storage, Import/Export, GST compliance).

---

## 3. Public Platform Inventory Facades (`InventoryQueryFacade` & `InventoryCommandFacade`)

Consumer business modules interact exclusively through stable public platform facades:

```text
       CONSUMER DOMAINS (Sales, Purchase, POS, WMS, Marketplace, Consignment)
                                         │
                  ┌──────────────────────┴──────────────────────┐
                  │                                             │
                  ▼                                             ▼
       InventoryQueryFacade                           InventoryCommandFacade
  • getStock()                                    • moveInventory()
  • getAvailable()                                • transferInventory()
  • getNetworkStock()                             • reserveInventory()
  • getLocationStock()                            • releaseReservation()
  • getInventoryHistory()                         • adjustInventory()
  • getInventoryKPIs()                            • replenishInventory()
```

---

## 4. Standard Business Inventory Documents

$$\text{Business Transaction} \xrightarrow{\text{ITEX}} \text{Inventory Document} \xrightarrow{\text{Movement}} \text{Event Bus} \xrightarrow{\text{Balance Update}}$$

| Document Type | Operational Purpose |
|---|---|
| `TransferOrder` | Authorization for inter-location stock transfer. |
| `TransferReceipt` | Confirmation of physical stock receipt at target location. |
| `Reservation` | Stock allocation/commitment against sales order or channel. |
| `Allocation` | Order fulfillment location assignment. |
| `StockCount` | Physical audit count sheet. |
| `StockAdjustment` | Reconciled variance adjustment document. |
| `ReplenishmentRequest` | Automated location reorder request. |
| `ReplenishmentSuggestion` | Suggested transfer job from parent location. |

---

## 5. Master Data vs Runtime State Isolation

### Master Data (Static Configuration)
- `InventoryLocation` (Master Node Definition)
- `LocationRoles` (`[DISTRIBUTION, FULFILLMENT, SALES, REPLENISHMENT, SERVICE, RETURNS, PRODUCTION]`)
- `InventoryTerritory` (Territorial Tree Nodes)
- `LocationCapabilities` (Operational Permissions)
- `TopologyRelationships` (Graph Connectors)
- `BinHierarchy` (Rack / Bin Structural Layout)
- `InventoryPolicies` & `ComplianceRules` (Operational & Regulatory Constraints)

### Runtime State (Operational Transactions)
- `InventoryTransaction` & `StockMovement` (Transaction & Movement Stream)
- `Reservation` & `Allocation` (Commitments & Assignments)
- `Replenishment` (Suggested Transfer Jobs)
- `LocationKPIs` (Real-Time Performance Metrics)
- `InventoryEvents` (Published Domain Event Bus)

---

## 6. Generic Inventory Event Bus (`InventoryEventBus`)

```text
  InventoryReceived               InventoryIssued                 InventoryTransferred
  InventoryReserved               InventoryReleased               InventoryAdjusted
  InventoryReturned               InventoryDamaged                InventoryExpired
  InventoryCounted                InventoryAllocated              InventoryReplenishmentSuggested
```

---

## 7. Financial Ownership (`InventoryOwnership`)

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

## 8. Ten Disconnected Subsystems Replaced by Unified Architecture

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
