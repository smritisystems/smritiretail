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

# SMRITI Retail OS — Hybrid Thermal Print Architecture Spike (Server TCP vs QZ Tray vs PRN)

**Version:** v3.29.0  
**Status:** Feature-Flagged Spike (Default: `server_tcp`)  
**Scope:** Label & Barcode Printing, POS Receipt Dispatch  

---

## 1. Architecture Overview & Hybrid Dispatch Model

SMRITI Retail OS supports a **hybrid tri-mode print architecture** that accommodates diverse store infrastructure configurations:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SMRITI Web Client                                 │
│  (LabelPrintingSection / BarcodeStudioTab / POS Billing / Sales Studio)     │
└───────────────┬─────────────────────────────────────────────┬───────────────┘
                │ 1. POST /api/v1/barcode/print                │
                ▼                                             │
┌───────────────────────────────────────────────┐             │
│            FastAPI Backend Service            │             │
│        (PrinterService & Template Engine)     │             │
└───────┬───────────────────────┬───────────────┘             │
        │                       │                             │
 [server_tcp Mode]        [qz_tray Mode]                      │
 (DEFAULT)                (Raw payload + job_id)              │
        │                       │                             │
        ▼                       ▼                             │
┌────────────────┐     ┌────────────────┐                     │
│  Server Socket │     │ Client Browser │                     │
│  (TCP :9100)   │     └────────┬───────┘                     │
└───────┬────────┘              │ 2. WebSocket (localhost)    │
        │                       ▼                             │
        │              ┌────────────────┐                     │
        │              │  QZ Tray Agent │                     │
        │              │  (Cashier PC)  │                     │
        │              └────────┬───────┘                     │
        │                       │ 3. Raw Print (USB/Driver)   │
        │                       ▼                             │
        │              ┌────────────────┐                     │
        │              │ 4. ACK Status  ├─────────────────────┘
        │              │ POST /ack      │ (Update PrintHistory)
        │              └────────────────┘
        ▼                       ▼
┌───────────────────────────────────────────────┐
│     Physical Thermal Printer (Zebra / TSC)     │
└───────────────────────────────────────────────┘
```

---

## 2. Print Dispatch Modes Comparison

| Mode | Transport Path | Best For | Prerequisites | Fault Isolation |
|---|---|---|---|---|
| **`server_tcp`** *(Default)* | Backend direct TCP socket to printer IP:9100 | Dedicated LAN/Ethernet printers, Cloud-to-LAN VPN | Printer on reachable static IP | Socket timeout does not affect business data. |
| **`qz_tray`** *(Hybrid)* | Backend compiles payload → Browser transmits to local QZ Tray via WebSocket | Direct USB-connected printers, local client printers | QZ Tray installed on cashier workstation | Asynchronous job ACK; failures isolated to `PrintHistory`. |
| **`prn`** *(Offline Export)* | Backend compiles payload → Browser downloads `.prn` file | Manual batch scripting, air-gapped workstations | None | File download only. |

---

## 3. Current Baseline Code Structure

1. **Backend Generator & Abstraction Service:**
   - `backend/app/services/printer_service.py`:
     - `generate_zpl_label`: Compiles Zebra ZPL-II command streams.
     - `generate_tspl_label`: Compiles TSC TSPL command streams.
     - `generate_escpos_receipt`: Compiles binary ESC/POS receipt commands.
     - `dispatch_payload`: Handles socket/USB communication and `PrintHistory` logging.
     - `run_diagnostics`: Validates engine output and TCP reachability.
2. **REST API Endpoint:**
   - `backend/app/api/v1/barcode.py`:
     - `POST /api/v1/barcode/print`: Main label generation & dispatch route.
     - `GET /api/v1/barcode/printer-settings`: Tenant printer IP and configuration.
     - `POST /api/v1/barcode/printer-settings`: Tenant printer settings persistence.
     - `GET /api/v1/barcode/print-history`: Audit logs of print jobs.
3. **Frontend UI Component:**
   - `src/components/LabelPrintingSec.tsx`:
     - CSV parsing, visual preview, layout selector, and print trigger.
4. **Data Models:**
   - `PrintHistory`: Tracks `user`, `item_code`, `barcode`, `quantity`, `status` (`Success` / `Failed` / `Pending`), `error_message`, `company_id`.
   - `SystemConfig`: Stores `printer_connection_{company_id}` and `print_dispatch_mode_{company_id}`.

---

## 4. QZ Tray Workstation Setup & Security Guidelines

### Step 4.1. Workstation Installation
1. Download and install QZ Tray (v2.2+) from [qz.io](https://qz.io).
2. Start QZ Tray on the cashier/terminal PC. Verify the tray icon is green (running on `ws://localhost:8182` or `wss://localhost:8181`).

### Step 4.2. Certificate Trust & Origin Signing
> [!WARNING]
> **DO NOT COMMIT PRIVATE SIGNING KEYS OR CERTIFICATES TO THE REPOSITORY.**
- In production, configure QZ Tray with the domain certificate and server-side request signing endpoint.
- For local pilot testing, allow the SMRITI origin when prompted by QZ Tray ("Remember this decision").

### Step 4.3. Feature Flag Configuration
In frontend `.env`:
```env
VITE_ENABLE_QZ_TRAY=true
```
In tenant `SystemConfig` (via API or Admin):
```json
{
  "print_dispatch_mode": "qz_tray"
}
```

---

## 5. Verification Checklist & Test Plan

- [x] **Test 1 (Server TCP Default):** When `dispatch_mode` is `server_tcp` (or omitted), backend performs direct socket dispatch; `PrintHistory` logs `Success` or `Failed`. (Verified in `test_barcode.py::test_print_labels_recording_history`)
- [x] **Test 2 (PRN Export):** When `saveAsPrn: true` or `dispatch_mode: "prn"`, backend returns `prn_content` without socket connection; `PrintHistory` logs `Success`. (Verified in `test_barcode.py::test_print_labels_prn_mode`)
- [x] **Test 3 (QZ Tray Mode):** When `dispatch_mode: "qz_tray"`, backend generates payload, does not open socket, records `PrintHistory` as `Pending`, and returns `job_id` + `payload`. (Verified in `test_barcode.py::test_print_labels_qz_tray_mode`)
- [x] **Test 4 (Job ACK Endpoint):** `POST /api/v1/barcode/print-jobs/{job_id}/ack` transitions `PrintHistory` from `Pending` to `Success` or `Failed` idempotently with tenant isolation. (Verified in `test_barcode.py::test_print_job_ack_endpoint_success_and_failure`)
- [x] **Test 5 (Frontend QZ Client & Flag):** `src/utils/qzTrayClient.ts` safely handles `VITE_ENABLE_QZ_TRAY` flag, websocket connection, and ACK triggers. (Verified in `qzTrayClient.test.ts`)
- [x] **Test 6 (Non-Breaking Invariant):** Server TCP remains the default; POS billing, item master, and launchpad remain untouched and fully intact.

