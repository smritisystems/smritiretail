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

  * Version    : 3.33.0
  * Created    : 2026-09-20
  * Modified   : 2026-09-20
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Procurement & Inventory Valuation Governance
-->

# Walkthrough: Inward Landed Cost, Multi-Component Freight & Commercial Engine v3.33.0

## 1. Purpose
Deliver a canonical, production-ready **Inward Landed Cost, Multi-Component Freight & Commercial Engine** for SMRITI Retail OS that accurately determines the inventory acquisition cost of every accepted SKU upon Goods Receipt Note (GRN) inwarding. The engine supports unlimited, independently traceable inward cost components (Freight, Cartage, Loading/Hamali, Insurance, Packing & Forwarding, Customs Duty, Toll, etc.), enforces Hamilton-Hare largest-remainder penny cent-balancing (0.0000 allocation variance guarantee), adheres to statutory Ind-AS 2 / AS-2 Input Tax Credit (ITC) boundaries, and equips operators with a dual-column GRN Studio layout, Purchase Price Variance (PPV) dispute workflows, post-GRN margin previews, and forensic cost drill-downs ("Why is my landed cost ₹X?").

## 2. Scope
- **Database Schema**: 4 canonical tables (`inward_cost_component_types`, `inward_cost_components`, `inward_cost_allocations`, `inward_cost_adjustments`) provisioned across `smritisys`, `smriti001`, and `smriti002` via Alembic migration `v1478`.
- **Statutory Tax Capitalization (Ind-AS 2 / AS-2)**: Input Tax Credit (ITC) eligible GST (e.g. 18% GST on Freight) is routed as an asset claim to GSTR-2B and excluded from inventory cost; non-creditable taxes (Customs, Entry Duty, Toll) are 100% capitalized.
- **Hamilton-Hare Largest-Remainder Cent-Balancing**: Mathematical algorithm allocating multi-thousand rupee freight across hundreds/thousands of SKU items with zero rounding loss, assigning remainder pennies deterministically to lines with highest fractional remainders.
- **Backend Service Layer**: Pure in-memory allocation preview, atomic persistence and WMS batch valuation (`ProductCostValuation` and `ProductBatchStock.unit_cost`), and forensic drill-down reporting.
- **FastAPI Endpoints**: `GET /api/v1/purchase/inward-cost-types`, `POST /api/v1/purchase/landed-cost/preview`, `POST /api/v1/purchase/receipts/`, `GET /api/v1/purchase/receipts/{id}/cost-components`, and `GET /api/v1/purchase/receipts/{id}/landed-cost/breakdown/{item_id}`.
- **Operator-First UI/UX**: Dual-column GRN Studio (`GrnReceiptTab.tsx`), collapsible Right Transport Dock (`InwardCostDock.tsx`), multi-component expense modal (`AddCostComponentModal.tsx`), allocation preview modal (`CostAllocationPreviewModal.tsx`), forensic drilldown dialog (`WhyThisCostModal.tsx`), PPV dispute card (`[Accept]` vs `[Create Claim]` opening `CreateDebitNoteDlg`), and post-GRN success modal (`GrnPostedSuccessModal.tsx`).
- **Strictly Optional Behavior**: If zero transport expenses are added, the GRN posts standard purchase rates with 0 extra clicks and 0 modal interruptions.

## 3. Files Created
1. `backend/alembic/versions/v1478_inward_cost_components_and_allocation_ledger.py`: Alembic migration creating the 4 canonical cost engine tables and seeding 19 standard cost component types.
2. `backend/app/models/inward_cost.py`: SQLAlchemy ORM models (`InwardCostComponentType`, `InwardCostComponent`, `InwardCostAllocation`, `InwardCostAdjustment`).
3. `backend/app/schemas/inward_cost.py`: Pydantic schemas for cost component creation, allocation preview, why-this-cost breakdown, and adjustments.
4. `backend/app/services/landed_cost.py`: Core `LandedCostAllocationEngine` with Hamilton-Hare mathematical cent-balancer and forensic analysis.
5. `scripts/register_inward_cost_architecture.py`: Database registration script for `architecture_entities`, `architecture_decisions` (`ADR-PURCH-02`), `architecture_capabilities` (`purchase.landed_cost_engine`), and SHA-256 preflight certificates (`PF-2026-0919-*`).
6. `scripts/verify_inward_landed_cost_engine.py`: Comprehensive test suite verifying all 5 endpoints, token authentication, Hamilton-Hare zero-loss balancing, GRN transactional posting, and breakdown queries.
7. `src/components/purchase/types/inwardCost.ts`: TypeScript contracts for inward cost components, allocation bases, and why-this-cost responses.
8. `src/components/purchase/InwardCostDock.tsx`: Right-side collapsible transport & logistics cost dock with real-time net expense calculation.
9. `src/components/purchase/AddCostComponentModal.tsx`: Modal for adding line-item transport/freight charges with GST/ITC toggles.
10. `src/components/purchase/CostAllocationPreviewModal.tsx`: Real-time allocation table preview showing line-by-line addon costs and final landed costs before posting.
11. `src/components/purchase/WhyThisCostModal.tsx`: Forensic audit dialog breaking down base invoice rate, tax, and itemized addon expenses.
12. `src/components/purchase/GrnPostedSuccessModal.tsx`: Post-inwarding celebration dialog with Margin Preview, stock valuation summaries, and printing shortcuts.
13. `docs/walkthrough/procurement/Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md`: This walkthrough.
14. `docs/implementation/purchase/Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md`: Formal 19-section implementation plan.

## 4. Files Modified
1. `backend/app/models/__init__.py`: Exported inward cost models into central registry.
2. `backend/app/schemas/purchase.py`: Added `cost_components` and `transport_details` to `PurchaseReceiptCreate`, and `landed_cost_summary` to responses.
3. `backend/app/services/purchase.py`: Hooked `LandedCostAllocationEngine.allocate_and_persist_components_async` into `create_purchase_receipt` transaction flow.
4. `backend/app/api/v1/purchase.py`: Mounted the 4 new inward cost endpoints with Bearer auth and error translation.
5. `src/components/CreateDebitNoteDlg.tsx`: Added default prefill props (`defaultSupplierId`, `defaultAmount`, `defaultReason`) for PPV discrepancy claims.
6. `src/components/purchase/GrnReceiptTab.tsx`: Transformed workspace into dual-column layout with Receiving Summary cards, 3-tier commercial rate hierarchy (`PO Rate`, `Inv Rate`, `Net Rate`, `Landed Cost`), PPV dispute card, and Right Transport Dock.
7. `docs/walkthrough/README.md`: Appended chronological entry for this walkthrough.
8. `docs/implementation/README.md`: Appended chronological entry for the implementation plan.
9. `CHANGELOG.md`: Added release notes under v6.43.0.
10. `DEVELOPMENT_STATUS.md`: Marked Inward Cost Engine as Completed.

## 5. Architecture Decisions
- **ADR-PURCH-02: Multi-Component Inward Cost & Hamilton-Hare Allocation Engine**:
  - *Context*: Legacy ERPs either provide only a single flat freight field or lump freight into the item purchase price, violating Ind-AS 2 accounting standards, muddying supplier vs transporter liabilities, and losing audit trails.
  - *Decision*: Adopt a dedicated 4-table relational schema with independent component line items, transporter document references, statutory ITC tracking, and immutable allocation ledgers.
  - *Mathematical Cent Balancing*: Mandate the Hamilton-Hare largest-remainder algorithm for all non-integer cost divisions to guarantee that $\sum \text{allocated} \equiv \text{total expense}$ to the exact 0.0000 penny.
- **ADR-PURCH-03: Ind-AS 2 / AS-2 Statutory Capitalizability Enforcement**:
  - GST paid to transporters or freight handlers that is eligible for Input Tax Credit (ITC) must NOT be capitalized into inventory valuation. It is booked to the GST Input Tax Ledger. Non-creditable costs (Customs duty, non-GST Octroi/Toll) are 100% capitalized.
- **ADR-PURCH-04: Non-Intrusive Operator Flow (Optional by Design)**:
  - If a retail store receives goods with free vendor delivery or no local cartage expenses, zero transport expenses are entered. The engine detects this and defaults `landed_cost = unit_price` without any extra prompts or clicks.

## 6. Design Rationale
- **Dual-Column Operator Workspace**: Inward clerks primarily inspect items and match physical cartons against vendor invoices. By placing freight and transport logistics in an expandable dock on the right, the main workspace remains uncluttered while giving transport details immediate 1-click accessibility.
- **3-Tier Commercial Rate Hierarchy**: Inwarding clerks often struggle to identify whether a price mismatch is due to vendor price hikes or freight addons. Displaying `PO Rate` vs `Inv Rate` vs `Net Rate` vs `Landed Cost` makes discrepancies immediately transparent.
- **Purchase Price Variance (PPV) Dual Pathway**: When `Inv Rate > PO Rate`, the clerk is empowered with two clear actions:
  1. `[Accept & Inward]`: Acknowledge the price change and absorb into inventory.
  2. `[Create Price Claim]`: Instantly open a pre-filled Debit Note dialog (`CreateDebitNoteDlg`) to reclaim the overcharged amount from the vendor.
- **Post-GRN Margin Preview**: Rather than waiting for monthly management reports, operators and store managers immediately see their projected gross profit margin % based on current retail MRP vs newly computed landed cost.

## 7. Implementation Summary
- **Database Layer**: Applied migration `v1478` across all database instances. Table `inward_cost_component_types` provides 19 system-seeded categories (`FREIGHT`, `CARTAGE`, `HAMALI`, `INSURANCE`, `PACKING_FORWARDING`, `CUSTOMS_DUTY`, etc.).
- **Cent-Balancing Service**: The `LandedCostAllocationEngine.preview_allocation` computes unrounded shares across items, truncates to 2 decimal places, tracks the remainder $R = \text{Expense} - \sum \lfloor S_i \rfloor_{.02}$, sorts lines descending by fractional remainder, and distributes $0.01$ increments until $R = 0$.
- **FastAPI Endpoints**: Implemented and registered 4 REST endpoints on `/purchase`.
- **Frontend Architecture**: Integrated `InwardCostDock`, `AddCostComponentModal`, `CostAllocationPreviewModal`, and `WhyThisCostModal` into `GrnReceiptTab.tsx`. Verified 0 TypeScript compilation errors and 100% form registry validation.

## 8. Tests Executed
1. **Automated Verification Script (`scripts/verify_inward_landed_cost_engine.py`)**:
   - `TEST 1: Authentication & Health Check` -> HTTP 200 (Bearer Token acquired).
   - `TEST 2: GET Inward Cost Component Types` -> HTTP 200 (19 types returned).
   - `TEST 3: POST Landed Cost Allocation Preview` -> HTTP 200 (₹4,000 expense across 1,220 units allocated with 0.0000 variance).
   - `TEST 4: POST Create Purchase Receipt with Landed Cost` -> HTTP 201 (`GRN/2026-27/0999` created with 4 line items and 2 cost components).
   - `TEST 5: GET Persisted Cost Components` -> HTTP 200 (Components and allocations verified in PostgreSQL).
   - `TEST 6: GET Why-This-Cost Forensic Breakdown` -> HTTP 200 (Base invoice price + exact freight allocation breakdown returned).
2. **TypeScript Compilation Check**:
   - Command: `npm run lint` (`tsc --noEmit`)
   - Result: 0 errors.
3. **Architecture Duplication & Governance Gate**:
   - Command: `npm run architecture:check` (`python scripts/architecture_duplication_gate.py`)
   - Result: 11/11 checks passed, 0 violations, 0 architectural debt.
4. **Launchpad Catalog Validation**:
   - Command: `npm run validate-launchpad`
   - Result: 44/44 unique tiles passed, 83 render cases passed.
5. **Form & Screen Registry Check**:
   - Command: `npm run validate-registry`
   - Result: 73/73 form components passed with valid `data-field-key` annotations.

## 9. Verification Results
- **Status**: `Done`
- **Component Types**: 19 canonical types seeded and operational.
- **Cent-Balancing Invariance**: ₹4,000.00 expense distributed across 1,220 units yielded:
  - Line 1 (`SH-001`, 200 units): ₹778.42 (₹3.89/unit)
  - Line 2 (`SH-002`, 296 units): ₹1,032.88 (₹3.49/unit)
  - Line 3 (`SH-003`, 250 units): ₹1,107.23 (₹4.43/unit)
  - Line 4 (`SH-004`, 474 units): ₹1,081.47 (₹2.28/unit)
  - **Sum of Allocations**: Exactly ₹4,000.00 (Variance: 0.0000).
- **Postgres Ledger Persistence**: 2 `inward_cost_components` and 4 `inward_cost_allocations` rows successfully committed.
- **WMS Batch Valuation**: Batch stock `unit_cost` and `product_cost_valuations.last_landed_cost` updated atomically.

## 10. Known Limitations
- Direct auto-posting of freight transport invoices to Accounts Payable (`vendor_bills`) is planned for Phase 2 accounting integration.
- Weight-based allocation requires item gross weight in product master; falls back to Value-based allocation if item weights are 0.

## 11. Future Work
- Late-arriving freight invoice adjustments via `inward_cost_adjustments` and adjustment vouchers (`LC-ADJ-*`) without reopening historical GRNs.
- Transporter performance analytics (cost per kg / cost per pair benchmarks across logistics partners).

## 12. Related ADRs
- `ADR-PURCH-02`: Multi-Component Inward Cost & Hamilton-Hare Allocation Engine.
- `ADR-PURCH-03`: Ind-AS 2 / AS-2 Statutory Capitalizability Enforcement.
- `ADR-PURCH-04`: Non-Intrusive Optional Inward Cost Flow.

## 13. Related RFCs
- `RFC-2026-09-LC`: Canonical Inward Landed Cost, Freight & Acquisition Valuation Engine.
