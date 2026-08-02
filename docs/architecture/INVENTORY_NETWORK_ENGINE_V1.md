# SMRITI Platform — Inventory Location Engine (ILE) & Inventory Topology Engine (ITE) v1.0

**Status:** PERMANENTLY FROZEN ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions, Marketplaces like Amazon FC, Goods in Transit, and Production Lines) is NOT a collection of separate modules.

It is a **Unified Core Platform Capability of the Inventory Kernel**, orchestrated natively by six specialized engines:
1. **Inventory Location Engine (ILE)**: Answers *"Where is inventory?"* (Locations, Balances, Hierarchy, Capacity, Status, Bins).
2. **Inventory Topology Engine (ITE)**: Answers *"How is the network connected?"* (Location Network Graph, Topology, Relationships, Distance, Routing).
3. **Inventory Visibility Engine (IVE)**: Answers *"What is the current real-time state?"* (Universal single-pane-of-glass dashboards & KPIs).
4. **Inventory Allocation Engine (IAE)**: Answers *"Where should orders be fulfilled from?"* (FEFO/FIFO, nearest location, split fulfillment).
5. **Inventory Replenishment Engine (IRE)**: Answers *"How should stock be replenished?"* (Min/Max thresholds, Reorder Points, Suggested Transfers).
6. **Inventory Policy Engine (IPE)**: Answers *"What movements and operations are permitted?"* (Location capabilities, cold-chain, quarantine, permitted movement types).

```text
                               INVENTORY KERNEL v1.0
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
  Stock Movement Engine          Reservation Engine              Availability Engine
        │                                │                                │
        ▼                                ▼                                ▼
  ⭐ Inventory Location Engine (ILE) ⭐ Inventory Topology Engine (ITE) ⭐ Inventory Visibility Engine (IVE)
        │                                │                                │
        ▼                                ▼                                ▼
  ⭐ Inventory Allocation Engine (IAE) ⭐ Inventory Replenishment (IRE) ⭐ Inventory Policy Engine (IPE)
        │                                │                                │
        ▼                                ▼                                ▼
  Transfer Engine                Valuation Engine                 Replay & Audit Engine
```

---

## 1. Core Entity: `InventoryLocation` & Node Hierarchy

An `InventoryLocation` represents a finite node within the hierarchical inventory network tree (`ParentLocation`, `Children`, `TreePath`, `Depth`).

> **CRITICAL SCALABILITY GUARD**: Customers (`Party`) are NOT `InventoryLocation` nodes. A consumer sale is an **Exit from the Inventory Network** (`TO_LOCATION = NULL` / `INVENTORY_EXIT`), keeping the location tree finite and high-performing.

---

## 2. Declarative Location Capabilities (`LocationCapability`)

Operation permissions are declared via capabilities rather than hardcoded location types:

```text
LocationCapabilities = [
  CAN_SELL, CAN_RECEIVE, CAN_DISPATCH, CAN_MANUFACTURE, 
  CAN_REPAIR, CAN_HOLD_CONSIGNMENT, CAN_FULFILL_MARKETPLACE, CAN_ACCEPT_RETURNS
]
```

---

## 3. Enterprise Inventory Territory (`InventoryTerritory`)

Locations belong to multi-tier territorial hierarchies for regional replenishment and planning:

$$\text{Global} \longrightarrow \text{India} \longrightarrow \text{Western Region} \longrightarrow \text{Maharashtra} \longrightarrow \text{Mumbai} \longrightarrow \text{Reliance DC}$$

---

## 4. Location Operational KPIs & Metrics

Every location node exposes standardized operational metrics via the **Inventory Visibility Engine (IVE)**:

```json
{
  "location_id": "loc-rel-001",
  "location_name": "Reliance Retail DC",
  "kpis": {
    "current_on_hand": 6135,
    "available_qty": 5800,
    "reserved_qty": 335,
    "incoming_in_transit": 200,
    "outgoing_in_transit": 0,
    "days_of_cover": 24.5,
    "inventory_value_inr": 4872000.00,
    "inventory_accuracy_pct": 99.8,
    "last_count_date": "2026-07-28",
    "last_sale_date": "2026-08-02",
    "last_receipt_date": "2026-08-01"
  }
}
```

---

## 5. Event-Driven Inventory Architecture (`InventoryEventBus`)

Kernel state changes publish immutable business events for external subscribers (Accounting, Notifications, Analytics):

$$\text{StockReceived} \quad \vert \quad \text{StockIssued} \quad \vert \quad \text{StockReserved} \quad \vert \quad \text{StockReleased} \quad \vert \quad \text{StockAdjusted} \quad \vert \quad \text{StockTransferred}$$

---

## 6. Renamed Financial Ownership (`InventoryOwnership`)

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
