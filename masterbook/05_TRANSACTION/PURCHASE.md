<!--
  SMRITI Retail OS — Masterbook
  Document  : 05_TRANSACTION/PURCHASE.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Purchase Transaction Architecture

---

## Purchase Order Flow

```
PurchaseStudio (React)
    │
    ├── selectedSupplier  (required — real DB supplier_id)
    ├── items[]           (product lines with qty, rate, GST)
    ├── deliveryDate
    └── paymentTerms
            │
    CreatePurchaseOrderCommand({ supplierId: selectedSupplier.id, ... })
            │
    PurchaseService.savePurchaseOrder()
            │
    POST /api/v1/purchase/orders
    Body: { supplierId: "supp-abc123", ... }
            │
    PurchaseOrchestrator:
    ├── Validate supplier.company_id == tenant_ctx.company_id
    ├── Auto-generate PO number
    └── INSERT INTO purchase_orders + purchase_order_items
```

---

## Key Business Rules

| Rule | Mandate |
|---|---|
| `supplier_id` required | Every PO must have a named supplier |
| Supplier ownership check | Orchestrator validates supplier belongs to current company |
| PO number auto-generated | Numbering engine — "PO-00001" |
| Goods Receipt Note (GRN) | Separate document — links to PO for 3-way match |
| Invoice matching | Purchase invoice matched against PO + GRN |

---

## Purchase Invoice (Bill) vs PO

```
Purchase Order (intent to buy)
    ↓
Goods Receipt Note / GRN (physical receipt)
    ↓
Purchase Bill / Invoice (financial record — triggers payable)
    ↓
Payment Voucher (cash / bank payment)
```

Each stage is a separate document. The PO is never modified once approved. GRN and Bill are linked to PO by reference.

---

## Workspace

Single Purchase Workspace (`purchase-studio`) for all purchase operations — Rule PROD-002 / SWP-001.

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
