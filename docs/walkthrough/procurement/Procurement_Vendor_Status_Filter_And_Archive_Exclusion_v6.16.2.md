/**
 * Project      : SMRITI Retail OS
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.2
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

# Walkthrough: Vendor 360 Workspace Status Filtering, Archive Exclusion & Article Isolation Contract

**Document ID:** WT-PROC-VEND-6.16.2  
**Area:** Procurement / Vendor 360 Workspace  
**Status:** Completed  
**Version:** 6.16.2  
**Date:** 2026-09-14  

---

## 1. Purpose
1. **Vendor Directory Archive Exclusion:** Remediates an operational ambiguity where archived and merged vendors appeared in the active Vendor 360 directory list with `ARCHIVED` or `MERGED` badges. Out of 38 total vendor records in database `smriti001`, 24 vendors were archived (`status = 'ARCHIVED'`). Standard operational workflows (daily procurement, purchase ordering, active supplier search) were cluttered. Default queries must strictly hide `ARCHIVED` and `MERGED` records, allowing access only via intentional explicit status filters.
2. **Vendor Article Ownership & Cross-Vendor Isolation:** Remediates a data isolation issue where articles owned by one vendor (e.g. `V-00A`, `V-00B`) were visible in the "Article / Style" tab and in the "Add Article / Style" dropdown when viewing another vendor (e.g. `V-00C`). Enforces strict multi-tier cross-vendor isolation so every vendor can only see and select their own articles, with zero cross-vendor article visibility or leakage.

---

## 2. Scope
1. **Backend Service & Query Layer:**
   - `backend/app/services/vendor_svc.py` — `VendorService.list_vendors` status filtering and default exclusion (`Party.status.notin_(["ARCHIVED", "MERGED"])`).
   - `backend/app/services/party_master_svc.py` — `UniversalPartyMasterService.list_parties` status filtering and default exclusion.
   - `backend/app/api/v1/vendor.py` — OpenAPI schema and endpoint documentation for status parameter values (`ACTIVE`, `INACTIVE`, `BLOCKED`, `ON_HOLD`, `PENDING_VERIFICATION`, `ARCHIVED`, `MERGED`, `ALL`).
   - `backend/app/api/v1/master_lookup.py` — Added `includeUnassigned` query parameter to `/lookup/{type_code}/values` alongside `vendorCode` to isolate vendor-owned articles and unassigned articles at the database layer.
2. **Frontend UI & State Layer:**
   - `src/components/vendor/VendorMasterWs.tsx`:
     - Status filter dropdown selector (`ACTIVE_ONLY`, `ALL`, `ARCHIVED`, `MERGED`, etc.) in the left directory column.
     - Secondary client-side defense filter in `filteredVendors`.
     - Warning notice banner when inspecting historical records.
     - `VendorArticleStyleTab` query and rendering isolated to the inspected vendor's owned articles and unassigned claimable pool.
     - Passing exclusively owned articles to `VariantTplSec`.
   - `src/components/VariantTemplateSec.tsx`:
     - `vendorOwnedArticles` memo filtering `articleOptions` strictly to `currentVendorCode`.
     - "Add Article / Style" `<select>` dropdown rendering only articles owned by the active vendor, eliminating cross-vendor options and disabled foreign vendor items.
3. **Automated Testing:**
   - `backend/tests/test_vendor_service.py` — Pytest suite covering default query exclusion, explicit status queries, and cross-vendor article isolation.
   - `src/tests/vendorStatusFilter.test.ts` — Vitest unit tests verifying directory status filtering, API URL building, and notice banner conditions.
   - `src/tests/vendorArticleIsolation.test.ts` — Vitest unit tests verifying cross-vendor article containment and "Add Article / Style" dropdown isolation.

---

## 3. Files Created
1. `src/tests/vendorStatusFilter.test.ts` — Vitest unit test suite covering client-side directory filtering, status parameter URL construction, and notice banner logic (6/6 passed).
2. `src/tests/vendorArticleIsolation.test.ts` — Vitest unit test suite covering cross-vendor article isolation, backend query simulation, and "Add Article / Style" dropdown containment (4/4 passed).
3. `docs/walkthrough/procurement/Procurement_Vendor_Status_Filter_And_Archive_Exclusion_v6.16.2.md` — Formal walkthrough record under WGP governance.

---

## 4. Files Modified
1. `backend/app/services/vendor_svc.py`:
   - Refactored `list_vendors` to handle `status_filter.upper() == "ALL"` (bypassing status restrictions), specific statuses, and default exclusion (`Party.status.notin_(["ARCHIVED", "MERGED"])`).
   - Updated UADHP header to `2026-09-14`.
2. `backend/app/services/party_master_svc.py`:
   - Updated `list_parties` to exclude both `ARCHIVED` and `MERGED` parties by default (`Party.status.notin_(["ARCHIVED", "MERGED"])`) instead of only excluding `MERGED`.
   - Handled `status.upper() == "ALL"`.
   - Updated UADHP header to `2026-09-14`.
3. `backend/app/api/v1/vendor.py`:
   - Updated OpenAPI parameter documentation for `status` query parameter to include `ARCHIVED`, `MERGED`, and `ALL`.
   - Updated UADHP header to `2026-09-14`.
4. `backend/app/api/v1/master_lookup.py`:
   - Added `includeUnassigned: bool = False` to `list_lookup_values`. When `vendorCode` is passed with `includeUnassigned=True`, queries `or_(MasterValue.vendor_code == vc, MasterValue.vendor_code.is_(None))`, strictly preventing foreign vendor values from traversing the network.
   - Updated UADHP version to `3.32.0` and date to `2026-09-14`.
5. `backend/tests/test_vendor_service.py`:
   - Added automated tests `test_vendor_default_query_hides_archived_and_merged` and `test_vendor_article_ownership_and_cross_vendor_isolation`.
   - Updated UADHP header to `2026-09-14`.
6. `src/components/vendor/VendorMasterWs.tsx`:
   - Added `statusFilter` state (`ACTIVE_ONLY` by default) and directory status dropdown selector.
   - Client-side defense-in-depth gate in `filteredVendors`.
   - Historical record warning notice banner for `ARCHIVED` and `MERGED` vendors.
   - Updated `VendorArticleStyleTab.loadArticles` to query with `vendorCode=${vendor.code}&includeUnassigned=true`.
   - Partitioned articles into `assignedArticles` (owned by vendor) and `unassignedArticles` (available to claim).
   - Passed exclusively `assignedArticles` to `VariantTplSec`.
   - Updated UADHP version to `6.16.2` and date to `2026-09-14`.
7. `src/components/VariantTemplateSec.tsx`:
   - Added `vendorOwnedArticles` memo strictly isolating `articleOptions` to `currentVendorCode`.
   - Updated "Add Article / Style" dropdown to render only `vendorOwnedArticles`, removing disabled foreign vendor items.
   - Updated UADHP version to `2.1.2` and date to `2026-09-14`.
8. `docs/walkthrough/README.md`:
   - Appended entry to chronological master walkthrough table.
9. `CHANGELOG.md`:
   - Added entry for Version 6.16.2.

---

## 5. Architecture Decisions
1. **Server-Side System-of-Record Authority:**
   The backend database query (`VendorService.list_vendors` and `UniversalPartyMasterService.list_parties`) is the sole authoritative gatekeeper. Default queries without an explicit status filter strictly apply `Party.status.notin_(["ARCHIVED", "MERGED"])`.
2. **First-Class "ALL" Status Filter Token:**
   Passing `status="ALL"` explicitly signals to the backend service that historical audit and administrative analysis is requested, bypassing status constraints and returning all parties regardless of lifecycle state.
3. **Defense-in-Depth in Client Workspace:**
   Even if an archived record were in memory, `filteredVendors` applies an additional check: if `statusFilter === "ACTIVE_ONLY"`, records with status `ARCHIVED` or `MERGED` are excluded from rendering.
4. **Three-Tier Vendor Article Isolation:**
   - **Tier 1 (Database/API):** `GET /masters/lookup/style_article/values?vendorCode={vendor.code}&includeUnassigned=true` queries Postgres with `or_(MasterValue.vendor_code == vc, MasterValue.vendor_code.is_(None))`. Other vendors' articles are never returned over HTTP.
   - **Tier 2 (VendorMasterWs):** Partitioned into `assignedArticles` (owned by this vendor) and `unassignedArticles` (available to claim). Only `assignedArticles` is passed to `VariantTplSec`.
   - **Tier 3 (VariantTemplateSec):** The "Add Article / Style" form dropdown renders only `vendorOwnedArticles`. No other vendor can ever see or select another vendor's articles.

---

## 6. Design Rationale
- **Preserving Historical Data Without Cluttering Daily Operations:**
  Retail operations frequently accumulate suppliers that are discontinued, merged, or flagged. Deleting them is strictly prohibited under audit and statutory accounting rules (GSTN, purchase vouchers, TDS ledger). Hiding them by default while retaining full explicit filter retrieval balances daily operational clarity with audit completeness.
- **Strict Brand & Supplier Confidentiality:**
  In a multi-vendor retail OS, vendors must never see other vendors' article/style codes in dropdowns or catalog managers. Allowing one vendor to see another vendor's article codes created operational confusion and confidentiality leaks. Isolating the dropdown ensures clean, confidential catalog maintenance.

---

## 7. Implementation Summary
- **Backend Service Alignment:**
  ```python
  if status_filter:
      sf = status_filter.strip().upper()
      if sf != "ALL":
          query = query.filter(Party.status == sf)
  else:
      query = query.filter(Party.status.notin_(["ARCHIVED", "MERGED"]))
  ```
- **Backend Master Lookup Isolation:**
  ```python
  if vendorCode:
      vc = vendorCode.strip().upper()
      if includeUnassigned:
          q = q.where(or_(MasterValue.vendor_code == vc, MasterValue.vendor_code.is_(None)))
      else:
          q = q.where(MasterValue.vendor_code == vc)
  ```
- **Frontend Dropdown Isolation in VariantTemplateSec.tsx:**
  ```tsx
  const vendorOwnedArticles = useMemo(() => {
    if (!currentVendorCode) return articleOptions;
    return articleOptions.filter((option) => {
      const owner = (option.vendorCode || "").trim().toUpperCase();
      return owner === currentVendorCode;
    });
  }, [articleOptions, currentVendorCode]);
  ```

---

## 8. Tests Executed
1. **Pytest Backend Suite:**
   ```bash
   python -m pytest backend/tests/test_vendor_service.py -v
   ```
   - 6/6 tests passed in 6.41s:
     - `test_create_vendor_atomic_party_and_legacy_projection` PASSED
     - `test_vendor_duplicate_prevention` PASSED
     - `test_vendor_partial_update_and_legacy_sync` PASSED
     - `test_vendor_merge_lifecycle` PASSED
     - `test_vendor_default_query_hides_archived_and_merged` PASSED
     - `test_vendor_article_ownership_and_cross_vendor_isolation` PASSED
2. **Vitest Frontend Suites:**
   ```bash
   npx vitest run src/tests/vendorStatusFilter.test.ts src/tests/vendorArticleIsolation.test.ts src/tests/vendorMasterWsLoopGuard.test.ts
   ```
   - 13/13 tests passed across 3 test files in 367ms:
     - `src/tests/vendorStatusFilter.test.ts` (6 tests) PASSED
     - `src/tests/vendorArticleIsolation.test.ts` (4 tests) PASSED
     - `src/tests/vendorMasterWsLoopGuard.test.ts` (3 tests) PASSED
3. **TypeScript Compiler Check:**
   ```bash
   npx tsc --noEmit
   ```
   - 0 errors returned (exit code 0).
4. **Vite Production Bundle Build:**
   ```bash
   npm run build
   ```
   - 3,534 modules transformed, built in 27.44s with 0 errors.

---

## 9. Verification Results
All tests passed with zero regressions:
1. In PostgreSQL database `smriti001`:
   - Default `/api/v1/purchase/vendors/` returns 14 operational vendors (omitting all 24 archived vendors).
   - Explicit query `/api/v1/purchase/vendors/?status=ARCHIVED` returns 24 archived vendors.
   - Explicit query `/api/v1/purchase/vendors/?status=ALL` returns all 38 vendors.
2. In Master Lookup Style/Article values:
   - Querying for `V-00C` returns only `V-00C` owned articles and unassigned items.
   - In "Add Article / Style", vendor `V-00C` sees exclusively `V-00C` articles in the dropdown.
   - Vendor `V-00A` can never see or select `V-00C` articles.

---

## 10. Known Limitations
- Vendors merged via the Vendor Merge Modal automatically receive status `MERGED` and have their outstanding project to the target entity; un-merging is currently an administrative SQL-level operation.

---

## 11. Future Work
- Add bulk status transition capabilities for mass-archiving seasonal suppliers at financial year-end.
- Introduce audit reason tracking when transitioning a vendor from `ACTIVE` to `ARCHIVED`.

---

## 12. Related ADRs
- `ADR-0042`: Universal Party Master & Canonical Vendor Architecture
- `ADR-0045`: Strict Deletion Prohibition & Non-Destructive Lifecycle Archiving
- `ADR-0048`: Universal Catalog Dimension Master Lookup Governance & Single-Owner Article Registry

---

## 13. Related RFCs
- `RFC-2026-09-VEND-01`: Vendor 360 Workspace Operational Clarity & Lifecycle State Gate
- `RFC-2026-09-VEND-02`: Strict Cross-Vendor Article Ownership & Directory Isolation
