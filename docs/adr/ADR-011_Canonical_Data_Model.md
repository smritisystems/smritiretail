<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# ADR-011: Canonical Data Model & SSOT Entity Governance

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
In large ERP systems, entity definitions (Product, Customer, Supplier, Warehouse, Invoice, Stock, Ledger) often fragment into inconsistent parallel schemas across different modules.

---

## Decision
We define a **Canonical Data Model** enforcing Single Source of Truth (SSOT) across core business entities:

1. **`Product`**: Canonical SKU definition (Code, Name, Barcode, MRP, GST Rate, UOM).
2. **`Customer`**: Canonical CRM Party definition (Code, Name, Phone, GSTIN, Address).
3. **`Supplier`**: Canonical Vendor definition (Code, Company Name, GSTIN, Payment Terms).
4. **`Warehouse`**: Canonical Storage Location (Code, Name, Branch ID, Address).
5. **`Invoice`**: Canonical Sales Transaction (Invoice No, Date, Customer, Items, Tax Summary, Payment).
6. **`StockMovement`**: Canonical Inventory Ledger Entry (Item, Warehouse, Movement Type, Qty).
7. **`JournalEntry`**: Canonical Double-Entry Financial Ledger (Entry No, Account, Debit, Credit).

---

## Consequences
- **Positive**: Guarantees identical data structures and field names across POS, Inventory, Sales, Purchase, and Accounting.
- **Negative**: Requires mapping adapters when integrating with legacy third-party systems.
