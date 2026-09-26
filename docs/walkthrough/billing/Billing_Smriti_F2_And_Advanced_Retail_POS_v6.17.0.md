<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.30.0
  * Created    : 2026-09-14
  * Modified   : 2026-09-14
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI F2 Advanced Item Search, Dual-Grid Row Editing & Enterprise POS Invoicing Architecture

**Walkthrough Version:** v6.17.0  
**Date:** 2026-09-14  
**Module:** `billing` / `pos`  
**Area:** POS Billing Terminal & F2 Universal Lookup  
**Status:** Completed  
**DHI Impact:** 99% maintained (Grade A)  

---

## 1. Purpose
This walkthrough documents the full architectural modernization and enterprise parity engineering for the POS Billing Terminal in SMRITI Retail OS. Based on comprehensive research into tier-1 retail enterprise POS systems (specifically Shoper 9 POS Series A releases 1.0 through 1.7), this implementation introduces a brand-compliant advanced item search modal (`SmritiF2AdvancedItemSearch.tsx`), in-place row editing via double-click, `F7` instant exact cash settlement, retail barcode scanner burst protection, and active item inspection ribbons across `BillingTerm.tsx` and `ProPosBillingTerm.tsx`.

---

## 2. Scope
- **Brand Governance Compliance:** Strict enforcement of zero legacy or prohibited product names in new filenames, exports, and UI components; all components standardise on `Smriti`.
- **Advanced F2 Item Search:** Clean rewrite of the F2 lookup modal with general selection, quantity comparison operators (`Greater Than`, `Is`, `Less Than` defaulting to `Qty > 0`), advanced drawer (`Alt+A`), image zoom (`Alt+I`), and single-key `Enter` selection contract.
- **Dual-Grid Row Editing Contract:** Double-clicking any item in the Item Details Grid loads it back into the Direct Entry input row for rapid modification of Quantity, Rate, Discount Code, Discount %, or Salesperson, saving in-place on `Enter`.
- **Item Deletion & Hotkey Ergonomics:** `Ctrl+D` line item deletion for highlighted rows, `Escape` edit-cancellation, `ArrowUp`/`ArrowDown` grid navigation, and `F11` quick-return to barcode input.
- **Exact Cash Settlement (`F7`):** Single-keystroke checkout bypassing multi-tender modal for cash-exact counter transactions.
- **Barcode Scanner Burst Guard:** Automatic interception and redirection of 8+ digit numeric bursts typed into Quantity or Rate fields back to the Barcode input, keeping `Qty = 1`.
- **Suspended Invoices Line Inspection:** Nested line item inspection preview in Recall queue before pulling suspended bills back into cart.
- **F6 Sales Promotions & "Define Sales Promotions" Catalogue Integration:**
  - `F6` calls active promotional schemes defined in the "Define Sales Promotions" repository.
  - Dual-tab promotional inspection window: Tab 1 (`Item Level Promotional Details`) and Tab 2 (`Bill Level Promotional Details`), toggled dynamically by pressing `F6`.
  - Dedicated "Define Sales Promotions" management window (`SmritiDefineSalesPromotionsModal.tsx`), reachable via `Alt+P` or from F6, allowing creation, modification, priority reordering, and deactivation of promotional schemes.
  - Authoritative persistent service (`SmritiSalesPromotionService.ts`) backing 4 canonical retail categories: Item Level Discounts, Item Level Offers, Bill Level Discounts, and Bill Level Offers.

---

## 3. Files Created
- [`src/components/billing/SmritiF2AdvancedItemSearch.tsx`](file:///F:/SMRITRretailNX/src/components/billing/SmritiF2AdvancedItemSearch.tsx): Enterprise F2 search modal component with tri-modal entity support, comparison operators, and image preview.
- [`src/components/billing/SmritiF6PromotionalDiscountsModal.tsx`](file:///F:/SMRITRretailNX/src/components/billing/SmritiF6PromotionalDiscountsModal.tsx): Dual-tab F6 sales promotions modal dynamically resolving schemes from Define Sales Promotions.
- [`src/components/billing/SmritiDefineSalesPromotionsModal.tsx`](file:///F:/SMRITRretailNX/src/components/billing/SmritiDefineSalesPromotionsModal.tsx): Dedicated "Define Sales Promotions" management catalog window.
- [`src/services/smritiSalesPromotionService.ts`](file:///F:/SMRITRretailNX/src/services/smritiSalesPromotionService.ts): Persistent sales promotion service for defining and querying schemes by level and priority.
- [`src/tests/smritiF2BillingSearch.test.ts`](file:///F:/SMRITRretailNX/src/tests/smritiF2BillingSearch.test.ts): 22 comprehensive unit test cases across 14 test suites verifying all search, filter, edit, delete, scanner guard, and settlement behaviors.
- [`src/tests/smritiSalesPromotionEngine.test.ts`](file:///F:/SMRITRretailNX/src/tests/smritiSalesPromotionEngine.test.ts): 10 unit test cases verifying Define Sales Promotions, priority sorting, F6 resolution, and statutory compliance.

---

## 4. Files Modified
- [`src/components/billing/BillingTerm.tsx`](file:///F:/SMRITRretailNX/src/components/billing/BillingTerm.tsx): Integrated `SmritiF2AdvancedItemSearch`, `SmritiF6PromotionalDiscountsModal`, `SmritiDefineSalesPromotionsModal`, `F6` discounts, `Alt+P` define promos, `F7` exact cash settlement, scanner burst protection, double-click in-place editing, `Ctrl+D` deletion, `Escape` cancellation, and active line inspector ribbon.
- [`src/components/billing/propos/ProPosBillingTerm.tsx`](file:///F:/SMRITRretailNX/src/components/billing/propos/ProPosBillingTerm.tsx): Mounted `SmritiF2AdvancedItemSearch`, `SmritiF6PromotionalDiscountsModal`, `SmritiDefineSalesPromotionsModal`, wired `F6` discounts, `Alt+P` define promos, `F11` quick return, scanner burst protection, double-click in-place editing, `Ctrl+D` deletion, and active item inspector ribbon.

---

## 5. Architecture Decisions
1. **Separation of Direct Entry vs Item Details Grid:** Mirroring proven enterprise POS architecture, data entry takes place in an ergonomics-optimized input bar (Direct Entry Grid), while committed items reside in a virtualized/scrollable table (Item Details Grid). Double-clicking bridges the two via explicit `editingLineId` state.
2. **In-Place Mutation Guard:** When `editingLineId` is active, committing direct entry replaces the targeted line item without duplicating rows, shifting row indices, or corrupting running serial numbers (`sNo`).
3. **Scanner Guard State Interception:** Fast optical scanners firing keystrokes during cashier focus shifts into `Qty` or `Rate` are intercepted via regex `/^\d{8,}$/`, sanitized, and transferred to `barcode` while retaining default `Qty = "1"`.
4. **Single-Keystroke Cash Settlement (`F7`):** Counter transactions where customers pay exact currency bypass the multi-tender dialog, immediately staging `mode: "Cash"` with zero change due.
5. **Promotions Called from "Define Sales Promotions" Catalog (`F6`):** Rather than hardcoding static discounts, `F6` queries `SmritiSalesPromotionService`, retrieving active promotion definitions created in "Define Sales Promotions" (`SmritiDefineSalesPromotionsModal.tsx`), applying highest-priority schemes by default and allowing manual cashier override, statutory reason selection, and bidirectional recalculation against `Calculated On`.

---

## 6. Design Rationale
In high-throughput retail checkout (supermarkets, apparel, department stores), cashiers rarely use a mouse. Every second spent clicking tabs or clearing erroneous scanner bursts slows billing throughput. Providing `F7` instant settlement, `F11` quick-return, `F6` promotions called from "Define Sales Promotions", `Ctrl+D` line voiding, and double-click row re-editing ensures cashier operational velocity while maintaining complete GST, MRP, and ledger accounting integrity.

---

## 7. Implementation Summary
- **Component Interface:** Clean `SmritiF2AdvancedItemSearch`, `SmritiF6PromotionalDiscountsModal`, and `SmritiDefineSalesPromotionsModal`.
- **Keyboard Shortcuts:**
  - `F2`: Universal Lookup (Variant / Item Search when on Stock No; Customer when on Customer).
  - `F6`: Sales Promo & Promotional Schemes Window (press F6 inside modal to toggle Item Level and Bill Level tabs).
  - `Alt + P`: Define Sales Promotions Catalogue Window (add, edit, prioritize schemes).
  - `F7`: Exact Cash Instant Checkout.
  - `F8`: Multi-Tender Settlement Modal.
  - `F11` / `F1`: Quick Return focus to Barcode input.
  - `F12`: Suspend Bill.
  - `Ctrl + D`: Void/Delete highlighted line item.
  - `Escape`: Cancel line edit mode or dismiss modal.
  - `ArrowUp` / `ArrowDown`: Navigate item grid.
- **Inspector Ribbon:** Displays detailed item metadata (Stock No, Barcode, Description, Brand, Size, HSN, GST %, Net Amount, Salesperson).

---

## 8. Tests Executed
```bash
npx vitest run src/tests/smritiF2BillingSearch.test.ts src/tests/smritiSalesPromotionEngine.test.ts
```
**Terminal Output:**
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/smritiF2BillingSearch.test.ts (22 tests) 13ms
 ✓ src/tests/smritiSalesPromotionEngine.test.ts (10 tests) 27ms

 Test Files  2 passed (2)
      Tests  32 passed (32)
   Start at  05:45:17
   Duration  467ms
```

Full Vitest Suite:
```bash
npx vitest run
```
**Terminal Output:**
```text
 Test Files  126 passed (126)
      Tests  816 passed (816)
   Start at  05:45:29
   Duration  25.02s
```

TypeScript Compilation Check:
```bash
npx tsc --noEmit
```
**Terminal Output:** Exit code 0 (zero errors).

Vite Production Build:
```bash
npm run build
```
**Terminal Output:**
```text
✓ 3538 modules transformed.
✓ built in 30.21s
```

---

## 9. Verification Results
- **Unit Test Suites:** 32/32 tests green (`smritiF2BillingSearch.test.ts` & `smritiSalesPromotionEngine.test.ts`).
- **Full Test Suite:** 126/126 test files green (816/816 tests passing).
- **TypeScript Compiler:** Zero errors (`npx tsc --noEmit` exit code 0).
- **Production Build:** `npm run build` cleanly compiled 3,538 modules in 30.21s.

---

## 10. Known Limitations
- Offline mode stores customer changes and promotional schemes locally in `localStorage`; central cloud synchronization requires network connection.
- Price override in Direct Entry is subject to role-based permission policies configured in POS profiles.

---

## 11. Future Work
- Real-time cloud sync for defined promotional schemes across multiple distributed store franchise nodes.
- Bi-directional Bluetooth barcode scanner buffer integration.

---

## 12. Related ADRs
- `ADR-0028`: Universal Lookup Architecture (F2 Dispatcher).
- `ADR-0034`: POS Cashier Ergonomics & Single-Keystroke Tender Settlement.

---

## 13. Related RFCs
- `RFC-POS-2026-07`: Dual-Grid Direct Entry and Fast Line Item Revision Contract.
- `RFC-POS-2026-09`: Retail Barcode Scanner Keystroke Desynchronization Guard.
