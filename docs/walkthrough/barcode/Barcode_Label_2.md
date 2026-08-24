<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Tag & Barcode Label Printing with QZ Tray Direct Thermal Dispatch

## 1. Purpose
This release provides a production-grade upgrade for Tag & Barcode Label Printing in SMRITI Retail OS, transitioning thermal barcode printing from a browser dialog-dependent mode to an enterprise direct-dispatch architecture. By integrating the official QZ Tray client with backend RSA 2048-bit X.509 cryptographic signing, the system spools raw DPL, TSPL, and ZPL printer streams silently and directly to Windows USB printer queues (such as `IMPACT by Honeywell IH-2 (300 dpi) - DPL`), while preserving fallback paths for Windows Print Dialog and offline PRN file downloads.

## 2. Scope
- **Backend Services:**
  - Server-side cryptographic key management, self-signed X.509 certificate generation, and SHA512 message signing in `backend/app/services/qz_security.py`.
  - Public certificate endpoint (`GET /api/v1/barcode/qz/certificate`) and request signing endpoint (`POST /api/v1/barcode/qz/sign`) in `backend/app/api/v1/barcode.py`.
  - Enhanced `PrintRequest` schema supporting `prnTemplate`, `templateContent`, `targetPrinter`, and `dispatch_mode: "qz_tray"` in `backend/app/schemas/barcode.py`.
  - Asynchronous print job acknowledgment endpoint (`POST /api/v1/barcode/print-jobs/{job_id}/ack`) tracking actual hardware spooling status in `PrintHistory`.
- **Frontend Clients:**
  - Integration of official `qz-tray` JavaScript client in `src/utils/qzTrayClient.ts` with certificate/signature promise resolution against FastAPI backend.
  - Live QZ Tray daemon diagnostic testing, Windows printer enumeration, and calibration test printing in `src/components/barcode/BarcodePrinterSelectModal.tsx`.
  - High-density 5-step tag printing workflow with Item Master criteria filters, 3-state sorting, safety validation gating, and multi-route dispatching in `src/components/barcode/TagLabelPrintingTab.tsx`.

## 3. Files Created
- `backend/app/services/qz_security.py`

## 4. Files Modified
- `backend/app/api/v1/barcode.py`
- `backend/app/schemas/barcode.py`
- `backend/app/tests/conftest.py`
- `backend/app/tests/test_barcode.py`
- `src/utils/qzTrayClient.ts`
- `src/components/barcode/BarcodePrinterSelectModal.tsx`
- `src/components/barcode/TagLabelPrintingTab.tsx`
- `src/tests/qzTrayClient.test.ts`
- `package.json`

## 5. Architecture Decisions
- **ADR-QZ-001: Server-Side Cryptographic Private Key Isolation:** To prevent browser security prompts and eliminate certificate warnings in QZ Tray, the RSA 2048-bit private key is retained exclusively on the backend (`backend/app/certs/`). The browser client never has access to the private key and signs connection/print challenges via `/api/v1/barcode/qz/sign`.
- **ADR-QZ-002: Windows Print Queue Addressing:** QZ Tray communicates directly with installed Windows printer spooler names (e.g. `IMPACT by Honeywell IH-2 (300 dpi) - DPL`) rather than requiring raw WebUSB browser permissions, providing 100% compatibility with USB, Network, and Virtual printer queues.
- **ADR-QZ-003: Two-Phase Dispatch & Acknowledgement:** The print transaction is initiated with the backend returning a tracking `job_id` and raw command stream; the frontend dispatches to QZ Tray and asynchronously reports hardware success or failure via `/print-jobs/{job_id}/ack` for audit logging in `print_history`.

## 6. Design Rationale
- High-density retail billing counters require instant, non-blocking barcode printing without popup dialogue friction.
- Decoupling the print stream generation on the server from the client-side spooler guarantees template syntax correctness (DPL/ZPL/TSPL) and data consistency with PostgreSQL Item Master records.

## 7. Implementation Summary
1. **Cryptographic Signing Infrastructure:** Implemented `QzSecurityService` with auto-generation of persistent 2048-bit RSA keys and X.509 certificate.
2. **FastAPI Endpoints:** Added `/api/v1/barcode/qz/certificate` and `/api/v1/barcode/qz/sign`. Updated `/api/v1/barcode/print` to generate raw printer payload and return `suggested_printer`.
3. **QZ Tray Client SDK:** Rewrote `qzTrayClient.ts` using official `qz-tray` package, implementing `initQzSecurity()`, `connectQzTray()`, `listQzPrinters()`, `testQzConnection()`, `testQzLabelPrint()`, and `dispatchToQzTray()`.
4. **Printer Selection Modal:** Integrated live QZ Tray status check, printer list dropdown from Windows spooler, and one-click test calibration.
5. **Tag Label Printing Workflow:** Added live QZ connection badge, dynamic safety validation, and port-aware dispatch buttons ("Confirm & Send to QZ Tray", "Generate & Download PRN", and "Print via Windows Dialog").

## 8. Tests Executed
- **Frontend Test Suites:**
  - `npx vitest run src/tests/qzTrayClient.test.ts` (6/6 passed)
  - `npx vitest run src/tests/tagLabelPrinting.test.ts` (22/22 passed)
  - `npm run test -- --run` (308/308 tests passed across 40 test files)
  - `npm run build` (Production build completed with 0 errors)
- **Backend Test Suites:**
  - `python -m pytest backend/app/tests/test_barcode.py` (7/7 passed)
- **Live Container Tests:**
  - `docker ps` (smriti-web, smriti-api, smriti-db healthy)
  - `curl.exe http://localhost:8000/api/v1/barcode/qz/certificate` (HTTP 200 returned valid X.509 certificate)
  - `curl.exe http://localhost:8000/api/v1/barcode/qz/sign` (HTTP 200 returned SHA512 RSA signature)

## 9. Verification Results
- All unit, integration, and build checks completed with 100% success.
- Status: **Done**

## 10. Known Limitations
- QZ Tray daemon (v2.2+) must be installed and running on the local host machine at port 8182/8181 to use silent printing. If unreachable, the UI provides clear diagnostic guidance and falls back to Windows Print Dialog or PRN download.

## 11. Future Work
- Support for dual-column 38x25mm jewelry tag formats with barcode and QR code combination in TSPL.
- Background automated queue retry for network-connected thermal printers.

## 12. Related ADRs
- `ADR-0083-Thermal-Printer-Integration.md`
- `ADR-0091-FastAPI-Postgres-Backend-System-Of-Record.md`

## 13. Related RFCs
- `RFC-2026-08-QZ-Tray-Thermal-Printing.md`
