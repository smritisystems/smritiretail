<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Classification: Architecture Decision Record — DRAFT (NOT COMMITTED TO DB)
Created      : 2026-09-03
-->

# ADR-WMS-001-DRAFT: Register `warehouse` and `stock_transfer` as First-Class WMS Entities

**Status:** DRAFT — not inserted into `smritisys.architecture_decisions` until approved  
**Domain:** `wms`  
**Date:** 2026-09-03  
**Author:** Jawahar Ramkripal Mallah  

---

## Context

The `wms` domain was seeded in v1394 with the description:
> "Governs zone bins, wave picking, cycle counts, and inter-branch logistics."

However, zero entities were assigned to it. WMS-related capabilities (`warehouse.wave_picking`, `inventory.inter_branch_transfer`) were incorrectly mapped to the `stock_movement` entity (domain=`inventory`), treating the *result* of WMS operations (a stock ledger event) as the *subject* of WMS capabilities.

Two first-class database tables exist and are production-active:

| Table | Model | API Routes |
|---|---|---|
| `warehouses` | `Warehouse` | `GET/POST /api/v1/wms/warehouses`, `GET/PUT /api/v1/wms/warehouses/{id}` |
| `stock_transfers` | `StockTransfer` | `GET/POST /api/v1/wms/transfers`, dispatch, receive, e-way-bill, delivery challan |

Neither has a registered architecture entity. The `wms` domain had no entity ownership assigned to it.

## Decision

Register `warehouse` and `stock_transfer` as first-class entities under the `wms` domain in `architecture_entities`.

### `warehouse` entity

| Attribute | Value |
|---|---|
| `entity_key` | `warehouse` |
| `domain_id` | `wms` |
| `canonical_name` | `Warehouse / Godown Location Master` |
| `canonical_table` | `warehouses` |
| `canonical_model` | `Warehouse` |
| `canonical_service` | `InventoryWmsService` |
| `canonical_api` | `/api/v1/wms/warehouses` |
| `status` | `CANONICAL` |

### `stock_transfer` entity

| Attribute | Value |
|---|---|
| `entity_key` | `stock_transfer` |
| `domain_id` | `wms` |
| `canonical_name` | `Inter-Warehouse Stock Transfer Order` |
| `canonical_table` | `stock_transfers` |
| `canonical_model` | `StockTransfer` |
| `canonical_service` | `InventoryWmsService` |
| `canonical_api` | `/api/v1/wms/transfers` |
| `status` | `CANONICAL` |

## Rationale

- The `stock_transfer` document (source warehouse, destination warehouse, status lifecycle, e-way bill, delivery challan) is semantically distinct from a `stock_movement` (an immutable ledger debit/credit entry). Conflating them violates the single-responsibility principle of the entity registry.
- The `warehouses` table is referenced as a FK by `stock_transfers`, `stock_audits`, and `product_batch_stocks` — it is a genuine master entity, not a subordinate attribute.
- Both entities have full CRUD APIs already implemented in `wms.py`.

## Implementation Status

- Both entities have been inserted into `smritisys.architecture_entities` and `smriti001.architecture_entities` as part of v1395 data corrections (2026-09-03).
- This ADR documents and formalizes that decision retroactively.
- This ADR does **not** need to be inserted into `architecture_decisions` as an `ARCHITECTURE_DECISION_REQUIRED` freeze — it is an `APPROVED` decision being recorded.

## Consequences

- `warehouse.wave_planning`, `warehouse.wave_execution` capabilities now correctly map to the `warehouse` entity.
- `wms.inter_branch_transfer`, `inventory.stock_transfer` capabilities now correctly map to the `stock_transfer` entity.
- The `wms` domain is now actively owned (previously empty).
- The `stock_movement` entity is no longer incorrectly used as a catch-all for WMS operations.

## Related ADRs

- ADR-WMS-002 (wave_planning vs wave_execution split)
- ADR-INVENTORY-001 (StockTransferStudioModal canonical)
