<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0 (CMP-001 Policy)
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Compatibility & Versioning Governance Policy
-->

# CMP-001: SMRITI Compatibility & Versioning Governance Policy

**Status:** APPROVED — Frozen Governance Policy (v1.0)  
**Parent Standard:** SMP-001 & PAR-001 Architecture Reference  
**Effective:** 2026-07-21  
**Scope:** Domain Release Compatibility (v18.0.0+), Extensions, and Public APIs  

---

## 1. Overview & Scope
CMP-001 establishes the compatibility contracts, API stability levels, release compatibility manifests, and SemVer rules governing all domain releases building on top of the **SMRITI Platform Foundation Series (PAR-001 v1.0 Baseline)**.

---

## 2. Foundation Version Contract
Every domain release (`v18.x`, `v19.x`, etc.) must explicitly state its compatibility baseline:
- **Platform Foundation Baseline:** `PAR-001 v1.0` (Layers 1 through 7)
- **SPK Kernel Runtime:** `v12.1.0`
- **Governance Standards:** `SMP-001` through `SMP-014`, `GCR-001`, `AOP-001`

---

## 3. API Stability Levels & Deprecation Grace Period

```text
 [STABLE] ──(Deprecation Notice)──> [DEPRECATED] ──(2 Major Releases)──> [REMOVED]
```

1. **`STABLE`** — Public API is guaranteed backwards-compatible. Cannot be broken in MINOR/PATCH releases.
2. **`DEPRECATED`** — Marked for future removal; remains 100% operational for a mandatory **2-release grace period**.
3. **`REMOVED`** — API removed with mandatory migration guide published.

---

## 4. SemVer Guarantees for Public Interfaces
1. **MAJOR Version (e.g. v18.0.0 → v19.0.0):** Reserved for new domain capabilities or intentional breaking API deprecations (requires a 2-release deprecation grace window).
2. **MINOR Version (e.g. v18.1.0 → v18.2.0):** New backwards-compatible domain features, public APIs, or module extensions.
3. **PATCH Version (e.g. v18.1.1 → v18.1.2):** Backwards-compatible bug fixes and security hotfixes.

---

## 5. Automated CI Compatibility Gate
CI build pipelines automatically enforce:
- Compatibility manifest presence.
- Detection of unannounced public API removals.
- Verification of 2-release deprecation grace window.
