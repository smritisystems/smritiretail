<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Master Framework — Phase E (Dynamic Schema-Driven Master Management) Walkthrough

## 1. Purpose
The purpose of this walkthrough is to document the final integration phase of the generic SMRITI Master Framework. It transitions the master administration UI from statically configured registries to a dynamic, database-schema-driven model, decoupling client administration screens from hardcoded UI component dependencies.

## 2. Scope
- Mount-time configuration retrieval from the backend master types catalog.
- Fully dynamic, database-schema-driven `MasterForm` rendering (inputs, selectors, dropdowns, checkboxes).
- Client-side data transformation mapping flat form properties to/from nested JSONB structures.
- Strict API routing split between Tier-2 Express-managed masters and Tier-1 FastAPI/PostgreSQL-managed lookup values.
- Dynamic dropdown option resolution for Tier-2 cross-entity linkages.
- Comprehensive end-to-end integration verification.

## 3. Files Created
- [test_crud_endpoints.ts](file:///d:/IMP/GitHub/SMRITRretailNX/scripts/test_crud_endpoints.ts) - Automated CRUD API validation harness.

## 4. Files Modified
- [masters_registry.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/masters_registry.ts) - Cleared Tier-1 configs and static dropdown options to rely solely on dynamic resolution.
- [MasterManagementTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/MasterManagementTab.tsx) - Dynamic state mapping, generic fetch flow, form rendering schema parser, and backend integration.

## 5. Architecture Decisions
- **Dynamic Configuration Merge:** We merge static configuration definitions for Tier-2 masters with dynamically-fetched lookup type descriptors from `/api/masters/lookup-types` at component mount.
- **Generic Form Mapping:** Instead of rendering hardcoded components per master field type, the system parses the Ajv-compliant `field_schema` (defining options via `enum`, types via `boolean`/`string`) and renders standard inputs.
- **Client-Side Structuring:** All custom lookup metadata values are mapped inside the nested database `data` object before transmission and flattened back into state objects upon edit.

## 6. Design Rationale
- Decoupling UI presentation logic from specific entity models allows administrators to introduce new master data categories dynamically directly in the backend without client deployments.
- Reusing standard SMRITI design system components keeps user operations cohesive across all data registers.

## 7. Implementation Summary
1. Cleaned up `masters_registry.ts` to keep only the Tier-2 masters (`company`, `branch`, `store`, `warehouse`).
2. Configured mount-time initialization of `mastersList` from local registry merged with fetched backend catalogs.
3. Updated `MasterForm` state instantiation to automatically flatten initial data when in edit mode.
4. Refactored list columns and statuses to parse the generic lookup fields.
5. Structured standard CRUD action pathways using generic `.isLookup` flags to route actions properly to the target APIs.

## 8. Tests Executed
We ran an automated integration test script validating that the backend rejects schema violations and processes valid transactions:
```bash
npx tsx scripts/test_crud_endpoints.ts
```

## 9. Verification Results
```text
Starting master framework CRUD integration testing...
Logged in successfully. Session Token acquired.

========================================
TESTING TIER-2 MASTER: COMPANIES
========================================
[GET] Fetching list for companies...
  List count before: 1
[POST] Creating new companies...
  Response Status: 201
  Created record: {
  "code": "TCP509799",
  "name": "Test Company 509799",
  "tax_id": "GST509799",
  "currency": "INR",
  "address": "123 St",
  "id": "comp-1783948509872",
  "status": "Active"
}
[PUT] Editing companies (updating name)...
  Response Status: 200
  Edited name: Test Company 509799 Updated
[DELETE] Deleting companies ID: comp-1783948509872...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "comp-1783948509872"
}

========================================
TESTING TIER-2 MASTER: BRANCHES
========================================
[GET] Fetching list for branches...
  List count before: 1
[POST] Creating new branches...
  Response Status: 201
  Created record: {
  "code": "TBR509799",
  "name": "Test Branch 509799",
  "company": "comp-um-ceff75",
  "address": "123 St",
  "id": "br-1783948509915"
}
[PUT] Editing branches (updating name)...
  Response Status: 200
  Edited name: Test Branch 509799 Updated
[DELETE] Deleting branches ID: br-1783948509915...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "br-1783948509915"
}

========================================
TESTING TIER-2 MASTER: STORES
========================================
[GET] Fetching list for stores...
  List count before: 1
[POST] Creating new stores...
  Response Status: 201
  Created record: {
  "code": "TST509799",
  "name": "Test Store 509799",
  "branch": "br-um-ceff75",
  "store_type": "Company Owned",
  "address": "123 St",
  "id": "store-1783948509872",
  "status": "Active",
  "created_at": "2026-07-13T13:15:09.872Z",
  "updated_at": "2026-07-13T13:15:09.872Z"
}
[PUT] Editing stores (updating name)...
  Response Status: 200
  Edited name: Test Store 509799 Updated
[DELETE] Deleting stores ID: store-1783948509872...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "store-1783948509872"
}

========================================
TESTING TIER-2 MASTER: WAREHOUSES
========================================
[GET] Fetching list for warehouses...
  List count before: 1
[POST] Creating new warehouses...
  Response Status: 201
  Created record: {
  "code": "TWH509799",
  "name": "Test WH 509799",
  "branch": "br-um-ceff75",
  "is_transit": false,
  "address": "123 St",
  "id": "wh-1783948509915",
  "status": "Active",
  "created_at": "2026-07-13T13:15:09.915Z",
  "updated_at": "2026-07-13T13:15:09.915Z"
}
[PUT] Editing warehouses (updating name)...
  Response Status: 200
  Edited name: Test WH 509799 Updated
[DELETE] Deleting warehouses ID: wh-1783948509915...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "wh-1783948509915"
}

========================================
TESTING TIER-1 LOOKUP MASTER: DEPARTMENT
========================================
[GET] Fetching list for lookup department...
  List count before: 3
[POST] Attempting invalid create for lookup department (expecting 400)...
  Response Status: 400
  Ajv Error Response: {
  "error": "Validation failed: data must NOT have additional properties"
}
[POST] Creating valid department (expecting 201)...
  Response Status: 201
  Created record: {
  "id": "453c60f5-da64-425b-9bc1-6b72db0fdaf2",
  "master_type_id": "eb1a5c0c-8b10-4dea-9841-4a47861a188c",
  "code": "TDP509799",
  "name": "Test Dept 509799",
  "parent_value_id": null,
  "data": {},
  "active": true,
  "sort_order": 0,
  "updated_at": "2026-07-13T13:15:10.618Z"
}
[PUT] Editing lookup department (updating name/metadata)...
  Response Status: 200
  Edited name: Test Dept 509799 Updated
[DELETE] Deleting lookup department ID: 453c60f5-da64-425b-9bc1-6b72db0fdaf2...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "453c60f5-da64-425b-9bc1-6b72db0fdaf2"
}

========================================
TESTING TIER-1 LOOKUP MASTER: DESIGNATION
========================================
[GET] Fetching list for lookup designation...
  List count before: 3
[POST] Attempting invalid create for lookup designation (expecting 400)...
  Response Status: 400
  Ajv Error Response: {
  "error": "Validation failed: data must NOT have additional properties"
}
[POST] Creating valid designation (expecting 201)...
  Response Status: 201
  Created record: {
  "id": "2b8c1bff-a08f-4ce8-b5e1-f21f8f3a4f4f",
  "master_type_id": "30556e73-deff-4cbf-a6a5-7d16618ee685",
  "code": "TDS509799",
  "name": "Test Desig 509799",
  "parent_value_id": null,
  "data": {},
  "active": true,
  "sort_order": 0,
  "updated_at": "2026-07-13T13:15:10.842Z"
}
[PUT] Editing lookup designation (updating name/metadata)...
  Response Status: 200
  Edited name: Test Desig 509799 Updated
[DELETE] Deleting lookup designation ID: 2b8c1bff-a08f-4ce8-b5e1-f21f8f3a4f4f...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "2b8c1bff-a08f-4ce8-b5e1-f21f8f3a4f4f"
}

========================================
TESTING TIER-1 LOOKUP MASTER: BANK
========================================
[GET] Fetching list for lookup bank...
  List count before: 0
[POST] Attempting invalid create for lookup bank (expecting 400)...
  Response Status: 400
  Ajv Error Response: {
  "error": "Validation failed: data must NOT have additional properties"
}
[POST] Creating valid bank (expecting 201)...
  Response Status: 201
  Created record: {
  "id": "53a8d90e-878c-4e94-9077-25423b6f5731",
  "master_type_id": "e50141f5-13c6-4b35-bd99-af877b5e7a25",
  "code": "TBK509799",
  "name": "Test Bank 509799",
  "parent_value_id": null,
  "data": {
    "ifsc": "IFSC001",
    "account_no": "123456"
  },
  "active": true,
  "sort_order": 0,
  "updated_at": "2026-07-13T13:15:10.910Z"
}
[PUT] Editing lookup bank (updating name/metadata)...
  Response Status: 200
  Edited name: Test Bank 509799 Updated
[DELETE] Deleting lookup bank ID: 53a8d90e-878c-4e94-9077-25423b6f5731...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "53a8d90e-878c-4e94-9077-25423b6f5731"
}

========================================
TESTING TIER-1 LOOKUP MASTER: PAYMENT_MODE
========================================
[GET] Fetching list for lookup payment_mode...
  List count before: 0
[POST] Attempting invalid create for lookup payment_mode (expecting 400)...
  Response Status: 400
  Ajv Error Response: {
  "error": "Validation failed: data/type must be equal to one of the allowed values"
}
[POST] Creating valid payment_mode (expecting 201)...
  Response Status: 201
  Created record: {
  "id": "ca82c73e-0eea-44b6-b202-b8b15b1cbd44",
  "master_type_id": "4124d28b-ecdd-4dcf-a017-a8f75e709de4",
  "code": "TUP509799",
  "name": "Test UPI 509799",
  "parent_value_id": null,
  "data": {
    "type": "UPI"
  },
  "active": true,
  "sort_order": 0,
  "updated_at": "2026-07-13T13:15:10.978Z"
}
[PUT] Editing lookup payment_mode (updating name/metadata)...
  Response Status: 200
  Edited name: Test UPI 509799 Updated
[DELETE] Deleting lookup payment_mode ID: ca82c73e-0eea-44b6-b202-b8b15b1cbd44...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "ca82c73e-0eea-44b6-b202-b8b15b1cbd44"
}

========================================
TESTING TIER-1 LOOKUP MASTER: CURRENCY
========================================
[GET] Fetching list for lookup currency...
  List count before: 0
[POST] Attempting invalid create for lookup currency (expecting 400)...
  Response Status: 400
  Ajv Error Response: {
  "error": "Validation failed: data/symbol must be string"
}
[POST] Creating valid currency (expecting 201)...
  Response Status: 201
  Created record: {
  "id": "4521d1f8-d634-4c9c-bc3d-abdb00cd3942",
  "master_type_id": "c48f6e07-af3e-488f-9df2-9dae7ae82bae",
  "code": "C799",
  "name": "C799",
  "parent_value_id": null,
  "data": {
    "symbol": "$"
  },
  "active": true,
  "sort_order": 0,
  "updated_at": "2026-07-13T13:15:11.054Z"
}
[PUT] Editing lookup currency (updating name/metadata)...
  Response Status: 200
  Edited name: C799 Updated
[DELETE] Deleting lookup currency ID: 4521d1f8-d634-4c9c-bc3d-abdb00cd3942...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "4521d1f8-d634-4c9c-bc3d-abdb00cd3942"
}

========================================
TESTING TIER-1 LOOKUP MASTER: EXPENSE_CATEGORY
========================================
[GET] Fetching list for lookup expense_category...
  List count before: 0
[POST] Attempting invalid create for lookup expense_category (expecting 400)...
  Response Status: 400
  Ajv Error Response: {
  "error": "Validation failed: data must NOT have additional properties"
}
[POST] Creating valid expense_category (expecting 201)...
  Response Status: 201
  Created record: {
  "id": "218b1b43-8419-4121-98bb-f7de37e50f8f",
  "master_type_id": "3ee2c28d-d7ed-4497-8fe3-903077ec0e14",
  "code": "TEC509799",
  "name": "Test Category 509799",
  "parent_value_id": null,
  "data": {},
  "active": true,
  "sort_order": 0,
  "updated_at": "2026-07-13T13:15:11.112Z"
}
[PUT] Editing lookup expense_category (updating name/metadata)...
  Response Status: 200
  Edited name: Test Category 509799 Updated
[DELETE] Deleting lookup expense_category ID: 218b1b43-8419-4121-98bb-f7de37e50f8f...
  Response Status: 200
  Delete response: {
  "success": true,
  "deletedId": "218b1b43-8419-4121-98bb-f7de37e50f8f"
}

All master framework tests completed successfully!
```

## 10. Known Limitations
- The current implementation assumes a single flat layer of properties inside the JSONB data column. Nested sub-objects are not fully editable through the flat dynamic form inputs.

## 11. Future Work
- Support for complex nested schemas (e.g. lists of contact objects) inside `data` structures.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
