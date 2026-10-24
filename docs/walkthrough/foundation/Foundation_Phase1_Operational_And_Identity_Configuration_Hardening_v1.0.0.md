<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Walkthrough (WGP)
-->

# Walkthrough: SMRITI Retail OS — Phase 1 Operational & Identity Configuration Hardening

**Walkthrough ID:** `WGP-FOUNDATION-P1-v1.0.0`  
**Area:** Foundation, Statutory & Commercial Configuration  
**Status:** Completed & Accepted  

---

## 1. Purpose
This walkthrough documents the full implementation and verification of Phase 1 Operational & Identity Configuration Hardening in SMRITI Retail OS. Phase 1 systematically remediated the 14 validated Priority 1 (P1) forensic audit findings, excising embedded tenant literals, eliminating fragmented static statutory state dictionaries, and unifying transactional tax jurisdiction and seller identity resolution dynamically across tenant entities.

---

## 2. Scope
The scope encompasses three primary architectural clusters across frontend and backend surfaces:
- **Cluster A: Statutory State Resolution Unification (P1-6 to P1-11)**:
  - Eliminated static `INDIAN_STATES` list in `src/constants/indianLocationData.ts`, converting it to dynamic derivation from `INDIAN_STATE_CITY_PIN_DATA` keys with statutory guidance pointing to `fetchCanonicalIndianStates()`.
  - Upgraded `src/components/customer/CustMailingDlg.tsx` to retrieve canonical states via `fetchCanonicalIndianStates()` querying `/control/reference/states` (`states_ref`) with zero hardcoded static fallback.
  - De-duplicated E-Way Bill state validations in `backend/app/services/eway_bill_service.py` by removing 40 lines of duplicate dictionaries and linking directly to canonical `GST_STATE_CODES` from `gst_engine.py` (which includes statutory codes 99, 25, 28, 27).
  - Confirmed CRM (`schemas/crm.py`) and WMS (`schemas/wms.py`) Pydantic models import directly from `app.core.gst_engine`.
- **Cluster B: Seller & Tenant Metadata De-Hardcoding (P1-1 to P1-5)**:
  - Excised hardcoded seller name (`"Tattly Threads"`), default GSTIN (`"27AAXFT2508H1ZR"`), and state code (`"27"`) from `backend/app/services/canonical_sales_writer.py`.
  - Dynamic extraction of seller identity and GSTIN from active tenant `Company`, `Branch`, and dispatch `Warehouse` entities.
  - De-hardcoded `"Maharashtra"` fallback in `backend/app/services/sales.py` in `convert_so_to_invoice`, resolving state dynamically from `Company.gst_number`.
  - Dynamic purchase tax jurisdiction resolution in `backend/app/services/purchase.py` via `PurchaseJurisdictionConfig` -> `Company.gst_number` -> `Company.state` -> `SystemParameterService` (`SMRITI.PURCHASE.DEFAULT_JURISDICTION_STATE`).
- **Cluster C: Multi-Tenant & Identity Scope Governance (P1-12 to P1-14)**:
  - Governed fallback state codes through server-authoritative system parameter `SMRITI.TAX.DEFAULT_STATE_CODE`.

---

## 3. Files Created
1. `backend/app/tests/test_phase1_operational_hardening.py`: Focused verification test suite covering E-Way bill canonical parity, dynamic purchase jurisdiction resolution, and `CanonicalSalesPostingWriter` dynamic seller identity and dispatch snapshot assertions.
2. `docs/implementation/foundation/Foundation_Phase1_Operational_And_Identity_Configuration_Hardening_Plan_v1.0.0.md`: Formal 19-section Implementation Plan per IPGP.
3. `docs/walkthrough/foundation/Foundation_Phase1_Operational_And_Identity_Configuration_Hardening_v1.0.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/canonical_sales_writer.py`
2. `backend/app/services/sales.py`
3. `backend/app/services/purchase.py`
4. `backend/app/services/eway_bill_service.py`
5. `src/constants/indianLocationData.ts`
6. `src/components/customer/CustMailingDlg.tsx`
7. `docs/implementation/README.md`
8. `docs/walkthrough/README.md`
9. `CHANGELOG.md`

---

## 5. Architecture Decisions
- **Single Source of Statutory State Definitions (ADR-048)**: No independent statutory state dictionaries are permitted in operational service files. All backend validation uses `app.core.gst_engine` (seeded from PostgreSQL `states_ref`), and all UI components query `/control/reference/states` via `fetchCanonicalIndianStates()`.
- **Tenant-First Identity Hierarchy**: Dispatch and invoice snapshots prioritize `Company` legal entity records, followed by `Branch` overrides and `Warehouse` dispatch locations. Fictitious demo tenant strings (`"Tattly Threads"`, `"27AAXFT2508H1ZR"`) are strictly prohibited in transactional pathways.
- **Hierarchical System Parameter Resolution**: Fallback state codes and jurisdictions resolve hierarchically: `TERMINAL` -> `BRANCH` -> `COMPANY` -> `GLOBAL` via `SystemParameterService`.

---

## 6. Design Rationale
In multi-tenant SaaS deployments, hardcoding specific customer brand names or GSTINs in transactional writers risks data contamination, compliance violations, and severe security leaks where invoices generated by Tenant B display Tenant A's branding or tax registration numbers. De-hardcoding these fields guarantees that every tenant operates with complete data isolation.

---

## 7. Implementation Summary
- **E-Way Bill Service**: Excised 40-line `VALID_GST_STATE_CODES` mapping and replaced it with direct reference to `GST_STATE_CODES`.
- **Customer Mailing Dialog**: Replaced direct consumption of static `INDIAN_STATES` array with `fetchCanonicalIndianStates()`. Handled failure gracefully without falling back to static lists.
- **Location Data Constant**: Exported `INDIAN_STATES` derived dynamically from `Object.keys(INDIAN_STATE_CITY_PIN_DATA).sort()` placed after dictionary initialization to prevent temporal dead zone compiler errors.
- **Canonical Sales Writer**: Dynamically resolves seller legal name from `comp_obj.name` or `branch_obj.name` or `disp_wh.name`. Dynamically resolves GSTIN from `comp_obj.gst_number` or `branch_obj.gst_number`. Resolves dispatch state from GSTIN state prefix, branch state code, company state code, or `SMRITI.TAX.DEFAULT_STATE_CODE`.
- **Sales Service**: Replaced static `"27"` and `"Maharashtra"` assumptions with dynamic company state code derivation in `convert_so_to_invoice`.
- **Purchase Service**: Replaced static `"DL"` fallback in `get_jurisdiction` with multi-step dynamic lookup including `Company.gst_number`, `Company.state`, and `SMRITI.PURCHASE.DEFAULT_JURISDICTION_STATE`.

---

## 8. Tests Executed
1. **Backend Unit & Integration Suite**:
   - `pytest backend/app/tests/test_phase1_operational_hardening.py`
   - `pytest backend/app/tests/test_gst_engine.py`
   - `pytest backend/app/tests/test_customer_discount_policy.py`
   - `pytest backend/app/tests/test_max_discount_cap.py`
   - `pytest backend/app/tests/test_negative_stock_policy.py`
   - **Result**: 27 passed in 5.75s.
2. **Frontend Test Suite**:
   - `vitest run src/tests/pricingDiscountEngine.test.ts src/tests/salesAuditAndFormatters.test.ts`
   - **Result**: 25 passed in 588ms.
3. **TypeScript Static Analysis**:
   - `npx tsc --noEmit`
   - **Result**: Exit code 0 (zero errors).

---

## 9. Verification Results
- Zero occurrences of `"Tattly Threads"` in transactional service logic.
- Zero occurrences of `"27AAXFT2508H1ZR"` in transactional service logic.
- Parity between `VALID_GST_STATE_CODES` and `GST_STATE_CODES` verified (`assert VALID_GST_STATE_CODES is GST_STATE_CODES`).
- All 14 P1 findings addressed across the 3 clusters.

---

## 10. Known Limitations
- UI components outside customer mailing dialog that consume `ALL_INDIAN_CITIES` still use client-side suggestions from `indianLocationData.ts` for pincode auto-fill, which is acceptable as UI convenience metadata rather than statutory GST authority.

---

## 11. Future Work
- Transition to Phase 2 for P2 operational defaults (e.g., token expiration settings, report poll intervals, barcode label dimensions).
- Implement database-driven master values for standard UI presets in Phase 3.

---

## 12. Related ADRs
- `ADR-048`: Statutory Reference Single-Source Architecture.
- `ADR-051`: Multi-Tenant Seller Identity Strictness.

---

## 13. Related RFCs
- `RFC-2026-08`: Elimination of Static Master Data and Hardcoded Commercial Policies in SMRITI Retail OS.
