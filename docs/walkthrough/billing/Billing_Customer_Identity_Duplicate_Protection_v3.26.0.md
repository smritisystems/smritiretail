<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-09-04
  Modified     : 2026-09-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Walkthrough: Customer Identity & Duplicate Protection (Phase 2F)

## 1. Purpose
Establish a single authoritative Customer Identity and Duplicate Protection mechanism across Customer Master, Corporate B2B Billing, Customer APIs, imports, and ERP connectors, ensuring deterministic protection against accidental customer and customer location duplicates.

## 2. Scope
- Backend:
  - Database schema & unique constraints on Customer, CustomerDeliveryLocation, CustomerBillingLocation, CustomerExternalIdentity.
  - `CustomerIdentityService` authoritative duplicate engine enforcing deterministic rules (Customer ID, Customer Code, GSTIN, Store Code, External ERP Identity, Mobile, Email, Name).
  - CRM service & repository duplicate prevention and default location enforcement.
  - Sales service immutable invoice snapshotting of billing store codes and locations.
- Frontend:
  - `BillingTerm` Corporate B2B workspace integration preserving Single Workspace Principle.
  - `CustMasterWs` duplicate warnings and collision prevention.
- Automated Testing:
  - 35-test Phase 2F test matrix in `backend/tests/test_customer_identity_duplicate.py`.
  - Regression validation across existing B2B suites.

## 3. Files Created
- `backend/app/services/customer_identity.py`: Authoritative `CustomerIdentityService` engine.
- `backend/alembic/versions/v1397_customer_identity_duplicate_protection.py`: Canonical database migration.
- `backend/tests/test_customer_identity_duplicate.py`: 35-test Phase 2F verification suite.
- `docs/walkthrough/billing/Billing_Customer_Identity_Duplicate_Protection_v3.26.0.md`: This walkthrough.

## 4. Files Modified
- `backend/app/models/crm.py`: Added billing locations, external identities, and unique constraint indexes.
- `backend/app/models/sales.py`: Added `billing_location_id` and `billing_store_code` columns.
- `backend/app/schemas/crm.py`: Added DTOs for duplicate checks, billing locations, external identities.
- `backend/app/schemas/sales.py`: Added snapshot fields to invoice DTOs.
- `backend/app/repositories/customer.py`: Added billing location and external identity repositories.
- `backend/app/services/crm.py`: Wired duplicate checks on customer and location mutations.
- `backend/app/services/sales.py`: Added snapshot resolution on invoice creation.
- `backend/app/api/v1/crm.py`: Exposed duplicate check endpoint `/customers/check-duplicate`.
- `backend/tests/test_b2b_gst_delivery_api.py`: Updated mock fixtures for Phase 2F compatibility.
- `src/components/billing/BillingTerm.tsx`: Single workspace corporate B2B selector integration.
- `src/components/billing/types.ts`: Added B2B billing interfaces.
- `src/components/customer/CustMasterWs.tsx`: Added duplicate check warnings and error handlers.

## 5. Architecture Decisions
1. **Single Workspace Principle**: SMRITI maintains exactly one canonical `Customer` entity. No parallel `CorporateCustomer` or `B2BCustomer` tables.
2. **Deterministic Duplicate Rules**:
   - Customer ID: Global hard duplicate (HTTP 409).
   - Customer Code: Tenant-scoped hard duplicate (HTTP 409). Cross-company distinct accounts allowed.
   - Statutory GSTIN: Customer-scoped hard duplicate (HTTP 409). No two distinct customers may claim the same active GSTIN.
   - Delivery / Billing Store Code: Customer-scoped hard duplicate (HTTP 409). Different customers may share store codes.
   - External ERP Identity: Composite hard duplicate `(company_id, source_system, external_type, external_code)` (HTTP 409).
   - Secondary Signals (Mobile, Email, Name): `POSSIBLE_DUPLICATE` warning with `allow_override=True`.
3. **Immutable Snapshotting**: Historical invoices snapshot `customer_gstin`, `billed_party_gstin_id`, `delivery_location_id`, `delivery_store_code`, `billing_location_id`, `billing_store_code`, and `billing_address` at the moment of invoice generation.

## 6. Design Rationale
Statutory and commercial compliance requires that tax invoices never change their legal counterparty details even if a customer renames a branch, relocates a warehouse, or surrenders a GSTIN. Furthermore, ERP connectors (SAP, Oracle) and Excel imports must be protected against accidental duplicate customer generation while allowing intentional multiple stores on the same premises.

## 7. Implementation Summary
- Integrated `CustomerIdentityService` into `CrmService` lifecycle.
- Enforced unique partial active indexes in PostgreSQL schema:
  - `uq_customers_company_code_active`
  - `uq_cgr_company_gstin_active`
  - `uq_cdl_customer_store_code_active`
  - `uq_cbl_customer_store_code_active`
  - `uq_cust_ext_ident_composite`
- Added default flag exclusivity for both delivery and billing locations.
- Preserved 100% backward compatibility for all retail and POS transaction flows.

## 8. Tests Executed
- `python -m pytest backend/tests/test_customer_identity_duplicate.py -v` (35 tests passed)
- `python -m pytest tests/test_b2b_gst_delivery_api.py tests/test_b2b_sales_wiring.py -v` (63 tests passed)
- `npx tsc --noEmit` (0 errors)
- `npm run build` (Clean production build in 28.56s)

## 9. Verification Results
- 35/35 Phase 2F customer identity tests green.
- 63/63 Phase 2B regression tests green.
- 0 frontend TypeScript errors.
- 0 lint or compilation errors.

## 10. Known Limitations
- External ERP sync connectors (SAP, Oracle) require their respective middleware adapters to supply `sourceSystem` when pushing records.

## 11. Future Work
- Implementation of Phase 2G automated reconciliation dashboard for external ERP customer mapping.

## 12. Related ADRs
- `ADR-0042`: Single Customer Master Architecture
- `ADR-0043`: Corporate B2B GST and Delivery Location Decoupling
- `ADR-0044`: Statutory GSTIN and External ERP Identity Collision Prevention

## 13. Related RFCs
- `RFC-2026-07`: Central Customer Identity & Duplicate Protection Specification
