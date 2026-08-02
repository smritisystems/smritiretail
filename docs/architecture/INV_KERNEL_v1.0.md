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

# INV_KERNEL_v1.0

## Purpose

This document defines the frozen inventory kernel for RC2. It is the canonical contract for all inventory state, fulfillment, and movement behavior across SMRITI.

The kernel exists to guarantee one source of truth, shared engine reuse, and deterministic inventory decisions. It is intentionally narrow and stable: no inventory module may implement separate stock logic outside this contract.

---

## Frozen Engine List

The following engines are frozen under INV_KERNEL_v1.0:

- Inventory State Engine
- Availability Engine
- Reservation Engine
- Trace Engine
- Timeline Engine

Status: Frozen for RC2 hardening and production validation.

---

## Canonical Ownership Rule

Every inventory quantity displayed anywhere in SMRITI must originate from the Inventory State Engine.

Every inventory decision must originate from the Inventory State Engine and its dependent engines:

- State Engine
- Availability Engine
- Reservation Engine

No module may independently calculate stock, available quantity, reservation totals, or fulfillment eligibility.

This is the inventory equivalent of the platform Canonical Ownership principle.

---

## Kernel Flow

```text
Stock Ledger
    |
    v
Inventory State Engine
    |
    +----> Availability Engine
    |
    +----> Reservation Engine
    |
    +----> Trace Engine
    |
    +----> Timeline Engine
```

---

## Public Engine APIs

### Inventory State Engine

Purpose: Return canonical inventory state for a product, SKU, warehouse, or ownership context.

Public contract:

- get_product_state(product_id)
- get_warehouse_state(product_id, warehouse_id)
- can_fulfill(product_id, requested_qty)

### Availability Engine

Purpose: Evaluate whether requested quantity can be fulfilled from valid stock state.

Public contract:

- can_fulfill(product_id, warehouse_id, qty, context)

### Reservation Engine

Purpose: Reserve available stock under strict transactional rules.

Public contract:

- reserve(product_id, qty, reservation_type, reservation_id)
- release(product_id, qty, reservation_id)
- cancel(product_id, reservation_id)

### Trace Engine

Purpose: Return movement history for a product, reference document, or SKU.

Public contract:

- get_product_trace(product_id)
- get_reference_trace(reference_doc_id)
- get_sku_trace(sku)

### Timeline Engine

Purpose: Return chronological movement timeline for business-level visibility.

Public contract:

- get_product_timeline(product_id)
- get_sku_timeline(sku)

---

## Exit Criteria

RC2 Inventory Kernel is complete only if all of the following pass:

- Multi-warehouse scenarios validated
- Consignment scenarios validated
- Negative stock scenarios rejected deterministically
- Concurrency reservation behavior validated
- Performance targets achieved
- SI_001 uses the kernel exclusively
- No duplicate stock calculations remain in the codebase

---

## Hardening Requirements

### H1 — Multi-Warehouse

- Main warehouse
- Branch warehouse
- Transit warehouse
- Warehouse-specific availability
- Warehouse transfers

### H2 — Consignment

- Supplier consignment
- Company-owned stock at partner
- Franchise stock ownership
- Mall counter inventory ownership
- Marketplace inventory ownership

### H3 — Negative Stock

- Sell greater than available is rejected
- Reserve greater than available is rejected
- Transfer greater than available is rejected
- Cancel reservation returns state correctly
- Reverse movement reverts the state deterministically

### H4 — Concurrency

Concurrent reservation attempts for the same SKU must be serialized by the engine so only one succeeds under valid stock conditions.

### H5 — Performance

Targets:

- Inventory State calculation: under 20 ms per SKU
- Availability check: under 10 ms
- Reservation: under 20 ms

Benchmark with:

- 100 SKUs
- 10,000 movements
- 100,000 movements

### H6 — SI_001 Integration

Sales Invoice must not calculate inventory.

Sales Invoice execution path must be:

```text
Sales Invoice
    |
    v
Availability Engine
    |
    v
Reservation Engine
    |
    v
Stock Ledger
```

---

## RC2 Freeze Rule

During RC2, no new inventory engine or feature may be introduced unless it is explicitly approved as a hardening item for the frozen kernel.

No inventory module may add parallel stock tables, parallel stock snapshots, or local stock calculations that bypass the canonical engine.

---

## RC3 Unlock Conditions

The following items remain blocked until RC2 exit criteria are fully satisfied:

1. Inventory Decision Engine
2. Inventory 360 Workspace
3. Advanced Inventory Analytics

Only after the kernel is hardened and validated may these be unlocked.
