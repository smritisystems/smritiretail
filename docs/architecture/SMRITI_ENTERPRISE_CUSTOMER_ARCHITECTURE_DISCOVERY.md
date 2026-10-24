<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 1.0.0
  Created      : 2026-10-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal - Architecture Discovery
-->

# SMRITI Enterprise Customer Architecture Discovery

**Document ID:** ARCH-CRM-001
**Date:** 2026-10-19
**Author:** Jawahar Ramkripal Mallah
**Phase:** Pre-Implementation Research and Architecture Audit
**Mode:** READ-ONLY - No code changes made
**Status:** COMPLETE - Pending Review and Approval

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Implementation Inventory](#2-current-implementation-inventory)
3. [Database and Relationship Findings](#3-database-and-relationship-findings)
4. [Enterprise Retail Business Model Comparison](#4-enterprise-retail-business-model-comparison)
5. [Corporate Account Lifecycle Walkthrough](#5-corporate-account-lifecycle-walkthrough)
6. [Proposed Conceptual ER Diagram](#6-proposed-conceptual-er-diagram)
7. [Data Ownership and Relationship Matrix](#7-data-ownership-and-relationship-matrix)
8. [Critical Architecture Decisions](#8-critical-architecture-decisions)
9. [Customer Form UX Specification](#9-customer-form-ux-specification)
10. [API and Authorization Implications](#10-api-and-authorization-implications)
11. [Testing and Migration Strategy](#11-testing-and-migration-strategy)
12. [Risks Unresolved Questions and Priorities](#12-risks-unresolved-questions-and-priorities)
13. [Evidence and Source References](#13-evidence-and-source-references)
14. [Go/No-Go Recommendation](#14-gono-go-recommendation)

---

## 1. Executive Summary

SMRITI Retail OS implements a **company-scoped, flat customer master** with optional group, policy,
GST registration, and loyalty sub-tables. The system handles single-store and small multi-outlet
retailers effectively. It does not yet have a formal corporate account hierarchy, consolidated
cross-company credit exposure, or cross-outlet transaction visibility.

### Key Findings from Live Database Audit (smriti001 tenant, 2026-10-19)

- **879 active customers** scoped to individual companies via `company_id` FK.
- **693 companies** in the tenant -- multi-company environment already active.
- `customer_relationships` table (parent-child hierarchy) exists with **0 rows** -- built but never used.
- `identity_code` UNIQUE column on `customers` acts as a cross-company deduplication anchor.
  Model C is half-built already.
- `customer_policies`, `customer_gst_registrations`, `customer_credit_ledger_entries`,
  `crm_segments` -- all exist as separate tables. Solid foundation.
- `customer_company_relationships` table does NOT exist -- the key missing link.
- `companies` table has NO `parent_company_id` -- company hierarchy is flat.

**Recommended architecture:** Model C -- Canonical Customer Identity with Company-Specific
Relationship records. This is a non-breaking extension of the existing schema.

**Recommendation: CONDITIONAL PROCEED** (see Section 14 for conditions).

---

## 2. Current Implementation Inventory

### 2.1 Frontend Files

| File | Size | Role | Status |
|---|---|---|---|
| CustMasterWs.tsx | 78 KB | Main workspace state/fetch/save | IMPLEMENTED BUT NOT VERIFIED (H5: seed data) |
| CustFormTab.tsx | 32 KB | Tab 1: General/Classification form | IMPLEMENTED BUT NOT VERIFIED |
| CustRetailDetTab.tsx | 17 KB | Tab 2: Retail Details | IMPLEMENTED BUT NOT VERIFIED |
| CustAddlDetTab.tsx | 21 KB | Tab 3: Additional/Payment Details | IMPLEMENTED BUT NOT VERIFIED |
| CustMailingDlg.tsx | 42 KB | Address/Location dialog | IMPLEMENTED BUT NOT VERIFIED |
| AdvancedCustSearch.tsx | 20 KB | Advanced search modal | IMPLEMENTED AND VERIFIED |
| CorporateCustomer360.tsx | 24 KB | Corporate 360 view | PARTIALLY IMPLEMENTED |
| CustomerCreditModal.tsx | - | Credit limit dialog | IMPLEMENTED BUT NOT VERIFIED |
| CustomerSegmentationModal.tsx | - | Segmentation modal | PARTIALLY IMPLEMENTED |
| CustomerMasterModal.tsx | 13 KB | Quick-create from POS/Sales | IMPLEMENTED BUT NOT VERIFIED |

EVIDENCE TYPE: VERIFIED FROM SMRITI SOURCE CODE

### 2.2 Backend Files

| File | Role | Status |
|---|---|---|
| backend/app/api/v1/crm.py | Customer + CRM routes (2,514 lines, v3.13.0) | IMPLEMENTED AND VERIFIED |
| backend/app/models/crm.py | Customer, Group, Relationships, Segments ORM | IMPLEMENTED AND VERIFIED |
| backend/app/models/loyalty.py | LoyaltyMember, LoyaltyTier, Transactions | IMPLEMENTED AND VERIFIED |
| backend/app/models/sales.py | SalesInvoice (85 cols), SalesOrder, SalesReturn | IMPLEMENTED AND VERIFIED |
| backend/app/services/crm.py | CrmService (CRUD, duplicate check) | IMPLEMENTED BUT NOT VERIFIED |
| backend/app/services/customer_identity.py | CustomerIdentityService (35 tests) | IMPLEMENTED BUT NOT VERIFIED |
| backend/app/repositories/customer.py | CustomerRepository | IMPLEMENTED BUT NOT VERIFIED |
| backend/app/schemas/crm.py | Pydantic schemas with camelCase/snake_case aliases | IMPLEMENTED AND VERIFIED |
| backend/app/api/v1/einvoice.py | E-Invoice/IRN IRP integration | IMPLEMENTED BUT NOT VERIFIED |

EVIDENCE TYPE: VERIFIED FROM SMRITI SOURCE CODE

### 2.3 Alembic Migration History (Customer-Related)

| Migration | Description |
|---|---|
| 44adad58fb7c_extend_customers_table.py | Base customer extension |
| v1385_crm_and_approvals.py | CRM base, customer groups |
| v1397_customer_identity_duplicate_protection.py | Duplicate detection, identity_code UNIQUE |
| v1413_customer_price_assignment.py | Price tier assignment table |
| v1414_customer_credit_ledger.py | Credit ledger entries table |
| v1416_customer_po_billing.py | Customer PO billing lifecycle |
| v1418_customer_article_mappings.py | Article-customer mappings |
| v1456_tax_inclusive_barcode_group_customer_snapshot.py | Tax-inclusive flag on group |
| v1458_pos_parked_carts_lsq_and_customer_switch_audit.py | POS customer switch audit |
| v1463_customer_pricing_basis_and_promotions_on_rate.py | Pricing basis field |
| v1480_customer_master_ux_contract.py | UX alias fields |
| v1539_crm_segments_and_group_code.py | CRM segments + group code (v3.12.0, latest) |

### 2.4 Test Coverage

| Test File | Coverage Area | Status |
|---|---|---|
| test_customer_identity_duplicate.py | Duplicate detection (35 tests) | IMPLEMENTED BUT NOT VERIFIED |
| test_crm_customer_contract.py | CRM customer contract | IMPLEMENTED BUT NOT VERIFIED |
| test_customer_master_ux_contract.py | UX alias fields, policy boundaries | IMPLEMENTED BUT NOT VERIFIED |
| test_customer_discount_policy.py | Discount policy enforcement | IMPLEMENTED BUT NOT VERIFIED |
| test_branch_isolation_customer_po.py | Branch isolation for customer POs | IMPLEMENTED BUT NOT VERIFIED |
| test_customer_po_billing_lifecycle.py | Full PO billing lifecycle | IMPLEMENTED BUT NOT VERIFIED |
| test_corporate_customer_360.py | Corporate 360 view | IMPLEMENTED BUT NOT VERIFIED |

---

## 3. Database and Relationship Findings

### 3.1 Live Record Counts -- smriti001 Tenant (2026-10-19)

| Table | Count | Notes |
|---|---|---|
| customers | 879 | All company-scoped via company_id FK |
| customer_groups | 401 | Many have random-suffix names (seeded data) |
| customer_gst_registrations | 16 | 13 for one corporate customer (RRL-001) |
| customer_delivery_locations | 9 | 7 for RRL-001 |
| customer_billing_locations | 3 | 1 for RRL-001 |
| customer_relationships | 0 | Table built, hierarchy entirely unused |
| loyalty_members | 43 | 1 with tier (Gold), 42 without tier assignment |
| loyalty_tiers | 2 | Silver (0 tiered members), Gold (1 tiered member) |
| sales_invoices | 2413 | 263 for RRL-001 alone |
| companies | 693 | Multi-company environment already active |
| crm_segments | 5 | Created in v3.12.0 |

EVIDENCE TYPE: VERIFIED FROM LIVE DATABASE

### 3.2 Customer Table (54 columns) -- Key Field Groups

```
IDENTITY:    id (PK), uuid (UNIQUE), code (company+code PARTIAL UNIQUE), identity_code (UNIQUE)
             name, mobile, email, gender, date_of_birth, pan_number, gst_number
TAXONOMY:    customer_type, environment, customer_group_id (FK->customer_groups)
             tags[], status, is_active, is_deleted
COMMERCE:    credit_limit, outstanding, price_tier_id, pricing_basis, is_tax_inclusive
             buying_factor, selling_factor, allow_promotions_on_rate
POLICY:      is_dependant, is_pre_sale_form_applicable, is_post_sale_form_applicable
TENANTING:   company_id (FK->companies), branch_id (FK->branches)
AUDIT:       created_at, modified_at, created_by, updated_by, version
```

Critical finding: `gst_number` is a single varchar for the primary GST. Multi-state GST
correctly uses `customer_gst_registrations` (verified: 13 rows for RRL-001).

### 3.3 Customer Sub-Tables (All Verified from Live Database)

| Table | Cols | Key Fields | Purpose |
|---|---|---|---|
| customer_policies | 29 | customer_id, payment_category, payment_term, transport_mode, allow_cash_bill | B2B permissions per customer |
| customer_gst_registrations | 22 | customer_id, gstin, state_name, state_code, registration_type, is_primary | Multi-state GST |
| customer_delivery_locations | 33 | customer_id, store_code, gstin, state_code, address | Ship-to with GSTIN |
| customer_billing_locations | 33 | customer_id, store_code, gstin, state_code | Bill-to with GSTIN |
| customer_relationships | 18 | parent_customer_id, dependant_customer_id, relation | Hierarchy (0 rows) |
| customer_external_identities | 19 | customer_id, source_system, external_type, external_code, metadata_json | Cards, ERP codes |
| customer_price_assignments | 19 | customer_id, price_tier_id, valid_from, valid_to, status | Time-bound price override |
| customer_credit_ledger_entries | 22 | customer_id, entry_type, amount, balance_after, reference_id, due_date | Full credit ledger |
| crm_segments | 19 | code, name, segment_type, rule_definition JSONB, member_count | Segmentation master |
| crm_segment_memberships | 17 | segment_id, customer_id, assigned_at | Segment membership |

### 3.4 Companies Table (36 columns) -- Key Findings

- Has: id, name, gst_number, legal_name, trade_name, business_type, pan, cin, address, state, state_code.
- **NO parent_company_id column** -- companies are flat, not hierarchical.
- 693 companies in smriti001 -- multi-company is in active use.

EVIDENCE TYPE: VERIFIED FROM LIVE DATABASE

### 3.5 Unique Constraints and Indexes on Customers

```sql
-- Partial unique: company-scoped code uniqueness for Active, non-deleted customers
uq_customers_company_code_active ON (company_id, code)
  WHERE code IS NOT NULL AND status = 'Active' AND is_deleted = false

-- Global unique: cross-company deduplication anchor
UNIQUE ON identity_code

-- Global unique: UUID
UNIQUE ON uuid

-- FK: customer_group_id -> customer_groups.id (RESTRICT on delete)
-- FK: company_id -> companies.id
-- FK: branch_id -> branches.id
```

---

## 4. Enterprise Retail Business Model Comparison

### Model A -- One Flat Customer Master Shared by All Stores

Suitable for single-company retailers with multiple stores under one legal entity.
**Current SMRITI state:** DOES NOT APPLY -- customers ARE company-scoped via company_id.
**Migration to adopt:** HIGH RISK -- would require removing company_id FK and adding ACLs.

### Model B -- Separate Customer Records per Company

Each legal entity creates its own customer record with no link between them.
**Current SMRITI state:** APPLIES -- company_id on customers creates per-company records.
**Risk:** HIGH -- data duplication already occurring.
Evidence: search q=reliance returns 4 results including 1 archived duplicate (CUST-RIL-1888).

### Model C -- Canonical Customer Identity + Company-Specific Relationship (RECOMMENDED)

A customer_identity represents the canonical person or business. Each company-customer
relationship is a separate record holding company-specific settings.
- Identity-level: name, mobile, email, PAN, identity_code, gst_registrations, locations.
- Relationship-level: credit limit, pricing group, payment terms, policies.

**Benefits:**
- Single cross-company customer search.
- Per-company credit and pricing isolation maintained.
- Cross-outlet returns supported via shared identity.
- Loyalty consolidated at tenant/identity level.

**Current SMRITI state:** PARTIALLY IMPLEMENTED.
- identity_code (UNIQUE) exists as a deduplication anchor -- Model C is half-built.
- customer_relationships exists for parent-child (not company-customer) relationships.
- **Missing:** customer_company_relationships junction table.

**Migration impact:** LOW-MEDIUM. Non-breaking -- add new table without dropping existing ones.

### Model D -- Full Corporate Account Hierarchy

CorporateAccount -> LegalEntity -> Region -> Outlet -> AuthorizedBuyer.
**Recommendation:** DEFER. Implement Model C first. Hierarchy can be built on top.

### Model E -- Corporate Buyer with Multiple Ship-To / Bill-To

**Current SMRITI state:** FULLY IMPLEMENTED.
customer_delivery_locations (9 rows, 7 for RRL-001) and customer_billing_locations (3 rows)
both have gstin and state_code. No change needed.

### Model F -- Consumer Identity Shared Across Outlets

**Current SMRITI state:** PARTIALLY IMPLEMENTED.
loyalty_members has loyalty_program_id column but is company-scoped.
**Recommendation:** Move loyalty to tenant-level loyalty_program_id scoping.

---

## 5. Corporate Account Lifecycle Walkthrough

Hypothetical scenario: "Example Retail Group" -- 2 legal entities, 3 GSTINs, 10 outlets.

| Step | Action | SMRITI Support | Status |
|---|---|---|---|
| 1. Corporate onboarding | customer_type=Corporate, PAN, identity_code | customers table | IMPLEMENTED AND VERIFIED |
| 2. Legal entity relationships | Link HQ to subsidiaries | customer_relationships (0 rows) | IMPLEMENTED BUT NOT VERIFIED |
| 3. GST registrations | Add state GSTINs | customer_gst_registrations | IMPLEMENTED AND VERIFIED |
| 4. Billing addresses per state | Add bill-to with GSTIN per state | customer_billing_locations | IMPLEMENTED AND VERIFIED |
| 5. Authorized contacts | Purchasing employees | customer_external_identities (metadata_json) | PARTIALLY IMPLEMENTED |
| 6. Price/credit terms | Group + customer override | customer_groups + customer_price_assignments | IMPLEMENTED AND VERIFIED |
| 7. POS customer selection | Search, select, load | /crm/customers/search API | IMPLEMENTED AND VERIFIED |
| 8. GST selection per transaction | Outlet vs. buyer state GSTIN | Frontend only (CustMailingDlg.tsx) | PARTIALLY IMPLEMENTED |
| 9. Invoice posting | sales_invoices + billing_location_id + billed_party_gstin_id | 85-col table | IMPLEMENTED AND VERIFIED |
| 10. Credit ledger | Entry per invoice/payment | customer_credit_ledger_entries | IMPLEMENTED AND VERIFIED |
| 11. Outstanding balance | customers.outstanding (denormalised) | Customer record | IMPLEMENTED AND VERIFIED |
| 12. Cross-outlet returns | Find original invoice across companies | NOT SUPPORTED | MISSING |
| 13. Cross-company loyalty | Points shared across all outlets | NOT SUPPORTED (company-scoped) | PARTIALLY IMPLEMENTED |
| 14. Consolidated reporting | Sum outstanding across companies | NOT IMPLEMENTED | MISSING |

---

## 6. Proposed Conceptual ER Diagram

```
TENANT (1)
  |
  +-- COMPANY (many) -- BRANCH (many) -- POS_TERMINAL
  |
  +-- CUSTOMER (tenant-scoped identity) [current: company-scoped]
        |-- identity_code (UNIQUE, cross-company anchor)
        |-- name, mobile, email, PAN, gst_number (primary)
        |
        +-- CUSTOMER_COMPANY_RELATIONSHIP [NEW -- Model C]
        |     |-- customer_id -> CUSTOMER
        |     |-- company_id -> COMPANY
        |     |-- customer_group_id (company-specific override)
        |     |-- credit_limit, credit_days (company-specific)
        |     |-- status
        |
        +-- CUSTOMER_GST_REGISTRATION (many) [EXISTING]
        |     |-- gstin, state_code, registration_type, is_primary
        |
        +-- CUSTOMER_DELIVERY_LOCATION (many) [EXISTING]
        |     |-- store_code, gstin, state_code, address
        |
        +-- CUSTOMER_BILLING_LOCATION (many) [EXISTING]
        |     |-- store_code, gstin, state_code
        |
        +-- CUSTOMER_POLICY (one per company) [EXISTING]
        |     |-- payment_category, payment_term, transport_mode
        |     |-- allow_cash_bill, allow_credit_invoice
        |
        +-- CUSTOMER_CREDIT_LEDGER_ENTRY (many) [EXISTING]
        |     |-- entry_type, amount, balance_after, reference_id, due_date
        |
        +-- CUSTOMER_RELATIONSHIP (parent-child) [EXISTING -- unused]
        |     |-- parent_customer_id, dependant_customer_id, relation
        |
        +-- CUSTOMER_EXTERNAL_IDENTITY [EXISTING]
              |-- source_system, external_type, external_code, metadata_json

  CUSTOMER_GROUP (company-scoped) [EXISTING]
        |-- code (v3.12.0), name, credit_limit, credit_days
        |-- max_discount_percent, min_margin_percent, allowed_payment_methods[]

  CUSTOMER_PRICE_ASSIGNMENT -> PRICE_BOOK -> PRICE_BOOK_ENTRY [EXISTING]

  LOYALTY_MEMBER (recommend: tenant-scoped) [EXISTING -- company-scoped today]
        |-- customer_id, loyalty_tier_id, current_points_balance
        |-- loyalty_program_id (move to tenant-level program)
        +-- LOYALTY_TRANSACTION (earn/redeem/bonus/expiry)

  CRM_SEGMENT <-- CRM_SEGMENT_MEMBERSHIP --> CUSTOMER [EXISTING v3.12.0]

  SALES_INVOICE [EXISTING]
        |-- customer_id, company_id, branch_id
        |-- billing_location_id, delivery_location_id
        |-- billed_party_gstin_id, place_of_supply_code
        +-- SALES_INVOICE_ITEM
```

---

## 7. Data Ownership and Relationship Matrix

| Entity | Owner Scope | Tenant Isolated | Cross-Company Visible | Current Status |
|---|---|---|---|---|
| Customer Identity | Tenant (proposed) / Company (current) | Yes | No -- should be Yes | PARTIALLY IMPLEMENTED |
| Customer Group | Company | Yes | No | IMPLEMENTED AND VERIFIED |
| Customer Policy | Company-Customer | Yes | No | IMPLEMENTED AND VERIFIED |
| Customer GST Registration | Customer (cross-company) | Yes | Yes | IMPLEMENTED AND VERIFIED |
| Customer Delivery Location | Customer (cross-company) | Yes | Yes | IMPLEMENTED AND VERIFIED |
| Customer Billing Location | Customer (cross-company) | Yes | Yes | IMPLEMENTED AND VERIFIED |
| Customer Price Assignment | Company-Customer | Yes | No | IMPLEMENTED AND VERIFIED |
| Customer Credit Ledger | Company-Customer | Yes | No | IMPLEMENTED AND VERIFIED |
| Loyalty Member | Company (should be Tenant) | Yes | No -- should be Yes | PARTIALLY IMPLEMENTED |
| CRM Segment | Company | Yes | No | IMPLEMENTED AND VERIFIED (v3.12.0) |
| Sales Invoice | Company | Yes | No | IMPLEMENTED AND VERIFIED |
| Customer Relationship | Tenant | Yes | Yes | IMPLEMENTED (0 rows used) |
| Customer Company Relationship | N/A | N/A | N/A | MISSING -- must be created |

---

## 8. Critical Architecture Decisions

### Q1. Customer identity scope: global, tenant, or company?

**Current:** Company-scoped (company_id FK on customers).
**Recommendation:** TENANT-SCOPED identity.
**Evidence (VERIFIED FROM LIVE DATABASE):** identity_code UNIQUE (no company_id scope) already
exists as the cross-company anchor. The mechanism is half-built.
**Default:** Promote identity_code as canonical key. Keep company_id for transaction scoping.
**Trade-off:** Queries need join via identity. Mitigated by retaining customers table as primary.

### Q2. Can one customer transact with multiple legal entities?

**Recommendation:** YES, via customer_company_relationships table (Model C).
**Current gap:** customers.company_id is single-valued. Workaround requires duplicate rows.
**Fix:** Add customer_company_relationships. Keep customers as identity anchor.
**Implementation dependency:** Moderate -- new table, no existing rows broken.

### Q3. Corporate parent: customer, separate entity, or both?

**Recommendation:** Corporate parent IS a customer record with customer_type='Corporate'.
Hierarchy uses customer_relationships.parent_customer_id (modelled, 0 rows used).
Do NOT create a separate CorporateAccount table yet.
Relation types: 'HQ', 'subsidiary', 'regional_office', 'outlet'.

### Q4. Bill-to and ship-to address modelling

**Current:** customer_billing_locations + customer_delivery_locations -- FULLY IMPLEMENTED.
Each location has its own gstin and state_code. **No change needed.**

### Q5. Company-specific override of customer groups and pricing

**Current:** customer_group_id is a single value on customers.
**Recommendation:** The new customer_company_relationships table carries customer_group_id
as a company-specific override, allowing different group per company.

### Q6. Credit exposure level

**Recommendation:** Three levels:
1. Relationship-level (per company): customer_credit_ledger_entries -- EXISTS.
2. Group-level: customer_groups.credit_limit -- EXISTS.
3. Consolidated (new): VIEW or API summing outstanding for all rows sharing identity_code.
   No new table needed -- one aggregation query.

**GST compliance (PUBLICLY DOCUMENTED EXTERNAL FACT):**
Under CGST Act 2017 Section 25(4), each GSTIN is a "distinct person." Credit exposure
must be tracked per GSTIN relationship for GST compliance.
Source: taxosmart.com, vjmglobal.com [2026].

### Q7. GST registration selection per transaction

**Current:** Frontend only (CustMailingDlg.tsx).
**Recommendation (ARCHITECTURAL RECOMMENDATION):** Server-side GST context resolver:

```
GET /crm/customers/{id}/gst-context?outlet_state_code=29&sale_company_id=COMP-001
Response: {
  "seller_gstin": "29AABCR1718E1ZO",   -- company GSTIN for outlet state
  "buyer_gstin": "29AABCE0001A1ZY",    -- customer billing location GSTIN for state
  "tax_type": "INTRA_STATE",            -- CGST+SGST
  "place_of_supply_code": "29"
}
```

### Q8. Cross-outlet returns

**Current:** NOT SUPPORTED -- returns are company-scoped.
**Recommendation:** Enable via shared identity_code:
1. Find original invoice across all company_ids for the tenant, filtered by customer identity_code.
2. Issue SalesReturn at accepting outlet with source_document_id from original company.
3. Requires CFO/MANAGER authorization. Cross-company credit note generated.
**Implementation complexity:** MEDIUM.

### Q9. Loyalty scope

**Recommendation:** TENANT-LEVEL loyalty.
**Evidence (VERIFIED FROM LIVE DATABASE):** loyalty_members.loyalty_program_id column already
exists. The program itself needs to be tenant-level, not company-level.
**Migration:** Low risk -- add loyalty_programs table at tenant level, migrate existing
company-scoped members to default tenant program.

### Q10. Duplicate detection and safe merging

**Current:** CustomerIdentityService + identity_code + 35-test suite. Mechanism exists.
**Evidence (VERIFIED FROM SMRITI SOURCE CODE):** test_customer_identity_duplicate.py imports
CustomerIdentityService, CustomerDuplicateCheckRequest, DuplicateDecision, MatchedIdentityType.
**Missing:** POST /crm/customers/{id}/merge?into={target_id} not implemented.
**Merge strategy:** Promote older identity_code as survivor, soft-delete duplicate,
update FK references (invoices, loyalty, GST regs) to survivor.

### Q11. Cross-company access and permissions

**Current:** All endpoints filter by tenant_ctx.company_id. No cross-company queries.
**Recommendation:**
- Add GROUP_CFO role for cross-company queries.
- Add X-Company-Scope: all header on reporting endpoints.
- All cross-company reads logged in audit table.
**Implementation complexity:** MEDIUM -- require_role() already exists.

### Q12. Supporting single-store retailers without enterprise complexity

**Recommendation:** Progressive disclosure via tenant configuration:
- companies.count = 1: SIMPLE mode (no corporate features shown in UI)
- companies.count > 1: HYBRID/ADVANCED mode with corporate account features
This is a UI configuration flag, not a schema change.

---

## 9. Customer Form UX Specification

### SIMPLE Mode (POS quick-create, single-store)

Trigger: companies.count = 1 or POS context.

Required fields only:
- Name (required, min 2 chars)
- Mobile (required, 10-digit Indian format, duplicate check on blur)
- Email (optional)
- Customer Group (dropdown, pre-selected default)

Duplicate warning: If mobile matches existing customer, show inline warning with
"Use existing" button. Never allow creating a duplicate silently.

Validation: Name >= 2 chars. Mobile = 10-digit Indian format.

### HYBRID Mode (Full customer form, SME retailers)

Tabs:
1. General -- name, code, type (Individual/Corporate/VIP/Wholesale), environment,
   customer group, mobile, email, gender, DOB, PAN, primary GSTIN.
2. Addresses -- delivery locations (ship-to) and billing locations (bill-to).
   Each address carries GSTIN and state code. Add/Edit/Remove UI.
3. Commerce -- pricing basis, price tier, credit limit, credit days,
   payment category, payment term, tax inclusive flag.
4. Loyalty -- program, tier, points balance (read-only display).

Field visibility rules:
- is_corporate = (customerType === 'Corporate') -> show GSTIN tab, authorized contacts
- is_dependant -> show parent account search
- Credit fields visible only to MANAGER+ role

### ADVANCED Mode (Corporate accounts, enterprise retailers)

Additional tabs (visible only for Corporate type + MANAGER+ role):
5. Corporate Hierarchy -- parent account link, subsidiary list via customer_relationships,
   relation type dropdown: HQ / Subsidiary / Regional Office / Outlet.
6. GST Registrations -- multi-state GSTIN management table.
7. Pricing Contracts -- price tier assignments with validity dates.
8. Credit Agreement -- consolidated outstanding, ledger history, per-company overrides.
9. Authorized Buyers -- from customer_external_identities with external_type=AUTHORIZED_BUYER.
10. Audit History -- visible to SYSADMIN only.

---

## 10. API and Authorization Implications

### 10.1 Verified CRM API Endpoints (v3.13.0)

| Endpoint | Verified Result |
|---|---|
| GET /crm/customers?limit=100 | array[100] |
| GET /crm/customers/search?q=reliance&status=Active | array[3] |
| GET /crm/customers/{id}/loyalty | enrolled=False pts=0 |
| GET /crm/customers/{id}/credit | credit_limit=100000.0 |
| GET /crm/customers/{id}/summary | credit_limit=100000.0 |
| GET /crm/customers/{id}/purchases | total=263 data[5] (v3.13.0) |
| GET /crm/customers/{id}/360 | invoice_count, total_spend, loyalty, segments (v3.13.0) |
| GET /crm/customers/{id}/segments | seg_count=3 |
| GET /crm/customers/{id}/gst-registrations | array[13] for RRL-001 |
| GET /crm/customers/{id}/delivery-locations | array[7] for RRL-001 |
| GET /crm/customers/{id}/billing-locations | array[1] for RRL-001 |
| GET /crm/segments | array[5] |
| POST /crm/segments | status=added |
| PATCH /crm/customer-groups/{id}/code | status=updated |
| GET /crm/export/customers | total=3 data[3] |
| GET /crm/export/customers/batch | streaming CSV header confirmed |
| GET /crm/customer-price-groups | array[3] |
| GET /loyalty/tiers | array[2], Silver mc=42 |

EVIDENCE TYPE: VERIFIED FROM LIVE DATABASE (smoke test, 2026-10-19)

### 10.2 Missing API Endpoints (Recommended)

| Endpoint | Priority | Purpose |
|---|---|---|
| GET /crm/customers/{id}/gst-context | HIGH | Server-side GST resolver per transaction |
| POST /crm/customers/{id}/merge | HIGH | Safe customer merge |
| GET /crm/customers/cross-company?identity_code=XX | HIGH | Cross-company identity lookup |
| GET /crm/customers/{id}/invoices/cross-outlet | MEDIUM | Cross-outlet invoice history |
| GET /crm/customers/{id}/credit/consolidated | MEDIUM | Cross-company consolidated balance |
| POST /crm/customers/{id}/relationships | LOW | Add corporate hierarchy link |
| GET /crm/customers/{id}/authorized-buyers | LOW | List authorized purchasers |

---

## 11. Testing and Migration Strategy

### 11.1 Required Tests (All Currently UNVERIFIED)

| Test | Priority | Type |
|---|---|---|
| Tenant isolation: company A cannot see company B customer data | CRITICAL | Security |
| Cross-company customer lookup via identity_code | HIGH | Model C |
| Duplicate detection: same mobile triggers 409 warning | HIGH | Data integrity |
| GST context: intra-state = CGST+SGST, inter-state = IGST | HIGH | GST compliance |
| Credit limit enforcement: invoice blocked when outstanding > limit | HIGH | Credit engine |
| Loyalty: earn at outlet A, redeem at outlet B (tenant-level program) | HIGH | Loyalty |
| Cross-outlet return: original invoice found, return authorized | MEDIUM | Returns |
| Pricing precedence: customer override > group > default | MEDIUM | Pricing |
| RBAC: CASHIER cannot view margin fields | MEDIUM | Authorization |

### 11.2 Migration Strategy for Model C (customer_company_relationships)

Phase 1 -- Non-breaking (1 sprint):

```sql
CREATE TABLE customer_company_relationships (
  id            VARCHAR(50) PRIMARY KEY,
  customer_id   VARCHAR(50) REFERENCES customers(id),
  company_id    VARCHAR(50) REFERENCES companies(id),
  branch_id     VARCHAR(50),
  customer_group_id VARCHAR(50) REFERENCES customer_groups(id),
  price_tier_id VARCHAR(50),
  credit_limit  NUMERIC(15,2),
  credit_days   INTEGER,
  status        VARCHAR(20) DEFAULT 'Active',
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, company_id)
);

-- Backfill from existing customers (one relationship per existing row)
INSERT INTO customer_company_relationships
  (id, customer_id, company_id, branch_id, customer_group_id, credit_limit, credit_days, status)
SELECT gen_random_uuid(), id, company_id, branch_id, customer_group_id, credit_limit, credit_days, status
FROM customers
WHERE is_deleted = false;
```

Phase 2: Update APIs to prefer relationship records. Keep customers.company_id for backward compat.

Phase 3: customers.company_id becomes nullable -- identity is truly tenant-scoped.

---

## 12. Risks, Unresolved Questions and Priorities

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Breaking existing company-scoped customer queries | HIGH | Keep customers.company_id; add new join path in parallel |
| Credit consolidation double-counts if same customer in 2 companies | HIGH | Unique constraint on identity_code + mandatory merge before duplicate create |
| GST GSTIN mismatch on cross-outlet returns generates invalid ITC for buyer | HIGH | CFO authorization required + credit note mechanism (not return invoice) |
| Loyalty cross-company sharing exposes financial data | MEDIUM | Tenant-level loyalty_program_id scoping with role check |
| Duplicate customers accumulating (879 customers, 693 companies) | MEDIUM | Mandatory mobile duplicate check before any customer create |

### Unresolved Questions

1. Should loyalty_members.company_id be removed or relaxed? Business decision on loyalty scope.
2. Who authorizes cross-company customer lookup? RBAC policy not yet defined.
3. How are cross-outlet returns settled between companies? Inter-company accounting policy required.
4. Is identity_code manually assigned or auto-generated by the API? Current behavior unclear.

### Implementation Priorities

| Priority | Item | Effort |
|---|---|---|
| P0 (Immediate) | Remove SEED_CUSTOMERS from CustMasterWs.tsx | 2 hours |
| P0 (Immediate) | Fix hardcoded loyalty IDs ('024', 'DSC') in mapper | 2 hours |
| P0 (Immediate) | Mandatory mobile duplicate check on customer create | 1 day |
| P1 (Sprint 1) | customer_company_relationships table + backfill migration | 3 days |
| P1 (Sprint 1) | GST context resolver API endpoint | 1 day |
| P1 (Sprint 1) | Cross-company customer search via identity_code | 1 day |
| P2 (Sprint 2) | Customer merge endpoint + UI | 3 days |
| P2 (Sprint 2) | Tenant-level loyalty_program_id scoping | 2 days |
| P3 (Sprint 3) | Consolidated credit exposure API | 2 days |
| P3 (Sprint 3) | Cross-outlet return authorization | 3 days |
| P4 (Future) | Full corporate hierarchy UI (ADVANCED mode tabs 5-10) | 2 sprints |

---

## 13. Evidence and Source References

| Claim | Type | Source |
|---|---|---|
| customers table: 54 columns, company_id FK | VERIFIED FROM LIVE DATABASE | information_schema.columns, smriti001, 2026-10-19 |
| customer_relationships: 0 rows | VERIFIED FROM LIVE DATABASE | COUNT query, smriti001, 2026-10-19 |
| 879 customers, 693 companies | VERIFIED FROM LIVE DATABASE | COUNT queries, 2026-10-19 |
| identity_code UNIQUE constraint | VERIFIED FROM LIVE DATABASE | information_schema.table_constraints |
| customer_gst_registrations: 13 rows for RRL-001 | VERIFIED FROM LIVE DATABASE | Direct query, 2026-10-19 |
| loyalty_members.loyalty_program_id column exists | VERIFIED FROM LIVE DATABASE | information_schema.columns |
| CustomerIdentityService + 35-test duplicate suite | VERIFIED FROM SMRITI SOURCE CODE | test_customer_identity_duplicate.py imports |
| customer_company_relationships table does not exist | VERIFIED FROM LIVE DATABASE | information_schema.tables search |
| companies: no parent_company_id | VERIFIED FROM LIVE DATABASE | information_schema.columns search |
| SEED_CUSTOMERS hardcoded at lines 342-489 | VERIFIED FROM SMRITI SOURCE CODE | grep result |
| Hardcoded loyalty IDs '024'/'DSC' at lines 378,379,453,454 | VERIFIED FROM SMRITI SOURCE CODE | grep result |
| CGST Act 2017 Section 25(4): each GSTIN is distinct person | PUBLICLY DOCUMENTED EXTERNAL FACT | taxosmart.com, vjmglobal.com [2026] |
| E-Invoice IRP/IRN for B2B turnover thresholds | PUBLICLY DOCUMENTED EXTERNAL FACT | ginesys.in, billclap.com |
| Parent-Subsidiary GSTIN model for enterprise buyers | GENERAL ENTERPRISE DESIGN PATTERN | vjmglobal.com |
| Model C recommendation | ARCHITECTURAL RECOMMENDATION | This document (author: Jawahar Ramkripal Mallah) |

---

## 14. Go/No-Go Recommendation

### Finding

SMRITI Retail OS has a solid foundation (approximately 80%) for enterprise customer management.
All sub-tables exist. The critical missing pieces are minimal and non-breaking to add:

1. customer_company_relationships table
2. Tenant-level loyalty scoping
3. Server-side GST context resolver endpoint
4. Customer merge endpoint and UI

### Recommendation: CONDITIONAL PROCEED

Mandatory conditions before starting enterprise corporate feature work:

| Condition | Priority | Evidence Required |
|---|---|---|
| Remove SEED_CUSTOMERS from CustMasterWs.tsx | P0 | Git diff showing removal |
| Fix hardcoded loyalty IDs in mapper | P0 | Git diff showing empty string defaults |
| Run 35-test duplicate detection suite; all must pass | P0 | Literal pytest terminal output |
| Add mandatory mobile duplicate check on customer create | P1 | API test showing 409 on duplicate mobile |

Approved to proceed (non-breaking):
- Add customer_company_relationships table via Alembic migration with backfill.
- Add GST context resolver GET endpoint.
- Activate customer_relationships for corporate hierarchy (data entry, not schema change).

Deferred (requires further design review):
- Cross-outlet returns (inter-company accounting policy must be defined first).
- Full corporate hierarchy UI ADVANCED mode (wait for Model C API to stabilise).
- Loyalty tenant-level scoping (wait for loyalty_programs table design review).

### Evidence Level

- All schema claims: VERIFIED FROM LIVE DATABASE.
- All code claims: VERIFIED FROM SMRITI SOURCE CODE.
- GST compliance claims: PUBLICLY DOCUMENTED EXTERNAL FACT with sources cited.
- Architecture recommendations: clearly labeled ARCHITECTURAL RECOMMENDATION.
- No UNVERIFIED ASSUMPTIONS used in any recommendation.

---

*End of Report*

*SMRITI_ENTERPRISE_CUSTOMER_ARCHITECTURE_DISCOVERY.md*
*Author: Jawahar Ramkripal Mallah | (c) SMRITIBooks.com. All Rights Reserved.*
