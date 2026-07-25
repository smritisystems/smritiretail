<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.0
  Created      : 2026-07-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Walkthrough: Barcode Studio V2.4a Enterprise Spec Upgrade v3.32.0

## 1. Purpose
This walkthrough documents the alignment and upgrade of SMRITI Barcode Studio in `f:\SMRITRretailNXmgrt` with the reference enterprise specification in `D:\Smriti_Retail_OS` (v2.4.0 / ADR-0008). It introduces the Article Range Loader, 9-column interactive fashion variant worksheet grid, 4-step style token resolution chain (`{style}`), Box & Carton multiplier mode, persistent LocalStorage reprint queue, and hardware scan telemetry with live Scan Reliability Score ($SRS$) computation.

## 2. Scope
- **Article Range Loader**: Generates style IDs between numeric/alphabetic boundaries (e.g. `BBM-0001` to `BBM-0010`) and automatically expands into size-color variants.
- **Interactive 9-Column Fashion Variant Worksheet Grid**: Displays `Selection`, `Style ({style})`, `Variant SKU`, `Item Name`, `Barcode Value`, `Cost/Selling/MRP Rates`, `Stock Qty`, `Box/Carton Rule`, and `Label Print Copies`.
- **4-Step Style Token Resolution Engine (`resolveStyleToken`)**: Resolves `{style}` using: `variant_of` $\rightarrow$ `custom_style_code` $\rightarrow$ `style_no` $\rightarrow$ SKU Hyphen Split fallback (`BBM-0001-6-BLK` $\rightarrow$ `BBM-0001`).
- **Box & Carton Multiplier Mode**: Converts packing capacity rules (`single`, `box6`, `carton12`, `case24`, `masterGS1`) into auto-computed label counts.
- **Persistent LocalStorage Reprint Queue**: Caches completed print batch jobs in `smriti_barcode_reprint_queue` with ZPL/TSPL output code inspector modals and 1-click reprinting.
- **Scan Telemetry Console ($SRS$ Gauge)**: Tracks scan events (`SCAN-EVT-001/002/003`) and calculates Scan Reliability Score ($SRS$):
  $$SRS = \left( \frac{\text{FirstPassScans} + 0.5 \times \text{RetryScans}}{\text{TotalScans}} \right) \times 100$$

## 3. Files Created
- `docs/walkthrough/inventory/Barcode_Studio_V2.4a_Upgrade_v3.32.0.md`: WGP documentation walkthrough.

## 4. Files Modified
- `src/components/BarcodeStudioTab.tsx`: Upgraded component to full Barcode Studio V2.4a spec.
- `docs/walkthrough/README.md`: Updated master index table with version v3.32.0.

## 5. Architecture Decisions
- **Standalone Tab & Widescreen Ergonomics**: Consolidated Barcode Master, Generator, Label Printing V2.4a, Demo, Telemetry Console, Reprint Queue, and Engine Settings under a single navigation hub.
- **Zero Data Loss & Offline Persistence**: Print job history is preserved in LocalStorage (`smriti_barcode_reprint_queue`) so store managers can reprint label batches even after app restarts.

## 6. Design Rationale
- **High-Throughput Warehouse Operations**: Warehouse operators can process 50+ style ranges and hundreds of footwear/apparel variants in seconds using the Article Range Loader.
- **Packing Multipliers**: Eliminates manual arithmetic for carton and box labeling.

## 7. Implementation Summary
- Added `resolveStyleToken` function implementing the 4-stage fallback chain.
- Added `LabelPrintingV24a` component with Article Range Loader, 9-column worksheet grid, and packing rules.
- Added `ReprintQueueHistory` component with LocalStorage caching and ZPL inspector modal.
- Added `ScannerConsole` component with live $SRS$ gauge computation.

## 8. Tests Executed
- Playwright E2E automation suite on Docker container `smriti-workspace`.

## 9. Verification Results
- All tests passed cleanly with 0 console errors and zero regression.

## 10. Known Limitations
- Direct USB hardware printing requires local thermal print proxy bridge or QZ Tray plugin.

## 11. Future Work
- Add direct WebUSB / QZ Tray hardware thermal print bridge support.

## 12. Related ADRs
- `ADR-0008`: Barcode Studio Modularization.

## 13. Related RFCs
- `RFC-BARCODE-003`: Barcode Studio V2.4a Widescreen Operations Upgrade.
