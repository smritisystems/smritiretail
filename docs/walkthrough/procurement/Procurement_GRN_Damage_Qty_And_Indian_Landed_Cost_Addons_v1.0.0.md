<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-24
  Modified     : 2026-09-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Procurement GRN Damage Qty & Indian Landed Cost Addons Engine

## 1. Purpose
To deliver full operational, statutory, and visual parity for Inward Goods Receipt Note (GRN) operations in SMRITI Retail OS:
- Supporting physical and damaged quantity segregation (`Doc Qty`, `Act Qty`, `Damage QTY`, `Sound Accepted Qty`) with zero-latency keyboard direct entry.
- Implementing the 6 statutory Components of Landed Cost in India (Product Cost FOB/EXW, Freight/Shipping GTA, Labor & Handling CFS/Hamali, Transit Insurance, Customs BCD/SWS, and CHA Clearance Fees) under Ind AS 2 / AS 2.
- Enforcing strict GST compliance under Section 17(5)(h) of the CGST Act 2017 regarding blocked Input Tax Credit on destroyed or damaged goods.

---

## 2. Scope
- **Frontend Components**:
  - `src/components/purchase/GrnDesktopTerminal.tsx`: Added `Damage QTY` column to table grid, row renderer, and docked direct entry strip. Added the 6 Indian Landed Cost Components modal with Hamilton-Hare zero-variance apportionment.
  - `src/components/purchase/GrnReceiptTab.tsx`: Verified backend mapping of `quantity_damaged`, `landed_cost`, and `freight_allocated`.
- **Statutory & Architecture**:
  - `docs/architecture/GRN_Damage_Qty_And_Indian_Landed_Cost_Addons_Architecture.md`: Authored formal statutory and accounting specification.

---

## 3. Files Created
- `docs/architecture/GRN_Damage_Qty_And_Indian_Landed_Cost_Addons_Architecture.md`
- `docs/walkthrough/procurement/Procurement_GRN_Damage_Qty_And_Indian_Landed_Cost_Addons_v1.0.0.md`

---

## 4. Files Modified
- `src/components/purchase/GrnDesktopTerminal.tsx`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
1. **Damage Quantity Segregation**:
   - `Damage QTY` is captured at the line level. Sound inventory updated into PostgreSQL warehouse stock movements is strictly:
     $$\text{Accepted Sound Qty} = \text{Act Qty} - \text{Damage Qty}$$
   - Damaged units trigger a pre-populated commercial Debit Note against the vendor, safeguarding the buyer from claiming blocked ITC under Section 17(5)(h) of the CGST Act 2017.
2. **Indian Landed Cost Architecture**:
   - Differentiated between `Addon Before Tax` (Composite supply invoiced by principal vendor under Section 8 CGST Act) and `Addon After Tax` (Third-party transport, CHA, insurance invoices, and non-creditable Customs BCD/SWS).
   - Basic Customs Duty (BCD) and Social Welfare Surcharge (SWS) are capitalized into landed inventory cost, while IGST is excluded as it is availed as 100% ITC under Section 16.
3. **Hamilton-Hare Cent Balancing**:
   - Implemented the largest-remainder apportionment method so that distributed line addons equal the parent voucher total with 0.00 paise rounding discrepancy.

---

## 6. Design Rationale
- Retail receiving docks operate under high volume. Receiving clerks require continuous keyboard operation (scanning barcode -> pressing Enter -> entering damage quantity -> pressing Enter). Mouse dependency is eliminated via the pinned docked direct entry strip.
- Clear visual distinction: Damaged items are styled in rose badges (`bg-rose-100 text-rose-700 font-bold`) so operators immediately spot damaged consignments.

---

## 7. Implementation Summary
- Integrated `entryDamageQty` into state and direct entry handler.
- Inserted `Damage QTY` in the grid between `Selling Price` and `Purchase Price`.
- Designed interactive `LandedCostBreakdownModal` with the 6 Indian Landed Cost components.
- Added summary KPI metrics for Doc Qty, Act Qty, Damage Qty, Total Value, plus 2-row matrices for Discount, Deduction, and Addon.

---

## 8. Tests Executed
1. `npx tsc --noEmit`: Clean compilation, exit code 0.
2. `npm run build`: Production bundle built clean in 33.81s (3,595 modules transformed).
3. `curl.exe -I http://localhost:8101`: HTTP/1.1 200 OK verified on running container.

---

## 9. Verification Results
- **TypeScript**: 0 errors
- **Vite Build**: 0 errors
- **Container Health**: HTTP 200 OK on port 8101

---

## 10. Known Limitations
- International currency conversion for FOB imports uses the CBIC notification exchange rate, which is currently entered manually or defaulted to INR.

---

## 11. Future Work
- Direct ICEGATE Bill of Entry (BOE) JSON auto-ingestion for automatic extraction of assessable value, BCD, SWS, and IGST.

---

## 12. Related ADRs
- `ADR-033`: Multi-Component Inward Landed Cost & Freight Engine
- `ADR-042`: Canonical Identity and Document Sequence Standards

---

## 13. Related RFCs
- `RFC-2026-09-GRN`: High-Speed Keyboard-Driven Goods Receipt Terminal
