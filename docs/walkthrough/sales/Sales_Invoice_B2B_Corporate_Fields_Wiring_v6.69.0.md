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

# Walkthrough: Corporate B2B Billing Fields Wiring & Sales Invoice Snapshot Immutability (Phase 2C/2F)

## 1. Purpose
This walkthrough documents the full wiring and statutory validation of corporate B2B billing fields, Place of Supply (POS) state derivation, customer billing location resolution, and immutable invoice snapshot persistence in the SMRITI sales invoicing pipeline.

---

## 2. Scope
- Inclusion of `billed_party_gstin_id` in canonical posting schemas and sales service adapters.
- Integration of `CustomerBillingLocation` resolution, customer ownership verification, and address/store code snapshot capture in `CanonicalSalesPostingWriter`.
- Cross-tenant and cross-customer delivery location access control and delivery GSTIN state validation.
- Resolution cascade for Place of Supply (`pos_state_code`, `pos_state`).
- Complete persistence of B2B snapshot columns on `SalesInvoice`: `billed_party_gstin_id`, `billing_address`, `billing_store_code`, `sis_code`, `delivery_gstin`, `pos_state`, `place_of_supply_code`.
- Verification of test suites:
  - `backend/tests/test_customer_identity_duplicate.py` (35 tests)
  - `backend/tests/test_b2b_sales_wiring.py` (16 tests)

---

## 3. Files Created
- `docs/implementation/sales/Sales_Invoice_B2B_Corporate_Fields_Wiring_Plan_v6.69.0.md`
- `docs/walkthrough/sales/Sales_Invoice_B2B_Corporate_Fields_Wiring_v6.69.0.md`

---

## 4. Files Modified
- `backend/app/schemas/canonical_posting.py`: Added `billed_party_gstin_id` field to `CanonicalPostingRequest`.
- `backend/app/services/sales.py`: Updated `SalesService.create_sales_invoice` to pass `billed_party_gstin_id`, `billing_location_id`, `billing_store_code`, `delivery_location_id`, `delivery_store_code`, `delivery_gstin`, and `dispatch_from_location_id` into canonical posting request.
- `backend/app/services/canonical_sales_writer.py`: Added billing location resolution, tenant and customer validation, POS derivation hierarchy, and populated B2B snapshot fields on `SalesInvoice`.
- `backend/tests/test_b2b_sales_wiring.py`: Added credit ledger entries cleanup in setup and teardown routines.
- `backend/tests/test_customer_identity_duplicate.py`: Hardened warehouse and product seed fixtures to ensure stock and address availability.
- `scripts/audit_all_dbs.py`: Configured dynamic PostgreSQL port resolution via configuration settings.
- `scripts/audit_schema_drift.py`: Configured dynamic PostgreSQL port resolution via configuration settings.

---

## 5. Architecture Decisions
- **Canonical Sales Posting Single Source of Truth:** All transactional sales invoice postings (POS and B2B corporate) route through `CanonicalSalesPostingWriter.post_sales_transaction()`.
- **Immutable Transaction Snapshotting:** Billing addresses, store codes, and delivery locations are snapshotted at posting time into `sales_invoices`. Subsequent updates to customer addresses or store codes do not alter historical documents.
- **Strict Multi-Tenant and Customer Isolation:** Invoices attempting to associate delivery locations or GST registrations belonging to another customer or company fail with explicit HTTP 400/403 errors.

---

## 6. Design Rationale
In enterprise B2B sales (e.g. large retail chains like Reliance Retail or Tata Trent), dispatches are destined for specific store codes (Shop-in-Shop/SIS codes) and delivery locations under statutory GST registrations. Storing live foreign keys without snapshots exposes past transactions to corruption if store codes or addresses are modified or reassigned. Snapshotting ensures regulatory compliance and non-repudiation.

---

## 7. Implementation Summary
1. **Schema Extension:**
   Extended `CanonicalPostingRequest` in `backend/app/schemas/canonical_posting.py` with `billed_party_gstin_id: Optional[str] = Field(None)`.
2. **Sales Service Adaptation:**
   In `backend/app/services/sales.py`, mapped incoming B2B attributes from `SalesInvoiceCreate` to `CanonicalPostingRequest`.
3. **Canonical Writer Resolution:**
   In `backend/app/services/canonical_sales_writer.py`:
   - Queried `CustomerBillingLocation` using `billing_location_id` or `billing_store_code`.
   - Verified that billing location matches `company_id`, `customer_id`, and `is_active`.
   - Extracted snapshot `billing_address` and `billing_store_code`.
   - Derived `pos_state_code` and `pos_state` following the priority: Delivery Location -> Explicit POS -> Billed Party GSTIN -> Customer GSTIN -> Branch State.
   - Instantiated `SalesInvoice` with all snapshot attributes: `billed_party_gstin_id`, `billing_address`, `billing_store_code`, `sis_code`, `delivery_gstin`, `pos_state`, `place_of_supply_code`.

---

## 8. Tests Executed
1. **Customer Identity & Duplicate Protection Suite:**
   ```bash
   .\.venv\Scripts\python.exe -m pytest backend/tests/test_customer_identity_duplicate.py -v
   ```
   **Output:** 35 passed in 41.63s.
2. **B2B Sales Wiring Suite:**
   ```bash
   .\.venv\Scripts\python.exe -m pytest backend/tests/test_b2b_sales_wiring.py -v
   ```
   **Output:** 16 passed in 23.59s.
3. **Architecture Duplication Gate:**
   ```bash
   python scripts/architecture_duplication_gate.py
   ```
   **Output:** 11 checks executed, 0 P0/P1 violations, PASSED.

---

## 9. Verification Results
All 51 automated tests across `test_customer_identity_duplicate.py` and `test_b2b_sales_wiring.py` passed with 100% success rate. Historical immutability, customer code update isolation, store code immutability, and cross-company tenant isolation verified.

---

## 10. Known Limitations
None.

---

## 11. Future Work
- Support multi-destination split delivery dispatches within a single parent purchase order requisition.
- Integrate automated NIC E-Way Bill JSON generation directly from the snapshotted delivery metadata.

---

## 12. Related ADRs
- `ADR-0027: Canonical Sales Posting Architecture`
- `ADR-0034: Multi-Tenant Customer Identity & Duplicate Protection`

---

## 13. Related RFCs
- `RFC-0019: Corporate B2B Billing & SIS Store Code Dispatch Pipeline`
