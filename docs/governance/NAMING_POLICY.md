<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Naming Governance Policy

**Policy ID:** NGP-v2.0
**Status:** FROZEN — MANDATORY — ALL agents, ALL sessions, ALL tasks, ALL contributors
**Effective:** 2026-08-24

---

## SMRITI Naming Integrity Principle

> Every repository identifier must represent a deliberate architectural concept or responsibility.
> AI agents and developers shall not create arbitrary, temporary, duplicate, ambiguous, or
> convenience-based names. Before creating an identifier, the repository must be searched for an
> existing equivalent or overlapping responsibility. If an equivalent exists, it must be reused or
> intentionally refactored. If the responsibility cannot be clearly established, creation must stop
> until the responsibility is defined.
>
> Filenames shall not exceed 22 characters, with 16 characters as the preferred maximum (including extension).
> Names such as `new`, `old`, `final`, `latest`, `temp`, `copy`, `backup`, arbitrary numbering,
> or similar development-state terminology are prohibited unless explicitly required by the
> architecture.

---

## 1. No Random Naming

An AI agent or developer **MUST NOT** create names such as:

```text
new_file.ts          temp.ts             helper.ts
utils2.ts            final.ts            final_new.ts
latest.ts            test_new.ts         manager.ts
handler2.ts          service_new.ts      abc.ts
misc.ts              common.ts           stuff.ts
working.ts           backup.ts           old.ts
copy.ts              data.ts             thing.ts
xyz.ts
```

unless that exact name is explicitly approved by the approved architecture.

---

## 2. Responsibility-First Naming

Every identifier **must describe its actual responsibility**.

| ❌ Bad | ✅ Good |
|---|---|
| `ThingManager.ts` | `EventRegistry.ts` |
| `CommonHelper.ts` | `EventPublisher.ts` |
| `DataProcessor.ts` | `InvoiceValidator.ts` |
| `SystemUtils.ts` | `StockLedger.ts` |
| `NewService.ts` | `BarcodeService.ts` |
| `FinalHandler.ts` | `BillingWorkspace.tsx` |

**Formula:**

```
NAME = DOMAIN + RESPONSIBILITY
```

Use both components only when both are necessary for disambiguation.

---

## 3. Never Name From Implementation Accident

Do not name a file after:

- Temporary implementation state
- Developer thought process or ticket numbers
- Dates or AI-generated sequences
- Debugging state or migration phase
- "new / final / latest / v2 / v3" suffixes
- Arbitrary abbreviations

| ❌ Prohibited |
|---|
| `billing_fix_3.ts` |
| `event_bus_new.ts` |
| `invoice_final_v2.ts` |
| `phase4_handler.ts` |
| `ai_generated_service.ts` |

---

## 4. Filename Length Limits (NGP-v2.0)

| Limit | Characters (including extension) |
|---|---|
| **Hard maximum** | 22 |
| **Preferred maximum** | 16 |

Any filename longer than 22 characters is a strict naming violation.
If a logical name exceeds 22 characters, **redesign the name** using the actual domain and
responsibility. Do not arbitrarily truncate it.

---

## 5. Search Before Create (MANDATORY)

Before creating **any** new file, module, component, service, class, interface, route,
configuration identifier, script, migration, or test:

1. Search the entire repository for existing filenames.
2. Search symbols / classes / functions.
3. Search imports and references.
4. Search related domain terminology.
5. Identify existing implementations with overlapping responsibility.
6. Determine whether the requested capability already exists.

**If an existing implementation performs the same responsibility:**

> **DO NOT create a duplicate. Reuse, extend, refactor, or rename the existing implementation.**

This is the SMRITI **Single Workspace Principle** — business behavior must be driven by policy,
configuration, document type, and workspace context, not by duplicate implementations.

---

## 6. No Duplicate Responsibility

Do not create multiple files that effectively perform the same function:

```text
❌  InvoiceService.ts
❌  InvoiceManager.ts
❌  InvoiceHandler.ts
❌  InvoiceProcessor.ts
❌  InvoiceOperations.ts
```

There must be **one authoritative implementation** unless architecture explicitly defines separate,
non-overlapping responsibilities for each file.

---

## 7. Naming Checklist Before Creation

Before creating any new file, the agent/developer **must** establish all of the following:

```
RESPONSIBILITY:  What does this file actually own?
OWNER:           Which domain/component owns this responsibility?
EXISTING:        Does an existing implementation already perform it?
NAME:            What is the shortest precise logical name?
LENGTH:          Is it <= 100 characters?
CONFLICT:        Does another file already have the same or confusingly similar name?
ARCHITECTURE:    Does the file belong in the selected directory?
```

**If any answer is unclear → STOP and request clarification. Do not invent a name.**

---

## 8. No "Helper" Dumping Ground

Do not create directories merely to avoid deciding where functionality belongs:

```text
❌  helpers/
❌  utils/
❌  misc/
❌  common/
❌  shared/
```

Every function belongs with the **domain/component responsible for it**.

---

## 9. No Version Suffixes in Source Files

Do not create:

```text
❌  ServiceV2.ts
❌  ServiceV3.ts
❌  ServiceFinal.ts
❌  ServiceLatest.ts
```

Use `Service.ts` and manage versions through:

- Git history
- Package versions (`package.json`)
- API versions (`/api/v1`, `/api/v2`)
- Schema versions (Alembic migration sequences)
- Event versions
- Migration version naming

---

## 10. Rename Instead of Duplicate

If the current filename is poor but the implementation is valid:

```text
✅  DO:   rename → update references → test

❌  DO NOT:
    create new correctly named file
    copy old implementation into it
    leave old file behind
```

Leaving obsolete duplicate files creates architectural debt.

---

## 11. Directory Governance

Directory names must be logical and architecturally purposeful:

```text
❌  helpers/
❌  utils/
❌  misc/
❌  temp/
❌  new/
❌  old/
❌  backup/
```

Every directory must have a clearly defined architectural purpose. Do not create unnecessary
deeply nested directories.

---

## 12. Mandatory AI Agent Workflow

Every AI coding agent working on SMRITI **must** follow this workflow for every file operation:

```text
DISCOVER            ← understand the task context
    ↓
SEARCH              ← search repository for existing responsibility
    ↓
UNDERSTAND          ← understand what the existing implementation does
    ↓
CLASSIFY            ← determine architectural layer and owning domain
    ↓
CHECK EXISTING      ← confirm no existing file covers the responsibility
IMPLEMENTATION
    ↓
PROPOSE NAME        ← apply DOMAIN + RESPONSIBILITY formula
    ↓
VALIDATE NAME       ← run through the 10-point naming checklist (Rule 7)
    ↓
CREATE / RENAME     ← only after all checks pass
    ↓
UPDATE REFERENCES   ← imports, config, tests, docs, scripts, Docker
    ↓
TEST                ← run relevant test suite + build/type-check
    ↓
ARCHITECTURE AUDIT  ← confirm no duplicate responsibility was introduced
    ↓
REPORT              ← per Rule 15 (Required Report)
```

**Critical rule: CREATE is never allowed before CHECK EXISTING IMPLEMENTATION.**

---

## 13. Rename Safety Protocol

When renaming any file:

1. Search all references (imports, dynamic imports, config, tests, scripts, docs, Docker).
2. Rename the physical file.
3. Update all static imports.
4. Update all dynamic imports.
5. Update all configuration references.
6. Update all test files.
7. Update all scripts.
8. Update Docker references where applicable.
9. Update documentation where required.
10. Search for the old name again to confirm zero references remain.
11. Run the relevant test suite.
12. Run build / type-check.
13. Confirm no broken references remain.

**Never leave obsolete duplicate files behind.**

---

## 14. Prohibited Development-State Names (Exhaustive List)

The following name fragments are **prohibited** in permanent source filenames:

```text
new       old        final      latest     temp       temporary
copy      backup     v2         v3         v4         fix
debug     test2      test3      helper     utils      misc
common    stuff      data       thing      abc        xyz
manager   processor  handler    service2
```

Any suffix of `_new`, `_old`, `_final`, `_latest`, `_temp`, `_copy`, `_backup`, `_fix`,
`_debug`, `_v2`, `_v3` is prohibited.

---

## 15. Required Report After Any Naming / Refactoring Operation

After any naming or refactoring operation, the agent must report:

```text
FILES RENAMED:                <list>
FILES CREATED:                <list>
FILES REMOVED:                <list>
OLD NAMES ELIMINATED:         <list>
REFERENCES UPDATED:           <list>
DUPLICATE RESPONSIBILITIES:   <list or "None found">
NAMING VIOLATIONS REMAINING:  <list or "None">
LENGTH VIOLATIONS REMAINING:  <list or "None">
TESTS EXECUTED:               <command + result>
BUILD / TYPE-CHECK:           <command + result>
ARCHITECTURE VALIDATION:      <Pass / Fail>
```

---

## 16. Stop Condition

If the correct responsibility or logical name cannot be determined:

**STOP. Do not guess. Do not create a random filename.**

Report:

> "Naming decision blocked: architectural responsibility is ambiguous."

Then explain what information is required to proceed.

---

## 17. Automated Guard

This policy is enforced by the **SMRITI Naming Guard** script:

```text
scripts/smriti_naming_guard.py
```

The guard is wired into CI (`ci.yml` → `Run SMRITI Naming Guard`). Any new file that violates
this policy causes a **CI failure**, blocking merge.

The naming guard checks:
- Prohibited development-state name fragments (Rule 14)
- Filename length violations (Rule 4)
- Scope: all `.ts`, `.tsx`, `.py`, `.js`, `.jsx`, `.css`, `.md` files in `src/` and `backend/`

---

## Enforcement Matrix

| Layer | Mechanism |
|---|---|
| AI Agent Instruction | This document + `.agents/AGENTS.md` |
| Repository Policy | `docs/governance/NAMING_POLICY.md` |
| Automated Guard | `scripts/smriti_naming_guard.py` |
| CI Gate | `.github/workflows/ci.yml` — naming guard step |

---

*This policy is mandatory and permanent. It supersedes any prior informal naming convention.*
*Effective 2026-08-24. Policy ID: NGP-v1.0.*
