<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-14
  Modified     : 2026-08-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Training Academy Phase 2 Guided Simulators Walkthrough — v1.0

## 1. Purpose
This walkthrough documents the implementation of **Phase 2 Guided Simulators** for the **SMRITI Training Academy**, providing interactive, step-by-step form simulators for **Day 1 (Master Creation)**, **Day 2 (Purchase Order)**, **Day 3 (Purchase Receipt / GRN)**, and **Day 4 (Sales / Billing)** operating in 100% session sandbox isolation.

## 2. Scope
- Authoring `Day1MasterSimulator.tsx` for creating Item & Supplier masters in the sandbox session.
- Authoring `Day2POSimulator.tsx` for issuing, approving, and tracking Purchase Orders in the sandbox session.
- Authoring `Day3GRNSimulator.tsx` for processing GRN material receipts, short/excess receipts, and immediate stock ledger updates.
- Authoring `Day4BillingSimulator.tsx` for POS cashier checkout, GST calculations, tender payments, and thermal tax invoice print previews.
- Integrating all Day 1–4 simulators into `TrainingAcademyTab.tsx`.

## 3. Files Created
- [`src/components/training/Day1MasterSimulator.tsx`](file:///F:/SMRITRretailNX/src/components/training/Day1MasterSimulator.tsx): Interactive Master Creation simulator for Items and Suppliers.
- [`src/components/training/Day2POSimulator.tsx`](file:///F:/SMRITRretailNX/src/components/training/Day2POSimulator.tsx): Interactive Purchase Order simulator.
- [`src/components/training/Day3GRNSimulator.tsx`](file:///F:/SMRITRretailNX/src/components/training/Day3GRNSimulator.tsx): Interactive GRN receipt & stock impact simulator.
- [`src/components/training/Day4BillingSimulator.tsx`](file:///F:/SMRITRretailNX/src/components/training/Day4BillingSimulator.tsx): Interactive POS billing terminal & tax invoice print preview simulator.
- [`docs/walkthrough/user_guide/SMRITI_Training_Academy_Phase2_Walkthrough_v1.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/user_guide/SMRITI_Training_Academy_Phase2_Walkthrough_v1.0.md): This walkthrough file.

## 4. Files Modified
- [`src/components/training/TrainingAcademyTab.tsx`](file:///F:/SMRITRretailNX/src/components/training/TrainingAcademyTab.tsx): Dynamically renders Day 1–4 guided simulators based on active day selection.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md): Registered Phase 2 walkthrough.

## 5. Architecture Decisions
- **Session Sandbox Data Isolation**: All Day 1–4 form inputs write exclusively to `trainingSandboxStore`, mutating zero production database records in `Smritibus_<CompanyCode>`.
- **Immediate Business Feedback**: Every simulator action instantly updates the Live Training State View (e.g. GRN receipt increments available stock; POS sale decrements available stock).

## 6. Design Rationale
Simulating realistic form inputs (SKU Codes, HSN, Tax rates, Purchase Rates, Short receipts, Tender payments) gives trainees hands-on operational experience while preventing mistakes on live billing terminals.

## 7. Implementation Summary
- Developed 4 dedicated simulator components with standard SMRITI UADHP headers.
- Wired form submissions to `trainingSandboxStore` methods.
- Verified TypeScript compilation and production bundle build.

## 8. Tests Executed
```bash
python -m pytest tests/test_production_isolation.py -v
npx vite build
```

## 9. Verification Results
```text
tests/test_production_isolation.py: 4/4 PASSED
✓ Vite build completed cleanly in 19.48s
```

## 10. Known Limitations
- Advanced returns (Day 6) and final PDF certificate renderer (Day 7) will be added in Phases 3 and 4.

## 11. Future Work
- **Phase 3**: Day 5 complete business cycle automated execution engine.
- **Phase 4**: Day 6 returns simulator & Day 7 practical exam / server-certified PDF renderer.
- **Phase 5**: Manager staff analytics & progress console.

## 12. Related ADRs
- `ADR-001`: Platform Architecture & Modular Isolation Policy.

## 13. Related RFCs
- `RFC-2026-08`: User Training & Store Onboarding Blueprint Standard.
