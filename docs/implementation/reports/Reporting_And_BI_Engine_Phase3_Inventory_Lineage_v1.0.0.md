<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.35.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Reporting & BI Engine — Phase 3 (Inventory 3-Tier State & Universal Audit Lineage)

## 1. Objective
Implement **Phase 3** (Steps 05 and 06 of the 12-stage roadmap) for the SMRITI Retail OS Reporting & BI Engine v1.0.0-GA:
1. **3-Tier Inventory State & Snapshot Engine** (Enforcing Invariant 6: Bounded valuation calculation without full ledger replay).
2. **Universal Drill-Down Pipeline & Forensic Audit Lineage** (Enforcing Invariant 7: Immutable document trace for every aggregate number).

## 2. Business Motivation
- Prevent performance collapse during historical stock valuation runs by anchoring calculations to frozen monthly/quarterly snapshots rather than replaying millions of ledger rows from system inception.
- Enable full statutory audit compliance by allowing auditors and store managers to click any summary cell and trace it directly to source POS invoices, GRN notes, and user audit events.

## 3. Scope
- 3-Tier inventory state computation engine in `backend/app/core/inventory_snapshot_engine.py`.
- Universal drill-down and audit lineage tracer in `backend/app/core/audit_lineage.py`.
- Verification test suite in `backend/tests/test_inventory_snapshots_and_lineage.py`.

## 4. Architecture Invariants Enforced
- **Invariant 6:** No historical inventory valuation depends indefinitely on replaying the entire transaction ledger.
- **Invariant 7:** No aggregate number loses its transaction/document lineage.
- **Invariant 8:** Drill-down paths cross navigation boundaries seamlessly without duplicating reporting logic.

## 5. Proposed Design

### A. 3-Tier Inventory State Engine (`inventory_snapshot_engine.py`)
- **Tier 1: Live State** — Reads current live stock balance for instant POS checkout.
- **Tier 2: Transaction-Derived State** — Reconstructs stock as of date $T$ using:
  $$\text{Stock}(T) = \text{Snapshot}(S) + \sum_{t=S}^{T} \text{Inward}(t) - \sum_{t=S}^{T} \text{Outward}(t) \pm \sum_{t=S}^{T} \text{Adjustments}(t)$$
  where $S$ is the latest frozen snapshot prior to $T$.
- **Tier 3: Frozen Periodic Snapshot** — Immutable historical valuation record per branch/item with landed cost valuation and integrity hash.

### B. Universal Audit Lineage Engine (`audit_lineage.py`)
- Standardized 4-level drill-down path:
  1. `Level 1: Studio Summary` (e.g., Brand/Category Sales Total)
  2. `Level 2: Article / Item Ledger` (e.g., Units sold by SKU)
  3. `Level 3: Document Register` (e.g., Invoices matching the SKU)
  4. `Level 4: Granular Document Audit` (e.g., Raw receipt, cashier timestamp, terminal ID, payment hash)
- Generates `AuditLineageTrace` with cryptographically traceable lineage IDs.

## 6. Files Created
- `backend/app/core/inventory_snapshot_engine.py`
- `backend/app/core/audit_lineage.py`
- `backend/tests/test_inventory_snapshots_and_lineage.py`
- `docs/implementation/reports/Reporting_And_BI_Engine_Phase3_Inventory_Lineage_v1.0.0.md`

## 7. Files Modified
- `docs/implementation/README.md`

## 8. Verification Plan
- Run `pytest backend/tests/test_inventory_snapshots_and_lineage.py -v`.
- Test point-in-time stock reconstruction against synthetic snapshot + delta ledger.
- Test 4-level drill-down navigation context generation.

## 9. Status
In Progress (Phase 3 Execution)
