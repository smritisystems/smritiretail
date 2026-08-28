<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.78.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Enterprise E-Invoice & E-Way Bill Statutory Dispatcher UI (v1.0.0-GA)

## 1. Objective
Build an interactive, dual-panel statutory compliance dispatch modal (`ComplianceDispatchModal.tsx`) in SMRITI Sales Studio, enabling 1-click GSTN Schema v1.03 E-Invoice generation (64-char IRN, Ack No, signed QR payload) and NIC E-Way Bill dispatch (12-digit EWB No, transit distance, vehicle details).

## 2. Business Motivation
Wholesale and B2B retail transactions exceeding statutory turnover thresholds require real-time GSTN E-Invoice registration and NIC E-Way Bill generation before consignment dispatch. Having a dedicated 1-click dispatcher inside Sales Studio ensures seamless compliance.

## 3. Scope
- Statutory Dispatch Gateway Modal (`ComplianceDispatchModal.tsx`).
- Live B2B invoice summary banner (Buyer GSTIN, legal name, tax breakdown, total value).
- GSTN E-Invoice tab: 1-click IRP registration, 64-char IRN hash display, signed QR code, cancellation action.
- NIC E-Way Bill tab: distance/vehicle inputs, 12-digit EWB number generation, validity tracking, cancellation action.

## 4. Current State
The backend compliance services (`EInvoiceService`, `EWayBillService`) and endpoints (`/compliance/einvoice/generate`, `/compliance/ewaybill/generate`) were certified, but the frontend lacked a dedicated dispatcher dialog.

## 5. Gap Analysis
- Needed dedicated visual modal for sales accountants to execute statutory dispatches directly from invoice views.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: UI calls `apiFetchV1` (`/api/v1/compliance/einvoice/generate`, `/api/v1/compliance/ewaybill/generate`) against the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────┐
│             SGIP STATUTORY DISPATCH GATEWAY MODAL                      │
├───────────────────────────────────┬────────────────────────────────────┤
│  TAB 1: GSTN E-Invoice (v1.03)    │  TAB 2: NIC E-Way Bill Gateway     │
│  - 64-char Hex IRN & Ack Details  │  - Distance (KM) & Vehicle Number  │
│  - Signed QR Code Payload Display │  - 12-digit EWB Number & Validity  │
│  - 1-Click Generate / Cancel      │  - 1-Click Generate / Cancel       │
└───────────────────────────────────┴────────────────────────────────────┘
```

## 8. Files Created
- `src/components/sales/components/ComplianceDispatchModal.tsx`
- `src/tests/complianceDispatchModal.test.ts`
- `docs/implementation/sales/Enterprise_EInvoice_EWayBill_Dispatcher_UI_v1.0.0.md`
- `docs/walkthrough/sales/Enterprise_EInvoice_EWayBill_Dispatcher_UI_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Generation of duplicate IRN for already-registered invoice.
  *Mitigation:* Backend idempotency and UI active IRN badge prevent double submissions.

## 12. Rollback Strategy
Modular modal component that can be disabled or closed cleanly.

## 13. Verification Plan
- Unit tests verifying component exports, data shapes, E-Invoice generation POST, and E-Way Bill generation POST.
- Full Vitest suite pass rate (`368/368 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update SMRITI Sales Studio User Guide.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`368/368 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-017`: SMRITI Government Integration Platform (SGIP) — E-Invoice & E-Way Bill Gateway.

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Enterprise_EInvoice_EWayBill_Dispatcher_UI_v1.0.0.md`.
