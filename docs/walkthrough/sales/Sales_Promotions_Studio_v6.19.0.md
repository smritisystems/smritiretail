<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.19.0
  Created      : 2026-09-14
  Modified     : 2026-09-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Human-First Sales Promotions & Schemes Studio

**Topic:** Human-First Visual Rule Builder, 1-Click Retail Recipes, Live Cart Sandbox Simulator, and Launchpad Integration  
**Version:** v6.19.0  
**Date:** 2026-09-14  
**Classification:** Internal Governance & Architecture Walkthrough  

---

## 1. Purpose
Establish an intuitive, enterprise-grade **Sales Promotions & Schemes Studio** in SMRITI Retail OS that empowers non-technical retail users (store owners, category merchandisers, boutique managers, sales supervisors) to define complex conditional promotions, BOGO deals, happy hour specials, bundle combos, and bill spend slabs without technical jargon or relational syntax, while delivering complete mathematical and operational parity with Tally Shoper 9 POS (`shoper9pos`) and Shoper 9 Distributor (`Shoper9Dist`) promotion engines.

---

## 2. Scope
- Full-screen **Sales Promotions Studio** (`SmritiSalesPromotionsStudio.tsx`) registered as a dedicated tile in the SMRITI Launchpad under **Master Data & Stock** (`id: "sales-promotions"`).
- **1-Click Popular Retail Recipe Library** (8 instant presets: Buy 2 Get 1 Free, Flat % Markdown, Flat ₹ Off, 3 for ₹1,999 Bundle, Spend ₹3k Save ₹500, Happy Hours 15% Off, Last Piece 40% Clearance, VIP Club 10% Exclusive).
- **Natural-Language Rule Formatter ("Mad-Libs" Builder)** translating selections into plain business language.
- **Embedded Live Cart Sandbox Simulator** allowing users to test promotions against mock items and verify item-level and bill-level proration in real time before counter deployment.
- Extended `SmritiSalesPromotionService` supporting recipe presets, natural language generation, simulation evaluation, and DTO mappings.
- Dual-access architecture connecting the studio with POS billing checkout (`F6` and `Alt+P`).

---

## 3. Files Created
1. `src/components/promotions/SmritiSalesPromotionsStudio.tsx` — Full-screen Promotions Studio component.
2. `src/tests/smritiSalesPromotionsStudio.test.ts` — Comprehensive Vitest unit test suite (10/10 green).
3. `docs/walkthrough/sales/Sales_Promotions_Studio_v6.19.0.md` — Authoritative WGP walkthrough document.

---

## 4. Files Modified
1. `src/services/smritiSalesPromotionService.ts` — Added `RetailPromotionRecipe`, `SMRITI_PROMOTION_RECIPES`, `formatPromotionAsSentence`, `simulateCart`, and extended `SmritiDefinedSalesPromotion` interface.
2. `src/components/launchpad/launchpadCatalog.ts` — Added `sales-promotions` tile under `Master Data & Stock` with `roles: ["MANAGER", "SYSADMIN"]`.
3. `src/components/shell/navigationResolver.ts` — Added `sales-promotions` context items in `sales` and `masters` navigation menus.
4. `src/App.tsx` — Added lazy import, `mapModuleId` mapping, and `renderTab` routing for `sales-promotions`.
5. `docs/walkthrough/README.md` — Appended chronological master index entry.

---

## 5. Architecture Decisions
1. **Human-First Abstraction over Canonical Shoper 9 Schema:**  
   Non-technical users interact with intuitive visual cards and plain business sentences. Under the hood, this compiles deterministically into Shoper 9's 13 canonical schemes, priority integers, and classification filters.
2. **Dedicated Studio vs. POS Modal Separation:**  
   Store managers and merchandisers configure campaigns in a spacious full-screen Studio, while billing cashiers interact with fast `F6` inspection and auto-evaluation at checkout.
3. **Pre-Flight Sandbox Simulator:**  
   To prevent accidental margin erosion or faulty scheme configurations, an embedded simulator allows instant evaluation against mock cart lines with itemized savings summaries.
4. **Offline-First Zero-Latency POS Synchronization:**  
   Promotions saved in the Studio commit immediately to local in-memory storage for 0ms checkout evaluation, while simultaneously persisting asynchronously to PostgreSQL.

---

## 6. Design Rationale
In traditional retail systems like Shoper 9, configuring promotions requires navigating multiple technical grids, cryptic condition operators (`AND`/`OR`/`END`), and raw priority numbers. This frequently leads to misconfigurations or reliance on technical personnel. SMRITI's visual wizard and 1-click recipes remove this barrier, while the real-time English sentence and cart simulator provide immediate feedback and confidence.

---

## 7. Implementation Summary
- Developed `SmritiSalesPromotionsStudio.tsx` with three core tabs:
  - **Active Catalog Tab:** Live status telemetry, search, filtering by level, and active/paused toggles.
  - **Visual Rule Builder Tab:** 4-step wizard with real-time plain English sentence banner.
  - **Live Sandbox Simulator Tab:** Interactive mock cart with time, day, and customer tier controls.
- Implemented 8 retail recipe presets in `smritiSalesPromotionService.ts`.
- Integrated `sales-promotions` into SMRITI Launchpad and shell routing.

---

## 8. Tests Executed
1. **Unit Test Suite (`src/tests/smritiSalesPromotionsStudio.test.ts`):**
   - Executed: `npx vitest run src/tests/smritiSalesPromotionsStudio.test.ts`
   - Output: 10/10 tests passed (38ms).
2. **Launchpad Registry Validation:**
   - Executed: `npm run validate-launchpad`
   - Output: PASSED (42 catalog tiles, 42 unique IDs, 75 App render cases).
3. **TypeScript Compilation:**
   - Executed: `npm run lint` (`tsc --noEmit`)
   - Output: 0 errors (Exit code 0).

---

## 9. Verification Results
```
Test Files  1 passed (1)
     Tests  10 passed (10)
  Duration  453ms

PASSED: every Launchpad tile has a unique ID and an App render case.
tsc --noEmit: 0 errors
```

---

## 10. Known Limitations
- Direct PDE barcode file import (`PDT / PDT file`) for mass stock numbers remains accessible via Master Data exchange rather than directly within the promo wizard.
- Customer classifications are currently pre-populated with standard retail demographics (Religion, Ethnicity, Age Group, Profession, Customer Type) and wholesale territory hierarchies (Zone, State, City).

---

## 11. Future Work
- Add AI-assisted promotion copilot to analyze historic sales volume and recommend optimal discount percentages based on seasonal demand.
- Implement automated manufacturer reimbursement claim debit note generation for trade schemes in Distributor mode.

---

## 12. Related ADRs
- `ADR-0042`: Dual-Tier Promotional Resolution & Offline-First POS Caching
- `ADR-0045`: Launchpad Workspace Role Isolation & Deny-by-Default Policy

---

## 13. Related RFCs
- `RFC-2026-PROMO-01`: Human-First Promotion Rule Synthesizer & Cart Sandbox Architecture
