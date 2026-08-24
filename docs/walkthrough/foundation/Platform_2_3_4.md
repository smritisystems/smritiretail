<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Platform Refactor Slice 12: ProPOS Register Shift Close (Z-Report) Automated Balancing Voucher Posting & Tender Reconciliations

## 1. Purpose
Automate the transactional reconciliation and double-entry General Ledger journal voucher posting for ProPOS Cash Register Shift Closures (Z-Reports). Ensure that cash register shortages and overages (physical cash drawer count vs expected cash aggregate) are accurately recorded in dedicated income/expense accounts in the General Ledger with strict idempotency and multi-tenant isolation.

## 2. Scope
- Standard Chart of Accounts expansion:
  - Account `4050`: Cash Register Overage (Surplus) [REVENUE / INCOME]
  - Account `5070`: Cash Register Shortage (Deficit) [EXPENSE]
- Domain service methods in `UnifiedAccountingLedgerService`:
  - `post_shift_close_to_gl`: Generates balanced double-entry `JournalVoucher` (`VOUCHER_TYPE = "SHIFT_CLOSE"`):
    - Cash Shortage ($\text{variance} < 0$): Debit Shortage (`5070`), Credit Cash in Hand (`1010`) for $|\text{variance}|$.
    - Cash Overage ($\text{variance} > 0$): Debit Cash in Hand (`1010`), Credit Overage (`4050`) for $\text{variance}$.
    - Zero Variance ($\text{variance} == 0$): Returns `None` (Cash balance already reflects actual drawer count from live invoice entries).
    - Idempotency guard: Re-reconciling or querying the same shift returns the existing voucher and prohibits duplicate ledger adjustments.
- Automated hook in `POSService.close_shift`:
  - Atomically computes aggregated cash sales, card sales, UPI sales, expected cash, and variance.
  - Automatically triggers `post_shift_close_to_gl` and commits both shift status and GL entries atomically.
- Z-Report Domain Service & REST API:
  - `POSService.get_z_report`: Computes shift sales breakdown, tender totals, variance, and resolves linked General Ledger voucher reference.
  - `GET /api/v1/pos/shifts/{shift_id}/z-report`: Exposes authoritative Z-Report schema (`POSZReportResponse`).
- Automated test suites:
  - `backend/tests/test_pos_shift_gl_integration.py` (7/7 tests passed).
  - Master Platform Regression Suite: 111/111 passed across 18 test suites in 64.88s.

## 3. Files Created
- `backend/tests/test_pos_shift_gl_integration.py` — Integration test suite verifying shift closing, cash shortage/overage GL balancing, idempotency, unclosed shift rejection, Z-report API, and multi-tenant isolation.
- `docs/walkthrough/foundation/Platform_Accounting_POS_Shift_Close_ZReport_v6.16.0.md` — This walkthrough document.

## 4. Files Modified
- `backend/app/services/unified_accounting_ledger_service.py` — Added accounts `4050` and `5070` to `DEFAULT_CHART_OF_ACCOUNTS` and implemented `post_shift_close_to_gl`.
- `backend/app/services/pos.py` — Integrated `post_shift_close_to_gl` in `close_shift` and implemented `get_z_report`.
- `backend/app/schemas/pos.py` — Added `POSZReportResponse` Pydantic v2 schema.
- `backend/app/api/v1/pos.py` — Added `GET /pos/shifts/{shift_id}/z-report` endpoint.
- `docs/walkthrough/README.md` — Appended Slice 12 to master walkthrough index.
- `docs/implementation/README.md` — Appended Slice 12 to master implementation index.

## 5. Architecture Decisions
- **Authoritative Till Reconciliation**: Individual POS sales invoices post live double-entry records directly to Cash in Hand (`1010`) or Bank Accounts (`1020`). At shift close, the cashier declares physical cash count. Any difference ($\text{Variance} = \text{Counted} - \text{Expected}$) is resolved via an authoritative balancing voucher adjusting `1010` against `5070` or `4050`.
- **Shift Document Linking**: The journal voucher stores `reference_doc_type = "POS_SHIFT"`, `reference_doc_id = shift.id`, and `reference_doc_no = f"ZREPORT-{register_id}-{opened_str}"`, maintaining bidirectional traceability.
- **Idempotency Guarantee**: `post_shift_close_to_gl` queries `JournalVoucher` by `reference_doc_type == "POS_SHIFT"` and `reference_doc_id == shift.id`. Repeated calls return the existing voucher without re-posting.

## 6. Design Rationale
Decoupling tender variance adjustments into a single end-of-shift balancing voucher prevents cashier checkout latency during active trading while providing complete audit trails for store managers and accountants upon shift closure.

## 7. Implementation Summary
- `DEFAULT_CHART_OF_ACCOUNTS`: Automatically seeds `4050` (Cash Register Overage) and `5070` (Cash Register Shortage).
- `post_shift_close_to_gl`: Validates shift closed state, detects shortage/overage, constructs balanced debit/credit lines, and persists journal voucher and GL entries.
- `close_shift`: Calculates invoice totals by payment mode (`CASH`, `CARD`, `UPI`), computes variance, updates shift entity, and calls `post_shift_close_to_gl`.
- `GET /api/v1/pos/shifts/{shift_id}/z-report`: Returns detailed Z-Report summary with GL voucher reference.

## 8. Tests Executed
```powershell
python -m pytest tests/test_pos_shift_gl_integration.py -v
python -m pytest tests/test_routing_boundary_canonical.py tests/test_universal_party_master.py tests/test_universal_item_master.py tests/test_unified_sales_ledger.py tests/test_unified_pricing_payment_engine.py tests/test_unified_approval_communicator.py tests/test_unified_workspace_capability.py tests/test_unified_outbox_analytics.py tests/test_wms_phase1.py tests/test_wms_phase2_grn_sales.py tests/test_wms_phase3_eway_bill.py tests/test_wms_phase4_audit_reconciliation.py tests/test_security_menu_access.py tests/test_unified_accounting_ledger.py tests/test_fiscal_period_brs.py tests/test_accounting_api.py tests/test_multicurrency_fx.py tests/test_pos_shift_gl_integration.py -v
```

## 9. Verification Results
- `tests/test_pos_shift_gl_integration.py`: 7/7 PASSED in 10.58s.
- Master Platform Regression Suite: 111/111 PASSED in 64.88s across 18 test suites.

## 10. Known Limitations
- Denomination breakdown persistence (e.g. counts of ₹500, ₹200, ₹100, ₹50 notes) will be integrated in Phase 4 POS Cash Drawer Denomination Tracking.

## 11. Future Work
- Multi-Tenant Ephemeral Database CI/CD Test Harness.
- POS Cash Drop / Mid-Shift Expense Voucher Automation.

## 12. Related ADRs
- `docs/architecture/ADR_001_FastAPI_Postgres_Sole_System_of_Record.md`
- `docs/architecture/ADR_008_Authoritative_Double_Entry_General_Ledger.md`

## 13. Related RFCs
- `docs/rfc/RFC_011_POS_Register_Shift_Close_ZReport_Reconciliation.md`
