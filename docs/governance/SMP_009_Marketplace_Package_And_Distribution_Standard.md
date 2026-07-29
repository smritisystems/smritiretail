<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0 (SMP-009 Specification)
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Governance Specification
-->

# SMP-009: Marketplace Package & Distribution Standard

**Status:** APPROVED — Frozen Governance Specification (v1.0)  
**Parent Standard:** SMP-001 Modular Platform Specification  
**Scope:** `.smx` Packaging, Repositories, Channels, Security Verification, Transactional Lifecycle  

---

## 1. Overview & Purpose
SMP-009 defines the official distribution, packaging, security, and repository protocol for the **SMRITI Marketplace Ecosystem (Layer 4)**. It establishes rules for `.smx` package formatting, multi-channel distribution (`Stable`, `LTS`, `Beta`, `Preview`, `Internal`), cryptographic authentication (RSA/ECDSA), and transactional package state transitions (`DOWNLOADED` → `VERIFIED` → `STAGED` → `INSTALLED` → `ENABLED` → `ROLLED_BACK`).

---

## 2. Package Architecture (`.smx` Zip Container)

Every distributable extension package must be formatted as a `.smx` Zip archive containing:

```text
module.smx
├── package.json         (Package & Distribution Metadata)
├── module.json          (SMP-002 Runtime Module Manifest)
├── bootstrap.py         (SmritiModule Lifecycle Handler)
├── signature.sha256     (Cryptographic Hash / Signature)
├── cert.pem             (Publisher X.509 Digital Certificate - Optional/Certified)
├── assets/              (UI Assets, Icons, Screenshots)
└── docs/                (README, Changelog, Manuals)
```

---

## 3. Release Channel Taxonomy

Repositories must categorize package releases into one of five distribution channels:

1. **`Stable`** — Production-tested, general commercial availability releases.
2. **`LTS`** — Long-Term Support releases receiving security & compliance backports.
3. **`Beta`** — Feature-complete candidate builds undergoing field testing.
4. **`Preview`** — Experimental developer preview builds.
5. **`Internal`** — Organization-private deployment builds.

---

## 4. Package State Transitions & Atomic Rollback

The Marketplace Package Lifecycle Manager must strictly enforce a 7-stage state machine:

```text
 [DOWNLOADED] ──> [VERIFIED] ──> [STAGED] ──> [INSTALLED] ──> [ENABLED]
                       │            │             │
                       ▼            ▼             ▼
                    [FAILED]     [FAILED]   [ROLLED_BACK]
```

---

## 5. Security & Trust Validation Triad

1. **Integrity Validation:** SHA256 digest calculation matching `signature.sha256`.
2. **Authenticity Validation:** RSA/ECDSA asymmetric signature verification against publisher public key / certificate (`cert.pem`).
3. **Trust & Revocation:** Trust Anchor chain validation against Key Revocation Lists (KRL).

---

## 6. Repository Provider Protocol

Repositories must implement the standard `RepositoryProvider` abstraction interface supporting:
- `fetch_catalog()`
- `get_package_metadata(package_id)`
- `download_package(package_id, destination_path)`
