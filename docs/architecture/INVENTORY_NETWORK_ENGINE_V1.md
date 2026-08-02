# SMRITI Platform — Inventory Location Engine (ILE) & Inventory Network Engine (INE) v1.0

**Status:** APPROVED ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions like Schools/Hospitals, Marketplaces like Amazon FC, Goods in Transit, and Production Lines) is NOT a collection of separate modules.

It is a **Unified Core Platform Capability of the Inventory Kernel**, orchestrated natively by four dedicated engines:
1. **Inventory Location Engine (ILE)**: Answers *"Where is inventory?"* (Locations, Balances, Ownership, Capacity, Status, Zone, Bin, Hierarchy).
2. **Inventory Network Engine (INE)**: Answers *"How inventory moves."* (Location Network, Transfers, Routing, Multi-location ATP, Fulfillment Path).
3. **Inventory Visibility Engine (IVE)**: Universal real-time visibility across all screens and profiles.
4. **Inventory Allocation Engine (IAE)**: Intelligent order fulfillment routing (FEFO/FIFO, nearest location, multi-location split fulfillment).

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
  ⭐ Inventory Allocation Engine (IAE) Transfer Engine              Valuation Engine
        │                                │                                │
        ▼                                ▼                                ▼
  Replay Engine                  Audit Engine                    State Engine
```

---

## 1. Unified Core Entity: `InventoryLocation`

Instead of treating `Warehouse` as the sole inventory container, every inventory balance in SMRITI belongs to an `InventoryLocation`.

### Inventory Location Types Matrix

| Location Type | Example | Operational Description |
|---|---|---|
| `WAREHOUSE` | Mumbai Central WH | Primary owned distribution warehouse. |
| `STORE` | Andheri Retail Outlet | Company-owned retail store / POS counter. |
| `RETAIL_CHAIN` | Reliance Retail DC / DMart / Croma | Key Account retail chain partner location. |
| `DISTRIBUTOR` | ABC FMCG Distributors | Authorized regional distributor location. |
| `FRANCHISE` | Pune Franchise Outlet | Third-party franchise retail location. |
| `INSTITUTION` | DPS School / Nanavati Hospital | Institutional bulk supply client location. |
| `MARKETPLACE` | Amazon FBA FC / Flipkart FBF | E-commerce channel fulfillment center. |
| `SUPPLIER` | Vendor Drop-Ship Warehouse | Vendor warehouse for drop-ship fulfillment. |
| `FACTORY` | Nashik Garment Factory | Manufacturing & WIP production plant. |
| `TRANSIT` | Truck MH-01-1234 | Inter-location / partner goods in transit. |
| `CUSTOMER` | Customer RMA Location | Customer site holding stock for RMA/service. |
| `REPAIR_CENTER` | Service & Refurbish Hub | Technical repair & quality hold facility. |

---

## 2. Explicit Ownership Layer (`OwnershipType`)

To support multi-party commercial structures in Indian retail, every `InventoryLocation` balance tracks explicit financial ownership:

| Ownership Type | Commercial Description | Accounting & Financial Treatment |
|---|---|---|
| `OWNED` | Company physical stock | Company balance sheet inventory asset. |
| `CONSIGNMENT` | Goods held at partner site | Company inventory asset until reported sold. |
| `BILL_AND_HOLD` | Sold but held at company WH | Customer-owned stock; revenue recognized. |
| `THIRD_PARTY` | Third-party stock held for fulfillment | Non-company stock; off-balance sheet. |
| `CUSTOMER` | Customer stock held for service | RMA/Service stock; off-balance sheet. |
| `SUPPLIER` | Vendor drop-ship stock | Supplier-owned stock until GRN/dispatch. |

---

## 3. Unified Location-to-Location Movement Model

Every physical stock movement executes as a directional transfer:

$$\text{StockMovement}: \text{FROM\_LOCATION} \xrightarrow{\quad \text{MovementType} \quad} \text{TO\_LOCATION}$$

### Movement Taxonomy

| From Location | To Location | Movement Type | Business Flow Description |
|---|---|---|---|
| `WAREHOUSE` | `RETAIL_CHAIN` | `CHANNEL_DISPATCH` | Dispatch goods to Key Account / Partner. |
| `RETAIL_CHAIN` | `CUSTOMER` | `CHANNEL_SALE` | Partner reports consumer sale. |
| `CUSTOMER` | `RETAIL_CHAIN` | `CHANNEL_RETURN` | Consumer returns item to Partner. |
| `RETAIL_CHAIN` | `WAREHOUSE` | `CHANNEL_STOCK_RETURN` | Partner returns unsold stock to Warehouse. |
| `WAREHOUSE` | `TRANSIT` | `TRANSFER_OUT` | Outbound inter-location dispatch. |
| `TRANSIT` | `WAREHOUSE` | `TRANSFER_IN` | Inbound inter-location receipt. |
| `SUPPLIER` | `WAREHOUSE` | `PURCHASE_RECEIPT` | Inbound GRN from Vendor. |

---

## 4. Multi-Location Network Aggregation Formula

Stock is tracked natively per product across all network locations:

$$\text{NetworkStock}(\text{SKU}) = \sum_{i \in \text{Locations}} \text{LocationBalance}(\text{SKU}, i)$$

### Network Balance Example (SKU A)

| Location Name | Location Type | Ownership | On-Hand Qty |
|---|---|---|---|
| Mumbai Warehouse | `WAREHOUSE` | `OWNED` | 150 units |
| Reliance Retail DC | `RETAIL_CHAIN` | `CONSIGNMENT` | 300 units |
| DMart Kalwa | `RETAIL_CHAIN` | `CONSIGNMENT` | 120 units |
| Amazon FBA FC | `MARKETPLACE` | `OWNED` | 40 units |
| Truck MH-04-9876 | `TRANSIT` | `OWNED` | 30 units |
| **TOTAL NETWORK STOCK** | **ALL LOCATIONS** | **MIXED** | **640 units** |

---

## 5. Ten Subsystems Replaced by Unified ILE & INE Architecture

By elevating inventory location and network capabilities to Level 1 Core Inventory Kernel status, SMRITI eliminates 10 disconnected legacy modules:

1. ✅ **Consignment Module**
2. ✅ **Marketplace Stock Module**
3. ✅ **Franchise Stock Module**
4. ✅ **Distributor Stock Module**
5. ✅ **Branch Stock Module**
6. ✅ **Company Stores Module**
7. ✅ **Institutional Stock Module**
8. ✅ **Van Sales Module**
9. ✅ **Mobile Sales Module**
10. ✅ **Transit Stock Module**

All 10 business scenarios execute seamlessly through the **Inventory Location Engine (ILE)**, **Inventory Network Engine (INE)**, **Inventory Visibility Engine (IVE)**, and **Inventory Allocation Engine (IAE)**.
