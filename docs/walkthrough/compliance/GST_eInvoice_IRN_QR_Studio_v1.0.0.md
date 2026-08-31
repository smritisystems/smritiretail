<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.94.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Advanced GST e-Invoice IRN Generation & QR Code Printing Studio (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the GST e-Invoice Engine — GSTN API v1.03 schema compliance, deterministic IRN simulation (SHA-256-style), CBIC-spec pipe-delimited QR payload builder, ACK number/date tracking, IRN cancellation, and bulk print queue management.

## 2. Scope
- `EInvoiceEngine` covering line item GST computation, totals with round-off, draft creation, IRN registration, QR payload building, IRN cancellation, and bulk print queue.
- `EInvoiceStudioModal` with invoice list, IRN registration action, IRN/QR display panel, line items with GST breakdown, and print queue tab.
- Supports INV (Tax Invoice), CRN (Credit Note), DBN (Debit Note) document types.
- Intra-state (CGST+SGST) and inter-state (IGST) tax routing.

## 3. Files Created
- `src/utils/eInvoiceEngine.ts`
- `src/components/compliance/EInvoiceStudioModal.tsx`
- `src/tests/eInvoiceEngine.test.ts`
- `docs/implementation/compliance/GST_eInvoice_IRN_QR_Studio_v1.0.0.md`
- `docs/walkthrough/compliance/GST_eInvoice_IRN_QR_Studio_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Deterministic IRN simulation**: The `deterministicIRN()` function produces a consistent 64-char hex string for identical inputs — enabling repeatable test assertions and idempotent registration retries. Production replaces this with an HMAC-SHA256 + GSTN API POST.
2. **CBIC QR payload**: Pipe-delimited string with SupplierGSTIN|BuyerGSTIN|DocNo|DocDate|GrandTotal|IRN|AckNo|AckDate — matches the CBIC e-Invoice QR specification for scanner verification.
3. **Round-off as a separate field**: IndAS 115 requires the round-off to be captured separately and not absorbed into a line item, so `EInvoiceTotals.roundOff` is an explicit field.
4. **IRN cancellation guard**: `cancelIRN()` throws on non-REGISTERED status, preventing double-cancellation and cancellation of draft/printed invoices.

## 6. Design Rationale
GST e-Invoicing became mandatory for turnover > ₹5 Cr from Aug 2023. SMRITI's compliance gateway must generate IRNs, print QR codes on invoices, and maintain a full cancellation audit trail for GSTN reconciliation.

## 7. Implementation Summary
- `EInvoiceEngine.computeLineItem()`: Computes taxable value, CGST/SGST or IGST, cess, and line total.
- `EInvoiceEngine.computeTotals()`: Aggregates all lines with IndAS 115 round-off.
- `EInvoiceEngine.createDraft()`: Builds an `EInvoice` in DRAFT status.
- `EInvoiceEngine.registerIRN()`: Generates IRN, ACK, and QR payload; transitions to REGISTERED.
- `EInvoiceEngine.buildQRPayload()`: Assembles CBIC-spec 8-field pipe-delimited string.
- `EInvoiceEngine.cancelIRN()`: Guards REGISTERED-only cancellation, stamps `cancelledAt` and `cancelReason`.
- `EInvoiceEngine.createBulkPrintJob()`: Queues all REGISTERED invoices, returns a `BulkPrintJob`.
- `EInvoiceEngine.completePrintJob()`: Marks job COMPLETED or FAILED with print/fail counts.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/eInvoiceEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 66/66 test files, 436/436 tests green in 9.76s.

## 10. Known Limitations
- IRN is a deterministic simulation; production must call `POST https://einv-apisandbox.nic.in/eicore/v1.03/Invoice` with RSA-2048 signed payload.
- QR code image rendering (QRious/qrcode.js) for printable invoice is a future sprint task.
- Bulk print job does not integrate with QZ Tray printer client in this release.

## 11. Future Work
- FastAPI `POST /api/v1/gst/einvoice/register` backed by GSTN API sandbox and production credentials stored in Postgres + Vault.
- QR image generation using `qrcode` npm package and embedded in printable PDF via `@react-pdf/renderer`.
- Integration with QZ Tray (`qzTrayClient.ts`) for direct thermal/laser printer output.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-028`: GST e-Invoice IRN Architecture and CBIC QR Payload Specification.

## 13. Related RFCs
- `RFC-097`: e-Invoice IRN Registration, Cancellation, and QR Print Workflow.
