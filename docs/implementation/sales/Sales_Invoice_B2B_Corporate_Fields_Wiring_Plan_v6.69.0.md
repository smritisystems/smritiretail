<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.69.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Corporate B2B Billing Fields Wiring & Sales Invoice Snapshot Immutability (Phase 2C/2F)

## 1. Objective
Ensure full end-to-end statutory and transactional persistence for corporate B2B billing and delivery fields in the Sales Invoice pipeline across `SalesService` and `CanonicalSalesPostingWriter`, guaranteeing customer identity duplicate protection and immutable transaction snapshotting.

---

## 2. Business Motivation
In enterprise B2B sales (e.g., dispatches to corporate retail chains such as Reliance Retail, Tata Trent, Aditya Birla Fashion), invoices require statutory GST registration mapping, state-level Place of Supply (POS) derivation, and immutable store code/address snapshots. If subsequent updates to customer billing locations or addresses mutate historical invoices, tax audit trails and E-Way/E-Invoice compliance are compromised. Additionally, cross-company or cross-customer delivery location access must be strictly rejected at posting time.

---

## 3. Scope
- **In-Scope:**
  - `CanonicalPostingRequest` schema expansion to include `billed_party_gstin_id`.
  - Passing B2B billing/delivery attributes (`billed_party_gstin_id`, `billing_location_id`, `billing_store_code`, `delivery_location_id`, `delivery_store_code`, `delivery_gstin`, `delivery_location_snapshot`, `dispatch_from_location_id`) from `SalesService.create_sales_invoice` to `CanonicalSalesPostingWriter.post_sales_transaction`.
  - Comprehensive customer billing location lookup, validation (tenant isolation, customer ownership, active status), and address/store code snapshot capture in `CanonicalSalesPostingWriter`.
  - Robust place of supply (`pos_state`, `place_of_supply_code`) resolution hierarchy honoring delivery location state, place of supply override, billing registration state, and home state fallback.
  - Symmetrical persistence on `SalesInvoice` entity (`billed_party_gstin_id`, `billing_address`, `billing_store_code`, `sis_code`, `delivery_gstin`, `pos_state`, `place_of_supply_code`).
  - Strict regression and duplicate protection verification across `backend/tests/test_b2b_sales_wiring.py` (16 tests) and `backend/tests/test_customer_identity_duplicate.py` (35 tests).

- **Out-of-Scope:**
  - Modifying underlying PostgreSQL table schemas (all columns already exist in `sales_invoices`).
  - Changing public REST API response contracts outside standard B2B fields.

---

## 4. Current State
- `SalesInvoice` model possessed columns `billed_party_gstin_id`, `billing_store_code`, `sis_code`, `delivery_gstin`, and `pos_state`.
- `SalesService` received these fields via `invoice_in` (`SalesInvoiceCreate`) but previously omitted passing `billed_party_gstin_id`, `billing_location_id`, and `billing_store_code` into `CanonicalPostingRequest`.
- `CanonicalSalesPostingWriter` had partial delivery location resolution but was missing billing location snapshotting and was not setting `billing_store_code` or `billed_party_gstin_id` on the instantiated `SalesInvoice`.
- `test_customer_identity_duplicate.py` failed due to missing `billing_store_code` resolution and warehouse address/stock prerequisites.

---

## 5. Gap Analysis
| Component | Previous State | Target State |
|---|---|---|
| `CanonicalPostingRequest` | Lacked `billed_party_gstin_id` field | Field added with optional string typing |
| `SalesService` | Dropped `billed_party_gstin_id`, `billing_location_id`, `billing_store_code` during mapping | Explicitly maps all B2B fields to canonical request |
| `CanonicalSalesPostingWriter` | Did not query `CustomerBillingLocation` or snapshot billing store code | Queries billing location, validates customer ownership, snapshots address and store code |
| POS & State Resolution | Relied only on customer GSTIN or manual input | Hierarchical cascade: Delivery Location -> Explicit POS -> Billed Party GSTIN -> Customer GSTIN -> Branch Home State |
| `SalesInvoice` Instantiation | Null `billed_party_gstin_id`, `billing_store_code`, `sis_code`, `pos_state` | Fully populated from resolved snapshot records |

---

## 6. Architecture Impact
- **Canonical Architecture Adherence:** Consolidates sales invoice generation strictly within `CanonicalSalesPostingWriter` per SMRITI Platform Architecture and Backend System-of-Record policies.
- **Tenant Isolation:** Enforces multi-tenant company isolation on billing locations, delivery locations, and GST registrations.
- **Immutability Contract:** Ensures snapshots captured at posting time remain unaffected by future CRM master data edits.

---

## 7. Proposed Design
1. **Schema Extension (`canonical_posting.py`):**
   Add `billed_party_gstin_id: Optional[str] = Field(None, description="Customer GST Registration ID")` to `CanonicalPostingRequest`.
2. **Adapter Mapping (`sales.py`):**
   Forward `billed_party_gstin_id`, `billing_location_id`, `billing_store_code`, `delivery_location_id`, `delivery_store_code`, `delivery_gstin`, `delivery_location_snapshot`, and `dispatch_from_location_id` into `CanonicalPostingRequest`.
3. **Billing Location Resolution & Validation (`canonical_sales_writer.py`):**
   Look up `CustomerBillingLocation` if `req.billing_location_id` or `req.billing_store_code` is provided. Validate:
   - `company_id == company_id`
   - `customer_id == resolved_customer_id`
   - `is_active == True`
   Snapshot `address` and `store_code`.
4. **Delivery Location & POS Validation:**
   Derive `pos_state_code` and `pos_state_name` from delivery location, billing registration, or state lookup.
5. **Entity Instantiation:**
   Assign snapshot attributes to `SalesInvoice`.

---

## 8. Files Created
None.

---

## 9. Files Modified
- `backend/app/schemas/canonical_posting.py`
- `backend/app/services/canonical_sales_writer.py`
- `backend/app/services/sales.py`
- `backend/tests/test_b2b_sales_wiring.py`
- `backend/tests/test_customer_identity_duplicate.py`
- `scripts/audit_all_dbs.py`
- `scripts/audit_schema_drift.py`

---

## 10. Dependencies
- PostgreSQL Database on configured port (e.g. 2781 or standard 5432).
- SQLAlchemy 2.0 Async Session and Alembic migrations.

---

## 11. Risks
- **Risk:** Existing tests or seed data with inactive or cross-company records failing validation.
  - **Mitigation:** Comprehensive pre-validation logic adhering to test scenarios and clean fixtures.

---

## 12. Rollback Strategy
Git revert of changes on `backend/app/services/canonical_sales_writer.py`, `backend/app/services/sales.py`, and `backend/app/schemas/canonical_posting.py`.

---

## 13. Verification Plan
- Run `pytest backend/tests/test_customer_identity_duplicate.py -v`.
- Run `pytest backend/tests/test_b2b_sales_wiring.py -v`.
- Run `python scripts/architecture_duplication_gate.py`.

---

## 14. Test Plan
- Verify all 35 tests in `test_customer_identity_duplicate.py` pass.
- Verify all 16 tests in `test_b2b_sales_wiring.py` pass.
- Verify snapshot immutability on invoice update/historical customer edits.

---

## 15. Documentation Impact
- Update `docs/walkthrough/sales/Sales_Invoice_B2B_Corporate_Fields_Wiring_v6.69.0.md`.
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
Code change only in FastAPI backend services. Requires backend service reload.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0027: Canonical Sales Posting Architecture`
- `ADR-0034: Multi-Tenant Customer Identity & Duplicate Protection`

---

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Sales_Invoice_B2B_Corporate_Fields_Wiring_v6.69.0.md`
