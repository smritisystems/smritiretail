<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: CRM, Loyalty, and Customer Master Domain Decoupling (v3.16.0)

## 1. Purpose
Decouple the legacy unified CRM & Loyalty UI console into three focused, enterprise-grade business modules: **Customer Master** (Master Data), **CRM Studio** (Pipelines & Campaigns), and **Loyalty Studio** (Points & Rewards).

## 2. Scope
- Create separate UI views for Customer Master directories, CRM Pipeline stages, and Loyalty Reward rules.
- Set up independent navigation workspace entries and sidebar routes.
- Retain the legacy `CrmLoyaltyTab` component as deprecated to support backward compatibility.
- Ensure that permission layers and audit logs register events specific to each target domain.
- Create helper components for Customer Profile, Customer Ledger, CRM Leads Manager, CRM Opportunity Pipeline, Loyalty Wallet Manager, and Loyalty Tier Manager.
- Add validation and analysis services for each of the respective domains.

## 3. Files Created
- `src/components/CustomerMasterTab.tsx`
- `src/components/customer/CustomerProfile.tsx`
- `src/components/customer/CustomerLedger.tsx`
- `src/services/customerValidation.ts`
- `src/components/CrmStudioTab.tsx`
- `src/components/crm/LeadManager.tsx`
- `src/components/crm/OpportunityPipeline.tsx`
- `src/services/crmService.ts`
- `src/components/LoyaltyStudioTab.tsx`
- `src/components/loyalty/WalletManager.tsx`
- `src/components/loyalty/TierManager.tsx`
- `src/services/loyaltyService.ts`
- `src/tests/customerCrmLoyaltyDecoupling.test.ts`
- `docs/implementation/foundation/CRM_Loyalty_CustomerMaster_Split_Plan_v3.16.0.md`

## 4. Files Modified
- `src/App.tsx`
- `src/layout_engine/layout_store.tsx`
- `src/components/CrmLoyaltyTab.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 5. Architecture Decisions
Follows Domain-Driven Design (DDD) principles. The Customer Master maintains the primary entity profile context, while CRM and Loyalty associate activities using the core Customer ID.

## 6. Design Rationale
Separating the interfaces reduces rendering overhead, enforces strict access boundaries, and allows independent feature evolution (e.g. adding AI scoring to CRM without impacting core Customer details).

## 7. Implementation Summary
- Initialized `CustomerMasterTab` with mobile/email lookup, GSTIN/PAN indicators, and profile validation schemas.
- Developed `CustomerProfile` and `CustomerLedger` components to view detailed customer history and credit outstanding ledger items.
- Developed `customerValidation.ts` to perform format checks (e.g. GSTIN, PAN, Mobile) before registering profiles.
- Developed `CrmStudioTab` along with `LeadManager` and `OpportunityPipeline` to manage leads directory, source scoring, and kanban-style opportunity stages.
- Developed `crmService.ts` for scoring calculation rules based on lead details.
- Developed `LoyaltyStudioTab` along with `WalletManager` and `TierManager` to show member wallets, points, silver/gold/platinum tiers, and reward conversion parameters.
- Developed `loyaltyService.ts` for points earnings and tier threshold checks.
- Connected tab options to the global Layout Store and registered menu switches in the application sidebar.
- Added JSDoc `@deprecated` markers and warning banners to `CrmLoyaltyTab`.

## 8. Tests Executed
- Vitest suite runs (`npm run test`).
- Project compilation checks (`npm run lint`).

## 9. Verification Results
All 46 test cases passed successfully; compiler outputs returned zero warnings.

## 10. Known Limitations
None.

## 11. Future Work
Provide backend API migrations matching the domain-driven decoupling.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
