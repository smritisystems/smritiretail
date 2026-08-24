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

  * Version    : 2.1.2
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Implementation Plan: CRM, Auditing, and POS Upgrades
## Plan Version: v2.1.2 (2026-07-11)

### 1. Objective
Upgrading the core architecture and user interface of SMRITI Retail OS, focusing on unified customer CRM data synchronization, global backend audit logging, and split-payment, keyboard-driven POS Terminal enhancements.

### 2. Business Motivation
Aligning the isolated frontend prototype systems (CRM local storage cache fallbacks) into the centralized JSON backend database server. Auto-capturing all mutation API requests in the audit activity log, and closing critical cashier efficiency gaps in POS checkout registers.

### 3. Scope
- Add global mutation auditing middleware inside the Express backend persistence layer.
- Add backend GET/POST/PUT API endpoints for `/api/customers` and `/api/customers/groups`.
- Sync frontend `customerStore.ts` with these server endpoints on load and update, keeping local storage as a fallback offline queue.
- Support single and split payment tenders in `/api/pos/checkout` and allocate them to correct General Ledger accounts.
- Bind F2, F3, F12, and Escape keys in `PosTerminalTab.tsx` for fast cashier operations.

### 4. Current State
- Customer CRM operated completely within browser local storage.
- Audit logs were only updated manually on company setup wizard actions.
- POS checkouts supported only single payment modes and no keyboard-only hotkeys.

### 5. Gap Analysis
- **CRM Sync Gap:** Browser data was lost on session changes or clear actions.
- **Auditing Gap:** Mutations like pricing edits, product creation, and stock updates went untracked.
- **POS Desk Speed Gap:** Cashiers had to navigate via mouse clicks to execute hold or pay functions.

### 6. Architecture Impact
None. Preserves data models and adds standard endpoints and key event mappings.

### 7. Proposed Design
- Add `customers` and `customerGroups` arrays to backend database structure.
- Intercept Express requests to build audit trails automatically.
- Split tenders checkouts mapping: `paymentObj: { mode: "Split", breakup: { Cash: 500, UPI: 500 } }`.

### 8. Files Created
None.

### 9. Files Modified
- `/server.ts`
- `/src/App.tsx`
- `/src/services/customerStore.ts`
- `/src/components/AdvancedBillingEngine.tsx`
- `/src/components/PosTerminalTab.tsx`

### 10. Dependencies
None.

### 11. Risks
- **Key Interception:** Potential browser key defaults conflicts.
  - *Mitigation:* Prevent default key actions using `e.preventDefault()`.

### 12. Rollback Strategy
Git checkout of affected files.

### 13. Verification Plan
- Run `npm run lint` and `npm run build`.
- Manually run checkout and verify CRM outstanding changes.

### 14. Test Plan
- Hotkey triggers tests.
- Split payments and ledger allocations tests.

### 15. Documentation Impact
Walkthrough documentation added.

### 16. Deployment Plan
Commit and push code.

### 17. Status
Completed.

### 18. Related ADRs
None.

### 19. Related Walkthroughs
- [CRM, Auditing, and POS Upgrades Walkthrough](../../walkthrough/sales/Sales_CRM_Audit_And_POS_Upgrades_Walkthrough_v2.1.2.md)
