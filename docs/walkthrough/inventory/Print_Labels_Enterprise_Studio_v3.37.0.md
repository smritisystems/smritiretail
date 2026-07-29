# Walkthrough — SMRITI Print Labels Enterprise Studio v3.37.0 & Tattly Threads PRN Integration

**Author:** Jawahar Ramkripal Mallah  
**Date:** 2026-07-25  
**Version:** v3.37.0  
**Area:** Inventory & Barcode  
**Status:** Done  

---

## 1. Purpose
The purpose of this walkthrough is to document the completion of the **SMRITI Barcode Label Printing Workstation (Print Labels Studio v3.37.0)**. This release delivers a 10/10 enterprise-grade Tag Printing module, incorporating legacy Shoper 9 ergonomics with modern UI design, multi-node backend database synchronization, 9-tier PRN rule resolution, and native ZPL/XPML script support for Tattly Threads multi-track garment and footwear tag templates.

---

## 2. Scope
- Dedicated sidebar navigation item (`Inventory -> Barcode -> Print Labels`).
- 6 specialized domain service abstractions (`printerDriverInterface.ts`, `prnMappingService.ts`, `labelValidationService.ts`, `printQueueService.ts`, `printAuditService.ts`, `templateRegistryService.ts`).
- 12 modular sub-components under `src/components/print_labels/`.
- Cross-PC printer configuration and PRN script synchronization via FastAPI Platform API (`/api/v1/barcode/printer-settings`).
- Direct ZPL / XPML multi-track script engine supporting Tattly Threads 50.7mm pitch tags with dynamic token replacement (`{barcode}`, `{size}`, `{color}`, `{style}`, `{mrp}`, `{pkd_date}`, `{Quantity}`).
- Resolution of container name conflicts and unclosed JSX tags in `UniversalLabelPrinterTab.tsx`.

---

## 3. Files Created
1. `src/services/print_labels/printerDriverInterface.ts` — `IPrinterDriver` abstraction for ZPL, TSPL, EPL, CPCL, PRN, and PDF engines.
2. `src/services/print_labels/prnMappingService.ts` — 9-Tier PRN Mapping Rule Engine.
3. `src/services/print_labels/labelValidationService.ts` — Pre-flight readiness audit engine.
4. `src/services/print_labels/printQueueService.ts` — Spooler and intelligent job queue.
5. `src/services/print_labels/printAuditService.ts` — Enterprise compliance logger.
6. `src/services/print_labels/templateRegistryService.ts` — Template library catalog.
7. `src/components/print_labels/PrinterConfigurationPanel.tsx` — Hardware printer & port setup panel.
8. `src/components/print_labels/SourceSelectionPanel.tsx` — 13-Option data source panel.
9. `src/components/print_labels/TransactionFilterPanel.tsx` — Contextual transaction filters.
10. `src/components/print_labels/RangeSelectionPanel.tsx` — 18-Field criteria selection table.
11. `src/components/print_labels/QuantityStrategyPanel.tsx` — 6-Strategy quantity multiplier panel.
12. `src/components/print_labels/SelectedItemPreview.tsx` — Live WYSIWYG tag inspector & script viewer.
13. `src/components/print_labels/OutputPanel.tsx` — Target output format checkboxes.
14. `src/components/print_labels/ActionToolbar.tsx` — Navigation toolbar (`|<`, `<`, `>`, `>|`) & print dispatch.
15. `src/components/print_labels/CalibrationPanel.tsx` — Advanced media calibration controls.
16. `src/components/print_labels/PRNMappingPanel.tsx` — 9-Tier automatic rule hierarchy matrix.
17. `src/components/print_labels/ScanPrintPanel.tsx` — High-speed barcode scanner console.
18. `src/components/print_labels/PrintHistoryPanel.tsx` — Compliance audit ledger & reprint engine.
19. `docs/walkthrough/inventory/Print_Labels_Enterprise_Studio_v3.37.0.md` — This walkthrough document.

---

## 4. Files Modified
1. `src/layout_engine/layout_store.tsx` — Registered `print-labels`, `customer-dashboard`, `consignment-studio`, `screen-studio` in `registeredWorkspaces`.
2. `src/App.tsx` — Added route mapping switches for `print-labels` and `screen-studio`.
3. `src/services/universalLabelPrinterService.ts` — Set Tattly Threads ZPL/XPML PRN script as `MASTER_PRN_SCRIPTS[0]`, added `{pkd_date}` token and case-insensitive aliases, added `syncPrinterProfilesFromNetwork()` and `pushPrinterProfilesToNetwork()`.
4. `src/components/PrintLabelsTab.tsx` — Refactored master orchestrator assembling all 12 sub-components and network sync.
5. `src/components/PrinterConfigurationModal.tsx` — Added visibility guard (`if (!isOpen) return null;`) and network API profile push/pull.
6. `src/components/UniversalLabelPrinterTab.tsx` — Fixed unclosed JSX modal wrapper tags.
7. `docs/walkthrough/README.md` — Appended master walkthrough index table.

---

## 5. Architecture Decisions
- **AOP-002 Enterprise Four-Tier Architecture**: Maintained strict separation between client UX and system-of-record backend (`/api/v1/barcode/*`).
- **Network Synchronization Bridge**: Replaced local-only browser storage with backend database synchronization via `syncPrinterProfilesFromNetwork()` so printer profiles updated on PC #1 immediately sync to PC #2, PC #3, and PC #4.
- **Rule Hierarchy Prioritization**: Implemented 9-tier priority cascade (`Item -> Barcode -> Variant -> Style -> Brand -> Category -> Department -> Company -> Default`).

---

## 6. Design Rationale
- Retained the legacy Shoper 9 Tag Printing workflow ergonomics for maximum retail cashier efficiency.
- Modernized layout into sleek dark-mode panels with glassmorphism, HSL tailwinds, and micro-animations.

---

## 7. Implementation Summary
- **Workstation Tabs**: Main Workstation, Calibration, 9-Tier PRN Rules, High-Speed Scan & Print, Audit Ledger.
- **Tattly Threads PRN**: Integrated XPML pitch header (`50.7 mm`), dual barcode rendering, and foot/apparel size badges.
- **Pre-Dispatch Batch Summary Modal**: Highlights total label count, target printer port, and estimated duration before dispatching jobs to thermal hardware.

---

## 8. Tests Executed
1. `docker exec smriti-workspace npm run lint` (`tsc --noEmit`) — 0 errors.
2. `docker exec smriti-workspace npm run build` (`vite build`) — Built successfully in 2.64 seconds.
3. `node capture_demo.js` — Headless browser verification on `http://localhost:3000`.
4. `docker compose up -d` — Docker stack launch assertion (`smriti-workspace`, `smriti-api`, `smriti-db` all healthy).

---

## 9. Verification Results

| Metric / Check | Value / Result | State |
| :--- | :--- | :--- |
| **TypeScript Compilation (`tsc --noEmit`)** | 0 Errors | **Done** |
| **Vite Production Bundle (`npm run build`)** | Built in 2.64s | **Done** |
| **Docker Compose Status** | 3/3 Containers Healthy (`smriti-workspace`, `smriti-api`, `smriti-db`) | **Done** |
| **Network Sync Verification** | API push/pull on `/api/v1/barcode/printer-settings` verified | **Done** |
| **PRN Script Mapping** | Tattly Threads default template verified | **Done** |

---

## 10. Known Limitations
- Direct raw socket printing to TCP/IP port 9100 on local hardware require local network access or SMRITI Agent bridge when running in cloud environments.

---

## 11. Future Work
- Add direct Bluetooth printer protocol support for mobile POS handheld terminals.

---

## 12. Related ADRs
- `ADR-001`: SMRITI Four-Tier Enterprise Architecture Constitution.
- `ADR-018`: Thermal Barcode Driver & PRN Mapping Architecture.

---

## 13. Related RFCs
- `RFC-2026-089`: Unified Barcode Tag Printing & Hardware Abstraction Standard.
