<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.7
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Procurement & Goods Receipt Note (GRN) Walkthrough
-->

# Procurement: Goods Receipt Note (GRN) Logistics, PO Delivery Terms Inheritance & Carrier Audit Trail Walkthrough v1.0.0

## 1. Purpose
This walkthrough documents the end-to-end implementation of commercial and logistics continuity between Purchase Orders and the Goods Receipt Note (GRN) inwarding lifecycle. In footwear and apparel supply chains, failure to carry forward purchase order commercial agreements (such as `Door Delivery` vs `Ex-Factory` freight terms, carrier details, and collection assignments) leads to accounting drift, duplicate freight billing, and misallocated landed costs. SMRITI now guarantees complete inheritance of PO delivery terms, freight terms, payment terms, collection type, and staging instructions across the GRN Studio, desktop receiving terminal, and the official statutory receiving slip (`GrnPrintModal.tsx`).

---

## 2. Scope
1. **Backend Schemas & Service (`backend/app/schemas/purchase.py`, `backend/app/services/purchase.py`)**:
   - Extended `PurchaseReceiptCreate` with `delivery_terms?: Optional[str]` and `freight_terms?: Optional[str]`.
   - Extended `PurchaseReceiptResponse` with `transporter_name`, `lr_number`, `vehicle_number`, `delivery_terms`, `freight_terms`, `payment_terms`, and `collection_type`.
   - Updated `populate_receipt_dates` to parse embedded logistics and commercial metadata from `notes`.
   - Updated `create_purchase_receipt` to resolve terms from the linked PO and embed them within `[LOGISTICS & LANDED COST: ...]` notes.
2. **GRN Receiving Studio (`src/components/purchase/GrnReceiptTab.tsx`)**:
   - Extended `PurchaseOrderOption` and added state for `deliveryTerms`, `freightTerms`, `paymentTerms`, `collectionType`, and `specialInstructions`.
   - In `handleSelectOrder`, dynamically inherited commercial terms and instructions from the selected PO with fallback inference (`buyer`/`to-pay` &rarr; `Ex-Factory`, otherwise `Door Delivery`).
   - In Step 3 ("COMMERCIALS"), transformed the overview grid into a 4-card layout featuring a dedicated **Logistics & Terms** card with dynamic status badges.
   - In Step 4 ("COSTS & FREIGHT"), introduced contextual commercial guidance banners distinguishing `Ex-Factory` (action required to capitalize freight) from `Door Delivery` (prepaid by supplier).
   - In `handlePostGrn` and `handlePrintReceipt`, propagated delivery terms into API payloads and print data.
3. **GRN Desktop Terminal (`src/components/purchase/GrnDesktopTerminal.tsx`)**:
   - In `handleSelectPurchaseOrder`, inherited PO special instructions into `deliveryInstructions` staging notes.
4. **Statutory Receiving Slip (`src/components/purchase/GrnPrintModal.tsx`)**:
   - Extended `GrnPrintReceiptData` with delivery and collection attributes.
   - Rendered statutory `Delivery Terms`, `Freight Terms`, `Payment Terms`, and `Collection` within the **Logistics & Carrier Audit Trail** container.
5. **Automated Verification**:
   - Created `src/tests/grnLogisticsAndTerms.test.tsx` verifying print modal rendering, terms inheritance, and fallback logic.

---

## 3. Files Created
1. `docs/walkthrough/purchase/Purchase_GRN_Logistics_And_Delivery_Terms_Inheritance_Walkthrough_v1.0.0.md` — Formal 13-section Walkthrough Governance Policy (WGP) document.
2. `src/tests/grnLogisticsAndTerms.test.tsx` — Comprehensive automated test suite for GRN logistics and terms.

---

## 4. Files Modified
1. `backend/app/schemas/purchase.py` — Added delivery/freight fields to `PurchaseReceiptCreate` and `PurchaseReceiptResponse`, and added regex note parsing.
2. `backend/app/services/purchase.py` — Captured PO commercial terms into `transport_parts` during receipt creation.
3. `src/components/purchase/GrnPrintModal.tsx` — Rendered Delivery Terms, Freight Terms, Payment Terms, and Collection in the Carrier Audit Trail header block.
4. `src/components/purchase/GrnReceiptTab.tsx` — Added terms state, PO inheritance in `handleSelectOrder`, Step 3 Logistics & Terms card, Step 4 advisory banners, and payload forwarding.
5. `src/components/purchase/GrnDesktopTerminal.tsx` — Inherited PO special instructions into staging notes.
6. `CHANGELOG.md` — Documented release `[6.99.7]`.
7. `docs/walkthrough/README.md` — Appended master index entry `v3.139.0`.
8. `docs/implementation/README.md` — Marked plan `v1.0.0` as Completed.

---

## 5. Architecture Decisions
1. **Contract-Driven Inwarding Governance**:
   - Inwarding operators do not have to guess or manually look up the supplier's commercial terms. The linked Purchase Order acts as the authoritative contract of record. If the PO specifies `Door Delivery`, the system informs the receiving clerk that highway freight was absorbed by the vendor. If `Ex-Factory`, the system warns that freight and LR charges must be entered and capitalized to avoid stock under-valuation.
2. **Backward-Compatible Notes Serialization**:
   - While database schema column migrations are governed, commercial terms are safely and immutably captured in `[LOGISTICS & LANDED COST: Delivery: ..., Freight Terms: ...]` within `purchase_receipts.notes`. This ensures zero schema drift and seamless serialization for existing PostgreSQL databases.

---

## 6. Design Rationale
- **Visual Distinction via Color-Coded Badges**:
  - `Ex-Factory` shipments display amber/warning indicators emphasizing operator action required.
  - `Door Delivery` shipments display emerald/blue badges indicating freight was prepaid by the supplier.
- **Fail-Safe Fallbacks**:
  - For ad-hoc inward receipts without a linked PO, terms default safely to `Door Delivery` (prepaid), avoiding spurious freight charges.

---

## 7. Implementation Summary
- **Backend**:
  - Extended Pydantic DTOs and enriched service receipt generation with PO terms inheritance.
- **Frontend Studio**:
  - Integrated 4-card commercial overview in Step 3 and contextual guidance banner in Step 4.
  - Embedded terms in statutory A4 receiving slip.
- **Quality Gates**:
  - 87/87 Vitest automated tests green.
  - TypeScript compiler reports 0 errors.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/grnLogisticsAndTerms.test.tsx src/tests/poPrintBrandingAndTerms.test.tsx src/tests/poGenerate.test.ts src/tests/poGenerateUX.test.ts src/tests/poModeConversion.test.ts src/tests/poSizewiseGrouping.test.tsx src/tests/poSizewiseUX.test.ts
```

Output:
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/poPrintBrandingAndTerms.test.tsx (15 tests) 183ms
 ✓ src/tests/poSizewiseUX.test.ts (38 tests) 39ms
 ✓ src/tests/poSizewiseGrouping.test.tsx (10 tests) 82ms
 ✓ src/tests/grnLogisticsAndTerms.test.tsx (4 tests) 80ms
 ✓ src/tests/poGenerate.test.ts (3 tests) 6ms
 ✓ src/tests/poModeConversion.test.ts (6 tests) 15ms
 ✓ src/tests/poGenerateUX.test.ts (11 tests) 11ms

 Test Files  7 passed (7)
      Tests  87 passed (87)
   Start at  06:50:56
   Duration  3.48s
```

---

## 9. Verification Results
- **Automated Tests**: 87/87 PASSED.
- **TypeScript Static Verification**: `npx tsc --noEmit` exit code 0.
- **Print Inspection**: Statutory receipt slip displays `Delivery Terms: Ex-Factory (Paid by Buyer (To Pay))` and `Collection: Core Essentials (All-Year)` in the Logistics & Carrier Audit Trail.

---

## 10. Known Limitations
- Incidental freight charges entered during GRN inwarding do not mutate the historical Purchase Order; they capitalize into landed costs of the receiving receipt only.

---

## 11. Future Work
- Integration with external carrier tracking APIs (e.g. V-Trans, TCI) via webhook for real-time LR status synchronization.

---

## 12. Related ADRs
- `ADR-0056`: Two-Way Purchase Order Commercial Drawer & Visual Print Engine Architecture.
- `ADR-0061`: GRN Inward Landed Cost Multi-Component Allocation Architecture.

---

## 13. Related RFCs
- `RFC-2026-PO-019`: End-to-End Delivery Terms & Logistics Continuity from Sourcing to Inwarding.
