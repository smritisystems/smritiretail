<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Print Labels Studio CSV/Raw Barcode Intake, Print Profiles & Session Audit Log (v6.49.0)

## 1. Purpose
This release implements complete operational parity with legacy Label Studio V2 by providing high-throughput batch barcode manifest intake, rapid worksheet reset controls, configurable print profile presets (LAN/USB), and persistent in-session activity logging.

---

## 2. Scope
- **CSV & Raw Text Barcode Intake Modal (`parseBarcodeCsvOrText`):**
  - Ingests uploaded `.csv` or `.txt` manifests or pasted raw multiline text.
  - Automatically identifies field delimiters (comma `,`, tab `\t`, semicolon `;`, space ` `).
  - Supports configurable column mapping for Barcode (Col 1/2/3/4) and Print Quantity (Col 2/1/3/Default 1).
  - Ingestion aggregator automatically consolidates duplicate barcode scans, summing quantities into clean worksheet items.
- **Worksheet `[Clear All]` Action:**
  - 1-Click worksheet reset with user confirmation prompt and session activity logging.
- **Print Profile Presets (Save & Load):**
  - Dropdown in Step 3 / Left Sidebar (`PRINT PROFILE PRESETS`) to switch between saved printer configurations.
  - Dedicated `[💾 Save Current Settings Preset]` button in the Right Sidebar under Pre-Print Sanitizer.
  - Preserves settings (`templateId`, `printerInterface`, `networkPrinterIp`, `networkPrinterPort`, `dpi`) in browser `localStorage`.
- **Live Print Session Log Stream:**
  - Monospace terminal ticker in Step 3 recording real-time actions (`IMPORTED CSV`, `PRN DOWNLOADED`, `CLEARED WORKSHEET`, `SPOOLED LABELS`, `LOADED PRESET`).
- **Comprehensive Unit Testing:**
  - Expanded `src/tests/printLabelsStudio.test.ts` from 16 to 20 unit tests, certifying delimiter detection, column mapping, duplicate aggregation, and preset validation.

---

## 3. Files Created
- `docs/implementation/inventory/Barcode_PrintLabelsStudio_CSVIntake_And_Presets_Plan_v6.49.0.md`: Formal 19-section implementation plan.
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_CSVIntake_And_Presets_v6.49.0.md`: This 13-section walkthrough document.

---

## 4. Files Modified
- `src/components/barcode/PrintLabelsStudio.tsx`:
  - Added export helpers: `CsvParseOptions`, `ParsedBarcodeEntry`, `parseBarcodeCsvOrText`, `PrintProfilePreset`, `DEFAULT_PRINT_PRESETS`.
  - Added `Import Barcodes from CSV / Raw Text` modal with upload, paste, delimiter selector, and column mapping.
  - Added `[Import CSV / Text]` trigger buttons in top header and worksheet toolbar.
  - Added `[Clear All]` button with confirmation in worksheet toolbar.
  - Added `Print Profile Presets` dropdown, printer IP & port inputs, and `Print Session Log` ticker in Step 3.
  - Added `[Save Current Settings Preset]` button and modal prompt in Right Sidebar.
  - Version bumped to `6.49.0`.
- `src/tests/printLabelsStudio.test.ts`:
  - Added 4 unit tests verifying CSV parsing, delimiter detection, header skipping, column mapping, and presets.
  - Version bumped to `6.49.0`.
- `docs/implementation/README.md`: Updated master index table with v6.49.0 plan.
- `docs/walkthrough/README.md`: Updated master index table with v6.49.0 walkthrough.
- `CHANGELOG.md`: Added release notes for `[6.70.29] - 2026-10-08 (v6.49.0)`.

---

## 5. Architecture Decisions
1. **Side-Effect-Free Parser Abstraction:**
   The parser `parseBarcodeCsvOrText` is implemented as an exported pure function. It handles line sanitization, comment filtering, header detection, delimiter sniffing, and duplicate barcode aggregation without DOM or state dependencies.
2. **Duplicate Ingestion Aggregation Strategy:**
   When warehouse operators scan physical inventory repeatedly with wireless barcode guns or paste multi-scan logs, the engine aggregates identical barcode lines by summing their print quantities rather than creating dozens of redundant identical worksheet rows.
3. **Local Storage Profile Presets with Factory Fallbacks:**
   Default presets for `Zebra GK420D - Footwear 100x50 (LAN)` and `Zebra ZD421 - Retail 50x25 (USB)` are provided out-of-the-box. User-saved profiles are persisted into `localStorage` (`smriti_barcode_print_presets`) to enable instant workstation switching without database schema mutations.
4. **Rolling Monospace Session Log:**
   A rolling in-memory buffer of 15 timestamped session log events is maintained in component state, providing dispatchers immediate operational visibility into recent downloads, imports, and printer communications.

---

## 6. Design Rationale
- **Frictionless Manifest Intake:** Retail suppliers and manufacturers provide packing manifests in spreadsheets. Manually searching for 100+ items is tedious; pasting two columns (`barcode,qty`) directly loads the entire print job in under two seconds.
- **Workstation Preset Switching:** Dispatch bays frequently operate multiple label printers (e.g. 100x50mm shoe box labels on LAN port 9100 vs 50x25mm item stickers on USB). 1-Click preset loading eliminates repetitive IP and template re-entry.
- **Audit Traceability:** Real-time logging of line counts and download timestamps prevents duplicate print spools and accidental waste of expensive thermal rolls.

---

## 7. Implementation Summary
| Feature | UI Surface | Implementation Detail |
|---|---|---|
| **CSV / Raw Text Import Modal** | Top Header & Worksheet Toolbar | Modal with file upload, paste textarea, delimiter auto-detect, and column selectors. |
| **Duplicate Barcode Aggregator** | Ingestion Engine (`parseBarcodeCsvOrText`) | Aggregates repeated scans by summing `qty` into single worksheet rows. |
| **Worksheet Clear All** | Worksheet Toolbar | 1-Click reset clearing all items with confirmation dialog and session logging. |
| **Print Profile Presets** | Step 3 / Left Sidebar | Dropdown loading saved configurations (`templateId`, IP, port, interface, DPI). |
| **Save Current Preset** | Right Sidebar Card | Modal prompt saving current configuration to `localStorage`. |
| **Print Session Log** | Step 3 Diagnostics Area | Real-time monospace event feed displaying timestamps and operational summaries. |

---

## 8. Tests Executed
1. **Frontend Vitest Test Suite (`src/tests/printLabelsStudio.test.ts`):**
   - `20/20` tests passed (100% green).
   - Validated CSV manifest parsing and duplicate barcode aggregation (summing quantities).
   - Validated auto-detection of tab (`\t`), semicolon (`;`), and space (` `) delimiters.
   - Validated header row skipping (`Barcode No,Item Description,Print Qty`) and alternate column mapping.
   - Validated factory print profile presets (`GK420D LAN` and `ZD421 USB`).
2. **TypeScript Compiler Check (`tsc --noEmit`):**
   - Exit code `0` (0 errors across entire workspace).

---

## 9. Verification Results
```text
✓ Vitest Test Suite (src/tests/printLabelsStudio.test.ts): 20/20 passed in 40ms
✓ TypeScript Compiler (tsc --noEmit): Exit code 0 (0 errors)
✓ Zero Database Schema Alterations
✓ Zero Regressions on Existing Thermal Printing Workflows
```

---

## 10. Known Limitations
- Pasted manifests without product names or styles automatically synthesize item descriptions (`Item <barcode>`) and default pricing (₹1,199) if not present in the local catalog cache. Operators can edit these values directly in the worksheet table before printing.

---

## 11. Future Work
- Add Excel `.xlsx` binary parsing via `SheetJS` or `xlsx` client library for direct workbook dragging without prior CSV export.
- Add printer profile export/import as JSON files to replicate configurations across multiple warehouse client machines.

---

## 12. Related ADRs
- `ADR-0042`: Barcode Architecture and Thermal Hardware Spooling Standards.

---

## 13. Related RFCs
- `RFC-4180`: Common Format and MIME Type for CSV Data.
