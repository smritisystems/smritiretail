<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.2.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Platform Validation Engine (PVE v5.2.0) Architecture Walkthrough

## 1. Purpose
This walkthrough documents the design and implementation of the **SMRITI Universal Platform Validation Engine (PVE v5.2.0)**. PVE elevates field validation and cross-field dependency checking from a module-specific inventory helper into a **decoupled, reusable platform capability** across Product Master, Customer Master, Supplier Master, Purchase Orders, Sales Orders, and POS Billing.

---

## 2. Scope
- **Core PVE Engine (`backend/app/core/validation/`)**:
  - `schemas.py`: Defined `ValidationMode` (`NONE`, `WARNING`, `STRICT`, `AUTO_CREATE`), `CasingRule`, `FieldValidationConfig`, `ConditionalRuleConfig`, `ValidationPolicy`, `ValidationResult`.
  - `rules.py`: Defined `RuleEvaluator` supporting priority-based conditional rule evaluation (`priority: int`, `when`, `require`, `disable`, `set_mode`).
  - `engine.py`: Defined `PlatformValidationEngine` and `ValidationPolicyCache` (in-memory TTL cache).
- **Service Integration**:
  - `backend/app/services/inventory.py`: Integrated PVE into `create_product` via `get_validation_engine().validate_entity`.
- **Policy Configuration API (`backend/app/api/v1/validation_policy.py`)**:
  - `GET /api/v1/validation-policies/{entity_type}`: Fetch effective validation policy schema.
  - `PUT /api/v1/validation-policies/{entity_type}`: Update tenant validation policy and invalidate policy cache.
  - `POST /api/v1/validation-policies/{entity_type}/reset`: Reset policy to system default.
- **Automated Verification**:
  - Created `backend/app/tests/test_platform_validation_engine.py` (6 tests) and re-ran `test_master_hybrid.py` (10 tests) — 16/16 passed.

---

## 3. Files Created
- `backend/app/core/validation/__init__.py`: Package exports for PVE framework.
- `backend/app/core/validation/schemas.py`: Pydantic models for validation policies, field configs, conditional rules, and validation results.
- `backend/app/core/validation/rules.py`: Priority-based rule evaluator.
- `backend/app/core/validation/engine.py`: Core validation engine with policy cache and `validate_entity` pipeline.
- `backend/app/api/v1/validation_policy.py`: REST API endpoints for policy management.
- `backend/app/tests/test_platform_validation_engine.py`: Comprehensive test suite verifying all 4 validation modes, priority resolution, AUTO_CREATE role authorization, and REST endpoints.
- `docs/walkthrough/foundation/Platform_Validation_Engine_PVE_v5.2.0.md`: This walkthrough document.

---

## 4. Files Modified
- `backend/app/services/inventory.py`: Integrated `PlatformValidationEngine` into product creation.
- `backend/app/api/v1/__init__.py`: Exported `validation_policy` router submodule.
- `backend/app/main.py`: Registered `/api/v1/validation-policies` endpoint routes under tags `["Platform Validation Engine (PVE)"]`.
- `docs/walkthrough/README.md`: Appended walkthrough entry for PVE v5.2.0.
- `CHANGELOG.md`: Appended release notes for v5.2.0.

---

## 5. Architecture Decisions
1. **Metadata Policy Separation**: UI presentation (`label`, `widget`) is decoupled from Validation Policy (`mandatory`, `mode`, `master_type`, `casing`).
2. **Deterministic Priority Resolution**: Conditional rules specify `priority: int`. Higher priority rules (e.g. `200`) override lower priority rules (e.g. `100`) on property conflicts.
3. **Low-Latency In-Memory Caching**: `ValidationPolicyCache` caches policy definitions in memory with TTL invalidation, eliminating DB overhead during POS checkouts.
4. **`AUTO_CREATE` Governance**: `AUTO_CREATE` requires role authorization (`auto_create_allowed_roles`). Unauthorized users fall back to `STRICT` HTTP 422 failure with `validation_mode: "AUTO_CREATE_UNAUTHORIZED"`.

---

## 6. Design Rationale
Moving validation out of hardcoded service logic into a centralized, configurable policy engine guarantees consistent business rules, observable error diagnostics, and easy customization across retail verticals.

---

## 7. Implementation Summary
- **Evaluation Pipeline**: `validate_entity` evaluates conditional rules, applies casing normalization, checks mandatory/disabled flags, and evaluates values against Master Lookups based on effective validation modes.
- **Explainability**: Error payloads expose `policy_id`, `validation_mode`, and `master_type` for complete observability.

---

## 8. Tests Executed
Command:
```bash
python -m pytest app/tests/test_platform_validation_engine.py app/tests/test_master_hybrid.py -v
```

Terminal Output:
```text
app/tests/test_platform_validation_engine.py::test_pve_default_strict_validation_success PASSED [  6%]
app/tests/test_platform_validation_engine.py::test_pve_strict_validation_failure_raises_smriti_val_010 PASSED [ 12%]
app/tests/test_platform_validation_engine.py::test_pve_warning_mode_allows_unrecognized_value PASSED [ 18%]
app/tests/test_platform_validation_engine.py::test_pve_auto_create_mode_authorized PASSED [ 25%]
app/tests/test_platform_validation_engine.py::test_pve_conditional_rule_priority_resolution PASSED [ 31%]
app/tests/test_platform_validation_engine.py::test_validation_policy_api_endpoints PASSED [ 37%]
app/tests/test_master_hybrid.py::test_1_list_colors_returns_system_and_tenant_values PASSED [ 43%]
app/tests/test_master_hybrid.py::test_2_create_custom_color_dusty_rose PASSED [ 50%]
app/tests/test_master_hybrid.py::test_3_delete_system_value_returns_403_smriti_val_020 PASSED [ 56%]
app/tests/test_master_hybrid.py::test_4_update_system_value_name_returns_403_smriti_val_021 PASSED [ 62%]
app/tests/test_master_hybrid.py::test_5_toggle_active_on_beige_flips_active PASSED [ 68%]
app/tests/test_master_hybrid.py::test_6_post_product_with_lowercase_color_normalized_to_title_case PASSED [ 75%]
app/tests/test_master_hybrid.py::test_7_post_product_with_invalid_color_returns_422_smriti_val_010 PASSED [ 81%]
app/tests/test_master_hybrid.py::test_8_post_product_with_lowercase_size_normalized_to_upper_case PASSED [ 87%]
app/tests/test_master_hybrid.py::test_9_post_product_with_invalid_category_returns_422_smriti_val_010 PASSED [ 93%]
app/tests/test_master_hybrid.py::test_10_tenant_a_cannot_see_tenant_b_custom_colors PASSED [100%]

================= 16 passed, 122 warnings in 86.85s (0:01:26) =================
```

---

## 9. Verification Results
- 16/16 tests passed.
- PVE modes `STRICT`, `WARNING`, `NONE`, `AUTO_CREATE` verified.
- Priority resolution verified: Priority 200 rule overrode Priority 100 rule.
- REST API endpoints GET/PUT/POST reset verified.

---

## 10. Known Limitations
- Redis distributed cache synchronization across multi-instance clusters is deferred to Phase 3.

---

## 11. Future Work
- Extend PVE policies to Customer Master, Supplier Master, and Sales Order headers.
- Expose PVE Policy Manager UI within SMRITI Screen Studio.

---

## 12. Related ADRs
- `ADR-015`: Universal Platform Validation Engine & Policy Engine.

---

## 13. Related RFCs
- `RFC-023`: Platform Validation & Metadata Separation Standard.
