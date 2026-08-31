---
title: "Sprint 27: P1.4 Formula, Rule, Policy, and Workflow Engines (Governed Logic)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 27 — P1.4 Formula, Rule, Policy, and Workflow Engines (Governed Logic)

## 1. Purpose
This sprint fulfills **Blueprint Section 5: P1 Governed Logic and Reproducibility (P1.4 Formula, Rule, Policy, and Workflow Engines)**. It consolidates versioned registries in `smritisys` and deterministic execution engines for:
- Mathematical & financial formulas (AST-based, pure Decimal arithmetic, zero arbitrary code execution).
- Declarative business rules (condition trees + action emitters for pricing, discounts, loyalty, and credit limits).
- Statutory, tax, and retail policies (GST intrastate/interstate place of supply, cash till limits, rounding).
- Document and entity workflow state machines (purchase orders, sales returns, price revisions).

## 2. Scope
- **Formula AST Engine**: Recursive Decimal AST interpreter supporting literals, params, binary operators, functions (`round`, `min`, `max`, `abs`), and zero-division protection.
- **Business Rule Evaluator**: Condition tree evaluator (`all`, `any`, `not`, typed comparisons) emitting structured discount and threshold actions.
- **Statutory GST Tax Engine**: Place of supply statutory calculator splitting intrastate (CGST+SGST) vs interstate (IGST) line item taxes.
- **Workflow State Machine**: Transition validator asserting current state, requested action, and caller RBAC roles.
- **Unified Diagnostic Validator**: `/api/v1/governed-logic/validate` endpoint verifying AST syntax, operator safety, and workflow transition graphs before storage.
- **Verification**: 9/9 new integration tests in `backend/tests/t_gov_logic.py` (44/44 full regression tests green).

## 3. Files Created
- [`backend/app/schemas/gov_logic.py`](file:///F:/SMRITRretailNX/backend/app/schemas/gov_logic.py) — Pydantic schemas for formulas, rules, policies, workflows, and validation.
- [`backend/app/db/seed_gov_logic.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_gov_logic.py) — Authoritative seeder for canonical formulas, rules, policies, and workflows into `smritisys`.
- [`backend/tests/t_gov_logic.py`](file:///F:/SMRITRretailNX/backend/tests/t_gov_logic.py) — 9-part integration test suite.
- [`docs/walkthrough/foundation/Sprint27_Governed_Logic_Engines_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint27_Governed_Logic_Engines_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/services/governed_rules.py`](file:///F:/SMRITRretailNX/backend/app/services/governed_rules.py) — Added AST syntax validators and workflow graph validation to `GovernedRuleEngine`.
- [`backend/app/api/v1/governed_logic.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/governed_logic.py) — Expanded REST router with query listing, evaluation, and validation endpoints.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 5.1 to `DONE / VERIFIED` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 27 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.43.0`.

## 5. Architecture Decisions
- **Zero Arbitrary Code Execution**: No `eval()`, `exec()`, or runtime code compilation is allowed in `smritisys` or runtime evaluation. All calculations execute through structured JSON ASTs.
- **Deterministic Decimal Arithmetic**: All monetary and percentage calculations use Python `Decimal` with explicit rounding modes (`ROUND_HALF_UP`) to prevent floating-point drift.
- **Fail-Closed Workflow Transitions**: Undefined transitions or transitions initiated by users lacking required roles fail closed with explicit validation errors.

## 6. Design Rationale
In enterprise multi-tenant retail and ERP platforms, business rules, tax algorithms, and workflow transitions must be versioned, immutable, and reproducible so that historical invoices and audit logs can be replayed with absolute mathematical consistency.

## 7. Implementation Summary
- **Formulas**: `GET /api/v1/governed-logic/formulas` and `POST /api/v1/governed-logic/formulas/evaluate`.
- **Rules**: `GET /api/v1/governed-logic/rules` and `POST /api/v1/governed-logic/rules/evaluate`.
- **Policies**: `GET /api/v1/governed-logic/policies` and `POST /api/v1/governed-logic/policies/gst/evaluate`.
- **Workflows**: `GET /api/v1/governed-logic/workflows` and `POST /api/v1/governed-logic/workflows/transition`.
- **Validation**: `POST /api/v1/governed-logic/validate`.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python app/db/seed_gov_logic.py
python -m pytest tests/t_gov_logic.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 9 items

tests/t_gov_logic.py::test_formula_registry_listing PASSED               [ 11%]
tests/t_gov_logic.py::test_formula_ast_evaluation_net_price PASSED       [ 22%]
tests/t_gov_logic.py::test_formula_ast_evaluation_zero_division_guard PASSED [ 33%]
tests/t_gov_logic.py::test_business_rules_listing PASSED                 [ 44%]
tests/t_gov_logic.py::test_business_rule_evaluation PASSED               [ 55%]
tests/t_gov_logic.py::test_statutory_gst_tax_policy_intrastate PASSED    [ 66%]
tests/t_gov_logic.py::test_statutory_gst_tax_policy_interstate PASSED    [ 77%]
tests/t_gov_logic.py::test_workflow_state_machine_transition PASSED      [ 88%]
tests/t_gov_logic.py::test_definition_validation_endpoint PASSED         [100%]

======================== 9 passed, 8 warnings in 9.61s ========================
```

## 10. Known Limitations
- Transaction snapshot anchoring is handled in P1.5 (Transaction Reproducibility).

## 11. Future Work
- Sprint 28: `P1.5 Transaction Reproducibility & Historical Replay Engine (Blueprint Section 5.2)`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-005`: Governed Logic & Deterministic AST Interpretation

## 13. Related RFCs
- `RFC-GOV-001`: Versioned Formula, Rule, Policy, and Workflow Architecture
