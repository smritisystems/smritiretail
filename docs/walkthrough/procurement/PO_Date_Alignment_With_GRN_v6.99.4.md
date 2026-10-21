<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.4
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Procurement Document Chronology & Integrity Walkthrough
-->

# Walkthrough: Headless Purchase Order Date Alignment with Authoritative GRN & Bill Chronology (v6.99.4)

## 1. Purpose
This implementation remediates historical creation timestamps across all 28 existing submitted Purchase Orders (POs) in database `smriti001` (Tenant `COMP-001`) on `https://tattlythreads.smritisys.com`. Following the successful correction of Goods Receipt Notes (GRNs) in v6.99.3, all Purchase Orders remained at the software onboarding date (`2026-10-16`), creating a chronological inversion where inventory was received months before the corresponding Purchase Order was issued. This repair aligns each Purchase Order to its authoritative commercial date (timed 1 hour prior to its GRN on the same day: `10:00:00 UTC`), eliminating negative vendor lead times, audit vulnerabilities, and reporting distortions while preserving full financial and line-item integrity.

---

## 2. Scope
- **Target Entity:** `purchase_orders` in database `smriti001` (Tenant `COMP-001`).
- **Target Records:** All 28 submitted Purchase Orders corresponding to the 28 authoritative vendor purchase bills from `ALL VENDOR PURCHASE FOR SOFTWARE.xlsx` across 9 suppliers (`A`, `B`, `C`, `D`, `E`, `F`, `G`, `I`, `J`).
- **Lifecycle Timestamp Columns Updated:** `created_at`, `submitted_at`, `confirmed_at`, and `modified_at`.
- **Non-Negotiables Enforced:**
  - 100% HEADLESS execution (NO browser, GUI, or manual UI automation).
  - NO amendments, NO cancellations, and NO recreation of submitted POs.
  - Zero duplicate POs, GRNs, movements, or ledger entries.
  - Complete preservation of PO IDs, order numbers, line items, quantities, totals, and `RECEIVED` status.
  - Non-destructive table backup `_backup_purchase_orders_date` inside `smriti001`.

---

## 3. Files Created
1. `backend/app/tests/test_admin_po_date_remediation.py` — Dedicated unit test suite verifying schema constraints, Pydantic DTOs, and database name injection prevention.
2. `scripts/reconcile_live_po_dates.py` — Production-grade CLI engine supporting dual-mode execution (Direct Database Mode via SQLAlchemy asyncpg and Remote API Mode via FastAPI SYSADMIN endpoint).
3. `scripts/verify_remediated_po_dates.py` — Post-execution verification script inspecting full procurement chain chronology (`PO <= GRN <= Bill`), item totals, and backup logs.
4. `docs/walkthrough/procurement/PO_Date_Alignment_With_GRN_v6.99.4.md` — This comprehensive WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/database_manager.py` — Registered `PoDateCorrectionItem` and `PoDateRemediationRequest` schemas.
2. `backend/app/api/v1/database_manager.py` — Added canonical SYSADMIN endpoint `POST /api/v1/database-manager/admin-remediate-po-dates` with atomic backup creation, pessimistic locking (`FOR UPDATE`), and lifecycle timestamp alignment.
3. `docs/walkthrough/README.md` — Appended chronologically to the master walkthrough index table.
4. `CHANGELOG.md` — Documented version `[6.99.4]` release notes.

---

## 5. Architecture Decisions

### ADR-PO-01: Same-Day Spot Procurement Chronology Alignment
- **Context:** In physical retail, vendor drop shipments and initial store fill-ins operate on a spot procurement model where the commercial order is authorized and fulfilled on the same date.
- **Decision:** Set PO timestamp to `[Vendor Bill Date] 10:00:00 UTC` (1 hour prior to GRN at `11:00:00 UTC`).
- **Rationale:** Strictly enforces $\text{PO Date} < \text{GRN Date} \le \text{Bill Date}$, yielding a positive 1-hour lead time ($\text{Lead Time} = 0\text{ days}$) and completely clearing the temporary `2026-10-16` software initialization timestamp.

### ADR-PO-02: Synchronized Lifecycle Audit Timestamps
- **Context:** The `purchase_orders` model features lifecycle audit columns `submitted_at` and `confirmed_at` introduced in Phase A (v1508).
- **Decision:** Atomically synchronize `created_at`, `submitted_at`, and `confirmed_at` to the target historical timestamp.
- **Rationale:** Prevents internal state discrepancies where a PO is marked `RECEIVED` or `CONFIRMED` on October 16th while its creation date is in June or July.

---

## 6. Design Rationale
- **Pessimistic Row-Level Locking:** During live mutation, rows are selected with `SELECT ... FOR UPDATE` to prevent race conditions.
- **Pre-Mutation Audit Snapshot:** A table `_backup_purchase_orders_date` is created and populated with `(po_id, order_no, status, grand_total, old_created_at, new_created_at)` before any updates execute.
- **Idempotent CLI Runner:** `scripts/reconcile_live_po_dates.py` can be safely executed repeatedly; if a PO is already remediated, the mutation is a deterministic no-op.

---

## 7. Implementation Summary

### Schema & DTO Specifications
```python
class PoDateCorrectionItem(BaseModel):
    order_no: str
    target_date: str
    order_id: Optional[str] = None
    bill_no: Optional[str] = None

class PoDateRemediationRequest(BaseModel):
    database: str = "smriti001"
    dry_run: bool = True
    corrections: List[PoDateCorrectionItem]
```

### Administrative Remediation Endpoint
```python
@router.post("/admin-remediate-po-dates")
async def admin_remediate_po_dates(
    req: PoDateRemediationRequest,
    current_user: User = Depends(get_current_user),
):
    verify_sysadmin_role(current_user)
    # 1. Inspect or acquire pessimistic locks
    # 2. Insert snapshot into _backup_purchase_orders_date
    # 3. Update created_at, submitted_at, confirmed_at, modified_at
```

---

## 8. Tests Executed

### 8.1 Unit Test Suite (`backend/app/tests/test_admin_po_date_remediation.py`)
```bash
pytest backend/app/tests/test_admin_po_date_remediation.py -v
```
**Literal Terminal Output:**
```
collecting ... collected 3 items

backend\app\tests\test_admin_po_date_remediation.py::test_po_date_correction_item_schema PASSED [ 33%]
backend\app\tests\test_admin_po_date_remediation.py::test_po_date_remediation_request_schema PASSED [ 66%]
backend\app\tests\test_admin_po_date_remediation.py::test_db_name_pattern_sanitization_po PASSED [100%]

======================= 3 passed, 24 warnings in 45.85s =======================
```

---

## 9. Verification Results

| Verification Criterion | Status | Evidence / Metric |
|---|---|---|
| Schema Parity & DTO Registration | Done | 3/3 pytest passing in `test_admin_po_date_remediation.py` |
| SYSADMIN Authentication Guard | Done | `verify_sysadmin_role` enforces `403 FORBIDDEN` for non-SYSADMIN |
| SQL Injection Prevention | Done | `DB_NAME_PATTERN` blocks metacharacters, semicolons, comments |
| Non-Destructive Table Backups | Done | `_backup_purchase_orders_date` created and verified |
| Full Procurement Chronology | Done | 28/28 Procurement chains verified: `PO created_at <= GRN created_at` |
| Financial & Line Item Integrity | Done | Grand totals, lines, and quantities 100% preserved |

---

## 10. Known Limitations
None. All 28 Purchase Orders are strictly aligned with their respective Goods Receipt Notes and Vendor Purchase Bills.

---

## 11. Future Work
1. Add an automated procurement lifecycle integrity validator to continuous integration to prevent out-of-order document timestamp generation.

---

## 12. Related ADRs
- **ADR-0012:** FastAPI + PostgreSQL Sole Backend System-of-Record
- **ADR-0026:** Database Manager Administration & Governed DML Remediation APIs
- **ADR-PO-01:** Same-Day Spot Procurement Chronology Alignment

---

## 13. Related RFCs
- **RFC-0078:** Headless Data Integrity Remediation & Chronological Inward Alignment
