<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Testing Standards & Coverage Governance

**Status:** FROZEN — v1.0 (2026-07-28)  
**Reference ADR:** ADR-003 (Engineering Constitution), SEB v1.0 §10

---

## 1. Mandatory Test Layers Per Module
| Layer | Tool | Coverage Target |
| :--- | :--- | :--- |
| Unit Tests | Pytest | Core business rule functions |
| Integration Tests | Pytest + SQLAlchemy TestDB | Repository & service layer |
| API Tests | Pytest + FastAPI TestClient | All REST endpoints |
| UI / E2E Tests | Playwright (`tests/e2e/`) | Critical user workflows |
| Performance | Locust (optional) | High-throughput POS paths |

## 2. Test Location Convention
```text
backend/app/modules/
    inventory/
        tests/
            test_inventory_service.py
            test_inventory_api.py
            test_inventory_repository.py
```

## 3. Test Naming Convention
```python
# ✅ Correct
def test_gst_calculator_returns_correct_igst_for_interstate_sale():
    ...

# ❌ Prohibited
def test1():
    ...
def testSomething():
    ...
```

## 4. No Mock Data in Production (GR-010)
- `pytest` fixtures and test factory functions are confined to `tests/` directories.
- Zero `if DEBUG: return mock_data` constructs in service or repository code.

## 5. CI Gate Requirements
All pull requests require:
```bash
python -m pytest backend/app/tests/ --tb=short
python scripts/validate_ssot_architecture.py
python scripts/validate_layout_tokens.py
npx tsc --noEmit
```
A PR with failing tests or linter violations MUST NOT be merged.

## 6. Test Independence Rule
Each test must be independently runnable without depending on another test's output. Use `pytest fixtures` with proper `setup` and `teardown` for database state.
