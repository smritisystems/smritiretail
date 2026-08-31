<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Optional QZ Tray Print Dispatch (Spike + Hybrid) v3.29.0

## 1. Purpose
To provide an optional, feature-flagged **QZ Tray** local browser dispatch path for raw thermal label printing (ZPL, TSPL, ESC/POS) without breaking or altering the existing default server TCP :9100 socket transport or offline PRN export.

## 2. Scope
- Backend request schema and dispatch mode resolution (`server_tcp`, `qz_tray`, `prn`).
- Backend `POST /api/v1/barcode/print` payload generation for `qz_tray` without socket connection.
- Backend `POST /api/v1/barcode/print-jobs/{job_id}/ack` endpoint for asynchronous execution status update.
- Frontend `src/utils/qzTrayClient.ts` with `VITE_ENABLE_QZ_TRAY` flag protection, WebSocket RPC fallback, and ACK callback.
- Frontend `src/components/LabelPrintingSec.tsx` integration with dispatch mode toggle and status badge.
- Comprehensive unit testing across backend (pytest) and frontend (vitest/tsc).
- Preservation of existing item master, POS billing, and launchpad behavior.

## 3. Files Created
- `docs/print/QZ_TRAY_SPIKE.md`
- `src/utils/qzTrayClient.ts`
- `src/tests/qzTrayClient.test.ts`
- `docs/walkthrough/print/Print_QZ_Tray.md`

## 4. Files Modified
- `backend/app/schemas/barcode.py`
- `backend/app/services/printer_service.py`
- `backend/app/api/v1/barcode.py`
- `backend/app/tests/test_barcode.py`
- `src/components/LabelPrintingSec.tsx`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Tri-Mode Hybrid Print Transport**:
  1. `server_tcp` (Default): Backend initiates raw socket connection on port 9100.
  2. `qz_tray` (Feature-flagged): Backend returns compiled raw command stream and `job_id`; browser dispatches to local QZ Tray via WebSocket and sends ACK.
  3. `prn`: Backend returns compiled raw command stream for file download.
- **Fail-Safe Asynchronous Status**: In `qz_tray` mode, `PrintHistory` is recorded as `Pending` until the browser delivers the ACK.
- **Tenant Isolation**: Both dispatch and ACK operations strictly enforce `company_id` tenancy.
- **Zero External Client Dependencies**: Direct native WebSocket RPC fallback ensures browser dispatch works even if `qz-tray.js` is not loaded in `window`.

## 6. Design Rationale
Retail environments often feature both networked LAN thermal printers (ideal for server TCP dispatch) and direct USB-connected cashier printers (which a remote backend server cannot reach via TCP). Providing a unified, feature-flagged hybrid pathway enables flexible deployment across cloud, on-premise, and air-gapped stores.

## 7. Implementation Summary
1. **Schema & Models**: Updated `PrintRequest` with `dispatch_mode`, `dispatchMode`, `language`. Added `PrintJobAckRequest` and updated `PrinterSettingsRequest`.
2. **PrinterService**: Added `qz_tray` handling in `dispatch_payload` and `get_configured_printer`.
3. **Barcode Router**: Handled `qz_tray` and `prn` dispatch paths in `print_labels` and added `POST /print-jobs/{job_id}/ack`.
4. **Client Utility**: Built `src/utils/qzTrayClient.ts` checking `VITE_ENABLE_QZ_TRAY` and implementing RPC print dispatch.
5. **Label UI**: Added dispatch mode selector and live QZ Tray flag indicator.

## 8. Tests Executed
- `pytest backend/app/tests/test_barcode.py --tb=short -q` (6/6 passed)
- `npx vitest run src/tests/qzTrayClient.test.ts` (3/3 passed)
- `npx vitest run` (131/131 passed across 21 test files)
- `npx tsc --noEmit` (0 errors)

## 9. Verification Results
All automated tests passed with 100% success. Verified that when `dispatch_mode` is omitted or set to `server_tcp`, standard TCP behavior is preserved. Verified that when `dispatch_mode` is `qz_tray`, payload is returned without socket connection, `PrintHistory` is set to `Pending`, and `POST /print-jobs/{job_id}/ack` updates status to `Success` or `Failed`.

## 10. Known Limitations
- Hardware printing via QZ Tray requires the QZ Tray desktop application running on the client PC.
- In production with HTTPS, QZ Tray requires a valid SSL certificate and domain binding to avoid mixed-content blocks.

## 11. Future Work
- Add digital signature verification endpoint (`/api/v1/barcode/qz-tray/sign`) for enterprise QZ Tray certificate authorization.
- Extend QZ Tray dispatch to POS 80mm ESC/POS receipt printing.

## 12. Related ADRs
- `docs/adr/ADR-0014-Multi-Database-Isolation.md`
- `docs/adr/ADR-0021-FastAPI-Postgres-System-Of-Record.md`

## 13. Related RFCs
- `docs/rfc/RFC-0012-Hybrid-Thermal-Print-Dispatch.md`
