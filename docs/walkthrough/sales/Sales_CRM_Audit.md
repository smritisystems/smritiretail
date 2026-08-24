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

# SMRITI Retail OS — Walkthrough: CRM, Auditing, and POS Upgrades
## Document Version: v2.1.2 (2026-07-11)

### 1. Purpose
This walkthrough documents the full-stack updates implemented to resolve the operational and architectural gaps identified in SMRITI Retail OS. This includes backend audit logging automation, remote database CRM synchronization, and POS checkout enhancements (split payments, hotkeys event listeners, and on-screen toolbar shortcuts).

### 2. Scope
- Add centralized Express interceptor middleware in the backend persistence layer to automatically generate audit logs on mutating APIs.
- Set up dedicated CRUD REST endpoints for Customer and CustomerGroup entities on the server.
- Synchronize frontend `customerStore.ts` cache with remote endpoints on load and update events, keeping local storage as a fallback offline queue.
- Support split tenders in `/api/pos/checkout` and allocate payment breakdown to appropriate General Ledger accounts.
- Bind F2, F3, F12, and Escape keys in `PosTerminalTab.tsx` for fast cashier operations.

### 3. Files Created
None.

### 4. Files Modified
- `/server.ts`
- `/src/App.tsx`
- `/src/services/customerStore.ts`
- `/src/components/AdvancedBillingEngine.tsx`
- `/src/components/PosTerminalTab.tsx`

### 5. Architecture Decisions
- **Synchronous Cache Fallback:** Kept the frontend's synchronous query signatures (`getCustomers`) intact by syncing server database arrays into `localStorage` on mount and update, dispatching window events to trigger component refreshes.
- **Global Interceptor Auditing:** Placed audit log triggers within the Express post-response persistence middleware to catch all `POST`, `PUT`, `DELETE` operations on operational APIs.
- **Tenders Ledger Allocations:** Map split checkout breakup to distinct Debit General Ledger accounts (Cash, Bank-POS, Bank-UPI, Accounts Receivable) per tender.

### 6. Design Rationale
Using a hybrid local-storage cache sync model maintains SMRITI's signature high-velocity UI render times and ensures robust offline capabilities during internet dropouts. Global middleware auditing guarantees complete operational traceability without manual logging code cluttering business services.

### 7. Implementation Summary
- **Backend Audit & CRM:**
  - Added `customers` and `customerGroups` arrays in `server.ts` loadDb/saveDb hooks.
  - Added seed data in `migrateUsersAndSeedOrganizationData()`.
  - Added global Express interceptor middleware that logs mutating calls to `auditLogs`.
  - Created `/api/customers` and `/api/customers/groups` endpoints.
- **Split Payments POS Checkout:**
  - Upgraded `/api/pos/checkout` to support `customerId` and `payment` (including split breakout).
  - Allocated tenders to correct ledger accounts and added credit amounts to customer's outstanding balance.
- **Frontend CRM Sync:**
  - Modified `customerStore.ts` to call backend APIs on mount and update.
  - Implemented offline queuing for pending customer changes.
  - Called `syncCustomersWithBackend` on App component mount.
- **POS Keys & Toolbar:**
  - Integrated keydown event listeners for F2, F3, F12, and Escape.
  - Added a visual key overlay in the POS terminal sidebar.

### 8. Tests Executed
- Run linter checks (`npm run lint`).
- Run compiler builds (`npm run build`).

### 9. Verification Results
TypeScript linter compiled successfully and generated production packages with zero errors.

### 10. Known Limitations
None.

### 11. Future Work
Apply similar hotkey listener bindings to the Purchase Studio and Inventory Adjustments tabs.

### 12. Related ADRs
None.

### 13. Related RFCs
None.
