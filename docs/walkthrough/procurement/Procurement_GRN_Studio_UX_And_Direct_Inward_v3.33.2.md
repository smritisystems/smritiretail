<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.33.2
  * Created    : 2026-09-20
  * Modified   : 2026-09-20
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: GRN Studio UI Hardcoded Elimination, Direct Catalog Inward & Statutory A4 Slip

## 1. Purpose
To eliminate default hardcoded mock data states from the Goods Receipt Note (GRN) Studio frontend (`GrnReceiptTab.tsx`), replace automatic mock pre-population with a database-backed Inward Receiving Hub and Master Catalog product picker (`AddProductToGrnModal.tsx`), integrate a high-fidelity Statutory A4 Goods Receipt & Landed Cost Audit Slip modal (`GrnPrintModal.tsx`) conforming to AS-2 / Ind-AS 2 valuation rules, and upgrade the GRN History and post-GRN receipt workflows with instant 1-click statutory printing and purchase billing.

## 2. Scope
- Goods Receipt Note Workspace (`src/components/purchase/GrnReceiptTab.tsx`).
- Product Inward Catalog Picker Modal (`src/components/purchase/AddProductToGrnModal.tsx`).
- Statutory A4 Print Preview Modal (`src/components/purchase/GrnPrintModal.tsx`).
- Post-GRN Celebration & Summary Modal (`src/components/purchase/GrnPostedSuccessModal.tsx`).
- Architecture Certificate Registry (`scripts/register_grn_studio_ux_certificates.py`).
- Documentation, Master Index & Changelog (`docs/walkthrough/README.md`, `CHANGELOG.md`).

## 3. Files Created
- [`src/components/purchase/AddProductToGrnModal.tsx`](file:///f:/SMRITRretailNX/src/components/purchase/AddProductToGrnModal.tsx)
- [`src/components/purchase/GrnPrintModal.tsx`](file:///f:/SMRITRretailNX/src/components/purchase/GrnPrintModal.tsx)
- [`scripts/register_grn_studio_ux_certificates.py`](file:///f:/SMRITRretailNX/scripts/register_grn_studio_ux_certificates.py)
- [`docs/walkthrough/procurement/Procurement_GRN_Studio_UX_And_Direct_Inward_v3.33.2.md`](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/Procurement_GRN_Studio_UX_And_Direct_Inward_v3.33.2.md)

## 4. Files Modified
- [`src/components/purchase/GrnReceiptTab.tsx`](file:///f:/SMRITRretailNX/src/components/purchase/GrnReceiptTab.tsx)
- [`src/components/purchase/GrnPostedSuccessModal.tsx`](file:///f:/SMRITRretailNX/src/components/purchase/GrnPostedSuccessModal.tsx)
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md)
- [`CHANGELOG.md`](file:///f:/SMRITRretailNX/CHANGELOG.md)

## 5. Architecture Decisions
1. **Zero-Default Initial State**: When opening GRN Studio, the component starts with a clean, empty state (`grnLines: []`, `costItems: []`, blank strings for numbers and transporter). It no longer pre-populates hardcoded mock items or dummy supplier names.
2. **Explicit Sample Demo Pathway**: The footwear demo lines (`DEFAULT_SAMPLE_LINES` & `DEFAULT_SAMPLE_COST_COMPONENTS`) were preserved exclusively behind a dedicated "Load Footwear Demo (4 SKUs)" button. Operators can optionally load it for training or audit testing without polluting live inwarding sessions.
3. **Database-Driven Open PO Receiving Hub**: Replaced the previous blank/mock layout with an interactive launchpad showing open confirmed Purchase Orders fetched live from `GET /api/v1/purchase/orders/`. Operators can inspect order values, item counts, and trigger 1-click contract line hydration (`Inward PO →`).
4. **Direct Inwarding via Master Catalog**: Introduced `AddProductToGrnModal.tsx`, querying PostgreSQL master inventory via `/inventory/`. Operators can inward ad-hoc goods without an upstream Purchase Order, capturing SKU, title, size, color, cost price, GST rate, and MRP.
5. **Statutory A4 Document Standard**: Developed `GrnPrintModal.tsx` rendering statutory Goods Receipt Notes with complete Ind-AS 2 / AS-2 landed cost components (freight, cartage, hamali, packaging), tax credit separation (ITC vs capitalized), carrier information (transporter, LR, vehicle, weight, cartons), and three-tier signature approvals (Prepared By, Inspected By, Authorized By).
6. **Preflight Certificate Governance**: Bound new components under `@SmritiCapability("PURCHASE", "...")` and issued certificates (`PF-2026-0919-DCD2F9`, `PF-2026-0919-632BB9`) via `scripts/register_grn_studio_ux_certificates.py`, passing Rule 7 and Rule 8 of the SMRITI Architecture Duplication Gate.

## 6. Design Rationale
- Operators entering the GRN Studio previously saw hardcoded footwear items (`ABC Footwear Pvt. Ltd.`, `GRN-2026-00452`) even when inwarding unrelated materials. This created operational friction, risk of posting invalid mock items, and obscured the actual open POs waiting in the warehouse dock.
- Modern retail ERP operations require both PO-based contract inwarding and ad-hoc / direct-to-store deliveries (e.g. local vendor supplies, emergency replenishments). Enabling catalog search directly solves this requirement.
- Physical warehouse docks require immediate statutory printouts for carrier driver sign-off, gate passes, and accounts payable verification before lorry release.

## 7. Implementation Summary
- Refactored `GrnReceiptTab.tsx` state to start with empty arrays and blank strings.
- Built the "Goods Inward Receiving Hub" empty state featuring Open POs table and Direct Inward actions.
- Built `AddProductToGrnModal.tsx` with live debounced catalog search against `/inventory/`.
- Built `GrnPrintModal.tsx` with zoom controls (`75%`, `100%`, `125%`), print stylesheet (`@media print`), statutory signatures, and QR code.
- Added `onPrintSlip` callback and "Print Statutory A4 Slip" button in `GrnPostedSuccessModal.tsx`.
- Enhanced GRN History subview with text search filter across receipt numbers, supplier names, and invoice numbers, with collapsible line drawers and direct "Print Slip" / "Bill" actions.
- Added "Clear All" action in GRN Studio to quickly reset active inwarding drafts.

## 8. Tests Executed
1. `npm run lint` (`tsc --noEmit`): Exited with code 0 (0 errors across whole repository).
2. `python scripts/architecture_duplication_gate.py`: 11/11 checks passed, 0 P0/P1 violations, 0 registered debt.
3. `pytest backend/tests/t_grn_stock.py backend/tests/t_po_flow.py -v`: 2/2 tests passed.
4. `pytest backend/tests/t_purch_invoice.py backend/tests/test_supplier_crud.py backend/tests/test_tattly_po_reconciliation.py -v`: 9/9 tests passed.

## 9. Verification Results
- **TypeScript Compiler Check**: PASSED (0 errors).
- **Architecture Duplication Gate**: PASSED (11/11 checks).
- **Backend Purchase & Reconciliation Test Suites**: 11/11 tests passed in under 4.5 seconds.
- **Empty State UX**: Clean zero-default state verified; Open POs load dynamically; Catalog product selection functional.
- **Print Modal**: High-fidelity statutory A4 document renders cleanly with landed cost allocations and signature blocks.

## 10. Known Limitations
- Direct inwarding without a PO does not have an upstream contract rate; the operator enters or confirms the billed invoice rate directly.

## 11. Future Work
- Integration of mobile barcode/QR camera scanning directly in the `AddProductToGrnModal`.
- Batch PDF export for multiple historical GRNs selected simultaneously.

## 12. Related ADRs
- `ADR-PURCH-02`: Inward Landed Cost, Multi-Component Freight & SKU Allocation Ledger Engine.

## 13. Related RFCs
- `RFC-2026-GRN-01`: SMRITI Goods Receipt Note & Landed Cost Operational Standardization.
