# SMRITI Platform — Inventory Location Engine (ILE) & Inventory Network Engine (INE) v1.0

**Status:** APPROVED ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions, Marketplaces like Amazon FC, Goods in Transit, and Production Lines) is NOT a collection of separate modules.

It is a **Unified Core Platform Capability of the Inventory Kernel**, orchestrated natively by five dedicated engines:
1. **Inventory Location Engine (ILE)**: Answers *"Where is inventory?"* (Locations, Balances, Ownership, Capacity, Status, Zone, Bin, Hierarchy).
2. **Inventory Network Engine (INE)**: Answers *"How inventory moves."* (Location Network Graph, Transfers, Routing, Multi-location ATP).
3. **Inventory Visibility Engine (IVE)**: Universal real-time visibility across all screens and profiles.
4. **Inventory Allocation Engine (IAE)**: Intelligent order fulfillment routing (FEFO/FIFO, nearest location, multi-location split fulfillment).
5. **Inventory Replenishment Engine (IRE)**: Auto replenishment (Min/Max stock, Reorder Point, Suggested Transfers).

```text
                               INVENTORY KERNEL v1.0
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
  Stock Movement Engine          Reservation Engine              Availability Engine
        │                                │                                │
        ▼                                ▼                                ▼
  ⭐ Inventory Location Engine (ILE) ⭐ Inventory Network Engine (INE) ⭐ Inventory Visibility Engine (IVE)
        │                                │                                │
        ▼                                ▼                                ▼
  ⭐ Inventory Allocation Engine (IAE) ⭐ Inventory Replenishment (IRE) Transfer Engine
        │                                │                                │
        ▼                                ▼                                ▼
  Valuation Engine               Replay Engine                   Audit Engine
```

---

## 1. Unified Core Entity: `InventoryLocation`

An `InventoryLocation` represents a finite, manageable node within the inventory network graph.

> **CRITICAL SCALABILITY GUARD**: Customers (`Party`) are NOT `InventoryLocation` nodes. A consumer sale is an **Exit from the Inventory Network** (`TO_LOCATION = NULL` / `INVENTORY_EXIT`), keeping the location graph finite and high-performing.

### Inventory Location Types Matrix

| Location Type | Example | Operational Description |
|---|---|---|
| `WAREHOUSE` | Mumbai Central WH | Primary owned distribution warehouse. |
| `STORE` | Andheri Retail Outlet | Company-owned retail store / POS counter. |
| `RETAIL_CHAIN` | Reliance Retail DC / DMart | Key Account retail chain partner location. |
| `DISTRIBUTOR` | ABC FMCG Distributors | Authorized regional distributor location. |
| `FRANCHISE` | Pune Franchise Outlet | Third-party franchise retail location. |
| `INSTITUTION` | DPS School / Nanavati Hospital | Institutional bulk supply client location. |
| `MARKETPLACE` | Amazon FBA FC / Flipkart FBF | E-commerce channel fulfillment center. |
| `SUPPLIER` | Vendor Drop-Ship Warehouse | Vendor warehouse for drop-ship fulfillment. |
| `FACTORY` | Nashik Garment Factory | Manufacturing & WIP production plant. |
| `TRANSIT` | Truck MH-01-1234 | Inter-location / partner goods in transit. |
| `REPAIR_CENTER` | Service & Refurbish Hub | Technical repair & quality hold facility. |

---

## 2. Location Status (`LocationStatus`)

Every node in the location graph maintains an explicit operational status:

- `ACTIVE`: Available for fulfillment, transfers, and replenishment.
- `INACTIVE`: Temporarily disabled for new shipments.
- `BLOCKED`: Restricting inbound or outbound stock movements.
- `UNDER_AUDIT`: Locked during physical stock count verification.
- `CLOSED`: Permanently decommissioned node.

---

## 3. Rich Financial Ownership Model (`OwnershipType`)

Financial ownership (`OwnershipType`) is completely decoupled from physical location (`InventoryLocation`):

| Ownership Type | Commercial Description | Accounting & Financial Treatment |
|---|---|---|
| `COMPANY_OWNED` | Company physical stock | Company balance sheet inventory asset. |
| `PARTNER_OWNED` | Sold stock held by partner | Invoice posted; revenue recognized. |
| `CONSIGNMENT` | Goods held at partner site | Company inventory asset until reported sold. |
| `MARKETPLACE` | Channel fulfillment stock | Channel asset; revenue on customer dispatch. |
| `THIRD_PARTY` | 3PL stock held for fulfillment | Non-company stock; off-balance sheet. |
| `CUSTOMER_OWNED` | Customer stock held for service | RMA/Service stock; off-balance sheet. |
| `SUPPLIER_OWNED` | Vendor drop-ship stock | Supplier-owned stock until GRN/dispatch. |

---

## 4. Network Movement Pipeline & Inventory Exit Semantics

Every physical stock movement executes as a directional transfer:

$$\text{StockMovement}: \text{FROM\_LOCATION} \xrightarrow{\quad \text{MovementType} \quad} \text{TO\_LOCATION}$$

### Universal Business Scenario Mapping Matrix

| Business Model | From Location | To Location | Ownership Type | Movement Flow |
|---|---|---|---|---|
| **Reliance Outright** | `WAREHOUSE` | `RETAIL_CHAIN` | `PARTNER_OWNED` | `CHANNEL_DISPATCH` ──► `CHANNEL_SALE` (`TO = NULL`) |
| **Reliance Consignment** | `WAREHOUSE` | `RETAIL_CHAIN` | `CONSIGNMENT` | `CONSIGNMENT_DISPATCH` ──► `CONSIGNMENT_SALE` (`TO = NULL`) |
| **Amazon FBA** | `WAREHOUSE` | `MARKETPLACE` | `MARKETPLACE` | `MARKETPLACE_TRANSFER` ──► `MARKETPLACE_SALE` (`TO = NULL`) |
| **Company Store** | `WAREHOUSE` | `STORE` | `COMPANY_OWNED` | `TRANSFER` ──► `POS_SALE` (`TO = NULL`) |
| **Distributor** | `WAREHOUSE` | `DISTRIBUTOR` | `PARTNER_OWNED` | `DISTRIBUTOR_DISPATCH` ──► `DISTRIBUTOR_SALE` (`TO = NULL`) |

---

## 5. Inventory Network Graph Topology & Auto Replenishment (IRE)

Modeling locations as a directed graph enables automated fulfillment routing and replenishment:

```text
                                INVENTORY NETWORK GRAPH
                                           │
                                     [Factory Plant]
                                           │
                                 [Mumbai Central WH]
                                           │
               ┌───────────────────────────┼───────────────────────────┐
               │                           │                           │
       [Reliance DC]                 [Amazon FBA FC]            [Andheri Store]
               │                           │                           │
        (Inventory Exit)            (Inventory Exit)            (Inventory Exit)
       Consumer Sale               Marketplace Sale                 POS Sale
```

### Auto Replenishment Engine (IRE) Workflow

```text
Reliance DC  ──►  Current Stock: 35 units  │  Minimum Threshold: 100 units
                   ↓
Suggested Transfer Generated: Mumbai Central WH ──► Reliance DC (Qty: 65 units)
```

---

## 6. Ten Disconnected Subsystems Replaced by Unified Architecture

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
