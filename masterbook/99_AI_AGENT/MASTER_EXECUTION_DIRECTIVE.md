<!--
  SMRITI Retail OS — Masterbook
  Document  : 99_AI_AGENT/MASTER_EXECUTION_DIRECTIVE.md
  Purpose   : Mandatory protocol for every AI coding agent working on SMRITI
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
  Copyright : © SMRITIBooks.com. All Rights Reserved.
-->

# SMRITI AI Agent — Master Execution Directive

> **MASTERBOOK is the architectural memory of SMRITI.**
> **Source code is the implementation.**
> **If they differ, the AI agent must NOT silently choose one — it must report the difference and obtain an architectural decision.**

---

## Mandatory Pre-Task Protocol

**Before making ANY architectural change, every AI agent MUST execute these steps in order:**

```
STEP 1: Read masterbook/00_MASTER_INDEX.md
STEP 2: Identify which Masterbook section is relevant to the task
STEP 3: Read the relevant Masterbook document(s)
STEP 4: Audit the actual current source code
STEP 5: Compare CURRENT CODE vs MASTERBOOK specification
STEP 6: Document any divergence found
STEP 7: If divergence exists → STOP → report to user → await decision
STEP 8: Implement only after an evidence-based decision
STEP 9: Update Masterbook if the architecture is intentionally changed
```

**Do NOT assume that current source code matches the Masterbook blueprint.**
**Do NOT assume that a previous agent's implementation was correct.**

---

## Rule: Verify Before You Build

Before creating any new:
- Table / column
- API endpoint
- Service / orchestrator
- Workspace / screen / module
- Registry / engine / framework

Ask:
1. **Does the Masterbook describe this already?** → If YES, check the implementation.
2. **Does an existing capability satisfy ≥70% of the requirement?** → If YES, extend it (PBC-001).
3. **Will this create a duplicate?** → If YES, REJECT immediately (PROD-002 / SWP-001).

---

## Architectural Conflict Protocol

When the current code DIVERGES from the Masterbook:

```
CONFLICT DETECTED
    │
    ├── Severity: CRITICAL (security/data isolation)
    │       → Stop immediately. Report. Await explicit decision.
    │
    ├── Severity: MAJOR (architectural principle)
    │       → Document conflict. Propose resolution. Await approval.
    │
    └── Severity: MINOR (naming/style)
            → Note it. Proceed with Masterbook convention.
```

**Never silently choose the code over the Masterbook or vice versa.**

---

## Evidence-Based Implementation Rules

Per `AGENTS.md` (DOC-001, Rules 1–10):

1. **Show git diffs** for every file claimed to be modified
2. **Paste literal terminal output** for every test or lint run
3. **Never claim "it's fixed"** without showing actual evidence (diff + test output)
4. **Never build on previous session claims** without verifying against actual code first
5. **Label every task** with: Done / Failed / Partially Verified / Unverified

---

## Mandatory Traceability (GEMINI.md — Traceability Rule)

Every implementation MUST reference:
- At least one **Audit ID** (AUD-xxx)
- At least one **Finding ID** (F-xxx)

Changes without audit traceability should not be merged.

---

## Do Not Shortcuts Checklist

| Anti-Pattern | Why Prohibited |
|---|---|
| Make `customer_id` optional | Breaks FK contract — ghost invoices |
| Add demo/sample data to production | PROD-003 violation |
| Create a new workspace for a sub-use-case | SWP-001 violation |
| Use `datetime.utcnow` for `Date` columns | Causes Pydantic `date_from_datetime_inexact` |
| Trailing slash in endpoint paths | Causes 307 redirect — silent failure |
| Silent fallback returning local fake ID | Fake IDs fail orchestrator ownership check |
| Query without `company_id` filter | Cross-company data leak |
| Skip `Workspace.Changed.v1` subscription | Stale company data in UI |
| Assume endpoint URL from route handler path | Must check `app.include_router(prefix=...)` |
| Skip orchestrator ownership validation | Company A FK accepted in Company B context |
| Proceed without Masterbook check | Architecture drift |

---

## Quick Reference: Key Files

| Purpose | File |
|---|---|
| Frontend customer wiring | `src/kernel/public/ISalesService.ts` |
| Frontend sales service | `src/kernel/internal/SalesService.ts` |
| Frontend billing studio | `src/components/sales/SalesBillingStudio.tsx` |
| Frontend customer service | `src/kernel/internal/CustomerService.ts` |
| Backend sales schemas | `backend/app/schemas/sales.py` |
| Backend CRM schemas | `backend/app/schemas/crm.py` |
| Backend orchestrator | `backend/app/services/sales_orchestrator.py` |
| Backend CRM service | `backend/app/services/crm.py` |
| Backend auth/deps | `backend/app/api/deps.py` |
| Backend CRM router | `backend/app/api/v1/crm.py` |
| Backend sales router | `backend/app/api/v1/sales.py` |
| Customer model | `backend/app/models/crm.py` |
| Sales invoice model | `backend/app/models/sales.py` |
| Platform kernel | `src/kernel/SPK.ts` |
| API client | `src/lib/apiFetchV1.ts` |
| Types | `src/types.ts` |

---

## Quick Reference: Key Rules

| Rule ID | Rule | Document |
|---|---|---|
| AFR-001 / AFR-002 | Architecture Freeze | 01_CONSTITUTION |
| PBC-001 | Promote Before Create | 01_CONSTITUTION |
| KND-001 | Kernel Independence | 02_ARCHITECTURE/SMRITI_HYBRID... |
| PROD-001 | Customer Value Priority | 01_CONSTITUTION |
| PROD-002 / SWP-001 | Single Workspace Principle | 01_CONSTITUTION |
| PROD-003 | Clean Production Install | 06_DATABASE/COMPANY_DATABASES |
| PROD-004 | Environment Isolation | 03_SECURITY/COMPANY_ISOLATION |
| AUTH-001–004 | Authentication Chain | 03_SECURITY/USER_COMPANY_ASSIGNMENT |
| AP-008 | Item Attribute Snapshot | 04_MASTER_DATA/PRODUCT |
| SCS-INV-001 | Customer→Invoice Wiring | 05_TRANSACTION/SALES |
| CON-001 | Constitution Freeze | 01_CONSTITUTION |
| DOC-001–002 | Auto Documentation | AGENTS.md |
| WNG-001–005 | Navigation Governance | AGENTS.md |
| UFR-001–006 | Universal Form Registry | AGENTS.md |
| USR-001–007 | Universal Security Registry | AGENTS.md |

---

## Masterbook Update Protocol

When architecture is **intentionally changed**:

1. Update the relevant Masterbook document
2. Update `00_MASTER_INDEX.md` if a document status changes
3. Record the change in `CHANGELOG.md`
4. Reference the ADR if one was created
5. Commit with message: `docs(masterbook): update {section} — {reason}`

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
*This directive is binding for all AI agents. Failure to follow it constitutes an architecture breach.*
