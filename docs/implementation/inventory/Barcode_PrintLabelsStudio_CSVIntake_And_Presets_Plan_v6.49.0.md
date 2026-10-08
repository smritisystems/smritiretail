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

# SMRITI Implementation Plan: Barcode Print Labels Studio CSV/Raw Barcode Intake, Print Profiles & Session Audit Log (v6.49.0)

## 1. Objective
Achieve complete functional and operational alignment between SMRITI Print Labels Studio (`src/components/barcode/PrintLabelsStudio.tsx`) and legacy Label Studio V2 by implementing:
1. `Import Barcodes from CSV / Raw Text` modal with auto-delimiter detection, file upload, text paste, and configurable column mapping.
2. 1-Click `[Clear All]` worksheet reset affordance.
3. Persistent `Print Profile Presets` (Save Current Settings & Load Named Preset) backed by browser storage.
4. Live in-session `Print Session Log` audit stream.
5. Search bar Brand & Category filters.

## 2. Business Motivation
In high-throughput retail packaging and dispatch operations:
- Warehouse teams receive shipment manifests in CSV/Excel or scan large batches using offline barcode guns. Without direct CSV/Raw Text intake, operators are forced to search and select hundreds of SKUs one by one.
- Operators frequently switch between different physical label printers (e.g. Footwear 100x50mm on Zebra LAN vs Apparel 50x25mm on USB). Reconfiguring IP, port, DPI, and layout each time is error-prone.
- A live in-session audit log gives dispatch supervisors immediate confirmation of what files were downloaded, what jobs were spooled, and how many labels were processed.

## 3. Scope
- **In Scope:**
  - **`Import Barcodes from CSV / Raw Text` Modal:**
    - Dual mode: `Upload CSV File` (.csv, .txt) and `Paste Raw Text` (multi-line textarea).
    - Auto-delimiter detection (comma, tab, semicolon, space) with manual override.
    - Column selectors: Barcode Column (Col 1/2/3) and Print Qty Column (Col 2/1/Default 1).
    - Ingestion aggregator combining duplicate barcode entries into aggregated print quantities.
    - Catalog matcher synthesizing complete StudioRow records.
  - **Worksheet `[Clear All]` Button:**
    - Clean reset with confirmation dialog and session logging.
  - **Print Profile Presets:**
    - `PRINT PROFILE PRESETS` dropdown in Step 3 / Left Sidebar.
    - `[💾 Save Current Settings Preset]` in Right Sidebar.
    - Persists presets to `localStorage` (`id`, `name`, `templateId`, `printerInterface`, `networkPrinterIp`, `networkPrinterPort`, `dpi`).
  - **Print Session Log:**
    - Live monospace event feed in left sidebar recording session activities (import, download, spool, clear, sanitize).
  - **Unit Test Suite Expansion:**
    - Unit tests in `src/tests/printLabelsStudio.test.ts` certifying CSV/text parsing, delimiter detection, column mapping, and duplicate barcode aggregation.
- **Out of Scope:**
  - Modifying PostgreSQL database schema (all profile presets and session logs are client/browser managed).
  - Changing external REST API contracts.

## 4. Current State
- `PrintLabelsStudio.tsx` supports manual search and inward sync (PO, GRN, Transfer), but cannot ingest raw barcode text or CSV files.
- Users cannot clear the entire worksheet in one click.
- Printer configurations (IP, port, template) must be manually reselected each time.
- No in-session event log exists.

## 5. Gap Analysis
1. **Bulk Intake Gap:** Legacy Label Studio V2 featured an `Import Barcodes from CSV / Raw Text` modal that accepted pasted barcode lists with quantities; current studio lacked this ingestion path.
2. **Worksheet Reset Gap:** Legacy studio had a prominent `Clear All` button; current studio required manual row removal.
3. **Preset Management Gap:** Legacy studio allowed saving and switching printer setups via named presets.
4. **Session Observability Gap:** Legacy studio displayed a timestamped `PRINT SESSION LOG` showing recent print and download actions.

## 6. Architecture Impact
- **Frontend Architecture:** Modularizes CSV parsing logic as pure function `parseBarcodeCsvOrText(rawText, options)` exported from `PrintLabelsStudio.tsx` for testability.
- **State Management:** Preserves presets in `localStorage` and keeps rolling session logs in component state.
- **Backend Architecture:** Zero backend changes required.

## 7. Proposed Design
1. **Pure Function `parseBarcodeCsvOrText`:**
   - Detects delimiter (`,`, `\t`, `;`, ` `).
   - Maps columns for barcode and print quantity.
   - Sums quantities for duplicated barcode lines.
   - Returns structured `ParsedBarcodeEntry[]`.
2. **Import Modal UI:**
   - Styled to match dark/light theme and user screenshot.
   - Radio buttons for `Upload CSV File` and `Paste Raw Text`.
   - Dynamic preview and `Process & Add to Worksheet` button.
3. **Print Profile Presets:**
   - Saves current settings to `smriti_barcode_print_presets`.
   - Selecting a preset updates template, printer IP, port, interface, and DPI.
4. **Session Log Stream:**
   - Rolling buffer of 15 timestamped entries rendered in dark terminal styling.

## 8. Files Created
- `docs/implementation/inventory/Barcode_PrintLabelsStudio_CSVIntake_And_Presets_Plan_v6.49.0.md` (This document)
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_CSVIntake_And_Presets_v6.49.0.md` (Walkthrough)

## 9. Files Modified
- `src/components/barcode/PrintLabelsStudio.tsx`: Core component additions.
- `src/tests/printLabelsStudio.test.ts`: Test suite expansion.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.
- `CHANGELOG.md`: Version 6.49.0 release notes.

## 10. Dependencies
- React 18
- Lucide React
- Vitest 4.x

## 11. Risks
- *Risk:* Uploading a massive CSV (>10,000 lines) could lock the UI thread.
  *Mitigation:* Chunk processing and limit parsed batch to first 2,000 lines with an alert.
- *Risk:* Corrupted or empty lines in pasted text.
  *Mitigation:* Filter out empty lines, comments, and header rows automatically.

## 12. Rollback Strategy
All changes are localized to `PrintLabelsStudio.tsx` and unit tests. Reverting git commit restores previous v6.48.0 state without data loss.

## 13. Verification Plan
1. Run `npx vitest run src/tests/printLabelsStudio.test.ts` to verify CSV parser and aggregation tests.
2. Run `npx tsc --noEmit` to verify TypeScript compile health.
3. Run backend pytest suites to ensure no regressions.

## 14. Test Plan
- Unit test for auto-delimiter detection (comma, tab, semicolon, space).
- Unit test for column mapping (barcode col, qty col).
- Unit test for duplicate barcode aggregation.
- Unit test for header row skipping.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Build and test locally in `smritiNX` branch.

## 17. Status
Approved — In Progress.

## 18. Related ADRs
- `ADR-0042`: Barcode Architecture and Thermal Hardware Spooling Standards.

## 19. Related Walkthroughs
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_V2_Parity_v6.48.0.md`
