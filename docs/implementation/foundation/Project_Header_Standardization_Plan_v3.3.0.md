<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.3.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Implementation Plan: Project Header Standardization — v3.3.0

This document defines the plan to update the standard project header across all applicable first-party source files in the repository.

---

## 1. Objective
Apply the latest approved project header consistently to all applicable first-party files in the repository, preserving existing dates while ensuring uniform branding and ownership metadata.

---

## 2. Business Motivation
Branding, ownership, and copyright attributions must be uniform across all source assets. This ensures correct governance, clear representation of founding leadership, and legal clarity regarding proprietary source code licenses.

---

## 3. Scope
- **Files Scanned:** 167 total files.
- **Files Eligible for Update:** 150 first-party files (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss`, `.html`, `.md`, `.sh`, `.bat`, `.ps1`, `.sql`).
- **Files Skipped:** 17 files, including generated assets (`db_store.json`), build folders (`dist`), third-party modules (`node_modules`), dependency locks (`package-lock.json`), configurations (`package.json`, `tsconfig.json`), env setups (`.env`, `.env.example`), and text licenses (`COPYING`, `NOTICE`, `THIRD_PARTY_LICENSES.md`).

---

## 4. Current State
- Files contain varying, older header configurations naming Jawahar Ramkripal Mallah alone.
- Some newer or configuration files (e.g., `vite.config.ts`) lack standard headers.

---

## 5. Gap Analysis
- Missing founders' metadata (Pushpa Devi Jawahar Mallah) and organization details (AITDL NETWORKS) in the current files.
- Inconsistent header formats across newly created utilities and config scripts.

---

## 6. Architecture Impact
- **Non-Functional Change:** No application logic, packages, database definitions, or routing features are affected.

---

## 7. Proposed Design

### Header Structure

#### A. JavaScript, TypeScript, CSS, SCSS, SQL (`/** ... */`)
```typescript
/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : {Version}
 * * Created    : {Created}
 * * Modified   : {Modified}
 * * Copyright  : {Copyright}
 * * License    : {License}
 */
```

#### B. Shell, PowerShell, Python (`# ...`)
```python
# Project      : SMRITI Retail OS
# Repository   : SMRITIRetailNX
# Organization : AITDL NETWORKS
# 
# Founders
# 
# * Pushpa Devi Jawahar Mallah
#   * Founder & Chairperson
#   * Phone: +91 9324117007
#   * Email: founder@aitdl.com
# 
# * Jawahar Ramkripal Mallah
#   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
#   * Email: founder@aitdl.com
# 
# * Websites: aitdl.com | erpnbook.com | smritibooks.com
# 
# * Version    : {Version}
# * Created    : {Created}
# * Modified   : {Modified}
# * Copyright  : {Copyright}
# * License    : {License}
```

#### C. HTML, Markdown (`<!-- ... -->`)
```html
<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : {Version}
  * Created    : {Created}
  * Modified   : {Modified}
  * Copyright    : {Copyright}
  * License    : {License}
-->
```

#### D. Windows Batch (`REM ...`)
```batch
REM Project      : SMRITI Retail OS
REM Repository   : SMRITIRetailNX
REM Organization : AITDL NETWORKS
REM 
REM Founders
REM 
REM * Pushpa Devi Jawahar Mallah
REM   * Founder & Chairperson
REM   * Phone: +91 9324117007
REM   * Email: founder@aitdl.com
REM 
REM * Jawahar Ramkripal Mallah
REM   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
REM   * Email: founder@aitdl.com
REM 
REM * Websites: aitdl.com | erpnbook.com | smritibooks.com
REM 
REM * Version    : {Version}
REM * Created    : {Created}
REM * Modified   : {Modified}
REM * Copyright  : {Copyright}
REM * License    : {License}
```

---

## 8. Files Created
- None.

---

## 9. Files Modified
- 150 first-party files across the repository.

---

## 10. Dependencies
- Native python script to perform bulk updates safely.

---

## 11. Risks
- **Syntax Breakers:** Inserting incorrect comment syntax into source code could cause compilation errors.
  - *Mitigation:* The script will identify extension types and apply matching comments correctly. We will run `npm run lint` immediately after.

---

## 12. Rollback Strategy
`git reset --hard HEAD` will revert all changed headers instantly before pushing.

---

## 13. Verification Plan
- Run `npm run lint` to verify zero TypeScript compile errors.
- Run a verification script checking for exact header match across the 150 target files.

---

## 14. Test Plan
- Run automated parser checking header uniformity and print a stats report.

---

## 15. Documentation Impact
- None.

---

## 16. Deployment Plan
Commit and push from development.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- None.

---

## 19. Related Walkthroughs
- None.
