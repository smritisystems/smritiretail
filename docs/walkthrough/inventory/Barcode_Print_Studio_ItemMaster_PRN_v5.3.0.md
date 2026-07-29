<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.3.0
  Created      : 2026-07-27
  Copyright    : © SmritiSys. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Barcode Print Studio & PRN Script Generator v5.3.0

## 1. Purpose
Implement an interactive Barcode Print Studio and raw PRN script generator service (`prnGenerator.ts` & `BarcodePrintStudioModal.tsx`) mapped directly to Item Master catalog items, enabling store operators to generate, preview, copy, download, and dispatch TSPL and ZPL thermal printer commands.

## 2. Scope
- **PRN Script Generator Service (`prnGenerator.ts`)**:
  - `generateTSPLScript`: Generates raw TSPL commands (`SIZE`, `GAP`, `CLS`, `TEXT`, `BARCODE`, `PRINT`) for TSC, TTP, and GPrinter thermal printers.
  - `generateZPLScript`: Generates raw ZPL commands (`^XA`, `^PW`, `^LL`, `^FO`, `^FD`, `^BC`, `^PQ`, `^XZ`) for Zebra thermal printers.
  - `generatePRNScript`: Batch printer command generator mapping selected `Product` records from Item Master.
- **Barcode Print Studio Modal (`BarcodePrintStudioModal.tsx`)**:
  - Live 1:1 visual thermal label mockup (50x25mm, 40x25mm, 58x40mm).
  - Copies source selector (`Fixed Copies` vs `On-Hand Stock Qty`).
  - Copy PRN Script & Download `.PRN` File dispatch tools.
- **Item Master Integration (`ItemMasterTab.tsx`)**:
  - Connected `Print Labels` launcher button in Item Master registry toolbar and batch action drawer.

## 3. Files Created
- `src/services/prnGenerator.ts`
- `src/components/BarcodePrintStudioModal.tsx`
- `src/tests/prnGenerator.test.ts`
- `docs/walkthrough/inventory/Barcode_Print_Studio_ItemMaster_PRN_v5.3.0.md`

## 4. Files Modified
- `src/components/ItemMasterTab.tsx`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Decoupled Command Generator**: Separated TSPL/ZPL PRN script rendering into an independent service so all inventory modules (Item Master, Purchase, GRN, Stock Transfer) can consume the same PRN engine.

## 6. Design Rationale
- Provides thermal hardware compatibility out of the box without requiring third-party print drivers.

## 7. Implementation Summary
1. Built `prnGenerator.ts` service for TSPL/ZPL label generation.
2. Built `BarcodePrintStudioModal.tsx` interactive dialog.
3. Created unit test suite `prnGenerator.test.ts` (100% pass).
4. Integrated launcher into `ItemMasterTab.tsx`.

## 8. Tests Executed
- `npx tsc --noEmit`
- `npx vitest run`
- `py scripts/validate_governance.py`

## 9. Verification Results
- 0 TypeScript compilation errors.
- 15/15 test files passed (78/78 tests).
- Governance Validation Status: PASSED.

## 10. Known Limitations
None.

## 11. Future Work
Add WebUSB / Bluetooth direct hardware communication bridge for raw printer sockets.

## 12. Related ADRs
- `ADR-0008`: Barcode Studio Modularization.

## 13. Related RFCs
- `RFC-LABEL-001`: Universal Label Printing Engine.
