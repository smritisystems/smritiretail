<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.0.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — ProPOS Unified Enterprise Billing Suite v6.0.0

## 1. Objective
Replace legacy, fragmented Billing (`BillingTerm.tsx`), Tax Invoice, and older POS dialogs with the modern, high-speed, enterprise **ProPOS Billing Suite** adhering to the designs in `F:\SMRITI\Smriti_billing_Plus_More\stitch_shoper9_billing_configuration_guide`.

## 2. Business Motivation
Provide cashiers, store operators, and managers with an ultra-responsive, keyboard-driven retail checkout terminal supporting split multi-tenders, suspended bill queues, customer loyalty redemptions, sales returns, EOD Z-reports, and promotion schemes.

## 3. Scope
* High-Speed POS Billing Terminal (`ProPosBillingTerm.tsx`)
* Multi-Tender Settlement Screen (`ProPosSettlementDl.tsx`)
* Suspended Bill Queue & Recall (`ProPosRecallDlg.tsx`)
* Invoice Cancellation / Void with Audit Codes (`ProPosCancellation.tsx`)
* Customer Loyalty & Tier Redemption (`ProPosLoyaltyLooku.tsx`)
* Sales Returns & Blind Returns (`ProPosSalesReturnD.tsx`)
* End-of-Day Z-Report Closeout (`ProPosEodReportVie.tsx`)
* Daily Sales & Shift Analytics (`ProPosDailyReports.tsx`)
* Promotion Engine Dashboard (`ProPosPromotionEng.tsx`)
* Sales Staff Commission Rules (`ProPosCommissionBu.tsx`)
* Modern Thermal & Laser Tax Invoice Receipt (`ProPosTaxInvoiceRc.tsx`)
* Unified Workspace Shell (`ProPosWs.tsx`)

## 4. Current State
Previous POS implementation used outdated dialog overlays with limited split-tender support and lacked dedicated Z-Report reconciliation and recall queues.

## 5. Gap Analysis
* Missing dedicated split tenders for UPI QR, Cards, Vouchers, and Loyalty Points.
* Missing park/hold bill queue.
* Missing structured End-of-Day Z-Report closeout with actual drawer count reconciliation.
* Missing direct sales return reference lookups.

## 6. Architecture Impact
Components reside under `src/components/billing/propos/` and are cleanly integrated into `PosTerminalTab.tsx` and `AdvancedBillingEng.tsx`.

## 7. Proposed Design
Adopts Material-3 high-density retail tokens:
* Primary Deep Blue: `#00288e`
* Surface Container: `#f8f9fa`
* Net Display Typography: `36px` / `700` weight Inter font.

## 8. Files Created
1. `src/components/billing/propos/types.ts`
2. `src/components/billing/propos/ProPosWs.tsx`
3. `src/components/billing/propos/ProPosBillingTerm.tsx`
4. `src/components/billing/propos/ProPosSettlementDl.tsx`
5. `src/components/billing/propos/ProPosRecallDlg.tsx`
6. `src/components/billing/propos/ProPosCancellation.tsx`
7. `src/components/billing/propos/ProPosLoyaltyLooku.tsx`
8. `src/components/billing/propos/ProPosSalesReturnD.tsx`
9. `src/components/billing/propos/ProPosEodReportVie.tsx`
10. `src/components/billing/propos/ProPosDailyReports.tsx`
11. `src/components/billing/propos/ProPosPromotionEng.tsx`
12. `src/components/billing/propos/ProPosCommissionBu.tsx`
13. `src/components/billing/propos/ProPosTaxInvoiceRc.tsx`

## 9. Files Modified
1. `src/components/PosTerminalTab.tsx`
2. `src/components/AdvancedBillingEng.tsx`

## 10. Dependencies
* `lucide-react` icons
* `apiFetchV1` client

## 11. Risks
* Cashier unfamiliarity with new shortcuts: Addressed with visible shortcut labels on footer buttons.

## 12. Rollback Strategy
Git commit history preserves legacy terminal components.

## 13. Verification Plan
* Validate build via `npm run build`.
* Validate live container deployment via `docker compose up -d --build`.

## 14. Test Plan
* Barcode scan entry & cart item calculation.
* F7 Exact Cash and F8/F10 Settlement modal with split payments.
* Hold & Recall transaction queue.
* Sales Return calculations.
* Z-Report drawer reconciliation.

## 15. Documentation Impact
* Master Implementation Index updated.
* Master Walkthrough Index updated.
* CHANGELOG.md updated.

## 16. Deployment Plan
Deployed via Docker Compose.

## 17. Status
Completed

## 18. Related ADRs
* ADR-008: Platform Abstraction Layer (PAL)

## 19. Related Walkthroughs
* `docs/walkthrough/pos/ProPOS_Unified.md`
