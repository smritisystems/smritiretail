<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.34.1
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Catalogue Form Save & PostgreSQL Persistence Remediation

**Version:** 6.34.1  
**Area:** CRM & Customer Master  
**Module:** `CustMasterWs.tsx` / `CustomerMasterTab.tsx` / `CustFormTab.tsx`  
**Target Backend:** FastAPI Core (`/api/v1/crm/*`) & PostgreSQL (`smriti001`)  

---

## 1. Purpose
Address and resolve the defect where modified details in the Customer Catalogue / Customer Master module (`CustMasterWs.tsx`, `CustFormTab.tsx`, `CustAddlDetTab.tsx`) could not be saved to the database. Provide end-to-end diagnosis, root cause elimination, schema/DTO parity, database persistence verification, and visual regression testing with Playwright.

---

## 2. Scope
- **Frontend Workspace & Form Modules:**
  - `src/components/customer/CustMasterWs.tsx`
  - `src/components/customer/CustFormTab.tsx`
  - `src/components/customer/CustAddlDetTab.tsx`
  - `src/components/customer/types.ts`
  - `src/components/shell/TabRenderer.tsx`
- **Backend & Database Infrastructure:**
  - FastAPI CRM Endpoints (`PUT /api/v1/crm/customers/{customer_id}`, `GET /api/v1/crm/customers`)
  - PostgreSQL Database (`smriti001.customers` table)
- **Automated Verification:**
  - Playwright E2E Test Suite (`scripts/verify_customer_catalogue_save.py`)
  - Diagnostic Network & Console Capture Script (`scripts/test_customer_save_debug.py`)

---

## 3. Files Created
1. `scripts/verify_customer_catalogue_save.py` — End-to-end automated test validating form modification, PUT request intercept, database persistence, and round-trip reload.
2. `scripts/test_customer_save_debug.py` — Diagnostic script capturing network payload, browser console, and UI error banners.

---

## 4. Files Modified
1. `src/components/shell/TabRenderer.tsx` — Bound `onNotification={addNotification}` to `CustomerMasterTab`, enabling human-readable success and error toast notifications.
2. `src/components/customer/types.ts` — Added `is_tax_inclusive`, `pricing_basis`, and `allow_promotions_on_rate` aliases to `RetailCustomerRecord` to prevent desynchronization between camelCase and snake_case DTO bindings.
3. `src/components/customer/CustFormTab.tsx` — Fixed `Comp Code` field key collision (`data-field-key="company_code"`); synchronized bidirectional state changes for `pricingBasis`/`pricing_basis`, `isTaxInclusive`/`is_tax_inclusive`, and `allowPromotionsOnRate`/`allow_promotions_on_rate`.
4. `src/components/customer/CustAddlDetTab.tsx` — Synchronized `pricingBasis` and `pricing_basis` state handlers.
5. `src/components/customer/CustMasterWs.tsx`:
   - Aligned initial `SEED_CUSTOMERS[0]` to canonical backend entity `cust-rrl-192b561d` (`RRL-001`).
   - Fixed backend customer reconciliation in `loadCustomersFromBackend` so it defaults to `mappedList[0]` instead of leaving phantom mock records active.
   - Enhanced `mapBackendCustomerToRecord` to authoritatively deserialize `pricingBasis`, `pricing_basis`, `allowPromotionsOnRate`, `allow_promotions_on_rate`, and `is_tax_inclusive`.
   - Updated `handleSave` to include all statutory and pricing policy fields in the `PUT` payload, wrapped location synchronization in exception guards, and provided human-friendly notifications.

---

## 5. Architecture Decisions
1. **Authoritative Identification Over Array Indexing:** Customer state matching now strictly checks both backend `id` (`cust-rrl-192b561d`) and business `code` (`RRL-001`), ensuring that edits are routed to `PUT /crm/customers/{id}` instead of misclassified `POST` attempts.
2. **Dual-Key DTO Resiliency:** Added support for both snake_case and camelCase attributes on customer record objects to ensure seamless interop between PostgreSQL ORM representations and React component states.
3. **Graceful Sub-Entity Syncing:** Wrapped delivery and billing location synchronization in non-blocking error handling so that minor formatting inconsistencies in secondary addresses do not block primary customer profile persistence.

---

## 6. Design Rationale
- Previously, `CustomerMasterTab` had no notification binding in `TabRenderer.tsx`, causing any API validation error or HTTP 409 conflict to fail completely silently without giving feedback to the user.
- A seed customer with ID `cust-1` caused a phantom desynchronization because it did not exist in the database, triggering an erroneous `POST /crm/customers` with duplicate GSTINs. Anchoring to canonical records and defaulting to loaded backend data completely eliminates this issue.

---

## 7. Implementation Summary
1. **Diagnosis:** Executed `scripts/test_customer_save_debug.py`, pinpointing an HTTP 409 duplicate GSTIN conflict caused by phantom ID mismatch, along with omitted pricing policy fields in `backendPayload`.
2. **Code Remediation:** Updated `CustMasterWs.tsx`, `CustFormTab.tsx`, `CustAddlDetTab.tsx`, `TabRenderer.tsx`, and `types.ts`.
3. **TypeScript & Production Build:** Verified with `npx tsc --noEmit` (0 errors) and `npm run build` (built in 31.10s).
4. **End-to-End Playwright Automation:** Automated form edits, HTTP 200 verification on `PUT /crm/customers/cust-rrl-192b561d`, PostgreSQL database inspection, and full page reloads.

---

## 8. Tests Executed
```bash
# Diagnostic Run
python scripts/test_customer_save_debug.py

# Typecheck & Build
npx tsc --noEmit
npm run build

# End-to-End Verification Run
python scripts/verify_customer_catalogue_save.py
```

---

## 9. Verification Results

### Terminal Output from `verify_customer_catalogue_save.py`
```text
================================================================================
CUSTOMER CATALOGUE FORM SAVE & DATABASE VALIDATION E2E TEST
================================================================================

[DB PRE-CHECK] Current PostgreSQL record for RRL-001:
id         |  code   |          name           | pricing_basis | allow_promotions_on_rate | is_tax_inclusive 
-------------------+---------+-------------------------+---------------+--------------------------+------------------
 cust-rrl-192b561d | RRL-001 | Reliance Retail Limited | MRP           | f                        | f
(1 row)

[Step 1] Navigating to http://localhost:3000/?tab=customer-master...
  Logging in as Admin...
  Dispatching smriti_navigate_module for customer-master...

[Step 2] Selecting customer RRL-001 from Directory...
  Selected RRL-001 from Directory.

[Step 3] Modifying Customer Details in Form...
  - Customer Name set to: 'Reliance Retail Enterprise Limited'
  - Billing Basis (Bill On) set to: 'RATE'
  - Allow Retail Promotions on Trade Rate checked: True
  [SAVED SCREENSHOT 1] screenshots_customer_save_verification\01_customer_details_modified_in_form.png

[Step 4] Clicking 'Save Ctrl+S'...
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/delivery-locations/cdl-c64f6f2fec8a1d4e0a656483 -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/delivery-locations/cdl-f6f9d726fa7d857869840d6c -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/delivery-locations/cdl-ce58e57b7a7641a9b7375725 -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/delivery-locations/cdl-b837a5da -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/delivery-locations/cdl-3f2b6d6c -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/delivery-locations/cdl-e60327e0 -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/delivery-locations/cdl-a0550ba334c04bb28966a1a4 -> HTTP 200
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d/billing-locations/cbl-c25326a5 -> HTTP 200
  Total PUT responses intercepted: 9
  [SAVED SCREENSHOT 2] screenshots_customer_save_verification\02_customer_save_toast_notification.png

[Step 5] Direct PostgreSQL verification after Save:
id         |  code   |                name                | pricing_basis | allow_promotions_on_rate | is_tax_inclusive 
-------------------+---------+------------------------------------+---------------+--------------------------+------------------
 cust-rrl-192b561d | RRL-001 | Reliance Retail Enterprise Limited | RATE          | t                        | f
(1 row)
  [OK] PostgreSQL columns verified successfully!

[Step 6] Reloading page to verify persistence from PostgreSQL into UI...
  Customer Name loaded from backend after reload: 'Reliance Retail Enterprise Limited'
  Billing Basis loaded from backend after reload: 'RATE'
  Allow Retail Promotions on Trade Rate after reload: True
  [SAVED SCREENSHOT 3] screenshots_customer_save_verification\03_customer_reloaded_from_postgres.png

[Step 7] Reverting canonical record back to 'Reliance Retail Limited', MRP, Promo OFF...
  [NETWORK EVENT] PUT http://localhost:3000/api/v1/crm/customers/cust-rrl-192b561d -> HTTP 200
  Reset save succeeded via HTTP 200!
  [SAVED SCREENSHOT 4] screenshots_customer_save_verification\04_customer_restored_to_canonical_mrp.png

[FINAL DB CHECK] PostgreSQL record for RRL-001:
id         |  code   |          name           | pricing_basis | allow_promotions_on_rate | is_tax_inclusive 
-------------------+---------+-------------------------+---------------+--------------------------+------------------
 cust-rrl-192b561d | RRL-001 | Reliance Retail Limited | MRP           | f                        | f
(1 row)

================================================================================
ALL VALIDATION GATES PASSED PERFECTLY (100% SUCCESS)
================================================================================
```

---

## 10. Known Limitations
- When creating a completely new customer account (`Alt+N`), GSTIN format must strictly follow statutory rules (`^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`) to avoid backend 422 Unprocessable Entity responses.

---

## 11. Future Work
- Add bulk customer pricing policy updates in CRM Studio.
- Implement automated audit log feed entries when customer pricing basis or credit terms are modified.

---

## 12. Related ADRs
- `ADR-008`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-024`: Customer Master & Location Relational Hierarchy.

---

## 13. Related RFCs
- `RFC-CRM-004`: Customer Profile Data Contract and Pricing Governance.
