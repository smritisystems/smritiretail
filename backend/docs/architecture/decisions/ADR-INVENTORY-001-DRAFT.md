<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Classification: Architecture Decision Record — DRAFT (NOT COMMITTED TO DB)
Created      : 2026-09-03
-->

# ADR-INVENTORY-001-DRAFT: `inventory.stock_transfer` as Canonical — `wms.inter_branch_transfer` Deprecated

**Status:** DRAFT — not inserted into `smritisys.architecture_decisions` until approved  
**Domain:** `wms` / `inventory`  
**Date:** 2026-09-03  
**Author:** Jawahar Ramkripal Mallah  

---

## Context

Two frontend components model the same business object (`StockTransfer`) with different lifecycle fidelity:

| Component | File | Engine | States | Transfer Types |
|---|---|---|---|---|
| `InterBranchTransferModal.tsx` | `src/components/warehouse/` | `interBranchTransferEngine.ts` | 6 states | Branch-to-branch only |
| `StockTransferStudioModal.tsx` | `src/components/inventory/` | `stockTransferEngine.ts` | 10 states | INTER_BRANCH, WAREHOUSE_TO_BRANCH |

The backend has a full `StockTransfer` model (`stock_transfers` table) with a `TransferStatus` enum defining 6 states: `DRAFT, DISPATCHED, IN_TRANSIT, RECEIVED, PARTIAL, CANCELLED`. Neither frontend component currently calls the backend API (`/api/v1/wms/transfers`).

### Evidence

`interBranchTransferEngine.ts` — 9,756 bytes, branch-to-branch, 6 states  
`stockTransferEngine.ts` — 8,792 bytes, two transfer types, 10 states  
`/api/v1/wms/transfers` — IMPLEMENTED (dispatch, receive, e-way bill, delivery challan lifecycle)

## Decision

`StockTransferStudioModal` (`inventory.stock_transfer`) is the **canonical** component. It has:
- Richer lifecycle (10 states vs 6)
- Two transfer types (INTER_BRANCH + WAREHOUSE_TO_BRANCH)
- More complete engine implementation

`InterBranchTransferModal` (`wms.inter_branch_transfer`) is marked **DEPRECATED** in the governance registry.

## Prerequisites Before Physical Deprecation

The following must be resolved before `InterBranchTransferModal` is removed or redirected:

1. **Lifecycle state reconciliation:** The backend `TransferStatus` enum has 6 states; `StockTransferStudioModal` engine has 10. The extra 4 states (`SUBMITTED`, `APPROVED`, `STOCK_RESERVED`, `REJECTED`) must be added to the backend model via migration before the frontend calls the backend API.

2. **Backend API integration:** Both components currently use local engines. Before deprecating `InterBranchTransferModal`, `StockTransferStudioModal` must be validated against the live `/api/v1/wms/transfers` endpoints.

3. **Import audit:** All callers of `InterBranchTransferModal` must be identified and migrated to use `StockTransferStudioModal`.

## Current Registry State

| Capability | Status | Notes |
|---|---|---|
| `wms.inter_branch_transfer` | `DEPRECATED` | Retained for audit continuity |
| `inventory.stock_transfer` | `UNDER_REVIEW` | Pending lifecycle state reconciliation |

## Consequences

- Neither component is removed in this ADR — only the registry status is updated.
- The actual file move/removal is a separate Phase 2 cleanup task.
- The backend `TransferStatus` enum may need a migration to add the 4 missing states.

## Related ADRs

- ADR-WMS-001 (`stock_transfer` entity registration)
- ADR-WMS-002 (wave_execution pattern — same LOCAL_ENGINE + AVAILABLE_NOT_USED pattern)
