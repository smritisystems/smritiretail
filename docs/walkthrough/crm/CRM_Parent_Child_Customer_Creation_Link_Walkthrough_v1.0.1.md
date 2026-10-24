# CRM Parent–Child Customer Creation Link Walkthrough v1.0.1

## 1. Purpose
Correct Customer Master so **Add Child Customer** creates a child account linked to its selected parent.

## 2. Scope
The flow passes the parent’s canonical internal customer ID, validates tenant scope, persists a Child relationship, and returns parent identity for the child record, Parent–Child section, and paginated Customer Directory.

## 3. Files Created
- `docs/implementation/crm/CRM_Parent_Child_Customer_Creation_Link_Plan_v1.0.1.md`
- This walkthrough.

## 4. Files Modified
- `CustMasterWs.tsx` captures the selected parent and clears it for ordinary customer creation.
- `CreateCustomerModal.tsx` displays parent context and includes the parent ID in the create request.
- `CrmService.create_customer` validates the parent and writes the customer and relationship atomically.
- CRM schemas and repository load and return parent details and child customer codes.
- Enterprise Customer Master displays returned child codes and avoids a fabricated parent name.
- `types.ts` and the Directory row display carry and show the parent customer identity.
- Regression tests cover child creation and reload, independent creation, edits, invalid tenant references, modal context, and Parent–Child display.

## 5. Architecture Decisions
Use the existing `customer_relationships` table and parent/child internal IDs. No parallel hierarchy model or migration was introduced.

## 6. Design Rationale
The Add Child action already identifies the parent in context. Carrying its persisted ID through the request avoids ambiguity from mutable customer codes or names.

## 7. Implementation Summary
The workspace passes selected parent metadata to the modal. The create endpoint receives `parent_customer_id`; the service checks the same company and branch and active account state. It marks the child as dependent and inserts a `relation="Child"` relationship before a single transaction commit. API response mapping supplies parent ID/name/code and dependant code for reload and navigation. Directory query results now include the child flag and parent identity. Editing a linked child cannot clear its dependent flag; the existing relationship endpoint applies the same role gate and branch-scoped cycle checks.

## 8. Tests Executed
1. `npm test -- src/tests/customerMasterLifecycle.test.tsx src/tests/enterpriseCustomerMasterView.test.tsx` — 35 passed.
2. `npm run lint` — passed (`tsc --noEmit`).
3. `.venv\Scripts\python.exe -m pytest backend/tests/test_customer_lifecycle_e2e.py::test_add_child_customer_persists_parent_and_directory_relationship -q` — 1 passed against the configured isolated test database.
4. `.venv\Scripts\python.exe -m pytest backend/tests/test_customer_master_ux_contract.py backend/tests/test_customer_lifecycle_security.py -q` — 10 passed.

## 9. Verification Results
**Status: Partially Verified.** Focused UI, TypeScript, backend contract/security, and database-backed integration checks passed. The integration test selected the persisted `CustomerRelationship`, reloaded the child response, verified the parent’s child-list response, and checked the paginated Directory parent fields. The test used configured isolated database `smriti_test_phase2c`; the remote production database and existing production accounts were not accessed.

## 10. Known Limitations
Existing standalone accounts created before this fix are not automatically attached to a parent. They require a separate, reviewed data correction. Remote production behavior has not been verified from this workspace.

## 11. Future Work
Consider a one-time audit for child accounts previously created as independent parent accounts; do not change existing production data without a reviewed reconciliation.

## 12. Related ADRs
Existing CRM customer hierarchy architecture; no new ADR.

## 13. Related RFCs
No related RFC identified.
