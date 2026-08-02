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

## 2. Engine Boundary Enforcement Matrix

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

## 3. Complete Execution Lifecycle Pipeline

$$\text{Transaction} \xrightarrow{\text{ITEX}} \text{IIE (Identity)} \xrightarrow{\text{Movement}} \text{ILE (Location)} \xrightarrow{\text{Availability}} \text{Allocation} \xrightarrow{\text{Costing}} \text{Valuation} \xrightarrow{\text{Accounting}}$$

---

## 4. Core Engine Suite (Foundational Orchestration)

1. **Inventory Transaction Engine (ITEX)**: Single entry orchestrator receiving all commercial business transactions (GRN, Invoice, POS, Transfer, Count) and converting them into atomic movement directives.
2. **Inventory Identity Engine (IIE)**: Centralized identity resolution answering *"What exactly is this inventory?"* (SKU, Batch, Serial Number, Lot, Size/Color Variant, UOM, Packaging, Barcode, RFID, Expiry, Manufacturing Date).
3. **Inventory Movement Engine**: Executes atomic location-to-location stock movements.
4. **Inventory Location Engine (ILE)**: Answers *"Where is inventory?"* (Locations, Balances, Node Hierarchy, Capacity, Status, Bins).
5. **Inventory Network Engine (INE)**: Answers *"How inventory moves."* (Network Graph, Routes, Distance, Supply Paths, Parent/Child Routing).
6. **Reservation Engine**: Manages ATP reservations and channel commitments.
7. **Availability Engine**: Calculates real-time Available-to-Promise (ATP) stock.

---

## 5. Service Engine Suite (Business Capabilities)

1. **Inventory Visibility Engine (IVE)**: Answers *"What is the current real-time state?"* (Universal single-pane-of-glass dashboards & KPIs).
2. **Inventory Allocation Engine (IAE)**: Answers *"Where should orders be fulfilled from?"* (FEFO/FIFO, nearest location, split fulfillment).
3. **Inventory Replenishment Engine (IRE)**: Answers *"How should stock be replenished?"* (Min/Max thresholds, Reorder Points, Suggested Transfers).
4. **Inventory Policy Engine (IPE)**: Answers *"What operational movements are permitted?"* (Location capabilities, movement rules).
5. **Inventory Costing Engine (ICE)**: Calculates item valuation using FIFO, Moving Average, Weighted Average, Standard Cost, Specific Identification, and Replacement Cost.
6. **Inventory Compliance Engine (ICOMP)**: Evaluates legal & regulatory constraints (Expiry, Batch/Serial tracking, Cold Chain, Drug License verification, Hazard storage, Import/Export, GST compliance).

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

The **Inventory Event Bus (v1)** segregates domain events into external business events and internal technical events:

### Business Events (Consumed by Accounting, CRM, Analytics, Notifications)
`GoodsReceived` | `GoodsIssued` | `GoodsTransferred` | `GoodsSold` | `GoodsReturned` | `GoodsDamaged` | `GoodsExpired`

### Internal Technical Events (Consumed within Inventory Kernel)
`InventoryReserved` | `InventoryReleased` | `AllocationCreated` | `CountCompleted` | `CostCalculated` | `ValuationUpdated`

---

## 8. Standard Business Inventory Documents v1

$$\text{Business Transaction} \xrightarrow{\text{ITEX}} \text{Inventory Document} \xrightarrow{\text{IIE}} \text{Movement} \xrightarrow{\text{Event Bus}} \text{Balance Update}$$

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
