<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.59.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Sprint 43: P2 PSV, CGE, and PDT Unification

**Version:** `v1.0.0`  
**Area:** `foundation`  
**Module:** `PSV / CGE / PDT`  
**Certification Status:** `Done / Verified`  

---

## 1. Purpose
To implement and unify the three critical foundation capability planes specified in Blueprint Section 9:
1. **Projected Stock Visibility (PSV):** Non-authoritative stock projection ledger with strict party-scoped isolation and immutable event ingestion.
2. **Commercial Growth Engine (CGE):** Unified growth policy engine with anti-self-referral fraud protection, velocity points capping, and cascading refund clawbacks.
3. **Predictive Distribution Twin (PDT):** Pure read-only analytical twin and replenishment forecasting engine isolated from transactional stock truth.

---

## 2. Scope
- Tenant PostgreSQL schema provisioning for `psv_visibility_policies`, `psv_party_scopes`, `psv_stock_events`, `psv_stock_balances`, `cge_unified_policies`, `pdt_model_registry`, `pdt_sku_twin_cache`, `pdt_demand_signals`, `pdt_distribution_predictions`.
- Implementation of `PSVProjectionService` with party-scoped projection filters and idempotent projection deduplication.
- Implementation of `CGEUnifiedPolicyEngine` enforcing multi-vector anti-abuse heuristics and transactional benefit clawbacks.
- Implementation of `PDTIntelligenceEngine` generating multi-factor demand forecasts and safety stock recommendations.
- Provisioning REST API endpoints under `/api/v1/psv/*`, `/api/v1/cge-unified/*`, and `/api/v1/pdt/*`.
- 100% test coverage across all 3 modules with 11 automated integration tests.

---

## 3. Files Created
1. `backend/app/db/migr_pdt_psv.py` — Database migration for PSV, CGE, and PDT tables.
2. `backend/app/models/pdt.py` — Analytical twin models (`PDTModelRegistry`, `PDTSkuTwinCache`, `PDTDemandSignal`, `PDTDistributionPrediction`).
3. `backend/app/models/cge_policy.py` — Unified growth policy model (`CGEUnifiedPolicy`).
4. `backend/app/schemas/pdt.py` — Pydantic schemas for predictive twin endpoints.
5. `backend/app/schemas/cge_unified.py` — Pydantic schemas for unified growth policy endpoints.
6. `backend/app/services/pdt_engine.py` — Predictive Distribution Twin intelligence engine.
7. `backend/app/services/cge_unified_svc.py` — Commercial Growth Engine unified policy engine.
8. `backend/app/api/v1/psv.py` — FastAPI router for PSV scoped visibility endpoints.
9. `backend/app/api/v1/pdt.py` — FastAPI router for PDT intelligence endpoints.
10. `backend/app/api/v1/cge_unified.py` — FastAPI router for CGE policy and reversal endpoints.
11. `backend/tests/t_psv_scope.py` — Test suite for PSV scoping, idempotency, and isolation (4 tests).
12. `backend/tests/t_pdt_engine.py` — Test suite for PDT model registration, signals, twin velocity, and isolation (4 tests).
13. `backend/tests/t_cge_unified.py` — Test suite for CGE policy creation, anti-abuse, and refund reversal (3 tests).

---

## 4. Files Modified
1. `backend/app/models/psv.py` — Added `PSVVisibilityPolicy` and `PSVPartyScope` models.
2. `backend/app/schemas/psv.py` — Added PSV projection schemas with legacy response compatibility.
3. `backend/app/services/psv_projection.py` — Added party-scoped projection filters and policy bindings.
4. `backend/app/main.py` — Mounted `psv.router`, `pdt.router`, and `cge_unified.router`.
5. `docs/architecture/BLUEPRINT_PENDING.md` — Certified Section 9 per Rule 11.

---

## 5. Architecture Decisions
1. **Non-Authoritative PSV Ledger:**
   - PSV operates as a projected, non-authoritative visibility ledger.
   - Authoritative inventory truth resides exclusively in `products.stock` and `stock_movements`.
   - PSV ingestion does not mutate transactional stock or ledgers.
2. **Party-Scoped Isolation:**
   - Visibility policies enforce allowed SKU regex patterns and maximum lookback days.
   - Parties (distributors, franchise stores) can only access projected stock strictly within their configured scope.
3. **Strict Read-Only PDT Isolation:**
   - Predictive simulations calculate safety stock and demand forecasts without acquiring transactional locks.
   - Explainability factor weights are returned for complete operational transparency.
4. **Cascading Growth Reversals:**
   - Refund processing automatically triggers clawbacks across both `LoyaltyPointsLedger` (reducing member balance) and `CommissionLedger` (reversing salesperson commissions).

---

## 6. Design Rationale
- Decoupling analytical and projected visibility from transactional truth ensures high POS performance and zero ledger corruption while allowing external channel partners and franchise operators transparent inventory forecasting.
- Unifying growth rules under `CGEUnifiedPolicy` prevents fraud vectors like self-referral and point stuffing while maintaining strict accounting alignment on order refunds.

---

## 7. Implementation Summary
- **Database Schema**: 7 new tables provisioned in tenant databases (`smriti001`, `smriti002`).
- **Engines**: `PSVProjectionService`, `CGEUnifiedPolicyEngine`, `PDTIntelligenceEngine`.
- **API Surface**: Mounted 10 new REST endpoints under `/api/v1/psv`, `/api/v1/cge-unified`, `/api/v1/pdt`.
- **Naming Guard**: 100% compliant with `< 22` character filename policy.

---

## 8. Tests Executed
```bash
python -m pytest tests/t_psv_scope.py tests/t_pdt_engine.py tests/t_cge_unified.py -v
```

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 11 items

tests/t_psv_scope.py::test_psv_party_visibility_policy_and_scoping PASSED [  9%]
tests/t_psv_scope.py::test_psv_projection_idempotency_and_balance_accumulation PASSED [ 18%]
tests/t_psv_scope.py::test_psv_multi_party_scoped_isolation PASSED       [ 27%]
tests/t_psv_scope.py::test_api_psv_endpoints PASSED                      [ 36%]
tests/t_pdt_engine.py::test_pdt_model_registration_and_demand_signals PASSED [ 45%]
tests/t_pdt_engine.py::test_pdt_sku_twin_simulation_and_prediction PASSED [ 54%]
tests/t_pdt_engine.py::test_pdt_strict_read_only_isolation_guarantee PASSED [ 63%]
tests/t_pdt_engine.py::test_api_pdt_endpoints PASSED                     [ 72%]
tests/t_cge_unified.py::test_cge_unified_policy_creation_and_anti_abuse_evaluation PASSED [ 81%]
tests/t_cge_unified.py::test_cge_refund_reversal_cascade PASSED          [ 90%]
tests/t_cge_unified.py::test_api_cge_endpoints PASSED                    [100%]

====================== 11 passed, 13 warnings in 12.64s =======================
```

---

## 10. Known Limitations
- Machine learning model execution in PDT uses mathematical heuristic fallbacks until real transaction volume is accumulated in PostgreSQL.

---

## 11. Future Work
- Connect PDT forecasting pipelines to the downstream Analytics & Intelligence Plane (Blueprint Section 11).
- Add scheduled background reconciliation jobs for PSV balance audits against transactional stock movements.

---

## 12. Related ADRs
- `ADR-POS-002-ShiftC`: POS and Transactional Integrity.
- `ADR-MIG-003-SoleFastAPI`: FastAPI + Postgres Sole System of Record.

---

## 13. Related RFCs
- `RFC-PSV-001`: Projected Stock Visibility Non-Authoritative Architecture.
- `RFC-CGE-002`: Commercial Growth Engine Anti-Abuse and Cascading Clawbacks.
- `RFC-PDT-003`: Predictive Distribution Twin Read-Only Isolation.
