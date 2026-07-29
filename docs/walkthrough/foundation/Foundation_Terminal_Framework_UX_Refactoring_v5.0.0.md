<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.0.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail Terminal Framework v1.0 & UX Refactoring

## 1. Purpose
This walkthrough documents the architectural refactoring of the SMRITI Retail OS frontend into a workflow-first **Enterprise Retail Terminal Framework** (`v5.0.0`). High-frequency operational tasks are isolated into dedicated full-width 100vw/100vh kiosk terminals, while administrative tasks remain in Studios.

---

## 2. Scope
- Definition of `SMRITI Retail Terminal Framework v1.0 — Master Architecture Standard` (`STF-STD-001`).
- SDK contract (`TerminalPlugin.ts`), dynamic registry (`TerminalManifest.ts`), and hardware event bus (`TerminalEventBus.ts`).
- Modular hardware abstraction registry (`HardwareAdapterRegistry.ts`) covering Scanners, ESC/POS Thermal Printers, RJ11 Cash Drawers, Weighing Scales, and Customer Displays.
- Progressive disclosure right-side drawer architecture (`RightDrawerHost.tsx`, `DrawerRegistry.ts`, `GstDrawer.tsx`, `TransportDrawer.tsx`).
- Abstract item grid component (`SMRITIGrid.tsx`) with Fit-to-Width responsive table sizing.
- Refactoring of POS Terminal (`PosTerminalTab.tsx`) and Tax Invoice Terminal (`AdvancedBillingEngine.tsx`) to occupy 100% viewport width without dialog cards.
- Creation of Purchase Order (`PurchaseOrderTerminal.tsx`) and Goods Receipt Note (`GrnTerminal.tsx`) terminals.
- Universal Search Engine (`UniversalSearchModal.tsx`) with `Ctrl+K` keybindings.
- Zero breaking changes to backend FastAPI endpoints, PostgreSQL database schemas, or permissions.

---

## 3. Files Created
1. `src/components/terminal/TerminalPlugin.ts`
2. `src/components/terminal/TerminalManifest.ts`
3. `src/components/terminal/TerminalEventBus.ts`
4. `src/components/terminal/DrawerRegistry.ts`
5. `src/components/terminal/RightDrawerHost.tsx`
6. `src/components/terminal/StandardDocumentToolbar.tsx`
7. `src/components/terminal/SharedStatusBar.tsx`
8. `src/components/terminal/UniversalSearchModal.tsx`
9. `src/components/terminal/SMRITIGrid.tsx`
10. `src/components/terminal/drawers/GstDrawer.tsx`
11. `src/components/terminal/drawers/TransportDrawer.tsx`
12. `src/components/terminal/terminals/PurchaseOrderTerminal.tsx`
13. `src/components/terminal/terminals/GrnTerminal.tsx`
14. `src/hardware/HardwareAdapterRegistry.ts`
15. `src/tests/terminal_sdk.test.ts`
16. `docs/terminal-framework/00_MASTER_ARCHITECTURE_STANDARD.md`
17. `docs/walkthrough/foundation/Foundation_Terminal_Framework_UX_Refactoring_v5.0.0.md`

---

## 4. Files Modified
1. `src/App.tsx` (Removed `p-6` container padding for 100vw full-width viewports)
2. `src/components/PosTerminalTab.tsx` (Implemented `TerminalPlugin` & SMRITI Grid)
3. `src/components/AdvancedBillingEngine.tsx` (Removed fixed modal card wrapper for 100vw layout)
4. `docs/walkthrough/README.md` (Updated master index)

---

## 5. Architecture Decisions
- **ADR-001**: Introduction of `TerminalPlugin` SDK contract.
- **ADR-002**: Item Grid abstraction via `SMRITIGrid`.
- **ADR-003**: Peripheral hardware abstraction via `HardwareAdapterRegistry`.
- **ADR-004**: Progressive disclosure right drawers via `RightDrawerHost` + `DrawerRegistry`.
- **ADR-005**: 100vw Full-Width Operational Workspace requirement for high-frequency terminals.
- **ADR-006**: Standardization of `DocumentSession` state machine and `TerminalContext` environment.

---

## 6. Design Rationale
High-frequency operators (cashiers, receiving clerks, stock auditors) require maximum screen area, zero modal clutter, <150ms scan latency, and complete keyboard navigation. Refactoring the Tax Invoice Terminal to match **Shoper 9 POS Billing Window Architecture** (Header Row -> Detail Item Grid -> Right Net Values Sheet -> Bottom Summary Bar) with **Modern SMRITI UI Tokens ("Modern Tadka")** replicates the operational speed of Shoper9, TallyPrime, Marg, and SAP POS while retaining modern React glassmorphism and keyboard hotkeys.

---

## 7. Implementation Summary
- **Shoper 9 Header Bar**: Top control row displaying Bill Type, Cash/Credit mode, Customer Name & Code, Sales Staff, Shift, and Desk ID.
- **Detail Item Grid**: Occupies 75% of the viewport width with SMRITIGrid responsive column sizing and direct barcode scanning focus.
- **Right Net Values Sheet**: Real-time calculation of Gross Sales, Line Discounts, Bill Discounts, Taxable Base Value, CGST, SGST, IGST, Statutory TCS, Round Off, and a prominent Emerald Net Amount Payable box.
- **Shoper 9 Bottom Summary Bar**: Horizontal summary bar displaying Total Items, Total Qty, Sales Value, Item Disc, Bill Disc, Total Tax, and Net Amount.
- **Progressive Right Drawers**: Optional forms (GSTIN, E-Way Bill, Logistics, Promos) slide out from the right on demand (`RightDrawerHost`).
- **Hardware Integration**: Standardized pulse trigger for cash drawers, raw print payload formatting, and scanner buffer listeners.

---

## 8. Tests Executed
Executed Vitest test suite (`src/tests/terminal_sdk.test.ts`):
- `TerminalManifest` registration & resolution test: Passed.
- `DrawerRegistry` GST & Transport plugin resolution test: Passed.
- `TerminalEventBus` barcode scan event propagation test: Passed.
- `HardwareAdapterRegistry` cash drawer pulse trigger test: Passed.

---

## 9. Verification Results
- **Automated Tests**: 4 / 4 passed (100% success rate).
- **Browser Subagent Video Recording**: Captured live browser interaction demonstrating full-width Tax Invoice workspace, top document toolbar, right drawers for GST and Logistics, and Universal Search modal.
- **Recording Artifact**: ![Tax Invoice Terminal Browser Demo](file:///C:/Users/netma/.gemini/antigravity-ide/brain/dcf5ec5e-2602-4c77-8d95-6b562dc30a6d/tax_invoice_demo_v2_1784550838759.webp)
- **GST Drawer Screenshot**: ![GST Right Drawer Open](file:///C:/Users/netma/.gemini/antigravity-ide/brain/dcf5ec5e-2602-4c77-8d95-6b562dc30a6d/gst_drawer_open_1784550887050.png)
- **Logistics Drawer Screenshot**: ![Logistics Right Drawer Open](file:///C:/Users/netma/.gemini/antigravity-ide/brain/dcf5ec5e-2602-4c77-8d95-6b562dc30a6d/logistics_drawer_open_1784550900616.png)
- **Universal Search Screenshot**: ![Universal SKU Search Modal](file:///C:/Users/netma/.gemini/antigravity-ide/brain/dcf5ec5e-2602-4c77-8d95-6b562dc30a6d/universal_search_open_1784550913021.png)

---

## 10. Known Limitations
- Handheld Bluetooth barcode scanners on Android mobile devices require HID keyboard emulators.

---

## 11. Future Work
- Phase 3 & 4 expansion for Stock Transfer and Physical Count Terminals.

---

## 12. Related ADRs
- `ADR-001` through `ADR-006` in `docs/terminal-framework/00_MASTER_ARCHITECTURE_STANDARD.md`.

---

## 13. Related RFCs
- `RFC-STF-2026-01`: Enterprise Retail Terminal UX Specification.
