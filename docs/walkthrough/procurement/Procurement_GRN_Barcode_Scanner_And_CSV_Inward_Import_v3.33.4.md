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

  * Version    : 3.33.4
  * Created    : 2026-09-20
  * Modified   : 2026-09-20
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Procurement GRN Barcode Scanner Suite & Multi-Format CSV Inward Import Engine

**Document ID:** `WT-PROC-2026-0920-001`  
**Area:** `procurement`  
**Topic:** `Goods Receipt Note (GRN) Barcode Scanner Suite & Intelligent CSV Inward Import`  
**Version:** `v3.33.4`  
**Status:** `Completed`  
**Date:** `2026-09-20`  

---

## 1. Purpose
This release delivers an enterprise-grade inward physical material verification subsystem within the SMRITI Goods Receipt Note (GRN) Studio (`GrnReceiptTab.tsx`). It empowers warehouse and store receiving operators with:
1. High-throughput handheld barcode scanning with acoustic Web Audio API feedback, continuous +1 mode, autofocus lock, and live PostgreSQL master catalog reconciliation.
2. An integrated Mobile/Tablet Camera Barcode Scanner Viewfinder (`GrnCameraScannerModal.tsx`) using HTML5 `BarcodeDetector` APIs.
3. An Intelligent Multi-Format CSV / TSV / PDT Inward File Ingestion Engine (`GrnCsvImportModal.tsx`) supporting flexible reconciliation modes (merge against PO lines, append ad-hoc items, or replace workspace).
4. Full layout and visual fidelity matching the reference operator interface, including live Purchase Price Variance (PPV) dispute detection and post-GRN gross margin preview cards.

---

## 2. Scope
- **UI Subsystem:** `GrnReceiptTab.tsx` workspace enhancements.
- **Scanning Engine:** Handheld hardware wedge scan input, continuous +1 toggle, synthetic browser audio chimes, live master catalog lookup (`/inventory/?q=...`), and camera modal scanner.
- **File Ingestion:** RFC 4180 CSV, tab-delimited TSV, and Portable Data Terminal (PDT) tilde-delimited (`barcode~qty~rate`) import with template export (`grn_inward_template.csv`).
- **Commercial & Financial Metrics:** Live PPV calculation (`(Invoice Rate - PO Rate) * Net Accepted`), post-GRN gross margin preview (`Avg Landed Cost`, `Avg MRP`, `Avg Margin %`), Cost Summary with ITC tax breakdown, and bottom action buttons.
- **Testing & Governance:** Preflight architectural certificates, Vitest automated unit tests (9/9 tests green), Vite production build (3,584 modules compiled), and Docker container rebuild.

---

## 3. Files Created
1. `src/components/purchase/GrnCameraScannerModal.tsx`
   - Real-time video viewfinder camera barcode scanner modal using HTML5 `BarcodeDetector` API.
   - Laser scanline animation, torch toggle, sound chime feedback, and recent scan history list.
   - Certified via Preflight Certificate `PF-2026-0920-187BF6`.
2. `src/components/purchase/GrnCsvImportModal.tsx`
   - Multi-format inward CSV/TSV/PDT parser with auto-header alias resolution.
   - Validation breakdown, PPV indicators, sample template download, and merge/append/replace modes.
   - Certified via Preflight Certificate `PF-2026-0920-823590`.
3. `src/tests/grnBarcodeScanner.test.ts`
   - Vitest unit test suite covering barcode exact matching, continuous +1 mode, case-insensitive item IDs, ad-hoc SKU addition, and PPV computation (5/5 passed).
4. `src/tests/grnCsvImportEngine.test.ts`
   - Vitest unit test suite covering standard CSV parsing, header alias mapping, PDT parsing, and validation errors (4/4 passed).
5. `.architecture/certificates/PF-2026-0920-187BF6.json`
   - Preflight architectural approval certificate for `GrnCameraScannerModal.tsx`.
6. `.architecture/certificates/PF-2026-0920-823590.json`
   - Preflight architectural approval certificate for `GrnCsvImportModal.tsx`.
7. `scripts/register_grn_scanner_csv_certificates.py`
   - Certificate issuer script enforcing zero duplication and governance compliance.

---

## 4. Files Modified
1. `src/components/purchase/GrnReceiptTab.tsx`
   - Added Barcode Scanner card with live autofocus wedge input, `● Ready` badge, `+1 Mode` toggle, and action buttons.
   - Integrated `playScanTone` using native Web Audio API oscillators for zero-dependency acoustic feedback.
   - Integrated live catalog fallback lookup to `/inventory/?q=...` via `apiFetchV1`.
   - Wired `GrnCameraScannerModal` and `GrnCsvImportModal`.
   - Restructured layout to match reference UI: Inward Items table, Barcode Scanner card, side-by-side PPV and Margin Preview cards, 5-step process wizard, 4 metric pills, Remarks and Attachments.
   - Enhanced Right Dock: 8-column Cost Components table with GST and ITC status, updated Cost Summary with `Total GST (ITC Eligible)`, primary `Preview GRN & Labels` button, and `View Allocation Preview ->` navigation.

---

## 5. Architecture Decisions
- **ADR-048: Browser Native Web Audio API for Operational Feedback:** Rather than bundling heavy MP3/WAV audio assets or depending on network asset loads, synthetic audio tones (sine wave 880Hz→1320Hz for success, triangle wave 660Hz→880Hz for ad-hoc, sawtooth 220Hz→160Hz for error) are generated on-demand using browser `AudioContext`.
- **ADR-049: Dual Mode Receiving (Handheld Wedge vs Camera Viewfinder):** Store operators on POS terminals use physical handheld USB/Bluetooth 1D/2D scanners via keyboard wedge mode with instant autofocus; mobile/tablet operators on warehouse docks use the camera modal viewfinder.
- **ADR-050: Tolerant Multi-Format Inward Parser:** The inward import engine accepts standard CSV, TSV, and legacy PDT tilde-delimited streams (`barcode~qty~rate`) without requiring manual format selection.

---

## 6. Design Rationale
Warehouse and retail dock receiving environments require speed and ergonomics. High-throughput receiving operators scan hundreds of items in rapid succession; visual confirmation alone is insufficient, making auditory chimes essential. Side-by-side display of PPV disputes and Margin Preview allows receiving managers to immediately spot rate discrepancies and unviable margins before posting to the inventory ledger.

---

## 7. Implementation Summary
- **Handheld Rapid Scanner:** Input captures raw keystrokes with Enter termination, checks existing lines for matching SKU/Barcode/Item ID, increments accepted units, and queries backend master catalog when unknown.
- **Camera Viewfinder:** Renders responsive camera stream in modal with targeted viewfinder box, laser scanning animation, and real-time detection via `window.BarcodeDetector`.
- **CSV Ingestion Engine:** Parses headers case-insensitively, maps aliases (`ean` -> `barcode`, `recv_qty` -> `quantity`), reconciles lines, calculates PPV, and offers 3 import policies (`merge`, `append`, `replace`).
- **Landed Cost & ITC:** Right dock table displays base amounts, GST %, GST amounts, ITC eligibility status (green checkmark / red cross), and allocation methodology.

---

## 8. Tests Executed
```bash
# Automated Unit Test Suite
npx vitest run src/tests/grnBarcodeScanner.test.ts src/tests/grnCsvImportEngine.test.ts

# Architecture Duplication Gate
python scripts/architecture_duplication_gate.py

# Production Build Verification
npm run build

# Docker Container Verification
docker compose build smriti-web
docker compose up -d smriti-web
```

---

## 9. Verification Results
- **Vitest Unit Tests:** 9/9 tests passed (2/2 test files green) in 1.20s.
- **Architecture Gate:** 11/11 checks passed, 0 violations, 0 registered debt.
- **Production Build:** `vite build` completed successfully, 3,584 modules transformed in 43.31s.
- **Docker Deployment:** `smriti-web` container rebuilt and started healthy on port 3000 alongside healthy `smriti-api`, `smriti-db`, and `smriti-mssql`.

---

## 10. Known Limitations
- Native `window.BarcodeDetector` is supported in Chromium-based browsers; fallback manual barcode entry is provided for browsers lacking the experimental Shape Detection API.
- Live camera stream requires secure context (`https://` or `localhost`).

---

## 11. Future Work
- Integration with thermal barcode label printer service (QZ Tray) directly from the `Preview GRN & Labels` workflow.
- Direct ASN (Advance Shipping Notice) electronic EDI inward mapping.

---

## 12. Related ADRs
- `ADR-048`: Browser Native Web Audio API for Operational Feedback
- `ADR-049`: Dual Mode Receiving (Handheld Wedge vs Camera Viewfinder)
- `ADR-050`: Tolerant Multi-Format Inward Parser

---

## 13. Related RFCs
- `RFC-2026-09-GRN-SCAN`: Goods Receipt Barcode Scanner & CSV Ingestion Specifications
- `RFC-2026-09-LANDED-COST`: Landed Cost Allocation & Purchase Price Variance Governance
