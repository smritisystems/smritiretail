<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-23
  Modified     : 2026-10-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Customer Store and Branch Relation Audit Walkthrough

## Purpose
Record the code audit and implemented fixes for Customer Parent/Child and retailer store relationships.

## Findings
Customer legal accounts (`Customer` and `CustomerRelationship`), external customer sites (`CustomerDeliveryLocation`), SMRITI operating branches (`Branch`) and inventory nodes (`Warehouse`) are separate canonical entities. Invoice delivery references preserve location identity and historical code/address snapshots. No general-purpose Store table is needed for the audited relationships.

The former Customer Store Code Lookup UX claimed to map codes but did not persist an assignment. The directory hierarchy also manufactured child accounts and store codes from delivery addresses. The universal Branch lookup queried the control database without company scope and inserted sample branch/city values when empty. GRN imports treated ambiguous `store_id` as a warehouse identifier.

## Changes
The Customer modal now creates a customer delivery location through `POST /crm/customers/{customer_id}/delivery-locations`, reports success only after the API returns, then reloads canonical locations. Customer hierarchy and filter views no longer manufacture child accounts or sample store choices from addresses. The F2 branch lookup uses `get_company_db`, validates company scope through `TenantContext`, filters inactive/deleted branches, and returns actual nullable geography. GRN header normalization no longer guesses that store/location identifiers are warehouse IDs. PostgreSQL advisory-lock errors during delivery-location create/update now abort the operation.

## Recommendation
Keep a single Customer as the parent legal account where stores are fulfillment destinations only. Create dependant Customer records only for separately contracted, billed, credited, or independently governed entities. Attach each external store/site to its owning Customer through `CustomerDeliveryLocation`; use an immutable internal ID and retain retailer store code as external identity. Model Mumbai/Hyderabad as region attributes. Keep SMRITI Branch and Warehouse IDs distinct and map explicitly where fulfillment requires it.

## Verification
`npm run lint` completed successfully (`tsc --noEmit`). `npx vitest run src/tests/corporateCustomer360.test.tsx` passed: 1 test file, 11 tests. No DB migrations or production writes were performed. TypeScript validation, focused frontend tests, backend Python compilation, and a production Vite build passed. The backend CRM test command could not be completed in this environment.

## Remaining Work
Reconcile service-level company-wide store-code exclusivity with the database's customer-level unique index; audit and migrate every tenant before enforcing normalized uniqueness or non-null company ownership. Add dedicated store-level sales report grouping/filter dimensions and tests. Confirm store-specific billing requirements and explicit customer-site-to-warehouse mappings with business owners.
