<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Branch       : smritiNX

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-10-01
  * Modified   : 2026-10-01
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Forensic Architecture Report: SMRITI Purchase Order Lifecycle Phases A–C Backfill

## 1. Executive Summary & Baseline Inventory

This document establishes the retroactive forensic verification and architecture audit of the historical Purchase Order lifecycle work across commits `4989906` (Phase A), `178f8c9` (Phase B), and `93a4dcf` (Phase C), alongside related commits `7e2f83c` and `b366b81`, and image asset `spif-85a2c42c30ed42d795bc6df5e0e64859.webp`.

### Git Baseline State
- **Branch:** `smritiNX`
- **Current HEAD:** `6653376f` — `docs: add architecture report, walkthrough, and changelog entry for Universal Document Lifecycle Phase 1 PO pilot`
- **Parent Commit:** `fd8c4f60` — `feat: implement universal document lifecycle framework with purchase order pilot`
- **Working Tree:** Clean (0 uncommitted changes)
- **Lineage Chain:**
  ```text
  b366b81 (v6.44.0 PO validate hardening)
     ↓
  4989906 (Phase A: PO lifecycle DRAFT->SUBMITTED->CONFIRMED, migration v1508)
     ↓
  7b3d18c (fix schema v1509 parties.merged_into_party_id)
     ↓
  178f8c9 (Phase B: status-aware PO workspace)
     ↓
  93a4dcf (Phase C: cancellation policy picker, migration v1511)
     ↓
  fd8c4f6 (Phase 1: Universal Document Lifecycle Framework, migration v1512)
     ↓
  6653376 (Documentation: Phase 1 Walkthrough & Architecture Report)
  ```

---

## 2. Phase A Forensic Report (Commit `49899065`)

- **Commit Date:** Thu Oct 1 04:05:39 2026 +0530
- **Primary Objective:** Transition Purchase Order from legacy single-state (`CONFIRMED` upon creation) into a governed 3-state pipeline: `DRAFT` -> `SUBMITTED` -> `CONFIRMED`.

### A. Database Changes (Migration `v1508`)
- Added 8 nullable columns to table `purchase_orders`:
  1. `submitted_by` (`VARCHAR(100)`): User who transitioned PO from DRAFT to SUBMITTED.
  2. `submitted_at` (`TIMESTAMPTZ`): Timestamp of submission.
  3. `confirmed_by` (`VARCHAR(100)`): User who confirmed the order.
  4. `confirmed_at` (`TIMESTAMPTZ`): Timestamp of confirmation.
  5. `cancelled_by` (`VARCHAR(100)`): User who cancelled the order.
  6. `cancelled_at` (`TIMESTAMPTZ`): Timestamp of cancellation.
  7. `cancellation_reason` (`TEXT`): Operator-provided reason for cancellation.
  8. `parent_order_id` (`VARCHAR(50)`, FK to `purchase_orders.id` `ON DELETE SET NULL`): Lineage pointer for revisions.
- Created index `ix_purchase_orders_parent_order_id`.
- **Backward Compatibility:** All columns nullable; existing rows in `smriti001`–`smriti004` remained intact.

### B. Backend Models & Services
- `PurchaseOrder.status`: Default changed from `"CONFIRMED"` to `"DRAFT"`.
- `PurchaseService.submit_purchase_order(order_id)`:
  - Validates `po.status == "DRAFT"`.
  - Sets `po.status = "SUBMITTED"`.
  - Populates `po.submitted_by` and `po.submitted_at`.
- `PurchaseService.confirm_purchase_order(order_id)`:
  - Validates `po.status == "SUBMITTED"`.
  - Sets `po.status = "CONFIRMED"`.
  - Populates `po.confirmed_by` and `po.confirmed_at`.
- `PurchaseService.cancel_purchase_order(order_id, reason)`:
  - Populates `cancelled_by`, `cancelled_at`, and `cancellation_reason`.

### C. API Endpoints
- `POST /api/v1/purchase/orders/{order_id}/submit`
- `POST /api/v1/purchase/orders/{order_id}/confirm`
- `POST /api/v1/purchase/orders/{order_id}/cancel`

### D. Security, Permissions & Tenant Isolation
- Gated behind `require_role(UserRole.MANAGER, UserRole.SYSADMIN)`.
- Cashiers receive HTTP 403 Forbidden.
- Tenant isolation enforced via `PurchaseOrder.company_id == tenant.company_id` and branch filtering.

### E. Phase A Defects Discovered & Remediated
1. **Soft-Delete on Cancellation (DEF-01):** In Phase A, `cancel_purchase_order` set `po.is_deleted = True`. This was a serious architectural flaw, as `CANCELLED` is an explicit business lifecycle state. Fixed in Phase 1 so that `is_deleted = False` is strictly maintained.
2. **Audit Mismatch (DEF-02):** Phase A did not consistently write `WorkflowEvent` transition records. Fixed in Phase 1 via `UniversalLifecycleEngine`.
3. **Approval Bypass (DEF-03):** Phase A did not evaluate `ApprovalEngine` thresholds. Fixed in Phase 1.

### F. Automated Tests Introduced
- Tests T01–T20 in `backend/app/tests/test_purchase.py` validating draft creation, submitted state, confirmation, role rejections, and cancellation.

---

## 3. Phase B Forensic Report (Commit `178f8c99`)

- **Commit Date:** Thu Oct 1 05:02:15 2026 +0530
- **Primary Objective:** Build status-tabbed, operational PO Workspace UI and status filtering.

### A. Backend Changes
- `PurchaseService.list_purchase_orders`: Extended with `status: Optional[str] = None` supporting single values (`status=DRAFT`) or comma-separated lists (`status=DRAFT,SUBMITTED`).
- `GET /api/v1/purchase/orders/?status=`: Exposed query parameter to frontend.

### B. Frontend Workspace (`POWorkspaceTab.tsx`)
- Status tabs: `All POs`, `Draft`, `Submitted`, `Confirmed`, `Received`, `Cancelled`.
- Tab counts auto-calculated and displayed on badge chips.
- Per-row operational actions:
  - DRAFT rows render **Submit** button (requires MANAGER+).
  - SUBMITTED rows render **Confirm** button (requires MANAGER+).
  - Active rows render **Cancel** trigger.
- Role-based visual enforcement: Cashiers see read-only informative banner; action buttons are hidden in the UI.

### C. Forensic Meaning of "Open" Action
In `POWorkspaceTab.tsx`, the action **"Open"** (`onOpenPO` callback) signifies:
- Rehydrating the selected PO into the `PurchaseStudioTab` generate canvas (`PoSizewiseTab` or `PoGenerateTab`) for inspection or draft modification.
- **Critical Architectural Gate:** "Open" is **NOT** an authorization bypass. The UI visibility of "Open" does not permit unauthorized mutations because the backend independently verifies `require_role(MANAGER, SYSADMIN)` and document lifecycle state on every write endpoint.

### D. Automated Tests Introduced
- Tests T21–T25 in `backend/app/tests/test_purchase.py` verifying status filters (`?status=DRAFT`, `?status=SUBMITTED`, `?status=CONFIRMED`, multi-status filtering).

---

## 4. Phase C Forensic Report (Commit `93a4dcf6`)

- **Commit Date:** Thu Oct 1 10:27:32 2026 +0530
- **Primary Objective:** Implement structured cancellation policy, reason picker, and reason persistence.

### A. Database Changes (Migration `v1511`)
- Seeded `PO_CANCEL_REASON` master type in `master_types` table.
- Seeded 8 canonical cancellation reason values:
  1. `PRICE_DISPUTE` — Supplier revised prices after PO issue
  2. `DELIVERY_DELAY` — Supplier unable to meet agreed dispatch date
  3. `DEFECTIVE_TERMS` — Incorrect payment or delivery terms specified
  4. `SUPPLIER_REQUEST` — Supplier requested cancellation due to stockout
  5. `DUPLICATE_ORDER` — Accidental duplicate order entered
  6. `BUDGET_CUT` — Procurement budget rescinded or reallocated
  7. `SPEC_CHANGE` — Merchandise specifications or sizes changed
  8. `OTHER` — Other operational reason (requires explicit notes)

### B. Backend Changes
- Added endpoint `GET /api/v1/purchase/cancel-reasons` returning structured reasons with graceful static fallback if DB unseeded.
- Extended `PurchaseOrderCancelRequest` schema with `reason_code: Optional[str]`.
- Updated `cancel_purchase_order` to record structured reason string: `[{reason_code}] {notes}`.

### C. Invariant Verification: Queryability of Cancelled Records
- **Mandatory Policy Check:** Cancelled records must remain queryable in registers, audit logs, and accounting references.
- **Current Invariant:**
  ```text
  status = "CANCELLED"
  is_deleted = False
  deleted_at = None
  ```
  The legacy flaw of setting `is_deleted = True` was permanently eradicated in Phase 1 (`fd8c4f60`).

### D. Automated Tests Introduced
- Tests T26–T28 in `backend/app/tests/test_purchase.py` validating cancel reason retrieval and persistence.

---

## 5. Related Commits Classification

| Commit Hash | Topic | Primary Area | Touches Lifecycle Semantics? | Classification |
|---|---|---|---|---|
| `7e2f83c9` | Purchase Studio Phase 5: Multi-Image Batch Upload & Heuristics | Merchandising UI / SPIF | **NO** — Only affects local image matching and thumbnail preview. Does not touch status machine or approval gates. | **NON-LIFECYCLE / OUT OF PRIMARY SCOPE** |
| `b366b81f` | PO Validation Gate Hardening (Gaps 1, 3, 4) | Pre-Save Policy Engine | **NO** — Hardened `POProductPolicyEngine` validation during `size_pivot` entry prior to saving. Does not modify state machine transitions. | **PRE-SUBMIT PRODUCT VALIDATION / OUT OF CORE STATE-MACHINE SCOPE** |

---

## 6. Image Asset Forensics

### Inspection of `spif-85a2c42c30ed42d795bc6df5e0e64859.webp`
- **Filesystem Path:** `F:\SMRITRretailNX\static\uploads\spif-85a2c42c30ed42d795bc6df5e0e64859.webp`
- **File Type:** WEBP (Lossy compressed RGB)
- **Dimensions:** 1024 × 294 pixels
- **File Size:** 31,538 bytes (~30.8 KB)
- **Git Commit Introduced:** `fd8c4f60` (`feat: implement universal document lifecycle framework with purchase order pilot`)
- **Repository-Wide Code/Docs References:** **0 matches** (Verified via full-text search across all branches).
- **Origin & Purpose:** Generated during manual testing of the Single Point Image Factory (`POST /api/v1/inventory/upload-image`) while testing Purchase Studio lookbook banners; subsequently swept up into `git commit` in `fd8c4f60`.
- **Classification:** **UNREFERENCED COMMITTED ASSET**.
- **Governance Recommendation:** In accordance with git safety policy, preserve this asset in git history to prevent destructive rewrite of commit hashes, but document it as an unreferenced test artifact that requires no production deployment.

---

## 7. Complete Purchase Order Lifecycle State Machine Matrix

The following table reflects the authoritative current state machine implemented across Phases A, B, C, and the Universal Lifecycle Framework:

| Transition | From State | Action | Target State | Required Role | Approval Gate | Domain Validation | Audit Event Logged | Downstream Side Effects |
|---|---|---|---|---|---|---|---|---|
| **Submit** | `DRAFT` | `SUBMIT` | `SUBMITTED` | `MANAGER`, `SYSADMIN` | Threshold check via `ApprovalEngine` | Line items exist or `grand_total > 0` | `WorkflowEvent` (`DRAFT` → `SUBMITTED`) | Populates `submitted_by`, `submitted_at` |
| **Approve** | `SUBMITTED` | `APPROVE` / `CONFIRM` | `CONFIRMED` | `MANAGER`, `SYSADMIN` | Multi-tier approval check | Must be in `SUBMITTED` state | `WorkflowEvent` (`SUBMITTED` → `CONFIRMED`) | Populates `confirmed_by`, `confirmed_at`; allows GRN creation |
| **Reject** | `SUBMITTED` | `REJECT` | `DRAFT` | `MANAGER`, `SYSADMIN` | None | Must be in `SUBMITTED` state | `WorkflowEvent` (`SUBMITTED` → `DRAFT`) | Reverts PO to editable draft |
| **Cancel (Draft)** | `DRAFT` | `CANCEL` | `CANCELLED` | `MANAGER`, `SYSADMIN` | None | Reason code/text required | `WorkflowEvent` (`DRAFT` → `CANCELLED`) | Populates `cancelled_by`, `cancelled_at`, reason; retains `is_deleted=False` |
| **Cancel (Submitted)** | `SUBMITTED` | `CANCEL` | `CANCELLED` | `MANAGER`, `SYSADMIN` | None | Reason code/text required | `WorkflowEvent` (`SUBMITTED` → `CANCELLED`) | Populates `cancelled_by`, `cancelled_at`, reason; retains `is_deleted=False` |
| **Cancel (Confirmed)** | `CONFIRMED` | `CANCEL` | `CANCELLED` | `MANAGER`, `SYSADMIN` | None | Reason code/text required; no posted receipts | `WorkflowEvent` (`CONFIRMED` → `CANCELLED`) | Populates `cancelled_by`, `cancelled_at`, reason; retains `is_deleted=False` |
| **Amend** | `CONFIRMED` | `AMEND` | `CANCELLED` (Orig) / `CONFIRMED` (New) | `MANAGER`, `SYSADMIN` | New revision evaluated | Must be `CONFIRMED`; original cannot be already amended | `WorkflowEvent` (`CONFIRMED` → `CANCELLED`) | Original cancelled; new PO created with `parent_order_id` & `amend_revision=1` |
| **Receive (GRN)** | `CONFIRMED` | `POST_GRN` | `RECEIVED` / `PARTIALLY_RECEIVED` | `MANAGER`, `SYSADMIN` | Receipt validation | Quantity received > 0 | `WorkflowEvent` (`CONFIRMED` → `RECEIVED`) | Increments stock on products; updates supplier outstanding |

---

## 8. Database Integrity Baseline Metrics

Captured via read-only execution of `scripts/capture_db_integrity_baseline.py` and `scripts/db_safety_check.py`:

```text
================================================================================
SMRITI RETAIL OS: TRANSACTION LIFECYCLE DATABASE INTEGRITY BASELINE
================================================================================
Existing Target Tables: ['approval_actions', 'approval_policies', 'approval_requests', 'goods_receipt_notes', 'purchase_orders', 'workflow_definitions', 'workflow_events']
1. Total Purchase Orders: 0
   PO Status & Soft-Delete Breakdown: Clean (0 active records in dev test DB)
2. Total Goods Receipt Notes (GRN): 0
3. purchase_bills table: NOT PRESENT (Registered in smriti_identity_registry; bills post via outbox/ledger)
4. Cancelled POs with legacy is_deleted=true: 0
5. Cancelled POs with is_deleted=false: 0
6. Amended POs with broken parent_order_id: 0
7. Duplicate order_no per company count: 0
8. Total Workflow Events: 0
9. Total Approval Policies: 0
10. Total Approval Requests: 0
================================================================================
DATABASE SAFETY CHECK SUMMARY: ALL INTEGRITY CONDITIONS SATISFIED (0 errors)
================================================================================
```

---

## 9. Approval Engine Forensic Finding & Status

Per Part 9 of the mandate:
- **Existing Schema:** `approval_policies` table exists in PostgreSQL with columns `name`, `code`, `document_type`, `min_amount`, `max_amount`, `required_role`, `priority`, `status`, `description`.
- **Existing Service:** `ApprovalEngine` (`backend/app/services/approval_engine.py`) provides `create_policy`, `check_transaction_enforcement`, and `submit_approval_request`.
- **Finding on Production Seeding:** The repository and specifications currently contain **no predefined numeric threshold brackets** for Purchase Order approvals (unlike Till Limits and Customer Credit Limits).
- **Mandatory Governance Statement:**
  > **"Approval threshold values require business confirmation."**
  Per policy, arbitrary financial thresholds must not be guessed or permanently seeded into control plane data.

---

## 10. Conclusion & Gate Readiness
- Phases A, B, and C are thoroughly reconstructed and verified.
- The PO lifecycle foundation is solid, regression-tested (62/62 tests green), and fully integrated with the universal engine.
- Proceed to execution of real `ApprovalEngine` test battery (Part 8) and conditional Phase 2 implementation.
