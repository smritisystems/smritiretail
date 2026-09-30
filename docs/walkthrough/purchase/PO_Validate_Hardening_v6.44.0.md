<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.44.0
  Created      : 2026-09-30
  Modified     : 2026-09-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: PO Validation Gate Hardening v6.44.0

**Area:** Procurement / Purchase Order Validation Engine
**Version:** 6.44.0
**Date:** 2026-09-30
**Status:** Done
**Capability:** `@SmritiCapability("PURCHASE", "PO_VENDOR_CONTROL")`

---

## 1. Purpose

Three structural gaps were discovered in the PO validation flow through a full three-layer audit
(Frontend ↔ Backend ↔ Database). This walkthrough documents the root causes, the fixes applied,
and the evidence gathered for each gap.

---

## 2. Scope

| Gap | Severity | Description |
|---|---|---|
| Gap 4 | HIGH | Sizewise Matrix (size_pivot) tab bypassed the entire policy gate |
| Gap 3 | MEDIUM | Stale-line banner showed count only — no per-line detail |
| Gap 1 | LOW | `purchase_order_id` missing from validate payload → orphaned audit logs |

No backend changes were required. All three gaps were frontend-only.

---

## 3. Files Created

1. `docs/walkthrough/purchase/PO_Validate_Hardening_v6.44.0.md` — This document.

---

## 4. Files Modified

| File | Change |
|---|---|
| `src/components/purchase/PoGenerateTab.tsx` | Gap 4 + Gap 1 fix in `handleSubmitGate`; version → 6.44.0 |
| `src/components/purchase/POValidationSummary.tsx` | Gap 3 fix: stale banner renders per-line detail; version → 6.44.0 |
| `src/components/purchase/types.ts` | Added `previous_action?: string` to `POSubmitValidationResult.line_results`; version → 6.44.0 |
| `CHANGELOG.md` | v6.44.0 entry added |

---

## 5. Architecture Decisions

### 5.1 Size-pivot validation uses same endpoint as line-items (Gap 4)

The `/purchase/validate-po-submit` backend already accepted any array of `product_ref` values —
it was never restricted to standard line-items. The fix maps `sizePivotRows` into the same
`lines[]` payload shape using `Pick<PurchaseOrderLineItem, "stockNo" | "orderQty" | "rate" | "vendorDecision">`.
No new endpoint or backend change was needed.

### 5.2 `previous_action` surfaces the backend field already present (Gap 3)

`POSubmitLineResult` on the backend already returns `previous_action: Optional[str]`. The
frontend type `POSubmitValidationResult` was simply missing the field in its intersection type.
Adding it unlocks the stale-detail UI without any backend change.

### 5.3 `purchase_order_id` is optional on both sides (Gap 1)

The backend `POSubmitValidationRequest` has `purchase_order_id: Optional[str] = None`.
Passing `openedOrder?.id ?? undefined` is a zero-risk forward when an existing order is open;
on new drafts `openedOrder` is `null` so `undefined` is passed, maintaining previous behaviour.

---

## 6. Design Rationale

**Gap 4** was the only genuine security/governance concern: a buyer on the Sizewise tab
could submit a PO containing a `BLOCK`-classified product without the engine ever being called.
The fix is minimal — 8 lines of `sizePivotRows` mapping — and uses the same `activeLines`
variable that feeds the existing validate call.

**Gap 3** improves buyer ergonomics: instead of reading *"2 products changed"* and scrolling a
200-row grid, the stale banner now shows:
```
Line 3: SND-SKU-001 — was ALLOW, now BLOCK
Line 7: SND-SKU-012 — was ALLOW, now APPROVAL_REQUIRED
```

---

## 7. Implementation Summary

### Gap 4 — `handleSubmitGate` in `PoGenerateTab.tsx` (lines 873–925)

**Before:**
```typescript
const activeLines = itemView !== "size_pivot"
  ? lineItems.filter(l => l.stockNo && l.orderQty > 0)
  : [];   // ← empty: validation skipped entirely

if (!header.supplierId || activeLines.length === 0) {
  handleSavePO();   // ← submit without policy check
```

**After:**
```typescript
const activeLines = itemView !== "size_pivot"
  ? lineItems.filter(l => l.stockNo && l.orderQty > 0)
  : sizePivotRows
      .filter(r => r.articleNo && r.totalQty > 0)
      .map(r => ({
        stockNo: r.articleNo,
        orderQty: r.totalQty,
        rate: r.rate,
        vendorDecision: r.vendorDecision,
      } as Pick<PurchaseOrderLineItem, "stockNo" | "orderQty" | "rate" | "vendorDecision">));
```

### Gap 1 — validate payload now carries `purchase_order_id`

```typescript
body: JSON.stringify({
  vendor_id: header.supplierId,
  transaction_date: header.orderDate || undefined,
  purchase_order_id: openedOrder?.id ?? undefined,  // ← Gap 1 fix
  lines: activeLines.map(...),
}),
```

### Gap 3 — `POValidationSummary.tsx` stale banner

```tsx
const staleLines = result?.line_results.filter(r => r.stale) ?? [];

{hasStale && (
  <div className="...amber...">
    <div>⚠ {result.stale_count} product(s) changed since you last browsed…</div>
    <ul>
      {staleLines.map(r => (
        <li key={r.line_index}>
          Line {r.line_index + 1}: {r.product_ref}
          {r.previous_action
            ? <> — was <strong>{r.previous_action}</strong>, now <strong>{r.action}</strong></>
            : <> — now <strong>{r.action}</strong></>}
        </li>
      ))}
    </ul>
  </div>
)}
```

### types.ts — `previous_action` field added

```typescript
line_results: (POProductDecision & {
  line_index: number;
  stale?: boolean;
  previous_action?: string;   // ← action at browse-time — set when stale=true
})[];
```

---

## 8. Tests Executed

| Test | Command | Result |
|---|---|---|
| TypeScript strict compile | `npx tsc --noEmit` | Exit 0 — 0 errors |

No new unit tests were added (these are pure frontend structural/UX fixes). Existing `poGenerateUX.test.ts` suite covers `handleSubmitGate` happy-path flows.

---

## 9. Verification Results

**Evidence — TypeScript compile:**
```
The command exited with code 0.
Stdout: (empty)
Stderr: (empty)
```

**Evidence — git diff `PoGenerateTab.tsx` (excerpt):**
```diff
-    const activeLines = itemView !== "size_pivot"
-      ? lineItems.filter(l => l.stockNo && l.orderQty > 0)
-      : [];
+    // ── Gap 4 fix: include size_pivot rows in validation ──
+    const activeLines = itemView !== "size_pivot"
+      ? lineItems.filter(l => l.stockNo && l.orderQty > 0)
+      : sizePivotRows
+          .filter(r => r.articleNo && r.totalQty > 0)
+          .map(r => ({...} as Pick<PurchaseOrderLineItem, ...>));
+          purchase_order_id: openedOrder?.id ?? undefined,
```

**Evidence — git diff `POValidationSummary.tsx` (excerpt):**
```diff
-              <div className="...font-medium flex items-center gap-2">
-                ⚠ {result.stale_count} product{...} changed since you last browsed. Decisions updated.
+              <div className="...flex flex-col gap-1.5">
+                <div className="flex items-start gap-2 font-medium">
+                  ...{result.stale_count} products changed…
+                </div>
+                <ul className="pl-4 space-y-0.5 font-normal">
+                  {staleLines.map(r => (
+                    <li>Line {r.line_index + 1}: {r.product_ref} — was {r.previous_action}, now {r.action}</li>
+                  ))}
+                </ul>
```

**Status per file:**

| File | Status |
|---|---|
| `src/components/purchase/PoGenerateTab.tsx` | Done |
| `src/components/purchase/POValidationSummary.tsx` | Done |
| `src/components/purchase/types.ts` | Done |
| `CHANGELOG.md` | Done |

---

## 10. Known Limitations

- `previous_action` is only populated by the backend when the existing decision log is found in `po_product_decision_logs`. If the product was never previously evaluated (fresh PO, first time adding the product), `previous_action` will be `null` and the banner falls back to *"now BLOCK"* (handled in the TSX via the ternary).
- Size-pivot rows do not carry a `vendorDecision.decision_log_id` unless the buyer went through the standard F2/barcode flow on the sizewise tab. In that case `decision_log_id` is `undefined` in the validate payload, which the backend accepts (it triggers a fresh evaluation).

---

## 11. Future Work

- Add `vendorDecision` tracking for `sizePivotRows` so size-pivot lines can forward their cached `decision_log_id` on revalidation (reducing backend re-evaluation calls).
- Consider surfacing a "Jump to line N" link in the stale banner that scrolls the PO grid to the affected row.

---

## 12. Related ADRs

- `ADR-0014: FastAPI Backend Sole System-of-Record`
- `ADR-PO-01: POProductPolicyEngine Authoritative Decision Principle`

---

## 13. Related RFCs

- `RFC-PO-Validate-Gate-Hardening-2026-09-30` (informal — documented here)
