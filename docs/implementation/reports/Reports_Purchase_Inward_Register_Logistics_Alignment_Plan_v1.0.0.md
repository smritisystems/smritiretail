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

# SMRITI Retail OS Implementation Plan: Reports & BI — Purchase Inward Register (GRN) Logistics, Delivery Terms & Transporter Alignment v1.0.0

## 1. Objective
Elevate the **Purchase Inward Register (GRN)** report (`RPT-PUR-001`) in the Standard Daily Retail Reports presentation center (`ReportDesignerTab.tsx`) by integrating end-to-end logistics visibility. The report must surface `Delivery Terms` (`Door Delivery` vs `Ex-Factory`), `Freight Terms`, `Transporter Name`, `LR / Bilty Number`, and `Collection Type` across both the **Detailed Line Items View** and the **GRN Summary View**, and make these attributes filterable and exportable.

---

## 2. Business Motivation
In retail procurement and inventory accounting:
1. **Auditing Landed Costs by Freight Terms**: Internal auditors and finance teams reconciling freight invoices need immediate visibility into whether inward shipments arrived under `Ex-Factory` (requiring separate transporter payment) or `Door Delivery` (prepaid by vendor).
2. **Carrier Performance & Transporter Reconciliation**: Transporters submit consolidated monthly freight bills referencing LR numbers. Without transporter and LR columns in the purchase register, accounts teams must open each physical GRN slip manually.
3. **Merchandise Collection Visibility**: Fashion and footwear merchandise teams need to filter inwarded stock by seasonal collection (e.g. `Spring / Summer 2026`, `Core Essentials`) to monitor pre-season delivery fulfillment.

---

## 3. Scope
- **Backend Schemas & Service (`backend/app/schemas/reports.py`, `backend/app/services/reports.py`)**:
  - Extend `PurchaseInwardItemLine` with `delivery_terms`, `freight_terms`, `transporter_name`, `lr_number`, and `collection_type`.
  - In `ReportsService.purchase_inward_register`, parse logistics metadata from `PurchaseReceipt.notes` and map them into each inward item line.
- **Frontend Presentation Center (`src/components/ReportDesignerTab.tsx`)**:
  - In `filteredGrnLines` live search: enable searching by transporter name, LR number, delivery terms, and collection.
  - In `grnSummaryList`: aggregate `delivery_terms`, `freight_terms`, `transporter_name`, and `lr_number`.
  - In **Detailed Line Items View**: render `Delivery Terms` (with color-coded badges) and `Transporter / LR`.
  - In **GRN Summary View**: render `Delivery Terms` and `Transporter / LR`.
- **Automated Verification**:
  - Create `src/tests/reportsPurchaseInwardLogistics.test.ts` verifying backend schema and frontend grid alignment.
- **Documentation & Walkthrough**:
  - Author formal 13-section WGP walkthrough document.
  - Update `CHANGELOG.md` and index tables.

---

## 4. Current State
- The Purchase Inward Register currently renders:
  `GRN #`, `Date`, `Supplier`, `PO #`, `Article / SKU`, `Item Description`, `Qty Received`, `Cost Rate`, `GST %`, `Tax`, `Line Total`, `Status`.
- It omits:
  `Delivery Terms`, `Freight Terms`, `Transporter Name`, `LR Number`, `Collection Type`.
- Finance operators cannot discern whether a GRN was `Ex-Factory` or `Door Delivery` without navigating away from the report into individual GRN records.

---

## 5. Gap Analysis
| Attribute | Current GRN Inward Register | Target GRN Inward Register |
|---|---|---|
| **Delivery Terms** | Hidden | Color-coded badge (`Door Delivery` / `Ex-Factory`) |
| **Freight Terms** | Hidden | Displayed with Delivery Terms |
| **Transporter & LR** | Hidden | Displayed as `Transporter (LR-XXXX)` |
| **Collection Type** | Hidden | Searchable & Displayable |
| **Searchability** | Code, Name, PO only | Includes Transporter, LR, Delivery Terms |

---

## 6. Architecture Impact
- **Non-Breaking Extension**: All newly added fields in `PurchaseInwardItemLine` are optional strings with null safety.
- **Single Source of Truth**: Metadata is extracted directly from the canonical `[LOGISTICS & LANDED COST: ...]` notes written by `PurchaseService`.

---

## 7. Proposed Design
1. **Schema Updates (`backend/app/schemas/reports.py`)**:
   ```python
   class PurchaseInwardItemLine(BaseModel):
       ...
       delivery_terms:   Optional[str] = None
       freight_terms:    Optional[str] = None
       transporter_name: Optional[str] = None
       lr_number:        Optional[str] = None
       collection_type:  Optional[str] = None
   ```
2. **Service Updates (`backend/app/services/reports.py`)**:
   Regex-extract embedded logistics parameters from `pr.notes` during query iteration.
3. **UI Updates (`ReportDesignerTab.tsx`)**:
   - Detailed View: Add `Delivery Terms` and `Transporter / LR` headers & table cells.
   - Summary View: Add `Delivery Terms` and `Transporter` columns.
   - Enhanced search query matching.

---

## 8. Files Created
- `docs/implementation/reports/Reports_Purchase_Inward_Register_Logistics_Alignment_Plan_v1.0.0.md`
- `src/tests/reportsPurchaseInwardLogistics.test.ts`
- `docs/walkthrough/reports/Reports_Purchase_Inward_Register_Logistics_Alignment_Walkthrough_v1.0.0.md` (upon completion)

---

## 9. Files Modified
- `backend/app/schemas/reports.py`
- `backend/app/services/reports.py`
- `src/components/ReportDesignerTab.tsx`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

---

## 10. Dependencies
- React 18, Tailwind CSS, Lucide icons (`Truck`, `BadgeCheck`).

---

## 11. Risks
- *Risk*: Legacy GRN records prior to logistics tracking have empty notes.
- *Mitigation*: Fallback cleanly to `—` or empty strings without breaking grid layouts.

---

## 12. Rollback Strategy
- Optional fields with default fallbacks; reverting frontend table columns restores previous presentation without loss of data.

---

## 13. Verification Plan
- Unit tests verifying serialization of `PurchaseInwardItemLine` with logistics attributes.
- Vitest testing verifying column rendering and search filtering.
- `npx tsc --noEmit` exit 0.

---

## 14. Test Plan
- Run `npx vitest run src/tests/reportsPurchaseInwardLogistics.test.ts`.
- Run full Vitest regression suite.

---

## 15. Documentation Impact
- Update `CHANGELOG.md`.
- Append master index in `docs/implementation/README.md` and `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
- Follow DEV (`F:\SMRITRretailNX`) &rarr; commit & push &rarr; pull into TEST (`F:\Smriti9`).

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0061`: GRN Inward Landed Cost Multi-Component Allocation Architecture.

---

## 19. Related Walkthroughs
- `Purchase_GRN_Logistics_And_Delivery_Terms_Inheritance_Walkthrough_v1.0.0.md`
- `Reports_Purchase_Inward_Register_Logistics_Alignment_Walkthrough_v1.0.0.md`
