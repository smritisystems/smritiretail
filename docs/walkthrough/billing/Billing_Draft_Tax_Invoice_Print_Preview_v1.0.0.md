<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-31
  Modified     : 2026-10-31
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Draft Tax Invoice Interactive Print Preview & Statutory Non-Tax Document Watermarking

## 1. Purpose
Provide a frictionless, WhatsApp-grade preview and physical print capability for **Draft Tax Invoices** directly from the POS billing terminal prior to statutory settlement and final database posting. In retail distribution and Modern Trade dispatch (e.g., Reliance Retail cross-docking and multi-tier store deliveries), logistics coordinators, gate security, and billing managers require verified physical or digital draft printouts for audit, pre-loading inspection, and gate pass clearances without incurring premature tax serialization, inventory depletion, or general ledger journal mutations.

## 2. Scope
- **Draft Tax Invoice Detection**: Identifying draft document state across models (`isDraft`, `is_draft`, or `status === "Draft"`).
- **Statutory Non-Tax Document Watermarking**: High-visibility diagonal red-dashed `DRAFT` stamp across all printable invoice pages in `StandardInvoiceA4.tsx`.
- **Statutory Disclaimers**: Insertion of prominent warning badges (`bg-amber-600` `DRAFT TAX INVOICE`) and statutory footnote banners (`*** DRAFT TAX INVOICE — FOR VERIFICATION & AUDIT ONLY — NOT A STATUTORY TAX DOCUMENT ***`) ensuring compliance with Rule 46 of the CGST Rules.
- **Interactive Print & Preview Modal Integration**: Automatic configuration of watermark presets (`isWatermarkEnabled: true`, `watermarkPresetId: "draft"`, `watermarkOpacity: 20`) in `PrintPreviewModal.tsx`.
- **Zero-Block POS Billing Actions**: Unblocking the action bar print button and adding a dedicated `Print Draft Preview` button in the draft notification banner to allow instantaneous generation from active cart items.
- **Automated Visual Verification**: Headless Playwright script capturing artifact `08_draft_tax_invoice_print_preview.png`.

## 3. Files Created
- `docs/walkthrough/billing/Billing_Draft_Tax_Invoice_Print_Preview_v1.0.0.md` (This document)
- `scripts/capture_draft_tax_invoice_playwright.py` (Playwright end-to-end capture suite)

## 4. Files Modified
- `src/print_engine/templates/StandardInvoiceA4.tsx`: Added `isDraft` detection, page watermark stamp overlay, amber header badge, continuation page header badge, and statutory disclaimer banner.
- `src/components/PrintPreviewModal.tsx`: Added automatic `isDraftDoc` detection to auto-activate draft watermarking preset and amber modal title badge.
- `src/components/billing/BillingTerm.tsx`: Added `handlePrintDraftPreview` to synthesize draft invoice models from active line items, wired `handleReprintInvoice` to route to draft preview when unfinalized items exist, added banner button and dropdown menu item.

## 5. Architecture Decisions
- **ADR-DRAFT-PRINT-NO-MUTATION**: Generating a Draft Tax Invoice preview or printout MUST be read-only and zero-mutation. It derives totals, taxes, and customer delivery coordinates directly from current cart state without generating document numbers, depleting stock balances, or posting GL debit/credit entries.
- **ADR-STATUTORY-DRAFT-WATERMARK**: To comply with statutory GST guidelines and prevent counterfeit or premature tax deduction claims, any invoice preview printed before final posting must feature an indelible diagonal `DRAFT` watermark across every page and explicit statutory disclaimer text.
- **ADR-WHATSAPP-ERGONOMICS-ZERO-BLOCK**: Cashiers are never blocked from previewing or sharing draft documents. The prior blocking toast `"Print blocked: Settle & Save the invoice before opening print preview"` is superseded by seamless on-demand draft rendering.

## 6. Design Rationale
In enterprise Modern Trade distribution, purchase orders and goods delivery notes often require warehouse packing verification before the official statutory tax invoice is serialized. Allowing cashiers to generate and print draft previews provides the physical documentation required for packing checks while guaranteeing database immutability.

## 7. Implementation Summary
1. **Dynamic Draft Status Detection (`StandardInvoiceA4.tsx`)**:
   ```typescript
   const isDraft = Boolean(
     (data as any)?.isDraft || 
     (data as any)?.is_draft || 
     (data as any)?.status === "Draft" || 
     (data as any)?.status === "DRAFT"
   );
   ```
2. **Page-Level Watermark Stamp**:
   ```tsx
   {isDraft && (
     <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 overflow-hidden">
       <div className="transform -rotate-45 border-4 border-dashed border-red-500/40 rounded-xl px-12 py-4">
         <span className="text-6xl font-black tracking-widest text-red-600/30 uppercase select-none font-mono">
           DRAFT
         </span>
       </div>
     </div>
   )}
   ```
3. **Statutory Amber Banner & Disclaimer**:
   ```tsx
   <div className="mt-4 p-2 bg-amber-50 border border-amber-300 rounded text-center">
     <span className="text-[10px] font-bold text-amber-900 tracking-wider font-mono">
       *** DRAFT TAX INVOICE — FOR VERIFICATION & AUDIT ONLY — NOT A STATUTORY TAX DOCUMENT ***
     </span>
   </div>
   ```
4. **Active Cart Synthesis (`BillingTerm.tsx`)**:
   ```typescript
   const handlePrintDraftPreview = useCallback(() => {
     if (postingLines.length === 0) {
       toast.warning("Draft Preview Empty: Scan or add at least one item into the bill to generate a draft tax invoice preview.");
       return;
     }
     const draftInvoiceData = {
       isDraft: true,
       status: "Draft",
       invoiceNumber: `DRAFT-${headerState.billNo || "NEW"}`,
       date: headerState.billDate || new Date().toISOString().split("T")[0],
       // ... mapped recipient, totals, taxes, and items
     };
     setPrintInvoiceData(draftInvoiceData);
     setShowPrintModal(true);
   }, [postingLines, headerState, summaryTotals, selectedCustomerReg, selectedCustomerLoc, selectedCustomerBillLoc]);
   ```

## 8. Tests Executed
1. `npx vitest run src/tests/billingDraftSubmitLifecycle.test.ts src/tests/smritiRelianceDiscountExclusivity.test.ts` (8/8 passed)
2. `npx tsc --noEmit` (0 errors, exit code 0)
3. `python scripts/capture_draft_tax_invoice_playwright.py` (Captured `08_draft_tax_invoice_print_preview.png`, exit code 0)

## 9. Verification Results
| Checkpoint | Artifact Name | Resolution | Status |
|---|---|---|---|
| Draft Tax Invoice Print Preview | `08_draft_tax_invoice_print_preview.png` | 1920x1080 | Done |

## 10. Known Limitations
- Draft invoice watermarking is rendered via client-side CSS print layers; direct raw ESC/POS thermal printers print a text-based ASCII draft header instead of graphical diagonal watermark text.

## 11. Future Work
- Add one-click "Share Draft PDF via WhatsApp" button directly on the print preview toolbar.

## 12. Related ADRs
- `ADR-0094`: Canonical Sales Posting Writer and In-App Print Engine Convergence
- `ADR-0095`: Statutory Tax Invoice Immutability and Pre-Settlement Draft Non-Tax Watermarking

## 13. Related RFCs
- `RFC-2026-11`: WhatsApp-Simplicity Retail Counter Checkout UX
- `RFC-2026-14`: Draft Document Lifecycle & Pre-Settlement Logistics Audit
