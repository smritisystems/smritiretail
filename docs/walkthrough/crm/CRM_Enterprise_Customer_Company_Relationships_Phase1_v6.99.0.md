<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Enterprise Customer Master Architecture Walkthrough
-->

# Walkthrough — Enterprise Customer Identity & Company Relationships (Model C — Phase 1)

**Document ID:** WGP-CRM-002  
**Version:** 6.99.0  
**Date:** 2026-10-19  
**Area:** CRM / Customer Master & Multi-Company Commercial Infrastructure  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal — Production Engineering Walkthrough  
**Status:** Completed & Certified  

---

## 1. Purpose

This document provides the authoritative engineering walkthrough for **Phase 1 of the Enterprise Customer Architecture Decisions & Revised Implementation Plan** (`docs/architecture/SMRITI_ENTERPRISE_CUSTOMER_DECISIONS_AND_REVISED_PLAN.md`).

Phase 1 establishes **Tenant-Level Customer Identity with Company-Specific Commercial Relationships (Model C)**. The customer master record represents the sovereign legal person / commercial enterprise across the group, while legal-entity-specific commercial terms (credit limit, payment terms, credit hold, price tier, customer group) are cleanly segregated in the new junction entity `customer_company_relationships`.

---

## 2. Scope

- **Alembic Database Migration `v1540`:** Creation of `customer_company_relationships` table in PostgreSQL tenant database `smriti001` with full `BaseEntity` audit columns, UUIDs, foreign keys, and indexes.
- **Idempotent Relationship Backfill:** Automated 1:1 backfill of active customers into `customer_company_relationships` inheriting default terms from `customer_groups` with zero active customer variance.
- **Backend ORM & Schema Models:** Definition of `CustomerCompanyRelationship` in `backend/app/models/crm.py` and `backend/app/schemas/crm.py`.
- **Cross-Company CustomerGroup Guard (Blocker 4 / BD-1):** Enforced application-level validation in `CrmService._validate_customer_group_company` asserting that assigned customer groups strictly belong to the same operating legal entity (`company_id`).
- **RESTful Endpoints:** Mounted `/customers/{customer_id}/company-relationships` (list, create, update) in `backend/app/api/v1/crm.py` guarded by role-based access control.
- **Architecture Duplication CI Gate Conformance:** Zero unapproved duplications across all 11 architecture gate checks.

---

## 3. Files Created

1. `backend/alembic/versions/v1540_customer_company_relationships.py` — Database migration creating table and executing idempotent backfill.
2. `backend/tests/test_customer_company_relationships.py` — Pytest unit test suite verifying schema validation, ORM structure, and the cross-company customer group guard.
3. `docs/walkthrough/crm/CRM_Enterprise_Customer_Company_Relationships_Phase1_v6.99.0.md` — This official WGP walkthrough document.

---

## 4. Files Modified

1. `backend/app/models/crm.py` — Added `CustomerCompanyRelationship` class, `CustomerGroup.company_relationships`, and `Customer.company_relationships`.
2. `backend/app/models/__init__.py` — Exported `CustomerCompanyRelationship`.
3. `backend/app/schemas/crm.py` — Added `CustomerCompanyRelationshipBase`, `CustomerCompanyRelationshipCreate`, `CustomerCompanyRelationshipUpdate`, `CustomerCompanyRelationshipResponse`.
4. `backend/app/services/crm.py` — Added `_validate_customer_group_company`, `create_company_relationship`, `update_company_relationship`, `list_company_relationships`, and `get_company_relationship`.
5. `backend/app/api/v1/crm.py` — Mounted `GET`, `POST`, and `PUT` endpoints under `/customers/{customer_id}/company-relationships`.
6. `docs/walkthrough/README.md` — Appended chronological master index entry.

---

## 5. Architecture Decisions

- **ADR-CRM-001 (Approved):** Tenant-Level Customer Identity with Company-Specific Commercial Relationships (Model C).
- **BD-1 (Identity Scope):** Customer master row represents the legal person. Company-specific commercial parameters reside in `customer_company_relationships`.
- **BD-2 (B2B Anchor):** Verified PAN is the primary business anchor for B2B corporate master records.
- **BD-4 (Cross-Company Guard):** CustomerGroup assignment is strictly scoped to the same `company_id` to prevent cross-company commercial/pricing contamination.

---

## 6. Design Rationale

1. **Non-Breaking Phase 1 Rollout:** `customers.company_id` is kept intact and `NOT NULL` in Phase 1. Existing POS, Billing Studio, and reporting queries continue executing without modification.
2. **Deterministic UUIDv7 / MD5 ID Generation:** Backfilled relationship IDs are deterministically seeded as `'ccr-' || substr(md5(c.id || '-' || c.company_id), 1, 16)`, ensuring perfect idempotency on repeated runs (`ON CONFLICT (customer_id, company_id) DO UPDATE`).
3. **Application Guard for Entity Integrity:** Because customer groups carry company-specific pricing policies and credit terms, assigning a customer group belonging to Company A to a relationship for Company B causes legal entity contamination. `_validate_customer_group_company` strictly blocks this with HTTP 422.

---

## 7. Implementation Summary

### DDL Specification (`v1540_customer_company_relationships.py`)
```sql
CREATE TABLE customer_company_relationships (
    id VARCHAR(50) PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_group_id VARCHAR(50) REFERENCES customer_groups(id) ON DELETE RESTRICT,
    price_tier_id VARCHAR(50),
    credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    credit_days INTEGER NOT NULL DEFAULT 0,
    credit_hold BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(100),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    CONSTRAINT uq_ccr_customer_company UNIQUE (customer_id, company_id)
);
```

---

## 8. Tests Executed

### A. Python Unit Tests (`backend/tests/test_customer_company_relationships.py`)
```powershell
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/tests/test_customer_company_relationships.py -v
```
Output:
```text
backend\tests\test_customer_company_relationships.py::test_customer_company_relationship_schema_validation PASSED [ 25%]
backend\tests\test_customer_company_relationships.py::test_customer_company_relationship_model_structure PASSED [ 50%]
backend\tests\test_customer_company_relationships.py::test_cross_company_customer_group_guard PASSED [ 75%]
backend\tests\test_customer_company_relationships.py::test_matching_company_customer_group_passes_guard PASSED [100%]

============================== 4 passed in 5.04s ==============================
```

### B. Frontend Vitest Customer Suites
```powershell
npx vitest run src/tests/customerMasterLifecycle.test.tsx src/tests/corporateCustomerWorkspace.test.tsx
```
Output:
```text
 ✓ src/tests/customerMasterLifecycle.test.tsx (9 tests) 47ms
 ✓ src/tests/corporateCustomerWorkspace.test.tsx (8 tests) 73ms

 Test Files  2 passed (2)
      Tests  17 passed (17)
```

---

## 9. Verification Results

1. **Alembic Migration Lineage:** Verified revision `v1540` stamped in `alembic_version` on `smriti001`.
2. **Column/AST Parity (Rule 12):** Column-by-column inspection verified all 20 columns, datatypes, defaults, nullability, 7 constraints, and 4 foreign keys matching the canonical contract.
3. **Data Integrity Variance Check:**
   - Active Customers: 879
   - Active Relationships: 879
   - **Variance: 0**
4. **Architecture Duplication Gate:** All 11 checks executed, 0 P0/P1 violations, Gate Status: PASSED.
5. **Static Analysis & Typecheck:** `npm run validate-registry` PASSED (106/106), `tsc --noEmit` exit 0 (0 errors).

---

## 10. Known Limitations

- **Phase 1 Additive State:** `customers.company_id` remains `NOT NULL` in Phase 1 to guarantee backward compatibility with existing POS and single-store billing queries.
- **Sub-Tables:** `customer_gst_registrations` and `customer_delivery_locations` still require `company_id NOT NULL` until Phase 2 relaxation.

---

## 11. Future Work

- **Phase 2:** Relax `company_id` to nullable on `customer_gst_registrations`, `customer_delivery_locations`, and `customer_billing_locations`.
- **Phase 3:** Relax `customers.company_id` to nullable once multi-company UI workflows are fully deployed.
- **Enterprise Group Dashboard:** Multi-company customer exposure analytics aggregating credit limits across legal entities.

---

## 12. Related ADRs

- `docs/architecture/SMRITI_ENTERPRISE_CUSTOMER_DECISIONS_AND_REVISED_PLAN.md` (ARCH-CRM-001-PLAN)
- `docs/architecture/SMRITI_ENTERPRISE_CUSTOMER_ARCHITECTURE_DISCOVERY.md` (ARCH-CRM-001)
- `docs/architecture/SMRITI_ENTERPRISE_CUSTOMER_ARCHITECTURE_VALIDATION.md` (ARCH-CRM-001-VAL)
- Control Plane ADR `ADR-CRM-001` (Enterprise Customer Master Workspace Transformation & Lifecycle Safety Subsystem)

---

## 13. Related RFCs

- RFC-CRM-2026-001: Multi-Company Commercial Relationship Segregation.
- RFC-TAX-2026-004: Indian GST Section 25 Distinct Persons & Inter-Company Return Constraints.
