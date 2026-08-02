# SMRITI Platform — Inventory Location Engine (ILE) & Inventory Network Engine (INE) v1.0

**Status:** APPROVED ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions, Marketplaces like Amazon FC, Goods in Transit, and Production Lines) is NOT a collection of separate modules.

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

## 2. Decoupling Financial Ownership from Physical Location

Financial ownership (`OwnershipType`) is completely decoupled from physical location (`InventoryLocation`):

```text
Physical Location (Where inventory is)  ≠  Financial Ownership (Who owns inventory)
```

### Scenario 1: Outright GST Sale to Reliance Retail (Standard Outright Flow)

1. **Step 1 — Invoice & Dispatch 300 units to Reliance DC**:
   - `FROM`: Mumbai Warehouse (1000 ──► 700 units)
   - `TO`: Reliance DC (0 ──► 300 units)
   - `MovementType`: `CHANNEL_DISPATCH`
   - `OwnershipType`: `PARTNER_OWNED` (Invoice posted: Dr Reliance Debtor, Cr Sales, Cr GST).
   - *Network Total*: 700 (WH) + 300 (Reliance) = 1000 units.

2. **Step 2 — Reliance reports Consumer Sale of 20 units**:
   - `FROM`: Reliance DC (300 ──► 280 units)
   - `TO`: Customer (0 ──► 20 units)
   - `MovementType`: `CHANNEL_SALE`
   - *Network Total*: 700 (WH) + 280 (Reliance) + 20 (Customer) = 980 units.
   - *No double reduction*: Mumbai Warehouse stock remains untouched at 700 units.

---

### Scenario 2: Consignment Agreement with Reliance (Consignment Flow)

1. **Step 1 — Dispatch 300 units on Consignment**:
   - `FROM`: Mumbai Warehouse (1000 ──► 700 units)
   - `TO`: Reliance DC (0 ──► 300 units)
   - `MovementType`: `CONSIGNMENT_DISPATCH`
   - `OwnershipType`: `COMPANY_OWNED` (Company retains balance sheet asset).
   - *Network Total*: 700 (WH) + 300 (Consignment) = 1000 units.

2. **Step 2 — Reliance reports Consumer Sale of 20 units**:
   - `FROM`: Reliance DC (300 ──► 280 units)
   - `TO`: Customer (0 ──► 20 units)
   - `MovementType`: `CONSIGNMENT_SALE`
   - Revenue Recognized & Journal Voucher posted via `AccountingCommandFacade.post_sales_invoice_voucher()`.

---

## 3. Unified Movement Pipeline Across Supply Network

The movement engine is universal across all tiers:

$$\text{Supplier} \xrightarrow{\quad \text{PURCHASE} \quad} \text{Factory} \xrightarrow{\quad \text{TRANSFER} \quad} \text{Warehouse} \xrightarrow{\quad \text{DISPATCH} \quad} \text{Reliance DC} \xrightarrow{\quad \text{SALE} \quad} \text{Customer}$$

$$\text{StockMovement}(\text{FROM\_LOCATION}, \text{TO\_LOCATION}, \text{MovementType}, \text{OwnershipType})$$

---

## 4. Ten Subsystems Replaced by Unified Architecture

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
