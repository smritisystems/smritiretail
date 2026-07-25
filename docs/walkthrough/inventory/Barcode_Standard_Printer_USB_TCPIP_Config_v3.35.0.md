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

  * Version    : 3.35.0 (Barcode Standard Printer USB & TCP/IP Configuration)
  * Created    : 2026-07-25
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Barcode Standard Printer USB & TCP/IP Configuration — Walkthrough v3.35.0

## 1. Purpose
This walkthrough documents the design and implementation of user configuration, editing, connection diagnostics, and persistence for barcode standard printers over **USB** (Direct Spooler / Virtual COM) and **TCP/IP** (RAW Network Socket Port 9100) across SMRITI Retail OS (Universal Label Printer Engine and Barcode Studio).

## 2. Scope
- Configuration UI for existing industrial & desktop barcode printers (Zebra, TSC, TVS, Citizen, Godex, Argox, Brother, Generic).
- TCP/IP parameters (IP address, RAW socket port `9100`).
- USB parameters (Direct USB port identifier `USB001`, COM port `COM4`, baud rate).
- Hardware diagnostic connection testing & raw ZPL / TSPL test label generator.
- Persistence of printer profiles in local storage and synchronization across all application modules.

## 3. Files Created
- `src/components/PrinterConfigurationModal.tsx` — Interactive setup dialog for adding, editing, testing, and managing barcode printer connection profiles.

## 4. Files Modified
- `src/services/universalLabelPrinterService.ts` — Extended `PrinterProfile` interface, default printer profiles, storage helpers (`getStoredPrinterProfiles`, `savePrinterProfiles`), test script generator, and diagnostic connection test function.
- `src/components/UniversalLabelPrinterTab.tsx` — Added "Configure USB / TCP-IP" button, connection status indicators, and modal integration.
- `src/components/UniversalLabelPrinterModal.tsx` — Connected persistent printer profiles & added printer hardware configuration button.
- `src/components/BarcodeStudioTab.tsx` — Integrated Barcode Standard Printer Setup card in Engine Settings view.
- `docs/walkthrough/README.md` — Updated master index.

## 5. Architecture Decisions
- **Unified Hardware Profile Schema**: Single schema for TCP/IP network printers, USB printers, serial COM printers, and virtual PDF rendering engines.
- **Client Storage & Multi-Tab Sync**: Uses `localStorage` key `smriti_slpe_printer_profiles_v1` with fallback seed profiles for offline-first resilience.
- **Protocol Agnostic Testing**: Supports command protocols ZPL, TSPL, EPL, CPCL, ESC-POS, and PDF.

## 6. Design Rationale
Retail environments employ a mix of network-attached industrial printers (e.g. Zebra ZD421 on TCP/IP 192.168.1.x) and direct USB storefront desktop printers (e.g. TSC TE244 on USB001). Allowing full user configuration, testing, and editing ensures seamless hardware compatibility without code changes.

## 7. Implementation Summary
1. Extended `PrinterProfile` with `connectionType`, `ipAddress`, `port`, `usbPort`, `baudRate`, `printerBrand`, and `dpi`.
2. Created `PrinterConfigurationModal.tsx` supporting interactive tab selection for TCP/IP vs USB vs Virtual PDF mode, realtime connection diagnostic test, and profile CRUD operations.
3. Updated dropdown selectors across `UniversalLabelPrinterTab`, `UniversalLabelPrinterModal`, and `BarcodeStudioTab` to dynamically render connection mode badges and target addresses.

## 8. Tests Executed
- Form Validation & Connection Test Execution (`testPrinterConnection`).
- Add / Edit / Delete printer profiles with default flag enforcement.
- Local Storage Persistence verification.

## 9. Verification Results
- All printer profile fields (IP, Port, USB Port, Brand, Protocol, DPI) save and persist cleanly across tab switches.
- Test connection function returns ACK / payload preview for both TCP/IP network sockets and USB ports.

## 10. Known Limitations
- Direct TCP/IP network raw socket calls in pure web browser environments require SMRITI Desktop Bridge / Agent for direct socket binding when not running under Electron/Native bridge.

## 11. Future Work
- Support WebUSB API for direct browser-level USB claim and bulk transfer.
- Support Bluetooth L2CAP socket discovery for mobile POS label printers.

## 12. Related ADRs
- `AOP-002`: Four-Tier Enterprise Architecture & Application Independence Principle.

## 13. Related RFCs
- `ACP_BARCODE_003`: SMRITI Smart Label Printing Engine (SLPE) & Hardware Registry.
