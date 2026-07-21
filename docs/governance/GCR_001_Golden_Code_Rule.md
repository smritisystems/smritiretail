<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0 (GCR-001 Baseline)
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Engineering Governance Standard
-->

# GCR-001: SMRITI Golden Code Rule & Engineering Standard

**Status:** FROZEN — Constitutional Engineering Standard (v1.0)  
**Effective:** 2026-07-21  
**Scope:** Universal Engineering Discipline across ALL agents, sessions, modules, and platform services  

---

## CONSTITUTIONAL PRECEPT
> **"Every line of code must improve the system without violating architecture, compatibility, security, performance, simplicity, or maintainability."**

---

## THE 20 MANDATORY ENGINEERING RULES

1. **Architecture First:** Code follows approved architecture layer boundaries (`SMP-001`, `SPK Kernel`, `Business Modules`, `Marketplace Ecosystem`).
2. **Single Responsibility:** Every module, service, and class has exactly one responsibility.
3. **Open–Closed Principle:** Software entities are open for extension, but closed for modification.
4. **No Duplicate Logic:** Centralize common validation and domain evaluation logic.
5. **Manifest Driven:** Subsystem capabilities, routes, permissions, and features are declared in manifests (`module.json`), never hard-coded.
6. **Backward Compatibility:** Public contracts, APIs, and manifests must preserve SemVer compatibility.
7. **Explicit Dependencies:** Modules must explicitly declare dependencies in `module.json`.
8. **No Magic Numbers:** Use named constant variables for all numeric thresholds.
9. **No Hardcoded Strings:** Use strongly-typed Enums or constant identifiers for channels, states, and tiers.
10. **Type Safety:** Use Pydantic V2 models, Dataclasses, and TypeScript interfaces instead of raw dicts.
11. **Fail Fast:** Never swallow exceptions or swallow errors with empty `except: pass` blocks.
12. **Atomic Operations:** Package installations, updates, database changes, and rollbacks must be transactional.
13. **Secure by Default:** All external data is untrusted until passing Integrity → Authenticity → Trust verification.
14. **Observable:** Log all operational events, state changes, signature failures, and security rejections.
15. **Test Before Merge:** Every feature requires unit, integration, and regression tests.
16. **Documentation Ships With Code:** No task is complete without an implementation plan, walkthrough, and updated index tables.
17. **Performance Budget:** Kernel startup, catalog aggregation, and route resolution must enforce latency budgets.
18. **Security Review:** Validate spoofing, tampering, replay, and abuse vectors before committing.
19. **Kernel Purity Rule:** SPK Kernel executes modules; Marketplace manages modules. SPK never makes network calls or handles certificates.
20. **Constitutional Rule:** If code conflicts with `SMP-001`, `ADRs`, or `GCR-001`, the code changes — the architecture does not.

---

## Golden Development Checklist
- [x] Architecture respected
- [x] Single responsibility enforced
- [x] No duplicate logic
- [x] Manifest driven
- [x] Backward compatible
- [x] Typed models used
- [x] Transaction safe
- [x] Security reviewed
- [x] Tests added & passing
- [x] Documentation updated
- [x] Performance validated
- [x] Logging added
