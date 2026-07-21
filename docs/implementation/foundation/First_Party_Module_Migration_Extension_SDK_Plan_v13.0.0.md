<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 13.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 19: First-Party Module Migration & Marketplace Extension SDK Engine (v13.0.0) — Approved Plan

## 1. Objective
Execute **Phase 19** of the SMRITI Modular Platform Roadmap: Migrate all first-party Retail Core subsystems (`sales`, `inventory`, `pos`, `purchase`, `crm`, `accounting`) into standardized SMP-001 module packages (`backend/app/modules/<module_id>/`) with `module.json` manifests and `bootstrap.py` lifecycle handlers conforming to the `SmritiModule` interface contract. In addition, deliver the **SMRITI Extension SDK (`extension_sdk.py`)**, **SMRITI Module Packager (`module_packager.py` producing `.smx` packages)**, and **Security Verification Engine (`security_manager.py`)** supporting SHA256 digital signatures, trust tiers (`FIRST_PARTY`, `CERTIFIED_PARTNER`, `COMMUNITY`, `PRIVATE_INTERNAL`), developer CLI `doctor()`, and automated manifest validation for the upcoming SMRITI Marketplace ecosystem.

## 2. Business Motivation
- **Product Ecosystem:** Establishes standard module packaging across all SMRITI subsystems.
- **Marketplace Readiness:** Third-party partners and clients can develop `.smx` extension modules conforming to SMP-002 standards with digital signature verification.

## 3. Scope
- Package layouts (`backend/app/modules/<module_id>/module.json` & `bootstrap.py` for `sales`, `inventory`, `pos`, `purchase`, `crm`, `accounting`).
- Extension SDK (`backend/app/core/extension_sdk.py`).
- Module Packager (`backend/app/core/module_packager.py`).
- Security Manager (`backend/app/core/security_manager.py`).
- SPK Kernel Auto-Discovery Loader upgrade (`backend/app/core/spk_kernel.py`).
- Pytest integration suite (`backend/app/tests/test_extension_sdk.py`).
- Walkthrough documentation.

## 4. Current State
- SPK Kernel v12.1.0 is initialized; Phase 19 migrates first-party modules into standard directories with auto-discovery.

## 5. Gap Analysis
- Need per-module `module.json` and `bootstrap.py` handlers for `sales`, `inventory`, `pos`, `purchase`, `crm`.

## 6. Architecture Impact
- Replaces static module dictionary in SPK Kernel with dynamic directory scanning under `backend/app/modules/*/module.json`.

## 7. Proposed Design
- Scanning loader imports `bootstrap.py` dynamically, instantiates `SmritiModule` subclass, and executes `register(registry_manager)`.

## 8. Files Created
- `/backend/app/modules/sales/module.json`
- `/backend/app/modules/sales/bootstrap.py`
- `/backend/app/modules/inventory/module.json`
- `/backend/app/modules/inventory/bootstrap.py`
- `/backend/app/modules/pos/module.json`
- `/backend/app/modules/pos/bootstrap.py`
- `/backend/app/modules/purchase/module.json`
- `/backend/app/modules/purchase/bootstrap.py`
- `/backend/app/modules/crm/module.json`
- `/backend/app/modules/crm/bootstrap.py`
- `/backend/app/modules/accounting/bootstrap.py`
- `/backend/app/core/extension_sdk.py`
- `/backend/app/core/module_packager.py`
- `/backend/app/core/security_manager.py`
- `/backend/app/tests/test_extension_sdk.py`
- `/docs/implementation/foundation/First_Party_Module_Migration_Extension_SDK_Plan_v13.0.0.md`

## 9. Files Modified
- `/backend/app/core/spk_kernel.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- Pydantic V2, FastAPI, Python `importlib`, `hashlib`, `zipfile`.

## 11. Risks
- Critical modules (`sales`, `pos`, `inventory`) are protected by `critical=True` in their `module.json`.

## 12. Rollback Strategy
- Restore static module dictionary fallback in `spk_kernel.py`.

## 13. Verification Plan
- Automated pytest suite and `npx tsc --noEmit`.

## 14. Test Plan
- Integration tests for module auto-discovery, lifecycle hooks, manifest validation, `.smx` packaging, and SHA256 digital signatures.

## 15. Documentation Impact
- Implementation plan and walkthrough documentation.

## 16. Deployment Plan
- Git commit and build verification.

## 17. Status
Approved / In Progress.

## 18. Related ADRs
- ADR-002 SMRITI Metadata Architecture
- AOP-001 SMRITI Optionality Principle

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/First_Party_Module_Migration_Extension_SDK_v13.0.0.md`
