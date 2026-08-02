# SMRITI Platform — Inventory Location Engine (ILE) & Inventory Network Engine (INE) v1.0

**Status:** PERMANENTLY FROZEN ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions, Marketplaces like Amazon FC, Goods in Transit, and Production Lines) is NOT a collection of separate modules.

It is a **Unified Core Platform Capability of the Inventory Kernel**, structured into Core Engines, Service Engines, Platform APIs, and Platform Services:

```text
                               INVENTORY KERNEL v1.0

================================== CORE ENGINES ==================================
  • Inventory Movement Engine                   • Inventory Location Engine (ILE)
  • Inventory Network Engine (INE)              • Reservation Engine
  • Availability Engine
==================================================================================
                                         │
                                         ▼
================================= SERVICE ENGINES ================================
  • Inventory Visibility Engine (IVE)           • Inventory Allocation Engine (IAE)
  • Inventory Replenishment Engine (IRE)        • Inventory Policy Engine (IPE)
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
```

---

## 1. Public Platform Inventory Facades (`InventoryQueryFacade` & `InventoryCommandFacade`)

Business modules interact exclusively through stable public platform facades:

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

## 2. Standard Business Inventory Documents

Operational workflows execute via standardized inventory business documents:

$$\text{Inventory Document} \longrightarrow \text{Movement Engine} \longrightarrow \text{Inventory Event Bus} \longrightarrow \text{Balances Updated}$$

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

## 3. Core Engine Distinction: ILE vs INE

- **Inventory Location Engine (ILE)**: Answers *"Where is inventory?"* (Locations, Balances, Node Hierarchy, Capacity, Status, Bins).
- **Inventory Network Engine (INE)**: Answers *"How inventory moves."* (Network Graph, Routes, Distance, Supply Paths, Parent/Child Routing).

---

## 4. Master Data vs Runtime State Isolation

### Master Data (Static Configuration)
- `InventoryLocation` (Master Node Definition)
- `LocationRoles` (`[DISTRIBUTION, FULFILLMENT, SALES, REPLENISHMENT, SERVICE, RETURNS, PRODUCTION]`)
- `InventoryTerritory` (Territorial Tree Nodes)
- `LocationCapabilities` (Operational Permissions)
- `TopologyRelationships` (Graph Connectors)
- `BinHierarchy` (Rack / Bin Structural Layout)
- `InventoryPolicies` (Movement & Storage Constraints)

### Runtime State (Operational Transactions)
- `StockMovement` (Directional Movement Stream)
- `Reservation` (ATP Stock Commitments)
- `Allocation` (Order Fulfillment Assignments)
- `Replenishment` (Suggested Transfer Jobs)
- `LocationKPIs` (Real-Time Performance Metrics)
- `InventoryEvents` (Published Domain Event Bus)

---

## 5. Generic Inventory Event Bus (`InventoryEventBus`)

```text
  InventoryReceived               InventoryIssued                 InventoryTransferred
  InventoryReserved               InventoryReleased               InventoryAdjusted
  InventoryReturned               InventoryDamaged                InventoryExpired
  InventoryCounted                InventoryAllocated              InventoryReplenishmentSuggested
```

---

## 6. Financial Ownership (`InventoryOwnership`)

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

## 7. Universal Business Scenario Mapping Matrix

| Business Model | From Location | To Location | InventoryOwnership | Movement Flow |
|---|---|---|---|---|
| **Reliance Outright** | `WAREHOUSE` | `RETAIL_CHAIN` | `PARTNER` | `CHANNEL_DISPATCH` ──► `CHANNEL_SALE` (`TO = NULL`) |
| **Reliance Consignment** | `WAREHOUSE` | `RETAIL_CHAIN` | `CONSIGNMENT` | `CONSIGNMENT_DISPATCH` ──► `CONSIGNMENT_SALE` (`TO = NULL`) |
| **Amazon FBA** | `WAREHOUSE` | `MARKETPLACE` | `MARKETPLACE` | `MARKETPLACE_TRANSFER` ──► `MARKETPLACE_SALE` (`TO = NULL`) |
| **Company Store** | `WAREHOUSE` | `STORE` | `COMPANY` | `TRANSFER` ──► `POS_SALE` (`TO = NULL`) |
| **Distributor** | `WAREHOUSE` | `DISTRIBUTOR` | `PARTNER` | `DISTRIBUTOR_DISPATCH` ──► `DISTRIBUTOR_SALE` (`TO = NULL`) |

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
