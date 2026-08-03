<!--
  Project      : SMRITI Retail OS
  Document     : Purchase Studio — Business Workflow Certification V1
  File         : docs/sdk/PURCHASE_WORKFLOW_CERTIFICATION_V1.md
  Author       : Jawahar Ramkripal Mallah
  Version      : 1.0.0  (Sprint 5 — Wave 1)
  Created      : 2026-08-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  Classification: Internal — Business Workflow Governance
-->

# Purchase Studio — Business Workflow Certification V1

**Status:** WAVE 1 CERTIFICATION — Sprint 5
**Scope:** PUR-001 through PUR-017
**Dependency:** All gates require SXP Platform Certification (CS-001 to CS-012) and
               Inventory Studio Certification (INV-001 to INV-021) to be met first.
**Kernel Rule:** Every mutating purchase workflow MUST route stock mutations through
               `InventoryDomainService.executeMovement()` → ITEX → ILGE.
               No UI component or manifest action may write stock data directly.

---

## Certification Status

| Gate | Workflow | Criterion | Status |
|---|---|---|---|
| PUR-001 | Raise PO | PO created via `PurchaseCommandFacade.createPO()` → `IPurchaseService.savePO()` | Unverified |
| PUR-002 | Raise PO | `PoWizard.validatePoPayload()` blocks submission when supplierId or lines missing | Unverified |
| PUR-003 | Raise PO | Offline PO queued on network failure; payload includes `operationId` + `idempotencyKey` | Unverified |
| PUR-004 | Raise PO | PO wizard completes in ≤ 3 interactions (SWEF P-007) | Unverified |
| PUR-005 | Receive Goods | `PurchaseCommandFacade.receiveGoods()` calls `InventoryDomainService.executeMovement({ movement_type:'purchase_receipt' })` | Unverified |
| PUR-006 | Receive Goods | `available_qty` at destination warehouse increases by received qty | Unverified |
| PUR-007 | Record Bill | `PurchaseCommandFacade.recordBill()` → `PurchaseTransactionService.executePurchase()` completes full pipeline | Unverified |
| PUR-008 | Record Bill | GST breakdown (CGST + SGST or IGST) computed correctly | Unverified |
| PUR-009 | Record Bill | Balanced journal entry created via `PostingService` | Unverified |
| PUR-010 | Record Bill | Purchase invoice document generated via `DocumentLifecycleService` | Unverified |
| PUR-011 | Make Payment | `PurchaseCommandFacade.makePayment()` → `PaymentService.processPayment()` reduces outstanding | Unverified |
| PUR-012 | Make Payment | Multi-channel split (Cash + UPI) accepted and totalled correctly | Unverified |
| PUR-013 | Supplier Return | `PurchaseCommandFacade.returnToSupplier()` → `PurchaseReturnService.executeReturn()` + stock reversal via ITEX | Unverified |
| PUR-014 | Supplier Return | Debit note document generated | Unverified |
| PUR-015 | Reorder Bridge | `inventory.reorder` action publishes `PurchaseOrderRequested.v1` on `DomainEventBus` | Unverified |
| PUR-016 | Reorder Bridge | `PurchaseOrderRequestListener` receives event → `PurchaseCommandFacade.createDraftPO()` creates draft PO | Unverified |
| PUR-017 | All | `purchase.manifest.ts` and `PurchaseCommandFacade` contain zero direct imports of `StockLedgerService`, `StockTransferService`, or `ReservationService` | Unverified |

---

## Gate Definitions

### PUR-001 — Raise PO: Kernel Call

**Workflow:** Raise Purchase Order
**Kernel Call:** `PurchaseCommandFacade.createPO(PoWizardPayload, ctx)` → `IPurchaseService.savePO()`
**Evidence Required:**
- `git diff` of `purchase.manifest.ts` showing delegation to `purchaseCommandFacade.createPO()`
- `git diff` of `PurchaseCommandFacade.ts` showing `savePO` call
- Unit test asserting returned record has `status: "Draft"` and correct `poNumber`

**Pass Criteria:** `PurchaseOrderRecord` returned with `supplierId`, `lines`, and `status: "Draft"`.

---

### PUR-002 — Raise PO: Wizard Validation

**Workflow:** Raise Purchase Order — Validation Gate
**Evidence Required:** Unit test asserting `validatePoPayload({})` returns errors for missing supplierId and lines.
**Pass Criteria:** `errors.length > 0` when supplierId or lines are absent; `errors.length === 0` on valid payload.

---

### PUR-003 — Raise PO: Offline Queue

**Workflow:** Raise Purchase Order — Network Failure Path
**Evidence Required:**
- Unit test mocking `IPurchaseService.savePO` to throw a network error
- Assert `OfflineExperienceManager.getPendingCount()` increases by 1
- Assert queued payload includes `idempotencyKey` field

**Pass Criteria:** `offline: true` in facade result; pending count +1; idempotencyKey present in queued envelope.

---

### PUR-004 — Raise PO: 3-Step Wizard (SWEF P-007)

**Workflow:** Raise Purchase Order — UX Gate
**Evidence Required:** Manual browser verification in `F:\SMRITI9TEST`
**Pass Criteria:** PO created within 3 wizard steps (Supplier+SKU → Qty+Rate+HSN → Review+Submit).

---

### PUR-005 — Receive Goods: ITEX Movement

**Workflow:** Goods Receipt (GRN)
**Kernel Call:** `PurchaseCommandFacade.receiveGoods()` → `InventoryDomainService.executeMovement({ movement_type: 'purchase_receipt' })`
**Evidence Required:**
- Unit test mocking `inventoryDomainService.executeMovement` and asserting it is called with `movement_type: 'purchase_receipt'`
- Assert `idempotency_key` includes `poId` and `itemId`

**Pass Criteria:** `executeMovement` called once per line with correct `movement_type` and `idempotency_key`.

---

### PUR-006 — Receive Goods: Available Qty

**Workflow:** Goods Receipt — Inventory Impact
**Evidence Required:** Integration assertion via `InventoryDomainService.fetchAvailableStock()` before and after GRN.
**Pass Criteria:** `available_qty` at destination increases by `receivedQty`.

---

### PUR-007 — Record Bill: Full Pipeline

**Workflow:** Record Supplier Bill
**Kernel Call:** `PurchaseCommandFacade.recordBill()` → `PurchaseTransactionService.executePurchase()`
**Evidence Required:**
- Unit test asserting `result.workflow.status === 'approved'`
- Unit test asserting `result.invoice.receiptText` contains `'SMRITI PURCHASE INVOICE'`

**Pass Criteria:** Pipeline completes: workflow approved + invoice generated.

---

### PUR-008 — Record Bill: GST Calculation

**Workflow:** Record Supplier Bill — Tax Gate
**Evidence Required:** Unit test asserting `result.taxBreakdown.cgst + result.taxBreakdown.sgst === result.taxBreakdown.totalTax`
**Pass Criteria:** CGST + SGST = total tax; or IGST = total tax for inter-state.

---

### PUR-009 — Record Bill: Journal Entry

**Workflow:** Record Supplier Bill — Accounting Gate
**Evidence Required:** Unit test asserting `result.journalEntry` has balanced debit/credit lines.
**Pass Criteria:** `journalEntry` not null; debits === credits.

---

### PUR-010 — Record Bill: Invoice Document

**Workflow:** Record Supplier Bill — Document Gate
**Evidence Required:** Unit test asserting `result.invoice.totalAmount === netAmount + totalTax`
**Pass Criteria:** `invoice.totalAmount` correctly sums net + tax.

---

### PUR-011 — Make Payment: Outstanding Reduction

**Workflow:** Make Payment
**Kernel Call:** `PurchaseCommandFacade.makePayment()` → `PaymentService.processPayment()`
**Evidence Required:** Unit test asserting `result.outstanding === totalAmount - paymentTotal`
**Pass Criteria:** Outstanding decreases by exactly the payment amount.

---

### PUR-012 — Make Payment: Multi-Channel

**Workflow:** Make Payment — Split Payment Gate
**Evidence Required:** Unit test with `paymentLines: [{ channel:'CASH', amount:150 }, { channel:'UPI', amount:150 }]`
**Pass Criteria:** `result.paymentResult.totalAmount === 300` (both channels summed).

---

### PUR-013 — Supplier Return: Stock Reversal

**Workflow:** Return to Supplier
**Kernel Call:** `PurchaseCommandFacade.returnToSupplier()` → `PurchaseReturnService.executeReturn()` + `InventoryDomainService.executeMovement({ movement_type:'purchase_return' })`
**Evidence Required:**
- Unit test mocking `executeMovement` and asserting `movement_type: 'purchase_return'`
- Assert `idempotency_key` includes `returnId` and `itemId`

**Pass Criteria:** `executeMovement` called with `movement_type: 'purchase_return'` for each return line.

---

### PUR-014 — Supplier Return: Debit Note

**Workflow:** Return to Supplier — Document Gate
**Evidence Required:** Unit test asserting `result.debitNote` is not null and `result.debitNote.receiptText` is non-empty.
**Pass Criteria:** Debit note generated as part of return pipeline.

---

### PUR-015 — Reorder Bridge: Event Published

**Workflow:** Inventory Reorder → Purchase Studio Event Bridge
**Evidence Required:**
- Unit test subscribing to `DomainEventBus` for `"PurchaseOrderRequested.v1"`
- Execute `raise_reorder_po` action with valid payload
- Assert event received with all 7 payload fields populated

**Pass Criteria:** Event received; `payload.source === "InventoryStudio"`; `payload.skuId`, `warehouseId`, `suggestedQty` all present.

---

### PUR-016 — Reorder Bridge: Draft PO Created

**Workflow:** PurchaseOrderRequestListener → Draft PO
**Evidence Required:**
- Unit test calling `PurchaseOrderRequestListener.register()` then publishing `"PurchaseOrderRequested.v1"`
- Assert `PurchaseCommandFacade.createDraftPO()` is called
- Assert returned draft PO has `status: "Draft"` and correct `skuId` in lines

**Pass Criteria:** Draft PO created with `warehouseId` matching event; `lines[0].itemId === event.skuId`.

---

### PUR-017 — Kernel Boundary: No Direct Inventory Service Imports

**Workflow:** All Purchase Workflows — Architecture Gate
**Evidence Required:**
```powershell
Select-String -Path src/components/purchase/purchase.manifest.ts `
              -Pattern "StockLedgerService|StockTransferService|ReservationService"
# Expected: 0 matches

Select-String -Path src/domains/purchase/PurchaseCommandFacade.ts `
              -Pattern "StockLedgerService|StockTransferService|ReservationService"
# Expected: 0 matches
```

**Pass Criteria:** Both `Select-String` commands return 0 matches.

---

## Manual Verification Checklist (Docker — F:\SMRITI9TEST)

> All gates below require the Docker environment to be running:
> `docker compose up workspace api db`

- [ ] PUR-004: PO wizard completes in ≤ 3 interactions in browser
- [ ] PUR-006: Available qty confirmed in Inventory Studio after GRN
- [ ] PUR-007–PUR-010: Supplier bill recorded and invoice visible in Purchase Bills workspace
- [ ] PUR-011–PUR-012: Payment posted and outstanding ledger updated
- [ ] PUR-013–PUR-014: Return posted; debit note visible; stock decremented
- [ ] PUR-015–PUR-016: Reorder workspace raises event; draft PO appears in Purchase Orders

---

*End of Purchase Studio — Business Workflow Certification V1*
