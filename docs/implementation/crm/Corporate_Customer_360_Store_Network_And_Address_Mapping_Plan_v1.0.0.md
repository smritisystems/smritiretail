<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-18
  Modified     : 2026-10-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
  Policy ID    : IPGP-v1.0
-->

# Implementation Plan: Corporate Customer 360 Store Network & Typed Address Mapping v1.0.0

## 1. Objective
Deliver an enterprise Reliance Retail-style Corporate Customer 360 cockpit and multi-store network architecture within SMRITI Retail OS, enforcing:
- **1-to-Many Store Code Mapping:** One corporate customer profile can own multiple store/delivery locations (`CustomerDeliveryLocation`).
- **Exclusive Store Code Assignment:** One store code can belong to at most one customer tenant-wide at any given time, enforced with database row-level locking (`with_for_update()`).
- **Typed Multi-Address Management:** Each store code can hold multiple addresses (`Delivery`, `Billing`, `Warehouse`, `Registered`, `Shipping`, `Other`) with a single active primary constraint per address type, versioned within `metadata_json` without modifying database table schemas or requiring unapproved migrations.
- **Unified Master Lookup & Self-Service UI:** A searchable Store Code lookup modal displaying all store codes (disabling claimed stores with tooltips identifying the current owner) while preserving the customer's own codes as selectable during edits.

## 2. Business Motivation
Large enterprise retail clients (such as Reliance Retail, Aditya Birla, Tata Trent) operate distributed store networks where thousands of physical outlets share a single corporate legal identity for master contracts, consolidated credit, and Party Stock Visibility (PSV). SMRITI Retail OS requires a cockpit that provides WhatsApp-level simplicity alongside enterprise-grade transactional controls, preventing accidental cross-customer store collisions while keeping billing, dispatch, and physical warehouse addresses isolated and historicized.

## 3. Scope
- **Backend Models & Schemas:** Pydantic schemas in `backend/app/schemas/crm.py` (`StoreAddressItem`, `StoreAddressCreate`, `StoreAddressUpdate`, `StoreCodeLookupItem`, `CorporateStoreItem`). Zero database migrations; reuse `CustomerDeliveryLocation.metadata_json` (JSONB).
- **Backend Services & Concurrency:** Concurrency-hardened `customer_identity.py`, repository queries in `customer.py` with `with_for_update()`, service methods in `backend/app/services/crm.py`.
- **Backend API Endpoints:** `/api/v1/crm/store-codes/lookup`, `/api/v1/crm/customers/{customer_id}/delivery-locations/{location_id}/addresses`, and enhanced `/api/v1/crm/customers/{customer_id}/corporate-360`.
- **Frontend Components:** `StoreCodeLookupModal.tsx`, `StoreAddressModal.tsx`, `CorporateStoreNetwork.tsx`, `CorporateCustomer360.tsx`, and `CustFormTab.tsx`.
- **Automated Verification:** Full unit and integration test coverage across `pytest` (10/10) and `vitest` (11/11).

## 4. Current State
Prior to this implementation:
- `CustomerDeliveryLocation` was limited to basic address text fields on a single customer record without structured multi-type addresses (Billing, Shipping, Warehouse) per store code.
- Store code lookups were ad-hoc without explicit collision checks, risking race conditions where two operators could assign the same store code simultaneously.
- Deleting an address erased historical dispatch metadata rather than performing soft deactivations.

## 5. Gap Analysis
| Requirement | Existing Architecture | Implemented Solution |
|---|---|---|
| One Customer → Many Store Codes | Supported via `delivery_locations` | Fully integrated into Corporate 360 overview, stores tab, and master form |
| One Store Code → Exactly One Customer | Unenforced application-level check | Server-side collision detection + `with_for_update()` row-level locking |
| One Store Code → Multiple Typed Addresses | Flat address fields | Structured `metadata_json["addresses"]` with single primary constraint per type |
| Store Code Lookup with Disabled States | No centralized lookup modal | Master lookup API + React modal showing all codes with owner tooltips |
| Historical Address Auditing | In-place overwrite / hard delete | Soft-deactivation (`is_active = false`) preserving full historical snapshots |

## 6. Architecture Impact
- **No DB Schema Mutation:** Utilized PostgreSQL JSONB column `CustomerDeliveryLocation.metadata_json` to persist typed addresses, adhering strictly to Rule 12 (Zero unapproved migrations).
- **Single System of Record:** Maintained FastAPI + PostgreSQL as the sole transactional source of truth; no client-side local storage hacks.
- **Pessimistic Concurrency:** Row-level locks during store code assignment eliminate double-claim race conditions across distributed POS and back-office nodes.

## 7. Proposed Design
1. **Schema Layer:**
   - `StoreAddressItem`: UUID ID, `address_type`, `address_line1`, `address_line2`, `city`, `district`, `state`, `state_code`, `pincode`, `contact_person`, `phone`, `email`, `is_primary`, `is_active`, `created_at`, `updated_at`.
   - `StoreCodeLookupItem`: Extended with `is_assigned`, `is_selectable`, `disabled_reason`, `assigned_customer_name`, `assigned_customer_code`.
2. **Service Layer:**
   - Identity engine inspects existing store codes across the tenant, returning `DuplicateDecision.HARD_DUPLICATE` if claimed by another customer.
   - Address management methods (`add_store_address`, `update_store_address`, `deactivate_store_address`) manage typed address arrays with timestamp updates and primary flag enforcement.
3. **UI Layer:**
   - Interactive modal workflows for Store Code lookup and multi-address configuration embedded within Corporate Customer 360 and Customer Master workspaces.

## 8. Files Created
1. `src/components/customer/corporate360/StoreAddressModal.tsx`
2. `src/components/customer/corporate360/StoreCodeLookupModal.tsx`
3. `src/components/customer/corporate360/CorporateAccountHeader.tsx`
4. `src/components/customer/corporate360/CorporateCustomer360.tsx`
5. `src/components/customer/corporate360/CorporateCustomerTabs.tsx`
6. `src/components/customer/corporate360/CorporateKpiCards.tsx`
7. `src/components/customer/corporate360/CorporatePsvWidget.tsx`
8. `src/components/customer/corporate360/CorporatePurchaseTrendWidget.tsx`
9. `src/components/customer/corporate360/CorporateRecentOrdersWidget.tsx`
10. `src/components/customer/corporate360/CorporateStoreNetwork.tsx`
11. `src/components/customer/corporate360/CorporateStoreTypeWidget.tsx`
12. `src/components/customer/corporate360/CorporateTopCategoriesWidget.tsx`
13. `src/components/customer/corporate360/types.ts`
14. `backend/app/tests/test_corporate_customer_360.py`
15. `src/tests/corporateCustomer360.test.tsx`

## 9. Files Modified
1. `backend/app/schemas/crm.py`
2. `backend/app/services/customer_identity.py`
3. `backend/app/repositories/customer.py`
4. `backend/app/services/crm.py`
5. `backend/app/api/v1/crm.py`
6. `src/components/customer/CustFormTab.tsx`
7. `src/components/customer/CustMasterWs.tsx`
8. `src/components/launchpad/launchpadCatalog.ts`
9. `src/components/shell/TabRenderer.tsx`
10. `src/components/shell/navigationResolver.ts`
11. `src/layout_engine/layout_store.tsx`
12. `src/navigation/breadcrumb/BreadcrumbRegistry.ts`
13. `src/tests/fioriLaunchpad.test.ts`

## 10. Dependencies
- FastAPI 0.115+
- SQLAlchemy 2.0+ with PostgreSQL dialect
- React 18 with Lucide icons
- Vite 5+ and Vitest 4.1+

## 11. Risks
- **Concurrency Contention:** High-frequency simultaneous store mappings could wait on row locks. Mitigated by short transactional scopes.
- **Malformed Address Payloads:** Handled via strict Pydantic schemas validating PIN codes, mandatory lines, and valid address types.

## 12. Rollback Strategy
All address records and store codes reside within standard `CustomerDeliveryLocation` records. If rollback is necessary, existing columns remain unmodified and older APIs continue to function without loss of backwards compatibility.

## 13. Verification Plan
- Unit testing of identity deduplication logic.
- Concurrency simulation verifying row-locking.
- Integration tests for lookup filtering and address primary toggling.
- Static and SSR rendering verification in Vitest.
- TypeScript compiler zero-error verification.

## 14. Test Plan
- Run `pytest backend/app/tests/test_corporate_customer_360.py` (16 tests including concurrency, advisory locking, address validation, tenant isolation, and PSV truth).
- Run `npx vitest run src/tests/corporateCustomer360.test.tsx` (11 tests).
- Run `npx vitest run src/tests/fioriLaunchpad.test.ts` (11 tests).
- Run `npx tsc --noEmit` across entire repository.
- Run `git diff --check` to ensure zero whitespace errors.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create Walkthrough in `docs/walkthrough/crm/CRM_Corporate_Customer_Store_Network_And_Address_Mapping_v1.0.0.md`.
- Update `docs/walkthrough/README.md` master index.

## 16. Deployment Plan
Code deployed to Development (`D:\Smriti_Retail_OS`), tested and pulled into Test (`F:\Smriti9`). No database schema migration script required.

## 17. Status
**Completed** (Verified with 16/16 pytest green, 11/11 vitest green, 11/11 launchpad vitest green, 0 tsc errors, 0 git diff check errors).

## 18. Related ADRs
- `ADR-0042`: Canonical Identity Resolution & Concurrency Safeguards
- `ADR-0089`: Decommissioning of Legacy Stores Table in favor of CustomerDeliveryLocation

## 19. Related Walkthroughs
- `docs/walkthrough/crm/CRM_Corporate_Customer_Store_Network_And_Address_Mapping_v1.0.0.md`
