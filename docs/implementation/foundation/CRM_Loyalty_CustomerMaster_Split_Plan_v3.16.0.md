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

# Implementation Plan: Monolith Split — CRM, Loyalty, and Customer Master Modules

## 1. Objective
Deconstruct the combined customer registry, relationship trackers, and point ledgers into three decoupled business domains:
1. **Customer Master** (Master Data Foundation)
2. **CRM Studio** (Relationship Management & Campaign Pipeline)
3. **Loyalty Studio** (Rewards, Wallet Tiers, & Retention Engine)

## 2. Business Motivation
Keeps responsibilities clear, reduces code coupling, and allows separate modular licensing or independent scaling of CRM activities and Loyalty mechanics.

## 3. Scope
- **Phase 1: Customer Master:** Dedicated components, validation layers, outstanding credit ledgers, and profile fields.
- **Phase 2: CRM Studio:** Leads tracking, prospect conversion pipelines, opportunity stages, and campaigns.
- **Phase 3: Loyalty Studio:** Point wallets, reward rules, coupon designers, cashback calculations, and tier progression.
- **Shared services & reports:** Dedicated reporting widgets and granular permission configurations for each module.

## 4. Current State
Customer records, campaigns, and loyalty data are managed collectively under `CrmLoyaltyTab.tsx` and unified database models, leading to high UI coupling and mixed concerns.

## 5. Gap Analysis
- No independent view or management panel for Lead/Campaign progression.
- Customer Master and Loyalty logic reside inside a shared view.
- Lack of granular module permissions (e.g. restricting point adjustments while allowing profile editing).

## 6. Architecture Impact
Strict Domain-Driven Design (DDD) enforcement. Customer Master serves as the central entity ID provider. CRM and Loyalty reference Customer IDs without duplicating master profiles.

## 7. Proposed Design

### Domain Boundaries
```text
Customer Master (Single Source of Truth)
   ├── ID, Name, GSTIN, Credit Limits, Address
   ▼
CRM Studio (Acquisition / Pipeline)
   ├── Lead Status, Opportunities, Campaigns
   └── Reference to Customer ID
   ▼
Loyalty Studio (Rewards / Tiers)
   ├── Points Wallet, Tier Rules, Coupon Issued
   └── Reference to Customer ID
```

---

## 8. Files Created

### Phase 1: Customer Master
- `src/components/CustomerMasterTab.tsx`
- `src/components/customer/CustomerProfile.tsx`
- `src/components/customer/CustomerLedger.tsx`
- `src/services/customerValidation.ts`

### Phase 2: CRM Studio
- `src/components/CrmStudioTab.tsx`
- `src/components/crm/LeadManager.tsx`
- `src/components/crm/OpportunityPipeline.tsx`
- `src/services/crmService.ts`

### Phase 3: Loyalty Studio
- `src/components/LoyaltyStudioTab.tsx`
- `src/components/loyalty/WalletManager.tsx`
- `src/components/loyalty/TierManager.tsx`
- `src/services/loyaltyService.ts`

---

## 9. Files Modified
- `src/App.tsx` (Add routing switches and navigation sidebar triggers)
- `src/components/CrmLoyaltyTab.tsx` (Marked as Deprecated; to be removed in post-migration cleanup)

## 10. Dependencies
React, Lucide React, Express API, Postgres Repositories.

## 11. Risks
Breaking existing checkout point calculations or customer lookup flows. We will maintain backwards-compatible APIs and transition client routes progressively.

## 12. Rollback Strategy
Revert frontend directory changes via Git and restore the deprecated `CrmLoyaltyTab` route switcher in `App.tsx`.

## 13. Verification Plan
- Verify no compilation errors (`npm run lint`).
- Execute frontend and backend integration test runs.

## 14. Test Plan
Run `npm run test` to confirm authorization and validation logic remains intact.

## 15. Documentation Impact
Update SMRITI Developer Guide, Wiki indexes, and Architecture Constitution.

## 16. Deployment Plan
Progressively deprecate the legacy CRM panel, roll out the split components, and commit schema adjustments.

## 17. Status
Completed

## 18. Related ADRs
None.

## 19. Related Walkthroughs
- [Foundation_CRM_Loyalty_CustomerMaster_Split_v3.16.0.md](../../walkthrough/foundation/Foundation_CRM_Loyalty_CustomerMaster_Split_v3.16.0.md)
