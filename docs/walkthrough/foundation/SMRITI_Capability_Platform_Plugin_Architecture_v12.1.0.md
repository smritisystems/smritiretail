<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders:
  * Pushpa Devi Jawahar Mallah (Founder & Chairperson)
  * Jawahar Ramkripal Mallah (Founder, CEO & Chief Software Architect)

  Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
  Version    : 12.1.0
  Created    : 2026-07-21
  Modified   : 2026-07-21
  Copyright  : © SMRITIBooks.com. All Rights Reserved.
  License    : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 18: SMRITI Modular Platform (SMP-001 v1.0) & SMRITI Platform Kernel (SPK v12.1.0) — Walkthrough

## 1. Purpose
This walkthrough documents the realization of the **SMRITI Modular Platform Specification (SMP-001 v1.0)** driven by the **SMRITI Platform Kernel (SPK v12.1.0)** runtime engine. SMP-001 transforms SMRITI Retail OS into a 10-year scalable enterprise platform where every module is independently auto-discovered and configurable via standardized manifests.

## 2. Scope
- Governance Specification Suite (`SMP_001` through `SMP_008`).
- Manifest Triplet (`platform_manifest.json`, `event_manifest.json`, `modules/accounting/module.json`).
- Alembic DDL Migration (`v1210_smriti_modular_platform_tables.py`).
- SPK Kernel Engine (`spk_kernel.py`) with 6 sub-managers, 12 core sub-registries, and `SmritiModule` contract.
- REST API router `/api/v1/capabilities/` (`matrix`, `toggles`, `profiles`, `performance`, `health`).
- Frontend Capability Store & Module Studio (`capability_store.ts`, `ModuleStudio.tsx`).
- Pytest suite (`test_capability_manager.py`).

## 3. Files Created
- `/docs/governance/SMP_001_Modular_Platform_Specification.md`
- `/docs/governance/SMP_002_Module_Development_Standard.md`
- `/docs/governance/SMP_003_Registry_And_Event_Contracts.md`
- `/docs/governance/SMP_004_Capability_Profiles_And_Templates.md`
- `/docs/governance/SMP_005_Versioning_And_Compatibility_Policy.md`
- `/docs/governance/SMP_006_Security_And_Trust_Model.md`
- `/docs/governance/SMP_007_Marketplace_And_Extension_SDK.md`
- `/docs/governance/SMP_008_Observability_And_Diagnostics.md`
- `/backend/app/core/platform/platform_manifest.json`
- `/backend/app/core/platform/event_manifest.json`
- `/backend/app/modules/accounting/module.json`
- `/backend/alembic/versions/v1210_smriti_modular_platform_tables.py`
- `/backend/app/core/spk_kernel.py`
- `/backend/app/core/capability_manager.py`
- `/backend/app/api/v1/capabilities.py`
- `/src/lib/capability_store.ts`
- `/src/components/ModuleStudio.tsx`
- `/backend/app/tests/test_capability_manager.py`
- `/docs/implementation/foundation/SMRITI_Capability_Platform_Plugin_Architecture_Plan_v12.1.0.md`
- `/docs/walkthrough/foundation/SMRITI_Capability_Platform_Plugin_Architecture_v12.1.0.md`

## 4. Files Modified
- `/backend/app/main.py`
- `/backend/app/api/v1/__init__.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 5. Architecture Decisions
- **SMP-001 Constitutional Specification:** Decouples platform specifications from runtime implementations.
- **Topological DAG Startup:** SPK executes startup phases deterministically (`BOOT → INITIALIZE → LOAD MODULES → START → READY → SHUTDOWN`).
- **Module Failure Isolation:** Exception boundaries prevent non-critical module failures from crashing Retail Core.

## 6. Design Rationale
- Kirana and retail stores onboard instantly with `Retail Lite v1.0` profile without seeing complex enterprise options. Enterprise customers unlock modules smoothly via single-click profiles or REST toggles.

## 7. Implementation Summary
- SPK Kernel coordinates 12 Core Registries and manages module state persistence in PostgreSQL (`module_states`).
- REST API gateway provides real-time telemetry metrics (`memory_footprint_mb`, `active_api_routes`, `startup_duration_ms`).

## 8. Tests Executed
- `.\.venv311\Scripts\pytest backend/app/tests/test_accounting.py backend/app/tests/test_capability_manager.py -v` (10 Passed)
- `npx tsc --noEmit` (0 Errors)

## 9. Verification Results
```text
backend/app/tests/test_capability_manager.py::test_spk_kernel_initialization_and_defaults PASSED
backend/app/tests/test_capability_manager.py::test_critical_module_protection_prevents_disable PASSED
backend/app/tests/test_capability_manager.py::test_prerequisite_dependency_auto_enable PASSED
backend/app/tests/test_capability_manager.py::test_dependent_module_prevents_disabling_prerequisite PASSED
backend/app/tests/test_capability_manager.py::test_capability_profile_application PASSED
backend/app/tests/test_capability_manager.py::test_fastapi_capability_guard_rejection PASSED
backend/app/tests/test_capability_manager.py::test_spk_kernel_diagnostics_telemetry PASSED
7 passed in 0.73s.
```

## 10. Known Limitations
- Marketplace digital signatures are validated via SHA256 checksums; PKI certificate authority signatures will be expanded in Phase 19.

## 11. Future Work
- Phase 19: Marketplace & Third-Party Extension SDK Engine (v13.0.0).

## 12. Related ADRs
- ADR-002 SMRITI Metadata Architecture
- AOP-001 SMRITI Optionality Principle

## 13. Related RFCs
- RFC-018 SMRITI Modular Platform & Capability Manager Interface
