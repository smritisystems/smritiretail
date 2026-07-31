# Architecture Decision Record (ADR-013)
# ITEM_MASTER_STUDIO_ENTERPRISE_STANDARD_v1.0 (INVENTORY DOMAIN)

**Status:** FROZEN — v1.0 (2026-07-31)  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Base Layer:** Consumes `SMRITI_ENTERPRISE_WORKSPACE_STANDARD_v1.0` (ADR-020 Layer 1 UX Framework)  
**Scope:** Item Master & Inventory Stock Governance Architecture  

---

## Executive Summary

`ITEM_MASTER_STUDIO_ENTERPRISE_STANDARD_v1.0` defines the frozen domain-specific architecture for Item Master & Inventory Management across SMRITI Retail OS. It inherits the **Common Workspace UX Framework (`ADR-020`)** for layout rules, while establishing inventory-specific capabilities: SKU/Barcode management, HSN/GST classification, Multi-Tier Pricing (MRP, Wholesale, Dealer Rate), Barcode Hub printing, Bin Locations, and Inventory Stock Valuation.

---

## 1. DOMAIN BOUNDARIES & ISOLATION

Item Master Studio **strictly adheres to domain isolation**:

- **Inherits Layer 1 (`ADR-020`)**: Hero banner (~55px), single-row ERP toolbar, full-width fluid layout (100%), SUPG data grid contracts, right-docked valuation summary, and SWMF pop-out window triggers.
- **DOES NOT INHERIT Procurement Features**: Does not contain Temporary Product Engine, Purchase Approval Queues, Supplier Procurement Workflows, RFQs, or Procurement Gallery.

---

## 2. INVENTORY DOMAIN CAPABILITY MATRIX

| Capability | Scope & Description | Platform Entry Point |
|---|---|---|
| **SKU & Barcode Management** | Auto-generation of unique SKUs, EAN/UPC barcodes, & barcode printing | `CreateItemCommand` |
| **HSN & GST Classification** | HSN/SAC code mapping, GST rate percentage (0, 5, 12, 18, 28%), taxability | `STRE.calculateTaxes` |
| **Multi-Tier Pricing** | MRP, Retail Price, Purchase Cost, Wholesale Rate, Dealer Rate | `IItemService` |
| **Stock & Warehouse Parameters**| Multi-location warehouse assignment, Bin/Rack location, Min/Max stock thresholds | `SPK.entities` |
| **Batch & Expiry Tracking** | Mandatory batch number, manufacturing date, & expiry date tracking for pharmacy/grocery | `ItemMasterBatchBar` |
| **Barcode Printing Hub** | Custom barcode label generator supporting thermal 50x25mm & A4 sticker sheets | `BarcodePrintDialog` |
| **Inventory Valuation** | Real-time calculation of total catalog valuation (INR) & low-stock reorder alerts | `ItemMasterTab` Summary |

---

## 3. INVENTORY CONFIGURATION METADATA (`SPK.configuration`)

```yaml
ItemMasterStudio:
  autoGenerateSKU: true
  autoGenerateBarcode: true
  defaultWarehouse: "Central WH-01"
  defaultGSTPercentage: 18
  enableBatchTracking: false
  enableExpiryTracking: false
  defaultLabelTemplate: "50x25mm"
  lowStockThresholdDefault: 5
```
