# SMRITI Platform — Inventory Location Engine (ILE) & Inventory Network Engine (INE) v1.0

**Status:** APPROVED ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions, Marketplaces like Amazon FC, Goods in Transit, and Production Lines) is NOT a collection of separate modules.

It is a **Unified Core Platform Capability of the Inventory Kernel**, orchestrated natively by six specialized engines:
1. **Inventory Location Engine (ILE)**: Answers *"Where is inventory?"* (Locations, Balances, Hierarchy, Capacity, Status, Zone, Bin).
2. **Inventory Network Engine (INE)**: Answers *"How inventory moves."* (Location Network Graph, Transfers, Routing, Multi-location ATP).
3. **Inventory Visibility Engine (IVE)**: Answers *"What is the current real-time state?"* (Universal single-pane-of-glass dashboards).
4. **Inventory Allocation Engine (IAE)**: Answers *"Where should orders be fulfilled from?"* (FEFO/FIFO, nearest location, split fulfillment).
5. **Inventory Replenishment Engine (IRE)**: Answers *"How should stock be replenished?"* (Min/Max thresholds, Reorder Points, Suggested Transfers).
6. **Inventory Policy Engine (IPE)**: Answers *"What movements and operations are permitted?"* (Location SKU eligibility, cold-chain, quarantine, permitted movement types).

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
  ⭐ Inventory Allocation Engine (IAE) ⭐ Inventory Replenishment (IRE) ⭐ Inventory Policy Engine (IPE)
        │                                │                                │
        ▼                                ▼                                ▼
  Transfer Engine                Valuation Engine                 Replay & Audit Engine
```

---

## 1. Core Entity: `InventoryLocation` & Node Hierarchy

An `InventoryLocation` represents a finite, manageable node within the hierarchical inventory network tree (`ParentLocation`, `Children`, `TreePath`, `Depth`).

> **CRITICAL SCALABILITY GUARD**: Customers (`Party`) are NOT `InventoryLocation` nodes. A consumer sale is an **Exit from the Inventory Network** (`TO_LOCATION = NULL` / `INVENTORY_EXIT`), keeping the location tree finite and high-performing.

### Hierarchical Location Tree Example

```text
Reliance Retail (Parent Partner Node)
  ├── Mumbai Central DC (Child Location)
  │     ├── Zone A (Child Zone)
  │     │     └── Bin A12 (Child Bin)
  │     └── Zone B (Child Zone)
  └── Pune DC (Child Location)
```

---

## 2. Node Relationships & Automated Network Graph Topology

Locations maintain explicit relationship topology (`Supplies`, `Replenishes`, `ProducesTo`), allowing the **Inventory Replenishment Engine (IRE)** and **Inventory Allocation Engine (IAE)** to walk the graph automatically:

```text
Factory  ──► [ProducesTo] ──► Mumbai Central WH  ──► [Supplies] ──► Reliance DC  ──► [Replenishes] ──► Store
```

---

## 3. Renamed Financial Ownership (`InventoryOwnership`)

Financial ownership (`InventoryOwnership`) is completely decoupled from physical location (`InventoryLocation`):

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

## 4. Inventory Policy Engine (IPE) Rules

The **Inventory Policy Engine (IPE)** evaluates movement permission constraints before any stock movement is executed:

- **SKU Eligibility**: Can this location receive/sell SKU X?
- **Movement Permissibility**: Is `CHANNEL_DISPATCH` permitted to location Y?
- **Storage Constraints**: Does SKU X require cold-chain or hazard-certified locations?
- **Quality & Quarantine**: Is SKU X under quality hold or quarantine at location Z?

---

## 5. Universal Business Scenario Mapping Matrix

| Business Model | From Location | To Location | InventoryOwnership | Movement Flow |
|---|---|---|---|---|
| **Reliance Outright** | `WAREHOUSE` | `RETAIL_CHAIN` | `PARTNER` | `CHANNEL_DISPATCH` ──► `CHANNEL_SALE` (`TO = NULL`) |
| **Reliance Consignment** | `WAREHOUSE` | `RETAIL_CHAIN` | `CONSIGNMENT` | `CONSIGNMENT_DISPATCH` ──► `CONSIGNMENT_SALE` (`TO = NULL`) |
| **Amazon FBA** | `WAREHOUSE` | `MARKETPLACE` | `MARKETPLACE` | `MARKETPLACE_TRANSFER` ──► `MARKETPLACE_SALE` (`TO = NULL`) |
| **Company Store** | `WAREHOUSE` | `STORE` | `COMPANY` | `TRANSFER` ──► `POS_SALE` (`TO = NULL`) |
| **Distributor** | `WAREHOUSE` | `DISTRIBUTOR` | `PARTNER` | `DISTRIBUTOR_DISPATCH` ──► `DISTRIBUTOR_SALE` (`TO = NULL`) |

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
