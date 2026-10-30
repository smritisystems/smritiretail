<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.98.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Procurement Vendor Statement & TDS 500 Defect Remediation and Bill Document Preview Wiring v6.98.0

## 1. Purpose
This implementation permanently resolves the issues identified during procurement visual report and vendor payables inspection:
1. **HTTP 500 Errors on Vendor Statement and TDS Endpoints:**
   - `/api/v1/vendors/{vendor_id}/tds-summary` was throwing 500 internal server errors when passed Universal Party identifiers due to non-existent attributes (`party.code`, `party.name`, `party.tax_id`) on the `Party` ORM model, as well as missing statutory/compliance columns on `supplier_profiles` in standalone development environments.
   - `/api/v1/purchase/vendors/{vendor_id}/statement?end_date=...` was failing due to mismatched query parameters (`start_date`/`end_date` aliases sent by frontend vs `from_date`/`to_date` expected by backend) and un-aliased party lookup in `get_vendor_statement_of_account`.
2. **Procurement Visual Reports Table Interaction:**
   - In `ProcurementVisualReportsTab.tsx`, clicking the "View Bill" button in the "Active Procurement Stream" table only emitted a transient toast notification (`Opening workflow for View Bill`) without displaying the document preview. It is now wired to invoke `setSelectedDoc(item)`, immediately opening the interactive document inspection modal.

---

## 2. Scope
- **Backend Ledger & Statutory TDS Engine (`backend/app/services/unified_ledger.py`):**
  - Standardized `Party` ORM attribute extraction: mapped `party.party_code` (was `party.code`), `party.legal_name or party.trade_name` (was `party.name`), `party.gstin` (was `party.tax_id`), `party.pan`, and `party.address_line1` (was `party.billing_address`).
  - Added candidate supplier ID aggregation (`cand_ids`) across `Supplier.id`, `Supplier.code`, `Party.id`, and `Party.party_code` to properly retrieve general ledger entries, purchase bills, and advance payments regardless of identifier type.
- **Backend API Routing (`backend/app/api/v1/vendor.py`):**
  - Added `start_date` and `end_date` query parameter aliases to `get_vendor_statement` to ensure backward and forward compatibility with frontend clients.
- **Database Schema Parity (`smritisys`):**
  - Updated `supplier_profiles` with `msme_category`, `commercial_classification`, `tds_section`, `tds_rate`, and `verification_flags`.
  - Added `contact_category` to `party_contacts` and verified existence of `party_bank_accounts` and `vendor_identity_migrations`.
- **Frontend UI (`src/components/procurement/ProcurementVisualReportsTab.tsx`):**
  - Wired the "NEXT ACTION" button to set `setSelectedDoc(item)` for viewing bills and vouchers, opening the full document preview modal with complete item breakdown.

---

## 3. Files Created
- `docs/walkthrough/procurement/Procurement_Vendor_Statement_TDS_500_And_Bill_Preview_Fix_v6.98.0.md` (This document)

---

## 4. Files Modified
- `backend/app/api/v1/vendor.py`: Added `start_date` and `end_date` aliases in `get_vendor_statement`.
- `backend/app/services/unified_ledger.py`: Fixed `Party` model field access and supplier ID reconciliation in statement and TDS summary routines.
- `src/components/procurement/ProcurementVisualReportsTab.tsx`: Configured "View Bill" action button to trigger `setSelectedDoc(item)` and updated icon to `Eye`.
- `docs/walkthrough/README.md`: Appended entry for v6.98.0 to master index.

---

## 5. Architecture Decisions
- **AD-LEDGER-01: Universal Multi-Key Vendor Reconciliation:** Financial ledger operations must search across all candidate keys (`Supplier.id`, `Supplier.code`, `Party.id`, `Party.party_code`) to ensure transactions posted against legacy suppliers or universal parties are unified into a single statement of account.
- **AD-LEDGER-02: Party Schema Contract Parity:** All services querying `Party` must adhere strictly to the column schema defined in `backend/app/models/party.py` (`party_code`, `legal_name`, `trade_name`, `gstin`, `pan`).
- **AD-UI-01: Direct Document Modal Inspection:** Document stream tables in visual report dashboards must provide immediate modal inspection upon user interaction rather than dead-end notification toasts.

---

## 6. Design Rationale
- Parameter aliasing (`eff_from = from_date or start_date`, `eff_to = to_date or end_date`) provides complete resilience against differing query conventions across various frontend components (`VendorStatementOfAccountModal`, `VendorPayablesTab`, etc.).
- Providing the `Eye` icon alongside the "View Bill" label provides intuitive visual feedback that the action opens an on-screen preview.

---

## 7. Implementation Summary
1. Corrected `UnifiedAccountingLedgerService.get_vendor_statement_of_account` and `get_vendor_tds_summary` to resolve supplier and party identities via dual lookup and aggregate candidate IDs into `cand_ids`.
2. Applied `IN` filters across `cand_ids` for `GeneralLedgerEntry.party_id`, `PurchaseBill.supplier_id`, and `SupplierPayment.supplier_id`.
3. Extended `get_vendor_statement` in `backend/app/api/v1/vendor.py` with `start_date` and `end_date` query aliases.
4. Updated `ProcurementVisualReportsTab.tsx` onClick handler to call `setSelectedDoc(item)` when action is not `create_grn`.

---

## 8. Tests Executed
- `npx tsc --noEmit`: Exited with code 0 (0 type errors).
- `npx vitest run src/tests/procurementVisualReports.test.ts`: 10/10 tests passed (1.10s).
- `pytest app/tests/test_vendor_statement_of_account.py app/tests/test_statutory_tds_engine.py`: 14/14 tests passed (90.71s).
- Synthetic audit across all 159 suppliers and `Party` records in PostgreSQL: 100% success rate on statement and TDS generation.

---

## 9. Verification Results
- Zero HTTP 500 errors on statement and TDS APIs.
- Successful rendering and preview interaction for purchase bills in `ProcurementVisualReportsTab`.
- Full compliance with PostgreSQL database contracts and TypeScript strict mode.

---

## 10. Known Limitations
- When viewing historical statements for legacy suppliers without GSTIN, the tax identification remains empty until updated in Vendor Master.

---

## 11. Future Work
- Add automated batch export of vendor statements to PDF with digital signature.
- Introduce auto-reconciliation matching between purchase bills and external supplier invoices.

---

## 12. Related ADRs
- `ADR-0042`: Universal Party Master Architecture and Legacy Supplier Migration.
- `ADR-0087`: Statutory TDS Engine and 194Q Threshold Aggregation.

---

## 13. Related RFCs
- `RFC-2026-08`: Unified Double-Entry Accounting Ledger for SMRITI Retail OS.
