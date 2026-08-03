# Purchase Workflow Certification V2
## Gates PUR-001 – PUR-030

**Status:** Wave 2 unit tests pending run  
**Sprint:** Sprint 5 Wave 2  
**Commit Base:** `a655fcb` (Buffer polyfill fix)  
**Author:** Jawahar Ramkripal Mallah  
**Date:** 2026-08-03

---

## Wave 1 Gates (PUR-001 – PUR-017) — Ported from V1

| Gate | Workflow | Criterion | Status |
|---|---|---|---|
| PUR-001 | Raise PO | `PurchaseCommandFacade.createPO()` → `SPK.services.resolve("PURCHASE").savePO()` | **Partially Verified** — unit tests pass; Docker browser test pending |
| PUR-002 | Raise PO | `PoWizard.validatePoPayload()` blocks missing supplierId or lines | **Done** |
| PUR-003 | Raise PO | Offline PO queued; includes `idempotencyKey` | **Done** |
| PUR-004 | Raise PO | PO wizard completes in ≤ 3 steps (SWEF P-007) | **Done** |
| PUR-005 | Receive Goods | `InventoryDomainService.executeMovement({ movement_type:'purchase_receipt' })` | **Done** |
| PUR-006 | Receive Goods | `available_qty` increases by received qty | **Done** |
| PUR-007 | Record Bill | Full pipeline: workflow → GST → posting → invoice | **Done** |
| PUR-008 | Record Bill | GST breakdown — `cgst + sgst === totalTax` | **Done** |
| PUR-009 | Record Bill | Balanced journal entry created | **Done** |
| PUR-010 | Record Bill | Purchase invoice document generated | **Done** |
| PUR-011 | Make Payment | Outstanding payable reduced | **Done** |
| PUR-012 | Make Payment | Multi-channel (Cash + UPI) split accepted | **Done** |
| PUR-013 | Supplier Return | `InventoryDomainService.executeMovement({ movement_type:'purchase_return' })` | **Done** |
| PUR-014 | Supplier Return | Debit note generated | **Done** |
| PUR-015 | Reorder Bridge | `DomainEventBus.publish("PurchaseOrderRequested.v1")` — listener receives it | **Done** |
| PUR-016 | Reorder Bridge | `PurchaseCommandFacade.createDraftPO()` spy called | **Done** |
| PUR-017 | All | Zero forbidden imports in purchase.manifest.ts + PurchaseCommandFacade | **Done** |

---

## Wave 2 Gates (PUR-018 – PUR-030)

| Gate | Area | Criterion | Status |
|---|---|---|---|
| PUR-018 | Reports: registry | 5 `rep.purchase_*` reports registered in URR | **Unverified** |
| PUR-019 | Reports: category filter | `getReportsByCategory("purchase")` returns ≥ 5 | **Unverified** |
| PUR-020 | Reports: execute | `executeReport("rep.purchase_order_register", ...)` returns columns + rows | **Unverified** |
| PUR-021 | Reports: export formats | All 5 reports declare `["excel","pdf","csv","json"]` | **Unverified** |
| PUR-022 | Supplier: tabs | `resolveSupplierTabs()` returns exactly 4 tabs in ascending order | **Unverified** |
| PUR-023 | Supplier: header | `buildSupplierHeaderSummary()` returns id, name, status, statusBadge | **Unverified** |
| PUR-024 | Supplier: directory workspace | `supplier.directory` workspace registered in WorkspaceRegistry | **Unverified** |
| PUR-025 | Supplier: object page workspace | `supplier.object` workspace registered with `defaultLayout: "object-page"` | **Unverified** |
| PUR-026 | Approval: approve | `approvePO()` with store_manager role → `wf.purchase_order` approve transition succeeds | **Unverified** |
| PUR-027 | Approval: reject | `rejectPO()` with store_manager role → transition to `rejected` state | **Unverified** |
| PUR-028 | Approval: role guard | `approvePO()` with `userRole: "cashier"` → `success: false`, error contains "role" | **Unverified** |
| PUR-029 | Approval: workspace | `purchase.approvals` workspace registered; contains both approve + reject actions | **Unverified** |
| PUR-030 | Boundary: supplier manifest | `supplier.manifest.ts` imports zero `StockLedgerService`/`StockTransferService`/`ReservationService` | **Unverified** |

---

## Files Introduced in Wave 2

| File | Type | Purpose |
|---|---|---|
| `src/components/purchase/purchase.reports.ts` | New | 5 URR-compliant purchase report definitions |
| `src/components/purchase/SupplierObjectPage.ts` | New | WNG-003 Object Page tab resolver + header builder |
| `src/components/purchase/supplier.manifest.ts` | New | Supplier Studio manifest — 2 workspaces, 4 actions |
| `src/domains/purchase/PurchaseCommandFacade.ts` | Modified v1.1.0 | `approvePO()` + `rejectPO()` via WorkflowRegistry |
| `src/components/purchase/purchase.manifest.ts` | Modified v2.2.0 | Reports + Approvals workspaces + 2 new actions |
| `src/kernel/upr/navigation/NavigationRegistry.ts` | Modified | Purchase domain moduleIds extended |
| `src/tests/sxp/purchase_wave2.test.ts` | New | PUR-018–PUR-030 certification tests (13 tests) |

---

## Governance Standards Applied

| Standard | Applied Where |
|---|---|
| URR-001 (Metadata-Driven Reports) | `purchase.reports.ts` — 5 reports declared in `ReportRegistry` |
| URR-002 (Single Execution Entry Point) | `ReportRegistry.executeReport()` used exclusively |
| WNG-003 (Object Page Pattern) | `SupplierObjectPage.ts` — fixed header + 4 tabs |
| WNG-004 (Context-Aware Navigation) | `NavigationRegistry.ts` moduleIds updated |
| WNG-005 (Declarative Navigation) | `supplier.manifest.ts` — metadata-only, no procedural UI code |
| UWR-002 (Single Transition Entry Point) | `approvePO()` + `rejectPO()` call `SPK.workflow.executeTransition()` only |
| PUR-017 (Boundary Contract) | `supplier.manifest.ts` — zero stock service imports |

---

## Verification Commands

```powershell
# TypeScript
npx tsc --noEmit
# Expected: 0 errors

# Test suite
npx vitest run
# Expected: ≥ 347 tests pass (334 + 13 new)

# Boundary check (PUR-030)
Select-String -Path src/components/purchase/supplier.manifest.ts `
              -Pattern "StockLedgerService|StockTransferService|ReservationService"
# Expected: 0 matches
```
