# CRM Parent–Child Customer Creation Link Plan v1.0.1

## 1. Objective
Ensure the Customer Master **Add Child Customer** action creates a child linked to the selected parent through the canonical customer relationship table.

## 2. Business Motivation
Operators expect child accounts created from a parent account to remain in that parent’s hierarchy. Standalone accounts break billing visibility, navigation, and account ownership workflows.

## 3. Scope
Carry the parent’s internal customer ID from the workspace into create-customer, validate tenant ownership, persist a `CustomerRelationship`, and expose the relationship in customer responses, the Parent–Child section, and the paginated Customer Directory after reload.

## 4. Current State
The Add Child action opened the generic create dialog without parent context. Generic creation produced an independent account. The relationship table and relationship endpoints already existed.

## 5. Gap Analysis
The dialog did not provide `parent_customer_id`; the create service did not create a relationship; child response data omitted parent identity and child code; the child banner used a hardcoded parent name fallback.

## 6. Architecture Impact
No new tables or migrations. The change uses `customers`, `customer_relationships`, the existing CRM create endpoint, repository relationship loading, and the current Customer Master modal.

## 7. Proposed Design
Pass `{id, code, name}` from the selected persisted parent. Send the internal ID as `parent_customer_id`. Validate the parent is active, undeleted, and within the active company and branch. Create the customer and Child relationship in one transaction. Return parent metadata and child code for the existing UI.

## 8. Files Created
- `docs/implementation/crm/CRM_Parent_Child_Customer_Creation_Link_Plan_v1.0.1.md`
- `docs/walkthrough/crm/CRM_Parent_Child_Customer_Creation_Link_Walkthrough_v1.0.1.md`

## 9. Files Modified
- `src/components/customer/CustMasterWs.tsx`
- `src/components/customer/types.ts`
- `src/components/customer/lifecycle/CreateCustomerModal.tsx`
- `src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx`
- `backend/app/schemas/crm.py`
- `backend/app/services/crm.py`
- `backend/app/repositories/customer.py`
- `backend/app/api/v1/crm.py`
- `backend/tests/test_customer_lifecycle_e2e.py`
- `src/tests/customerMasterLifecycle.test.tsx`
- `src/tests/enterpriseCustomerMasterView.test.tsx`
- Documentation indexes, ledgers, user guide, developer guide, troubleshooting guide, and changelog.

## 10. Dependencies
Existing SQLAlchemy `CustomerRelationship` model/table, tenant context, and customer internal identity allocation.

## 11. Risks
Parent IDs from a different company or branch must be rejected. Child creation must remain atomic so an error cannot leave a child without its relationship or vice versa. API response aliasing must remain compatible with camelCase and snake_case consumers.

## 12. Rollback Strategy
Revert the source changes. No schema rollback is needed. Existing customer and relationship rows remain untouched by code rollback.

## 13. Verification Plan
Run focused frontend Customer Master tests, TypeScript validation, backend CRM schema/security tests, and a database-backed creation test asserting the stored relationship and reloaded Parent–Child and Directory responses. Production remote data must not be modified during verification.

## 14. Security and Tenant Isolation
Resolve the parent by internal ID and require matching company and branch, active status, and non-deleted state before creating anything.

## 15. Data Integrity
Use the existing relationship table and canonical customer primary key. Persist the customer and relationship in the same transaction; rely on existing constraints for referential integrity.

## 16. API and Compatibility
Extend customer create input with optional `parentCustomerId`, customer responses with parent identity, relationship responses with dependant customer code, and directory responses with parent identity. Standalone create remains supported when no parent is supplied. Keep the existing creation role gate and apply it to the standalone dependant-link route.

## 17. Status
Implemented and partially verified: 35 focused frontend tests, 10 backend contract/security tests, and 1 database-backed integration test passed. `npm run lint` passed. The integration test verified `customer_relationships` persistence and retrieved the parent link and directory fields from the configured isolated test database. The remote production customer record was not inspected or modified.

## 18. Related ADRs
Existing customer parent-child hierarchy architecture and `CustomerRelationship` data model; no new ADR introduced.

## 19. Related Walkthroughs
- [Customer parent-child creation link walkthrough](../../walkthrough/crm/CRM_Parent_Child_Customer_Creation_Link_Walkthrough_v1.0.1.md)
