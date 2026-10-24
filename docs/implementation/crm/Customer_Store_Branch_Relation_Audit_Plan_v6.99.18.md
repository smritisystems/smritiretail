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

# Customer Parent, Child, Store and Branch Relations — Audit and Plan

## 1. Objective
Establish a source-backed customer hierarchy and store-code architecture, fix the implemented UX/data wiring defects, and record remaining rollout work.

## 2. Status
Implemented in source and locally verified; no database migration was applied and no live data was written.

## 3. Evidence Scope
Reviewed CRM models, CRM service/API, Branch and Warehouse models, invoice references, PSV references, DataBridge GRN adapter, F2 master lookup, Customer Master and Customer 360 views, local migration head, existing architecture walkthroughs, and read-only local tenant aggregates.

## 4. Current Canonical Entities
- `Customer`: legal/trading account and billing party.
- `CustomerRelationship`: explicit parent/dependant customer-account relationship.
- `CustomerDeliveryLocation`: customer-owned external retailer site with internal UUID/ID, external store code, address and optional GST details.
- `Branch`: SMRITI seller/operating branch.
- `Warehouse`: SMRITI stock-holding/fulfillment node, optionally attached to a Branch.

## 5. Recommended Relationship Model
Reliance Retail Ltd is the parent Customer. Legal subsidiaries or separately billed entities are dependant Customers only when they are independently contracted/billed. Mumbai and Hyderabad are regions/reporting attributes. Store A–D are CustomerDeliveryLocations under the appropriate contracting customer. SMRITI Branch and Warehouse records remain separate operational entities.

## 6. Canonical Identity
Use immutable `CustomerDeliveryLocation.id` as the internal store identity and preserve the retailer's `store_code` as an external business identifier. Do not derive internal IDs from code, city, GSTIN or row position.

## 7. Store Code Ownership
The current service enforces active store-code exclusivity within a company and location records belong to a Customer. Keep assignment explicit; do not infer ownership from address text. The current DB index is per `(customer_id, store_code)`, which does not encode company scope or case/space normalization. A future migration should reconcile the actual company-wide service rule with a DB-enforced normalized uniqueness key before changing behavior.

## 8. Branch and Warehouse Semantics
A Branch is a SMRITI operating/selling unit; a Warehouse is an inventory node. One branch may have multiple warehouses. Store code must not be reused as `branch_id`, `warehouse_id`, SKU, GSTIN, or invoice identity. Maintain explicit mappings when an external customer site maps to an internal fulfillment node.

## 9. Billing and Delivery
Billing location and delivery location are separate concepts. Invoices retain location IDs where available and code/address snapshots for historical reporting. Do not rewrite historic snapshots when a customer changes a location code. Add explicit store-to-billing-location/default terms only where customer contracts require store-specific billing.

## 10. UX Defects Corrected
- Customer store modal now creates a persisted customer delivery location through the canonical CRM API instead of claiming to map an unowned code.
- Successful save refreshes canonical locations into the customer workspace.
- Customer hierarchy no longer fabricates child accounts from delivery addresses or invents store codes.
- Customer location/report filters use loaded child/location records instead of fixed sample codes.
- F2 Branch lookup uses the authenticated company database and returns no demo branches or invented city/state values.
- GRN import no longer aliases ambiguous `store_id`/`location_id` columns to internal `warehouse_id`.
- Store-code advisory lock failures now stop the write instead of silently proceeding without cross-request serialization.

## 11. Tenant Isolation
F2 branch lookup is company-scoped by validated `TenantContext.company_id` and excludes inactive/deleted branches. Delivery-location APIs continue to use `get_company_db` and CRM service tenant checks.

## 12. Historical Transactions
Sales invoice delivery code and address snapshots remain the historical source after location deactivation or code changes. Preserve internal location ID FK semantics and audit changes.

## 13. Imports
Importers must distinguish an internal `warehouse_id` from an external retailer store code. Explicitly map store code to a customer location and resolve warehouse separately; reject ambiguous column names rather than guessing.

## 14. Reporting
Central reporting should group transaction snapshots by company, parent/customer, region, store location ID/code and seller branch/warehouse as separate dimensions. This change does not add store-level report dimensions; current sales report coverage remains follow-up work.

## 15. Migration Plan
No schema change was required for the implemented UX fixes. Before adding normalized uniqueness or mandatory company ownership, audit all tenant databases, produce duplicate/null reports, define conflict resolution, and create a reversible additive Alembic migration. Do not apply it automatically to production.

## 16. Rollback Plan
Frontend changes can be reverted independently. Revert API lookup routing and importer alias changes only alongside their regression tests. If a future schema migration is introduced, include explicit downgrade behavior and backup/restore validation before production rollout.

## 17. Verification Plan
TypeScript validation and focused Customer 360 UI tests were run. Run backend CRM API/service tests and full build/test suites before release. No production database was changed.

## 18. Risks and Follow-up
The existing company-wide code ownership rule and customer-level database unique index are not fully aligned. Existing `company_id` nullability, branch global code uniqueness, per-store billing policy, and region dimension need a tenant-wide migration/reporting design. Local DB counts are environment-specific and are not a production census.

## 19. Related Walkthrough
[Customer Store and Branch Relation Audit Walkthrough](../../walkthrough/crm/Customer_Store_Branch_Relation_Audit_Walkthrough_v6.99.18.md)
