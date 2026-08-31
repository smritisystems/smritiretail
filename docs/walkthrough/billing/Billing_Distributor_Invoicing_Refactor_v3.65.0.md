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

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.65.0
  * Created    : 2026-08-25
  * Modified   : 2026-08-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Distributor Invoicing Screen Layout Refactor (v3.65.0)

## 1. Purpose
Refactor the SMRITI Distributor Invoicing terminal (`BillingTerm.tsx`), Settlement Studio modal (`InvoiceSettlementD.tsx`), and associated modules to match the exact visual structure, layout, typography, and action flow of `F:\SMRITI\Tax Invoice\code.html` while preserving 100% of existing controls, shortcuts, modals, calculations, and business functions.

## 2. Scope
- `BillingTerm.tsx`: Top header navigation bar with live clock, quick actions (`New`, `Void`, `Return`, `Reprint`), Header Section Card with 2-row layout (`Bill Type`, `Transaction`, `Doc Prefix`, `Doc No.`, `Import`, `Recall`, `Customer` search with F2, `Sales Staff`), Detail Section table with monospace tabular numbers and bottom direct entry row (F11/F1), Footer Section with 3-tab details (`Transporter Details`, `Payment Details`, `AddOns And Deductions`), right totals card (`Sales`, `Discounts`, `Sales Tax`, `Add-ons`, `Deductions`), bottom high-visibility metric bar with Net Amount highlight (`#315384`), and persistent shortcut footer.
- `InvoiceSettlementD.tsx`: Settlement modal visual tokens, typography (`font-label-caps`, `font-code-md`), header badges, split tender entries, denomination counter, and high-visibility net payable banner.
- All keyboard shortcuts (`F2`, `F8`, `F11`, `F12`, `Ctrl+N`, `Ctrl+V`, `Ctrl+R`, `Ctrl+P`, `Ctrl+I`).

## 3. Files Created
- None (refactoring of existing components).

## 4. Files Modified
- [`src/components/billing/BillingTerm.tsx`](file:///f:/SMRITRretailNX/src/components/billing/BillingTerm.tsx)
- [`src/components/billing/InvoiceSettlementD.tsx`](file:///f:/SMRITRretailNX/src/components/billing/InvoiceSettlementD.tsx)

## 5. Architecture Decisions
- Preserved all data-binding, auto-population typeahead hooks (`searchBackendCustomers`, `searchBackendProducts`), modal states, held bill queues, and calculation engines intact.
- Enhanced global keyboard shortcuts listener to support all standard ERP key combinations (`Ctrl+N`, `Ctrl+V`, `Ctrl+R`, `Ctrl+P`, `Ctrl+I`, `F1`, `F2`, `F8`, `F11`, `F12`).
- Replaced legacy CSS layout classes with reference design system tokens (`bg-surface-container-lowest`, `border-outline-variant`, `font-label-caps`, `font-code-md`, `text-primary`, `bg-[#315384]`).

## 6. Design Rationale
Aligns the distributor billing terminal with industrial POS/wholesale terminal ergonomics, ensuring high readability, keyboard-first navigation, and aesthetic parity with the specification in `code.html`.

## 7. Implementation Summary
1. **Header Navigation**: Added live date/time clock badges, quick action buttons (`New`, `Void`, `Return`, `Reprint`), utility icons (`Notifications`, `Settings`, `Help`), user avatar badge, and F8 settlement trigger.
2. **Header Card**: Standardized two-row grid containing `Bill Type`, `Transaction`, `Doc Prefix`, `Doc No.`, `Import (Download)`, `Recall (History)`, customer search (F2), customer display, and `Sales Staff`.
3. **Detail Section**: Refactored tabular column sizing and monospace typography (`font-code-md`) for S.No, Stock No, Description, Rate, Qty, Value, Disc Code, Disc Qty, Disc %, Disc Amt, Total, Sales Staff, and delete actions. Added bottom direct entry row (F11) with inline typeahead and quick add.
4. **Footer Section**: Configured left tabbed cards (`Transporter Details`, `Payment Details`, `AddOns And Deductions` + `Document Remarks`) and right Net Values totals grid.
5. **High-Visibility Metric Status Bar**: Implemented 9-metric dark blue container (`No. of Items`, `Total Qty.`, `Sales Value`, `Item Lvl. Discount`, `Bill Discount`, `Total Tax`, `Total Addons`, `Total Deductions`, and `Net Amount` in `#315384`).
6. **Settlement Modal**: Upgraded `InvoiceSettlementD.tsx` with high-contrast summary badges, payment split table, cash denomination counter, and high-visibility net payable banner.

## 8. Tests Executed
- TypeScript compilation check: `npx tsc --noEmit` (Exited with code 0).
- Production bundle build: `npm run build` (Exited with code 0).
- Backend test suite: `python -m pytest backend/app/tests/test_reports.py -v` (12/12 passed).

## 9. Verification Results
All tests green, bundle built successfully with 0 errors.

## 10. Known Limitations
- None.

## 11. Future Work
- Integration with external Bluetooth and USB barcode scanner HID interfaces for hardware-level direct event handling.

## 12. Related ADRs
- `ADR-041`: Universal UI Design System & Terminal Layout Standardization.

## 13. Related RFCs
- `RFC-2026-08`: Distributor Tax Invoicing Terminal UX Specification.
