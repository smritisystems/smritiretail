<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-29
  Classification: Internal
-->

# SMRITI Retail OS Implementation Plan: Goods Receipt Note (GRN) Logistics, PO Delivery Terms Inheritance & Carrier Audit Trail v1.0.0

## 1. Objective
Ensure seamless commercial and logistics continuity between Purchase Orders and the Goods Receipt Note (GRN) inwarding lifecycle. When an operator selects an open Purchase Order in the GRN Studio (`GrnReceiptTab.tsx` / `GrnDesktopTerminal.tsx`), the order's configured `delivery_terms` (`Door Delivery`, `Ex-Factory`, `F.O.R. Destination`, `Ex-Godown`), `freight_terms`, `payment_terms`, and delivery instructions must dynamically auto-populate into GRN Step 3 ("Commercials"), Step 4 ("Costs & Freight"), and the statutory GRN Print Slip (`GrnPrintModal.tsx`).

## 2. Business Motivation
In footwear and retail supply chains:
1. **Commercial Terms Drift**: If a PO specifies `Door Delivery` (Freight Paid by Supplier) but the inwarding operator is unaware of the terms, they might mistakenly accept a transporter freight bill and charge it to inward landed costs.
2. **Ex-Factory Accountability**: If a PO specifies `Ex-Factory` (Freight Paid by Buyer), inward freight, LR/Bilty numbers, and transporter charges MUST be recorded and allocated across received items so stock valuation reflects true landed cost.
3. **Audit Trail Compliance**: Statutory receiving slips must document whether the shipment arrived under Door Delivery or Ex-Factory terms alongside carrier LR/Bilty details for audit and GST verification.

## 3. Scope
- **Backend Schema & Service (`backend/app/schemas/purchase.py`, `backend/app/services/purchase.py`)**:
  - Accept `delivery_terms` and `freight_terms` in `PurchaseReceiptCreate`.
  - Expose `delivery_terms` and `freight_terms` in `PurchaseReceiptResponse`.
  - Populate them automatically from the linked `PurchaseOrder` when `order_id` is supplied.
- **Frontend GRN Studio (`src/components/purchase/GrnReceiptTab.tsx`, `GrnDesktopTerminal.tsx`)**:
  - In `handleSelectPurchaseOrder`, dynamically inherit `delivery_terms`, `freight_terms`, `payment_terms`, and `special_instructions` into the active GRN state.
  - In Step 3 ("Commercials"), render a prominent **Logistics & Terms Card** showing PO delivery terms, freight terms, and source status.
  - In Step 4 ("Costs & Freight"), display smart advisory banners:
    - If `Ex-Factory`: warn that freight must be recorded and allocated to landed cost.
    - If `Door Delivery` (Paid by Supplier): note that freight was absorbed by supplier.
- **Statutory GRN Slip (`src/components/purchase/GrnPrintModal.tsx`)**:
  - Display `Delivery Terms` and `Freight Terms` in the **Logistics & Carrier Audit Trail** header section.
- **Automated Verification**:
  - Unit tests verifying delivery terms inheritance upon PO selection.
  - Print modal tests verifying terms rendering.

## 4. Current State
- `PurchaseOrder` now stores and prints `delivery_terms` and `freight_terms`.
- However, when `GrnReceiptTab` or `GrnDesktopTerminal` loads an order via `handleSelectPurchaseOrder`, it only maps items and supplier ID.
- `deliveryInstructions` in `GrnDesktopTerminal` is hardcoded to a static mock string ("Unload at Gate 2 Staging Bay...").
- Step 3 ("Commercials") displays Supplier, PO Source, and Vendor Invoice, but has no visibility into delivery or freight terms.
- `GrnPrintModal` displays Transporter Name, LR No, Vehicle, but omits delivery terms.

## 5. Gap Analysis
| Feature | Purchase Order | Current GRN State | Target GRN State |
|---|---|---|---|
| **Delivery Terms** | Configured (`Door Delivery`, `Ex-Factory`, etc.) | Not inherited | Auto-inherited from PO with override support |
| **Freight Terms** | Configured (`Paid by Supplier`, `To-Pay`) | Hidden in Step 3 | Prominently displayed with smart freight guidance in Step 4 |
| **Staging Instructions** | Configured in PO special instructions | Static mock string in terminal | Inherited from PO notes / instructions |
| **Statutory Print** | Printed on A4 Purchase Order | Omitted from GRN Slip | Displayed in Logistics & Carrier Audit Trail |

## 6. Architecture Impact
- **Non-Breaking Extension**: Uses optional fields in `PurchaseReceiptCreate` and `PurchaseReceiptResponse`.
- **Database Resilience**: Stores terms in `purchase_receipts.notes` or JSON metadata if column migration is deferred, ensuring zero schema drift.
- **Single Source of Truth**: GRN derives commercial defaults directly from the linked `PurchaseOrder`, with operator override capability for deviations.

## 7. Proposed Design
1. **Schema Updates (`backend/app/schemas/purchase.py`)**:
   ```python
   class PurchaseReceiptCreate(BaseModel):
       delivery_terms: Optional[str] = None
       freight_terms: Optional[str] = None
       ...
   class PurchaseReceiptResponse(BaseModel):
       delivery_terms: Optional[str] = None
       freight_terms: Optional[str] = None
       ...
   ```
2. **GRN Studio Step 3 ("Commercials")**:
   Add a 4th summary card in `GrnReceiptTab.tsx`:
   - Delivery Terms (`Door Delivery` / `Ex-Factory`)
   - Freight Terms (`Paid by Supplier` / `Paid by Buyer`)
   - PO Contract link badge
3. **GRN Studio Step 4 ("Costs & Freight")**:
   Add contextual advisory based on inherited terms:
   - Alert: `Ex-Factory` shipments require freight entry before landed cost allocation.
   - Info: `Door Delivery` shipments have freight prepaid by vendor.
4. **GRN Print Slip (`GrnPrintModal.tsx`)**:
   Add `Delivery Terms: {receiptData.delivery_terms}` in the top right carrier audit block.

## 8. Files Created
- `docs/implementation/purchase/Purchase_GRN_Logistics_And_Delivery_Terms_Inheritance_Plan_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_GRN_Logistics_And_Delivery_Terms_Inheritance_Walkthrough_v1.0.0.md` (upon completion)

## 9. Files Modified
- `backend/app/schemas/purchase.py`
- `backend/app/services/purchase.py`
- `src/components/purchase/GrnReceiptTab.tsx`
- `src/components/purchase/GrnDesktopTerminal.tsx`
- `src/components/purchase/GrnPrintModal.tsx`
- `src/tests/grnLogisticsAndTerms.test.tsx` (new test suite)
- `CHANGELOG.md`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- React 18 / Lucide icons (`Truck`, `ShieldCheck`, `FileText`).
- FastAPI `PurchaseReceipt` schemas.

## 11. Risks
- *Risk*: Orders created before delivery terms were added may have null `delivery_terms`.
- *Mitigation*: Apply intelligent fallback (if freight is `buyer` or `to-pay` &rarr; `Ex-Factory`, otherwise `Door Delivery`).

## 12. Rollback Strategy
- All fields are optional with safe fallbacks; reverting frontend components restores previous behavior without data loss.

## 13. Verification Plan
- Unit tests validating inheritance of terms from PO into GRN state.
- Automated tests verifying correct advisory banner rendering for both `Ex-Factory` and `Door Delivery`.
- Print modal snapshot testing.
- `npx tsc --noEmit` 0 errors.

## 14. Test Plan
- Run `vitest run src/tests/grnLogisticsAndTerms.test.tsx`.
- Run full PO & GRN test suite.
- Verify schema serialization with Python unittest.

## 15. Documentation Impact
- Update `CHANGELOG.md`.
- Update `docs/implementation/README.md`.
- Generate WGP Walkthrough in `docs/walkthrough/purchase/`.

## 16. Deployment Plan
- Follow DEV (`F:\SMRITRretailNX`) &rarr; commit & push &rarr; pull into TEST (`F:\Smriti9`).

## 17. Status
Approved

## 18. Related ADRs
- `ADR-0056`: Two-Way Purchase Order Commercial Drawer & Visual Print Engine Architecture.

## 19. Related Walkthroughs
- `Purchase_Order_Vendor_Delivery_Terms_Inheritance_Walkthrough_v1.0.0.md`

