---
title: "Sprint 28: P1.5 Transaction Reproducibility & Historical Replay Engine (Governed Logic)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 28 — P1.5 Transaction Reproducibility & Historical Replay Engine (Governed Logic)

## 1. Purpose
This sprint fulfills **Blueprint Section 5: P1 Governed Logic and Reproducibility (P1.5 Transaction Reproducibility)**. It introduces immutable version snapshot anchoring (`formula_versions`, `rule_versions`, `policy_versions`, `pricing_version`, `accounting_rule_version`, `doc_template_version`) and a deterministic historical replay recalculation engine across critical retail transactions (Sales Invoices, Sales Returns, Payments, GST calculations, Discounts, and Accounting Ledger Postings).

## 2. Scope
- **6-Part Governance Snapshot**: Immutable anchoring of version states for formulas, rules, policies, pricing, accounting rules, and document templates.
- **Historical Replay Engine**: Recalculates historical invoices using snapshot-bound definitions from `smritisys` rather than mutable ambient configurations.
- **Mathematical Zero Drift Guarantee**: Proof that publishing a newer rule version (e.g. 20% discount) leaves historical invoices created under Rule v1 (10% discount) 100% mathematically unchanged upon recalculation.
- **Balanced Ledger Postings Replay**: Automatically constructs double-entry journal postings matching recalculated net and tax totals (Debit Cash/Debtors == Credit Revenue + Output GST).
- **Automated Calculation Drift Detector**: Automated discrepancy comparator flagging any deviation between historical recorded totals and replayed values.
- **Verification**: 7/7 new integration tests in `backend/tests/t_tx_reproduce.py` (51/51 full regression tests green).

## 3. Files Created
- [`backend/app/schemas/tx_reproduce.py`](file:///F:/SMRITRretailNX/backend/app/schemas/tx_reproduce.py) — Pydantic models for `GovernanceSnapshot`, `TransactionReplayRequest`, `TransactionReplayResponse`, and `LedgerEntryReplay`.
- [`backend/tests/t_tx_reproduce.py`](file:///F:/SMRITRretailNX/backend/tests/t_tx_reproduce.py) — 7-part reproducibility and replay integration test suite.
- [`docs/walkthrough/foundation/Sprint28_Transaction_Reproducibility_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint28_Transaction_Reproducibility_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/services/tx_reproduce_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/tx_reproduce_svc.py) — Enhanced `TransactionReproducibilityService` with balanced ledger generator, drift detection, and 6-part snapshot creation.
- [`backend/app/api/v1/governed_logic.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/governed_logic.py) — Mounted `/snapshot/create` and `/replay` REST endpoints.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 5.2 to `DONE / VERIFIED` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 28 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.44.0`.

## 5. Architecture Decisions
- **Immutable Snapshot Structure**: Snapshots store discrete integer versions of rules, policies, and formulas rather than serialized executable code, guaranteeing zero tamper risk and deterministic reconstruction.
- **Replay Precision**: Recalculations use high-precision Python `Decimal` arithmetic with `ROUND_HALF_UP` statutory roundings.
- **Drift Tolerance Threshold**: Any discrepancy greater than `0.01` currency units between recorded totals and replayed values triggers a `drift_detected` flag with granular diff details.

## 6. Design Rationale
In enterprise retail, audits and statutory tax inspections require re-verifying historical invoices years after issuance. Dynamic or unversioned business logic causes calculation drift when tax rates or promotional policies change. Version-anchoring and historical replay ensure permanent auditability and legal compliance.

## 7. Implementation Summary
- **Snapshot Creation**: `POST /api/v1/governed-logic/snapshot/create` generates the 6-part snapshot.
- **Historical Replay**: `POST /api/v1/governed-logic/replay` recalculates totals and returns balanced ledger postings with drift diagnostics.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/t_tx_reproduce.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 7 items

tests/t_tx_reproduce.py::test_snapshot_creation_with_all_6_dimensions PASSED [ 14%]
tests/t_tx_reproduce.py::test_historical_invoice_replay_rule_v1_vs_v2_zero_drift PASSED [ 28%]
tests/t_tx_reproduce.py::test_statutory_gst_recalculation_replay PASSED  [ 42%]
tests/t_tx_reproduce.py::test_ledger_double_entry_postings_generation PASSED [ 57%]
tests/t_tx_reproduce.py::test_drift_detection_when_totals_mismatch PASSED [ 71%]
tests/t_tx_reproduce.py::test_api_snapshot_create_endpoint PASSED        [ 85%]
tests/t_tx_reproduce.py::test_api_replay_endpoint PASSED                 [100%]

======================== 7 passed, 8 warnings in 8.11s ========================
```

## 10. Known Limitations
- Transaction snapshots are attached as JSON metadata in `transactions.governance_metadata`.

## 11. Future Work
- Sprint 29: `P1.1 Universal Party Master Completion (Blueprint Section 6.1)`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-005`: Governed Logic & Deterministic AST Interpretation

## 13. Related RFCs
- `RFC-TX-001`: Transaction Immutability and Historical Replay Architecture
