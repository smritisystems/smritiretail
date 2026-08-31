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

# Walkthrough: Enterprise E-Invoice & E-Way Bill Statutory Dispatcher UI (v1.0.0-GA)

## 1. Purpose
Documents the implementation and testing of the SGIP Statutory Dispatch Gateway Modal, providing enterprise sales teams with a 1-click interface to generate, inspect, and cancel GSTN Schema v1.03 E-Invoices and NIC E-Way Bills directly from Sales Studio.

## 2. Scope
- Statutory Dispatch Gateway Modal (`ComplianceDispatchModal.tsx`).
- Live B2B invoice summary banner (Buyer GSTIN, legal name, tax breakdown, total value).
- GSTN E-Invoice tab: 1-click IRP registration, 64-char IRN hash display, signed QR code, cancellation action.
- NIC E-Way Bill tab: distance/vehicle inputs, 12-digit EWB number generation, validity tracking, cancellation action.

## 3. Files Created
- `src/components/sales/components/ComplianceDispatchModal.tsx`
- `src/tests/complianceDispatchModal.test.ts`
- `docs/implementation/sales/Enterprise_EInvoice_EWayBill_Dispatcher_UI_v1.0.0.md`
- `docs/walkthrough/sales/Enterprise_EInvoice_EWayBill_Dispatcher_UI_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Dual-Tab Statutory Gateway:** Separates E-Invoice registration and E-Way Bill transportation flows into distinct tabs while sharing live invoice financial context.
2. **Deterministic IRN & Signed QR Rendering:** Safely displays full 64-character hexadecimal IRNs and signed QR payloads with copy-to-clipboard and print integration.
3. **Statutory Outbox & Error Resilience:** Communicates directly with FastAPI compliance gateways backed by retry workers and transactional outbox.

## 6. Design Rationale
Empowers enterprise accountants to fulfill government compliance mandates without leaving the SMRITI Sales Studio workflow.

## 7. Implementation Summary
- `handleGenerateEInvoice`: Calls `POST /api/v1/compliance/einvoice/generate` with GSTN v1.03 payload.
- `handleGenerateEWayBill`: Calls `POST /api/v1/compliance/ewaybill/generate` with transportation metadata.
- `handleCancelEInvoice`: Dispatches cancellation request to `POST /api/v1/compliance/einvoice/cancel`.
- `handleCancelEWayBill`: Dispatches cancellation request to `POST /api/v1/compliance/ewaybill/cancel`.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **Frontend Test Suite:** 49/49 test files passed (368/368 tests green).
- **Backend Full Suite:** 56/56 tests passed across 8 test files in 26.92s.
- **Production Build:** Vite production bundle built in 28.68s with 0 errors.

## 10. Known Limitations
- E-Way Bill generation requires valid vehicle number format (`[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}`).

## 11. Future Work
- Auto-lookup of pin-to-pin transit distance via NIC Distance API.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-017`: SMRITI Government Integration Platform (SGIP) — E-Invoice & E-Way Bill Gateway.

## 13. Related RFCs
- `RFC-081`: Enterprise B2B Statutory Compliance Dispatch Standard.
