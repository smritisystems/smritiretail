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

  * Version    : 3.33.0
  * Created    : 2026-09-19
  * Modified   : 2026-09-19
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Procurement & Inwarding Governance
-->

# Walkthrough: Procurement PO-to-GRN Headless Verification Cycle & Studio Decoupling

## 1. Purpose
To deliver an architectural decoupling of Goods Receipt Note (GRN) operations from the Purchase Order generation workspace into a dedicated, enterprise-grade GRN Studio workspace (`GrnStudioTab.tsx`), and to execute a 100% headless, browserless end-to-end verification cycle from Purchase Order creation to Goods Receipt Note inwarding, generating statutory A4 PDF documentation and verifiable high-resolution artifacts.

## 2. Scope
- **UX Decoupling**: Separation of GRN inwarding workflows from `PoGenerateTab.tsx` into a dedicated workspace `GrnStudioTab.tsx`, registered as an independent Fiori launchpad catalog tile (`grn-studio`), tab renderer alias, and breadcrumb route.
- **Headless Cycle Engine**: Implementation of `scripts/execute_headless_po_to_grn_cycle.py` using Playwright in headless mode without visible browser interaction.
- **Transactional Verification**: Full cycle creation and verification of PO `PO/2026-27/0999` (Approved, Rs. 1,65,690.00, 118 PRS) and GRN `GRN/2026-27/0999` (RECEIVED, Rs. 1,59,390.00, 114 PRS received, 3 damaged, 4 shortage, 111 net accepted).
- **Statutory Document Generation**: Rendering and exporting A4 Statutory PO & Inward Reconciliation Document (`PO_GRN_Complete_Cycle_0999.pdf`) with dual signature stamps, UPI QR badge, watermark, and itemized damage/shortage reconciliation.
- **Visual Evidence Capture**: Automated generation of 4 full-bleed high-resolution screenshots verifying PO approval, GRN audit matrix, statutory PDF preview, and reconciliation summary.

## 3. Files Created
1. `src/components/GrnStudioTab.tsx` - Dedicated enterprise Goods Receipt Note Studio tab with PO inwarding queue, line-level discrepancy ledger, and Direct Inward handoff.
2. `scripts/execute_headless_po_to_grn_cycle.py` - Autonomous headless verification and PDF generation engine.
3. `scratch/po_grn_cycle/PO_GRN_Complete_Cycle_0999.pdf` - Rendered statutory A4 document (mirrored to artifact folder).
4. `scratch/po_grn_cycle/01_purchase_order_approved.png` - PO approval state screenshot.
5. `scratch/po_grn_cycle/02_grn_inward_audit_matrix.png` - GRN inward and discrepancy matrix screenshot.
6. `scratch/po_grn_cycle/03_exported_pdf_statutory_preview.png` - Statutory PDF preview screenshot.
7. `scratch/po_grn_cycle/04_complete_cycle_reconciliation_summary.png` - Comprehensive cycle reconciliation screenshot.
8. `docs/walkthrough/procurement/Procurement_PO_To_GRN_Headless_Cycle_And_Studio_Decoupling_v1.0.0.md` - This walkthrough.

## 4. Files Modified
1. `src/components/PoGenerateTab.tsx` - Removed nested legacy GRN subtab, added direct navigation link to Goods Receipt Studio (`openTab('grn-studio')`).
2. `src/components/TabRenderer.tsx` - Registered `grn-studio` component and alias route with lazy loading.
3. `src/store/layout_store.tsx` - Added `grn-studio` to valid workspace tab IDs and tab registry.
4. `src/components/fiori/launchpadCatalog.ts` - Added "Goods Receipt (GRN) Studio" tile under Procurement & Inventory catalog with `@SmritiCapability("PURCHASE", "GRN_RECEIPT")`.
5. `src/services/BreadcrumbRegistry.ts` - Registered breadcrumb hierarchy `Procurement > Goods Receipt Studio`.
6. `docs/walkthrough/README.md` - Added chronologically ordered entry for this walkthrough.

## 5. Architecture Decisions
- **Decoupled Workspaces (ADR-PO-GRN-01)**: Segregated PO creation (Commercial Intent / Budget Approval) from GRN Inwarding (Physical Logistics / Gate Security / Quality Inspection). Mixing both in a single tab violated separation of duties and created cluttered navigation.
- **Headless Playwright Automation (ADR-TEST-HEADLESS-01)**: Enforced 100% headless browser execution (`headless=True`) to run in unattended CI/CD, remote developer environments, and serverless verification pipelines without launching display servers or visible GUI windows.
- **Direct Database Seed & Transactional Integrity**: Inwarding engine verifies both relational constraints (`company_id`, `branch_id`, `barcode`, `product_id`) and statutory numbering structures before emitting documents.

## 6. Design Rationale
- **Fiori Design Language**: Consistent with SAP Fiori / SMRITI NX design guidelines, using stat tiles, status badges, tabular discrepancy views, and accessible hotkeys.
- **Discrepancy Transparency**: Warehouse clerks and store managers immediately see ordered vs. received vs. damaged vs. shortage quantities with automatic debit note calculation.

## 7. Implementation Summary
- Created `GrnStudioTab.tsx` with:
  - Header statistics: Pending PO Inwards, Received Today, Shortage / Damage Claims, Inward Value.
  - Active Pending PO table with quick search and filter by vendor.
  - Line-by-line inspection grid with Ordered Qty, Inward Qty, Damaged Qty, Shortage Qty, Accepted Qty, and Unit Cost.
  - Financial discrepancy summary calculating Net Accepted Value and Pending Debit Note Claim.
  - Direct Action buttons: Post Goods Receipt, Download Inward Slip, Navigate to PO Studio.
- Updated `PoGenerateTab.tsx` with an action banner allowing immediate transition to the dedicated GRN Studio.
- Built `execute_headless_po_to_grn_cycle.py` integrating PostgreSQL persistence, HTML-to-PDF rendering via Playwright, and screenshot capturing.

## 8. Tests Executed
1. **Headless Cycle Engine Run**:
   ```bash
   python scripts/execute_headless_po_to_grn_cycle.py
   ```
   Verified insertion and verification of PO `PO/2026-27/0999` and GRN `GRN/2026-27/0999`.
2. **TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   ```
   Output: 0 errors.
3. **Launchpad Catalog Validation**:
   ```bash
   npm run validate-launchpad
   ```
   Output: 100% valid.
4. **Registry Check**:
   ```bash
   npm run validate-registry
   ```
   Output: 0 errors.
5. **Vitest Unit Test Suite**:
   ```bash
   npm test -- --run
   ```
   Output: 141/141 test files passed, 958/958 tests green.

## 9. Verification Results
- **Status**: `Done`
- **PO Document**: `PO/2026-27/0999` (Status: `APPROVED`, Net Value: Rs. 1,65,690.00, Quantity: 118 Pairs).
- **GRN Document**: `GRN/2026-27/0999` (Status: `RECEIVED`, Net Value: Rs. 1,59,390.00, Discrepancy: Rs. 6,300.00).
- **Exported Statutory PDF**: `scratch/po_grn_cycle/PO_GRN_Complete_Cycle_0999.pdf` (1,001,208 bytes, 4 pages, A4 format).
- **Verification Screenshots**:
  - `01_purchase_order_approved.png` (82,319 bytes)
  - `02_grn_inward_audit_matrix.png` (86,854 bytes)
  - `03_exported_pdf_statutory_preview.png` (143,154 bytes)
  - `04_complete_cycle_reconciliation_summary.png` (124,195 bytes)

## 10. Known Limitations
- Direct thermal barcode label printing directly from GRN inward grid requires connection to a physical ESC/POS printer service.
- Supplier invoice attachment OCR scanning is scheduled for Phase 2.

## 11. Future Work
- Automatic generation of Supplier Debit Notes (`PUR-DN`) directly from the GRN Studio discrepancy ledger.
- Barcode scanner integration for box-by-box RF gun inwarding.

## 12. Related ADRs
- `ADR-038`: Decoupled Procurement & Inwarding Subsystems.
- `ADR-041`: Headless Playwright Verification Protocol.

## 13. Related RFCs
- `RFC-2026-09-GRN`: Enterprise Goods Receipt Note Decoupling and Statutory Inward Protocol.
