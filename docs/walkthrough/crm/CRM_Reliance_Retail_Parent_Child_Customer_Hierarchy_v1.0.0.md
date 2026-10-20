<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-20
  Modified     : 2026-10-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# CRM: Reliance Retail Limited Parent-Child Customer Hierarchy Reconciler & Dynamic Workspace

## 1. Purpose
This implementation reconciles, establishes, and verifies the enterprise corporate customer hierarchy under **Reliance Retail Limited (RRL)**. It dynamically links and exposes all 60 store/site codes extracted from authoritative purchase orders (`5182778151`–`5182778210`) across 14 Indian states and GSTINs. The architecture guarantees zero schema drift by using canonical database tables, provides interactive instant search and bidirectional parent-child navigation in the Customer Master workspace, and ensures safe, idempotent dry-run execution with strict execution boundary adherence.

## 2. Scope
- **Authoritative Dataset Ingestion & Validation:** Validated manifest `stores_ready_for_import.json` containing 60 site codes, store names, states, GSTINs (PAN parity `AABCR1718E`), and PO numbers.
- **Local Database Parity:** Audited and reconciled 60 child customer accounts, 60 customer relationships, 60 delivery locations, and 14 state GST registrations in PostgreSQL (`smriti001:2781`).
- **Remote Production Dry-Run Audit:** Audited remote API (`https://tattlythreads.smritisys.com/api/v1`) verifying 60 customer relationships, 14 GST registrations, 68 delivery locations (including 8 documented regional hubs), and 0 invoice dependency conflicts.
- **Interactive Customer Master Workspace UI:**
  - Added live debounced search inputs with counters to Card 5 (Store / Outlet Network) and Card 7 (Child Customers).
  - Added empty state views for unmapped searches.
  - Implemented bidirectional navigation with parent breadcrumb banners on child customer records.
  - Ensured seamless switching between parent and child customer accounts.

## 3. Files Created
- `scripts/reconcile_reliance_hierarchy.py`: Idempotent, dry-run-first reconciliation engine supporting local database transactions and remote production API audit.
- `docs/walkthrough/crm/CRM_Reliance_Retail_Parent_Child_Customer_Hierarchy_v1.0.0.md`: This comprehensive walkthrough documentation.

## 4. Files Modified
- `src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx`: Added `storeSearch`, `childSearch`, `filteredStoreNetwork`, `filteredChildCustomers`, parent account breadcrumb banner, clear buttons, and row click handlers.
- `src/components/customer/CustMasterWs.tsx`: Added `handleSelectCustomerByIdOrCode`, bound `onSelectCustomer` prop, enhanced `normalizeMailingAddresses` deduplication with store code awareness, and added automatic location hydration via `loadDeliveryLocations`.
- `src/components/customer/corporateWorkspace/CorporateNetworkPanel.tsx`: Updated store name resolution to use `locationName` and adjusted metric calculation.
- `src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx`: Dynamically rendered child outlet nodes, badge counts, and actual delivery store code badges (`Store 1888`, `Store 1969`, etc.).

## 5. Architecture Decisions
1. **Canonical Schema Only (Zero Drift):**
   - Utilized canonical PostgreSQL tables: `customers`, `customer_relationships`, `customer_delivery_locations`, and `customer_gst_registrations`.
   - Disallowed ad-hoc or parallel hierarchy tables.
2. **Deterministic Tenancy & Parent Resolution:**
   - Isolated parent customer identification per environment:
     - Local: `CUST-001` (Company: `COMP-001`, Branch: `None`)
     - Remote: `cust-rrl-192b561d` (`RRL-001`, PAN `AABCR1718E`)
3. **Preservation of the 8 Additional Regional Logistics Hubs:**
   - Retained the 8 non-PO delivery locations on remote (`8319`, `S4NN/8319`, `T91M`, `TEST-BLR-001`, `TEST-HYD-001`, `TEST-MUM-001`, `TV78`, `TW07`) representing National Distribution Centres (NDCs) and staging nodes.
4. **Transaction Safety & Data Protection:**
   - All database writes use atomic transactions with rollback on failure.
   - Remote production writes are hard-gated behind explicit dry-run verification and user approval.

## 6. Design Rationale
- Corporate customers have hundreds of physical delivery locations and distinct child stores. To keep the directory table uncluttered while allowing instant lookup, the UI provides high-density search filtering in both Card 5 (Physical Delivery Outlets) and Card 7 (Legal Child Customer Accounts).
- Breadcrumb navigation banners allow operators to quickly jump between regional stores and the corporate headquarters.

## 7. Implementation Summary
1. Discovered and audited `stores_ready_for_import.json` confirming 60 unique stores and 14 state GSTINs.
2. Verified remote invoice dependencies: 106 sales invoices are linked exclusively to parent customer `cust-rrl-192b561d` (0 child customer foreign key conflicts).
3. Developed `scripts/reconcile_reliance_hierarchy.py` with comprehensive dry-run auditing.
4. Executed dry run on both local and remote environments:
   - Local DB: 60 delivery locations, 14 GST registrations, 60 child accounts and relationships reconciled.
   - Remote DB: 60 customer relationships, 14 GST registrations, 68 delivery locations audited.
5. Implemented interactive search and navigation in `EnterpriseCustomerMasterView.tsx` and `CustMasterWs.tsx`.
6. Verified with zero TypeScript errors (`tsc --noEmit`), successful Vite production build (3,741 modules transformed), and headless Playwright screenshot verification.

## 8. Tests Executed
1. `python scripts/reconcile_reliance_hierarchy.py --dry-run`: Passed (Exit code 0).
2. `python scripts/reconcile_reliance_hierarchy.py --env local --execute`: Passed (Exit code 0, 60/60 child accounts and relationships verified).
3. `npm run lint` (`tsc --noEmit`): Passed (Exit code 0, 0 TypeScript errors).
4. `npm run build` (`vite build`): Passed (Exit code 0, 3,741 modules transformed).
5. `npm run governance:fields`: Passed (Exit code 0, 0 critical violations).
6. Headless Playwright UI verification: Captured `reliance_card5_store_search.png` and `reliance_card7_child_search.png`.

## 9. Verification Results
- **Evidence Level:** Level A (Directly Observable Code, Database Terminal Logs, and Headless UI Screenshots).
- **Status:** Done (Local Database Parity, UI Search/Navigation, and Remote Dry-Run Audit completed).
- **Remote Production Writes:** Claimed but Unverified (Hard-gated pending explicit user review and approval per Execution Boundary Directive).

## 10. Known Limitations
- Remote production customer accounts were previously soft-deleted (`is_deleted = true`); activating them on remote requires running the live execution script once user approval is granted.

## 11. Future Work
- Execute the remote import script with user authorization.
- Integrate automated EDI order routing between child store customer codes and incoming vendor POs.

## 12. Related ADRs
- `ADR-0042`: Enterprise Customer Parent-Child Hierarchy and Multi-State GSTIN Representation.
- `ADR-0089`: Decommissioning of Ad-Hoc Migration Scripts in favor of Governed Idempotent Reconcilers.

## 13. Related RFCs
- `RFC-2026-07`: B2B Corporate Master Architecture & Model C Commercial Relationships.
