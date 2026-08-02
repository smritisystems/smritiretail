# SMRITI Platform — Inventory Location Engine (ILE) & Inventory Topology Engine (ITE) v1.0

**Status:** PERMANENTLY FROZEN ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions, Marketplaces like Amazon FC, Goods in Transit, and Production Lines) is NOT a collection of separate modules.

It is a **Unified Core Platform Capability of the Inventory Kernel**, structured into three clean operational layers:

```text
                               INVENTORY KERNEL v1.0

================================== CORE ENGINES ==================================
  • Inventory Movement Engine                   • Inventory Location Engine (ILE)
  • Inventory Topology Engine (ITE)             • Reservation Engine
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
================================ PLATFORM SERVICES ===============================
  • Replay Engine                               • Audit Engine
  • Valuation Engine                            • Inventory Event Bus
==================================================================================
```

---

## 1. Master Data vs Runtime State Isolation

To support offline operation, high-speed caching, and clean domain boundaries, static configuration is strictly isolated from operational runtime state:

### Master Data (Static Configuration)
- `InventoryLocation` (Master Node Definition)
- `LocationRoles` (Additive Operational Roles)
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

## 2. Additive Location Roles (`LocationRoles`)

A location has a structural `LocationType`, but maintains one or more additive `LocationRoles`:

| Location Name | LocationType | Additive LocationRoles |
|---|---|---|
| Mumbai Central WH | `WAREHOUSE` | `[DISTRIBUTION, FULFILLMENT]` |
| Reliance Retail DC | `RETAIL_CHAIN` | `[SALES, REPLENISHMENT]` |
| Amazon FBA FC | `MARKETPLACE` | `[FULFILLMENT]` |
| Service & Repair Hub | `REPAIR_CENTER` | `[SERVICE, RETURNS]` |
| Nashik Garment Factory | `FACTORY` | `[PRODUCTION]` |

---

## 3. Generic Inventory Event Bus (`InventoryEventBus`)

The **Inventory Event Bus** publishes generic, inventory-centric business events consumed asynchronously by external kernels (Accounting, Notifications, Analytics, AI Forecasting):

```text
  InventoryReceived               InventoryIssued                 InventoryTransferred
  InventoryReserved               InventoryReleased               InventoryAdjusted
  InventoryReturned               InventoryDamaged                InventoryExpired
  InventoryCounted                InventoryAllocated              InventoryReplenishmentSuggested
```

---

## 4. Financial Ownership (`InventoryOwnership`)

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
