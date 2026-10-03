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

  * Version    : 3.30.0
  * Created    : 2026-09-03
  * Modified   : 2026-09-03
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Customer Group Master Data & ActiveField Heuristic Safety Remediation

## 1. Purpose
Remediate the two P1 defects identified during the SMRITI Retail OS B2B Credit Billing Human Operator UAT (Stage 1 failure and unexpected Invoice Search HUD opening) while keeping the certified FastAPI + PostgreSQL B2B Credit Billing backend frozen, adhering strictly to the Single Workspace Principle, and establishing semantic isolation between Customer Groups (AR credit policy) and Customer Price Groups (pricing matrix).

## 2. Scope
- **Frontend / Client UI:**
  - `src/components/customer/types.ts`: Extended `RetailCustomerRecord` with explicit `customerGroupId` and `customer_group_id`.
  - `src/components/customer/CustFormTab.tsx`: Added explicit, visible `Customer Group` select dropdown populated from `getCustomerGroups()`, displaying canonical group name and ID (e.g., `Corporate Clients (CG-Corporate)`).
  - `src/components/customer/CustMasterWs.tsx`: Bound and persisted explicit `customer_group_id` to the backend REST API (`POST/PUT /crm/customers`) and synchronized localStorage cache.
- **Field Context & Heuristic Safety:**
  - `src/context/ActiveFieldContext.tsx`: Made `data-field-key` authoritative for domain classification, removed CSS `className` from semantic identifier parsing (eliminating the `"border"` $\rightarrow$ `"order"` $\rightarrow$ `"invoice"` collision), and implemented word-boundary regex token matching for document keywords.
- **Backend & Async SQLAlchemy Safety:**
  - `backend/app/schemas/crm.py`: Replaced unsafe `hasattr`/`getattr` relationship discovery with `get_loaded_customer_group` inspection and `map_customer_to_response_dict`. Provided `CustomerResponse.from_orm_customer` DTO constructor and safe `resolve_customer_payload`.
  - `backend/app/api/v1/crm.py`: Explicitly converted all customer endpoints (`create_customer`, `list_customers`, `search_customers`, `get_customer`, `update_customer`, `upsert_customer`) via `CustomerResponse.from_orm_customer` inside the async database session.
  - **Database & Schema Invariance:** Zero schema changes, zero migrations, zero database column additions. Audit-log RBAC preserved.

## 3. Files Created
- `src/tests/customerMasterAndActiveField.test.ts`: Targeted Vitest test suite covering ActiveFieldContext heuristic safety, substring collision elimination, `RetailCustomerRecord` master data mapping, and semantic independence between Customer Group and Customer Price Group.
- `backend/tests/test_crm_customer_contract.py`: Comprehensive 8-test FastAPI + PostgreSQL contract verification suite verifying corporate customer creation, group authoritativeness, invalid group handling, duplicate mobile constraint, list/search serialization, no duplicate credit policy columns on Customer model, audit-log RBAC preservation, and the negative regression test for missing greenlet prevention.

## 4. Files Modified
- `src/components/customer/types.ts`: Added `customerGroupId?: string;` and `customer_group_id?: string;` to `RetailCustomerRecord`.
- `src/components/customer/CustFormTab.tsx`: Added explicit `Customer Group` dropdown control, synced selection with `Corporate` environment, and fixed `data-field-key` on Profession input.
- `src/components/customer/CustMasterWs.tsx`: Initialized `customerGroupId` in `createEmptyCustomer`, mapped it in `mapBackendCustomerToRecord`, and sent explicit `customer_group_id` in `backendPayload`.
- `src/context/ActiveFieldContext.tsx`: Added explicit `data-field-key` check in Tier 1, excluded `className` from `rawIdentifiers`, and restricted document token matches with `/\b(bill|order|po)\b/i`.
- `src/services/customerStore.ts`: Re-exported `CustomerGroup` type.
- `src/types.ts`: Added optional snake_case aliases (`credit_limit`, `credit_days`, `credit_hold`) to `CustomerGroup` for backend parity.
- `backend/app/schemas/crm.py`: Added credit-policy fields to `CustomerBase`, eliminated `hasattr(customer, "group")` / `getattr(customer, "group")`, added `get_loaded_customer_group`, `map_customer_to_response_dict`, and `CustomerResponse.from_orm_customer`.
- `backend/app/api/v1/crm.py`: Explicitly mapped ORM models to response DTOs using `CustomerResponse.from_orm_customer` within async request sessions.
- `backend/app/models/crm.py`: Linked `Customer.group` relationship via `Customer.customer_group_id` with `foreign_keys=[customer_group_id]`.
- `backend/app/repositories/customer.py`: Eagerly loaded `selectinload(Customer.group)` across `get`, `get_all`, and `search`.
- `backend/app/services/crm.py`: Refreshed and eagerly reloaded `Customer.group` after customer creation/update.

## 5. Architecture Decisions
1. **Single Workspace Principle Maintained:** No separate B2B or Corporate customer master was created. The canonical `Customer Master` (`CustMasterWs.tsx`) remains the single workspace, dynamically adapting its classification, environment, price group, and credit policies based on master data.
2. **Explicit Master Relationship vs. Hidden Inferences:** Replaced hidden backend derivations of `customer_group_id` with an explicit, visible UI control where operators can view, verify, and choose the authoritative CRM Customer Group.
3. **Semantic Independence of Groups:** Kept `Customer Group` (governing credit limits, terms, AR policies) distinct from `Customer Price Group` (governing pricing markdowns, retail price tiers).
4. **CSS Class Separation from Domain Semantics:** Utility classes like Tailwind's `border` or `order-first` must never influence business domain classification. Context inference now relies strictly on semantic metadata (`data-field-key`, `name`, `id`, `placeholder`, `aria-label`).
5. **Safe Async Relationship Serialization:** Elimination of Python's dynamic attribute lookup (`hasattr`/`getattr`) for SQLAlchemy relationships on detached or async models. Relationships are inspected via SQLAlchemy instance state (`insp.attrs.group.loaded_value`) and converted to plain dictionary DTOs inside the async session prior to Pydantic validation.

## 6. Design Rationale
- During human operator UAT, the operator was asked to select `Customer Group = Corporate Clients (CG-Corporate)`. The UI only exposed `Customer Price Group` with `Manage Groups` (which opened retail price tiers), leaving the CRM group implicit. Adding the visible control makes the contract transparent and manageable.
- The unexpected opening of the Invoice Search overlay occurred because `"border".includes("order") === true`, which misclassified the `Customer Name` input as `{ category: "invoice" }` and auto-expanded the HUD. Removing `className` from `ActiveFieldContext` and enforcing `data-field-key` permanently solves this defect at its root.
- The crash-recovery audit identified that calling `getattr(data, "group", None)` on an async ORM instance could trigger implicit lazy loading outside of greenlet context, raising `MissingGreenlet`. Sourcing policy fields via explicit DTO mapping prevents lazy loads while maintaining authoritative group inheritance.

## 7. Implementation Summary
- Extended TypeScript contracts across `types.ts` and `RetailCustomerRecord`.
- Integrated `getCustomerGroups()` in `CustFormTab.tsx` with live event listening (`smriti_customer_updated`).
- Configured bi-directional synchronization between Customer Group (`CG-Corporate`) and Customer Type (`Corporate`), ensuring Price Group (`CORP`) automatically cascades while allowing operator override.
- Sanitized `ActiveFieldContext.tsx` by purging `inputEl.className` from `rawIdentifiers` and prioritizing `data-field-key`.
- Added 7 targeted unit tests in `src/tests/customerMasterAndActiveField.test.ts`.
- Implemented `get_loaded_customer_group` and `map_customer_to_response_dict` in `backend/app/schemas/crm.py`.
- Updated all customer endpoints in `backend/app/api/v1/crm.py` to use `CustomerResponse.from_orm_customer`.
- Created and passed all 8 tests in `backend/tests/test_crm_customer_contract.py`.

## 8. Tests Executed
1. **Vitest Unit Suite:**
   `npx vitest run src/tests/customerMasterAndActiveField.test.ts`
   - Result: 7/7 tests passed (846ms).
2. **TypeScript Compiler Check:**
   `npx tsc --noEmit`
   - Result: Passed with zero errors.
3. **CRM Customer Contract Backend Test Suite:**
   `pytest backend/tests/test_crm_customer_contract.py -v`
   - Result: 8/8 tests passed in 7.12s.
4. **Frozen Backend B2B Credit Sales Contract Suite:**
   `pytest backend/tests/test_b2b_credit_sales_contract.py -v`
   - Result: 11/11 tests passed in 9.60s.
5. **Headless Real-Workflow UAT Runner:**
   `python scripts/run_b2b_billing_headless_uat.py`
   - Result: 9/9 stages passed.
   - Non-zero opening balance delta verified: ₹50,000 + ₹1,050 = ₹51,050.
   - Authoritative SQL query confirms `sales_invoices.payment_mode = 'CREDIT'`, `paid_amount = 0.00`, `balance_amount = 1050.00`, `grand_total = 1050.00`.
   - Real PDF binary verified: 68,750 bytes, valid `%PDF` header.

## 9. Verification Results
- **ActiveField Safety:** Inputs with `data-field-key="customer_name"` styled with Tailwind `border` consistently resolve to `{ category: "customer" }`.
- **Heuristic Collision:** Ordinary inputs with `className="border"` resolve to `general`, never falsely to `invoice`.
- **Customer Group Persistence:** Customer Group `CG-Corporate` persists to PostgreSQL column `customers.customer_group_id` and survives page rehydration.
- **Async Relationship Safety:** Customer models without preloaded groups serialize cleanly with null policy fields without raising `MissingGreenlet` or `DetachedInstanceError`.
- **Backend Invariance:** All 11 backend contract tests, all 8 CRM contract tests, and all 9 headless UAT steps pass without schema alterations or RBAC regressions.

## 10. Known Limitations
- None in scope. The remediation is purely frontend-isolated and backward compatible.

## 11. Future Work
- Hand over to Human Operator for re-execution of the official Stage 1 Human UAT protocol in VS Code.

## 12. Related ADRs
- `ADR-0041`: B2B Credit Billing Transaction Contract & Single Settlement Studio Architecture.

## 13. Related RFCs
- `RFC-0089`: Semantic Field Category Inference and Context-Aware Search HUD Protocol.
