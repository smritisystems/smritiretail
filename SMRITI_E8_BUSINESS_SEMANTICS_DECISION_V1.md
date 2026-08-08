# SMRITI ITEM MASTER E8 BUSINESS SEMANTICS DECISION V1
## Architectural & Business Semantics Audit Report

> **Final Decision:** E8 = CLOSED — SNAPSHOT SEMANTICS ARE CORRECT
> **Governance Baseline:** DATABASE: FROZEN (269 physical tables) | PRODUCT SCHEMA: FROZEN | SKU: FROZEN | BARCODE: FROZEN | ATTRIBUTE AUTHORITY: FROZEN

---

## Executive Business Semantics Decision Summary

| Analysis Domain | Model A (Live Master Linkage) | Model B (Item Snapshot Value - SMRITI Baseline) | SMRITI Governance Alignment |
|---|---|---|---|
| **Item Attribute Semantics** | Dynamic projection of live MasterValue | Point-in-time item snapshot at creation time | 🟢 **Model B (Snapshot)** |
| **SKU & Barcode Identity** | Risk of SKU/Barcode mismatch | 100% SKU & Barcode Immutability Guarantee | 🟢 **Model B (Snapshot)** |
| **Historical Document Integrity** | Distorts historical invoices, POs, GST records | 100% Audit & Tax Compliance Preservation | 🟢 **Model B (Snapshot)** |
| **Tenant & Catalog Isolation** | Risk of bulk unintended record mutation | Zero side-effects across existing catalog | 🟢 **Model B (Snapshot)** |
| **Import & Master Governance** | Requires complex relational cascade | Clean validation at entry time; snapshot storage | 🟢 **Model B (Snapshot)** |
| **Architectural Decision** | Unnecessary complexity & audit risk | **E8 = CLOSED — SNAPSHOT SEMANTICS ARE CORRECT** | 🟢 **CLOSED BY DESIGN** |

---

## 15-Domain SMRITI Business Requirements Assessment

1. **Item Master:** Product attributes (`color`, `size`, `brand`, `category`, `attributes` JSONB) capture allowed values from `MasterValue` at entry time. Once created, an item's attribute representation is an intentional point-in-time snapshot.
2. **SKU Identity:** SKU generation (e.g. `CH-01-A-RED-38`) uses immutable attribute tokens. Renaming a master option (`RED` -> `Crimson`) must NEVER alter an existing SKU. Model B snapshot semantics natively guarantees SKU immutability.
3. **Variant Identity:** Variants are distinct `Product` records (`style_code + color + size`). Snapshot semantics ensures variant tokens remain stable across item lifecycles.
4. **Barcode Identity:** EAN/GS1/200-series internal barcodes map 1-to-1 to physical item inventory. Model B prevents invalidating or re-printing physical barcode labels.
5. **Historical Invoices:** Printed invoices and statutory tax receipts reference historical item descriptors (e.g., "T-Shirt Red 38"). Mutating past items to "Crimson" violates accounting auditability.
6. **Purchase Documents:** Purchase orders and Goods Receipt Notes (GRN) match historical supplier delivery notes. Snapshot semantics preserves exact PO text.
7. **Sales Documents:** POS sales receipts, credit notes, and delivery challans match historical customer transaction receipts.
8. **Stock Movements:** Stock ledger entries log exact movement descriptions at transaction execution time.
9. **Excel Import:** Excel grid entry uses `MasterValue` for entry-time validation and canonical key resolution (`UniversalAttributeEngine`). Once committed, items store snapshot attributes.
10. **Product Attributes:** `Product.attributes` JSONB stores key-value text snapshots (`{"color": "Black", "size": "XL"}`) optimized for fast read-performance and indexing without joins.
11. **Industry Packs:** Industry packs (`apparel`, `footwear`, `electronics`, `jewellery`, `medical`) resolve display column labels (`Article Code` vs `Style Code`) dynamically at the UI registry level, independent of underlying item storage.
12. **Master Lookup Governance:** `MasterValue` provides governed dropdown options for *new* items. Renaming `RED` to `Crimson` updates future selection options without rewriting historical items.
13. **Multi-Tenant Behavior:** Snapshot storage guarantees zero cross-tenant leakage or unintended mass-update risks.
14. **Auditability:** Statutory audit trail requires historical immutability for item attributes once committed.
15. **Historical Reporting:** Financial and sales analytics report historical metrics accurately without retrospective text alteration.

---

## Architectural Principle: String Snapshot vs Identity Reference

> **SMRITI Architectural Principle (AP-008):**
> String equality (`Product.color == MasterValue.name`) is an **intentional snapshot representation**, NOT a dynamic foreign key reference.
> `MasterValue` serves as the **Validation Authority** at item entry time.
> `Product` stores the **Historical Item Snapshot** for operational execution.

---

## Final Status Declaration

```text
FINAL DECISION:
E8 = CLOSED — SNAPSHOT SEMANTICS ARE CORRECT

STATUS:
CLOSED BY ARCHITECTURAL DESIGN

DATABASE:
FROZEN (269 physical tables)

PRODUCT SCHEMA:
FROZEN

SKU ALGORITHM:
FROZEN

BARCODE ALGORITHM:
FROZEN

ATTRIBUTE AUTHORITY:
FROZEN
```