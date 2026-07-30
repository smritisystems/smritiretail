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

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.36.0 (Dedicated Print Labels Sidebar Menu & Tag Printing Studio)
  * Created    : 2026-07-25
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Dedicated "Print Labels" Sidebar Menu & Tag Printing Studio — Walkthrough v3.36.0

## 1. Purpose
This walkthrough documents the creation and registration of the dedicated **Print Labels** menu item in the SMRITI Retail OS navigation sidebar (`id: "print-labels"` under **Inventory & Sourcing**) and the implementation of the high-productivity **Tag Printing Studio (`PrintLabelsTab.tsx`)** modeled on classic retail ERP specifications (SMRITI Enterprise Retail spec).

## 2. Scope
- Dedicated sidebar navigation item registration (`Print Labels` under `Inventory & Sourcing`).
- Output & Port Selection: Direct USB Port, TCP/IP Network, COM 1-3, Parallel Port (LPT1), and File Export (.prn/.txt).
- Data Source Options: Manual Selection, Against Purchase (PT File / GRN), Against Transactions, Against Purchase Order, Against Item Masters, Against Direct Barcode Scan.
- Labels Strategy: Specified Quantity vs Present Stock.
- Selection Criteria Range Boundaries (From — To) for Stock No, Product, Brand, Style, Shade (Color), Size.
- Multi-track roll setup (1 to 4 labels per row).
- Selected Item Inspection, 2D Barcode Tag rendering, and Raw ZPL/TSPL script evaluation.

## 3. Files Created
- `src/components/PrintLabelsTab.tsx` — Dedicated Tag Printing Studio workstation component.

## 4. Files Modified
- `src/layout_engine/layout_store.tsx` — Registered `print-labels` under `Inventory & Sourcing` in the sidebar layout store.
- `src/App.tsx` — Added tab route mapping for `print-labels` and `tag-printing`.
- `docs/walkthrough/README.md` — Updated master walkthrough index table.

## 5. Architecture Decisions
- **Legacy ERP Compatibility**: Recreates the full functional ergonomics of classic Tag Printing software (SMRITI Enterprise Retail) while leveraging modern SMRITI UI glassmorphism and real-time reactive engines.
- **Unified Hardware Bridge**: Connects directly to `PrinterConfigurationModal` for live USB & TCP/IP hardware socket diagnostics.

## 6. Design Rationale
Retail managers and warehouse operators often perform bulk tag printing filtering across stock range boundaries (Stock No. 000006 to 000008, Product, Brand, Style, Shade, Size). Providing a dedicated sidebar menu item ("Print Labels") with explicit range boundary selection and multi-track roll support maximizes operational efficiency.

## 7. Implementation Summary
1. Registered `"print-labels"` in `registeredWorkspaces` array in `layout_store.tsx`.
2. Created `PrintLabelsTab.tsx` featuring output port radio matrix, option mode selection, range criteria table, navigation buttons (`|<`, `<`, `>`, `>|`), and primary action controls (`Print Selected`, `Print All`, `Clear`).
3. Mapped `"print-labels"` and `"tag-printing"` routes in `App.tsx`.

## 8. Tests Executed
- Navigation test from sidebar item to Print Labels tab.
- Range boundary filter evaluation on sample stock items.
- Hardware configuration modal trigger & port selection verification.

## 9. Verification Results
- **Print Labels** appears in the sidebar under Inventory & Sourcing.
- Tab opens cleanly and displays complete Tag Printing workstation layout.

## 10. Known Limitations
- File export output (.prn/.txt) relies on browser download trigger in pure web mode.

## 11. Future Work
- Add dynamic CSV/Excel PT file bulk upload dropzone.

## 12. Related ADRs
- `AOP-002`: Four-Tier Enterprise Architecture & Application Independence Principle.

## 13. Related RFCs
- `ACP_BARCODE_003`: SMRITI Smart Label Printing Engine (SLPE) & Hardware Registry.
