<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 12.1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 18: SMRITI Modular Platform (SMP-001 v1.0) & SMRITI Platform Kernel (SPK v12.1.0) Architecture — CONSTITUTIONALLY FROZEN BASELINE

## 1. Objective
Establish the **SMRITI Modular Platform Baseline Specification (SMP-001 v1.0)** driven by the **SMRITI Platform Kernel (SPK v12.1.0)**. SMP-001 defines architectural contracts, not implementation details. SPK orchestrates Kernel Lifecycle (`BOOT → INITIALIZE → LOAD MODULES → START → READY → SHUTDOWN`), Public vs Internal Kernel APIs, 6 kernel sub-managers (`Module Manager (SCM)`, `Registry Manager`, `Event Manager`, `Security Manager`, `Health Manager`, `Profile Manager`), 12 Core Registries (with extensible custom registry registration), auto-discovered per-module manifests (`modules/*/module.json`), SHA256 digital signatures, trust tiers (`FIRST_PARTY`, `CERTIFIED_PARTNER`, `COMMUNITY`, `PRIVATE_INTERNAL`), versioned dot-notation event contracts (`Domain.Entity.Action:v1`), feature-level dependencies (`REQUIRED`, `OPTIONAL`, `RUNTIME`, `DEVELOPMENT`), module failure isolation, 6 error namespaces (`SMRITI-CAP`, `SMRITI-MOD`, `SMRITI-REG`, `SMRITI-EVT`, `SMRITI-LIC`, `SMRITI-HLT`), PostgreSQL database installation state persistence (`module_states`), and an 8-document SMP Governance Specification Suite.

## 2. Business Motivation
- **Market Tailoring:** Kirana and footwear stores onboard instantly with `Retail Lite v1.0` profile without seeing complex finance or enterprise menus.
- **Enterprise Expansion:** Growing multi-branch chains unlock Advanced Accounting, Manufacturing, and AI capabilities through simple configuration toggles or one-click profiles.
- **Performance & Security Optimization:** Unused modules remain dormant, eliminating unnecessary background jobs, queries, or memory footprint.

## 3. Scope
- Governance Spec Suite (`docs/governance/SMP_001` through `SMP_008`).
- Manifests (`platform_manifest.json`, `event_manifest.json`, `modules/*/module.json`).
- Alembic DB DDL (`v1210_smriti_modular_platform_tables.py`).
- SPK Kernel (`spk_kernel.py` with `SmritiModule` contract, `ModuleContext`, 6 Sub-Managers, DAG topological sort, error namespaces).
- REST API Gateway `/api/v1/capabilities/`.
- Frontend Capability Store & Module Studio (`src/lib/capability_store.ts`, `src/components/ModuleStudio.tsx`).
- Pytest Suite (`backend/app/tests/test_capability_manager.py`).

## 4. Current State
- `ACCOUNTING_MODE` is feature-flagged. Subsystems are being converted to capability-managed plugins conforming to SMP-001.

## 5. Gap Analysis
- Need a unified, cross-cutting 4-level Capability Registry covering all 12 domain categories with per-module auto-discovery and DB state persistence.

## 6. Architecture Impact
- Standardizes all existing and future modules on the `SmritiModule` contract and topological DAG startup sequence.

## 7. Proposed Design
- Structural separation into 3 manifest types (`platform`, `event`, `module`).
- Production database persistence with multi-node cluster caching.

## 8. Files Created
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
- `/backend/app/api/v1/capabilities.py`
- `/src/lib/capability_store.ts`
- `/src/components/ModuleStudio.tsx`
- `/backend/app/tests/test_capability_manager.py`
- `/docs/implementation/foundation/SMRITI_Capability_Platform_Plugin_Architecture_Plan_v12.1.0.md`

## 9. Files Modified
- `/backend/app/main.py`
- `/backend/app/api/v1/__init__.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- Pydantic V2, FastAPI, SQLAlchemy, Zustand / React.

## 11. Risks
- Module failure isolation prevents non-critical module exceptions from bringing down Retail Core.

## 12. Rollback Strategy
- Fallback to `smriti-installation-state.json` defaults.

## 13. Verification Plan
- Automated pytest suite and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for auto-discovery, DAG topological sorting, DB persistence, lifecycle hooks, error namespaces, and health monitoring.

## 15. Documentation Impact
- Governance specifications `SMP-001` through `SMP-008`, implementation plan, and walkthrough.

## 16. Deployment Plan
- Git commit and build verification.

## 17. Status
Approved / In Progress.

## 18. Related ADRs
- ADR-002 SMRITI Metadata Architecture.
- AOP-001 SMRITI Optionality Principle.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/SMRITI_Capability_Platform_Plugin_Architecture_v12.1.0.md`
