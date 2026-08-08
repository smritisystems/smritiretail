# SMRITI Platform — Stock Location Engine (SLE) & Stock Network Engine (SNE) v1.0

**Status:** APPROVED ARCHITECTURE — Level 1 Inventory Kernel Core Capability v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Executive Architectural Principle

In SMRITI Retail OS, **stock outside your warehouse** (Retail Chains like Reliance/DMart/Croma, Distributors, Franchises, Institutions like Schools/Hospitals, Marketplaces like Amazon FC, and Goods in Transit) is NOT a separate consignment module.

It is a **Core Platform Capability of the Inventory Kernel**, managed natively by the **Stock Location Engine (SLE)** and **Stock Network Engine (SNE)**.

```text
                               INVENTORY KERNEL v1.0
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
  Stock Movement Engine          Reservation Engine              Availability Engine
        │                                │                                │
        ▼                                ▼                                ▼
  State Engine               ⭐ Stock Location Engine (SLE)    ⭐ Stock Network Engine (SNE)
        │                                │                                │
        ▼                                ▼                                ▼
  Transfer Engine                Valuation Engine                 Replay & Audit Engine
```

---

## 1. Unified Core Entity: `StockLocation`

Instead of treating `Warehouse` as the sole inventory container, every inventory balance in the platform belongs to a `StockLocation`.

### Location Types Matrix

| Location Type | Example | Ownership & Operational Description |
|---|---|---|
| `WAREHOUSE` | Mumbai Central WH | Primary owned distribution warehouse. |
| `STORE` | Andheri Retail Outlet | Company-owned retail store / POS counter. |
| `RETAIL_CHAIN` | Reliance Retail DC / DMart / Croma | Key Account retail chain partner location. |
| `DISTRIBUTOR` | ABC FMCG Distributors | Authorized regional distributor location. |
| `FRANCHISE` | Pune Franchise Outlet | Third-party franchise retail location. |
| `INSTITUTION` | DPS School / Nanavati Hospital | Institutional bulk supply client location. |
| `MARKETPLACE` | Amazon FBA FC / Flipkart FBF | E-commerce channel fulfillment center. |
| `TRANSIT` | Truck MH-01-1234 | Inter-location / partner goods in transit. |
| `FACTORY` | Nashik Garment Factory | Manufacturing & WIP production plant. |

---

## 2. Unified Location-to-Location Movement Model

Every physical stock movement in SMRITI executes as a directional transfer:

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

## 3. Multi-Location Network Aggregation Formula

Stock is tracked natively per product across all network locations:

$$\text{NetworkStock}(\text{SKU}) = \sum_{i \in \text{Locations}} \text{LocationBalance}(\text{SKU}, i)$$

### Network Balance Example (SKU A)

| Location Name | Location Type | On-Hand Qty | Status |
|---|---|---|---|
| Mumbai Warehouse | `WAREHOUSE` | 150 units | Physical Warehouse Stock |
| Reliance Retail DC | `RETAIL_CHAIN` | 300 units | Partner Stock |
| DMart Kalwa | `RETAIL_CHAIN` | 120 units | Partner Stock |
| Amazon FBA FC | `MARKETPLACE` | 40 units | Channel Stock |
| Truck MH-04-9876 | `TRANSIT` | 30 units | In-Transit Stock |
| **TOTAL NETWORK STOCK** | **ALL LOCATIONS** | **640 units** | **Canonical Network Total** |

---

## 4. Multi-Kernel Coordination

The **Stock Location Engine** coordinates cleanly across all Layer 1 Platform Kernels:

- **Inventory Kernel**: Tracks physical quantities by location (`SKU` + `StockLocation`).
- **Accounting Kernel**: Manages financial ownership, partner outstanding receivables, revenue recognition, and GST tax.
- **Sales Kernel**: Handles commercial contracts, pricing tiers, and credit terms.
- **UX Kernel**: Renders Stock Network Visibility (SNV) dashboards across Desktop, Tablet, and Mobile profiles.

---

## 5. Stock Network Visibility (SNV) Dashboard API

```json
{
  "location_id": "loc-rel-001",
  "location_name": "Reliance Retail DC",
  "location_type": "RETAIL_CHAIN",
  "metrics": {
    "units_received": 25000,
    "units_sold": 18500,
    "units_returned": 320,
    "units_damaged": 45,
    "current_balance_qty": 6135,
    "outstanding_financial_value": 4872000.00,
    "currency": "INR"
  }
}
```
