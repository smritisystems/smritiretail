# SMRITI Architecture Playbook

## Purpose

This playbook defines how SMRITI Retail OS should evolve its architecture over time.
It is intended for AI agents, developers, architects, and reviewers.

The goal is simple:

- evolve the platform with evidence
- avoid duplicate runtime layers
- preserve platform identity
- enforce governance through review and compliance

---

## 1. Architecture Constitution

The following rules are immutable.

### Rule 0 — Evidence Before Opinion
No architectural recommendation is accepted without evidence.

An agent must not say:
- “This probably already exists”
- “This seems like a good layer”
- “We should create a new runtime”

It must provide evidence.

### Rule 1 — Audit Before Creation
Before introducing any new framework, layer, engine, runtime, registry, SDK, or abstraction, the repository must be audited.

### Rule 2 — Reuse Before Expansion
If a capability already exists, reuse or extend it before creating something new.

### Rule 3 — Merge Before Duplicate
If two concepts overlap, merge them before introducing a third.

### Rule 4 — Rename Before Rewrite
If an existing component is close to the needed capability, prefer renaming or refactoring over rewriting from scratch.

### Rule 5 — One Responsibility Per Layer
Each architecture layer must own a single clear concern.

### Rule 6 — Capability Before Component
Start from the capability needed, not from the desire to create a new component.

### Rule 7 — No Architecture by Name Only
Do not create a new component because a name sounds right.
Create it only if the capability is genuinely missing and proven by evidence.

### Rule 8 — Architecture Budget
The platform should not grow into an explosion of layers.
The architecture should stay within a controlled set of top-level responsibilities.

### Rule 9 — Clear Ownership
Every architecture responsibility must have a clear owner.

### Rule 10 — Create New Only When Proven Necessary
New components are a last resort, not a default option.

### Rule 11 — Proof of Non-Existence
A proposal to create a new architecture component must prove that existing capabilities do not already satisfy the required need.

### Rule 12 — Extension Cost vs Creation Cost
Every proposal must compare the cost and risk of extension against the cost and risk of new creation.

### Rule 13 — Architectural Impact Statement
Every proposal must declare what layers or systems will be affected.

### Rule 14 — Deprecation First
When duplicates are found, prefer deprecation, migration, and removal over parallel coexistence.

### Rule 21 — Preserve Platform Identity (PPI-001)
New architecture must align with the existing platform vocabulary and naming pattern.
Examples:
- SPK
- SUNEF
- SSEF
- SDS
- STE

Do not introduce random names like “MegaRuntime” or “UniversalManager” unless the platform architecture explicitly requires them.

---

## 2. AI Architecture Review Protocol

This protocol is mandatory for every AI agent handling architecture work.

### Step 1 — Search Repository
The agent must search the repository for existing components related to the proposed capability.

### Step 2 — Collect Evidence
The agent must gather evidence from code, tests, docs, and runtime structure.

### Step 3 — Build Existing Component Matrix
The agent must identify:
- existing components
- their purpose
- their location
- their ownership

### Step 4 — Build Ownership Matrix
The agent must identify who owns the relevant capability.

### Step 5 — Perform Gap Analysis
The agent must clearly state:
- what already exists
- what is missing
- why the gap matters

### Step 6 — Make a Recommendation
The recommendation must be one of the following:
- Reuse
- Extend
- Merge
- Rename
- Create New

Create New is the final option, never the default.

---

## 3. Architecture Decision Matrix

Every proposal must end with a standard decision table.

| Capability | Existing Owner | Gap | Decision | Evidence |
| --- | --- | --- | --- | --- |
| Theme Resolution | ThemeContext | None | Reuse | ThemeContext.tsx, theme tests |
| Navigation | SUNEF | Minor | Extend | SUNEF runtime modules |
| Studio Manifest | WorkspaceRegistry | Partial | Extend | WorkspaceRegistry definitions |

### Decision rules
- Reuse: existing component fully satisfies the need
- Extend: existing component mostly satisfies the need but needs enhancement
- Merge: overlapping functionality should be consolidated
- Rename: existing component should be renamed to match the platform vocabulary
- Create New: no existing component can satisfy the requirement

### Required output
Every proposal must include:
- Final Decision
- Confidence
- Evidence Level
- Impact Level

---

## 4. Architecture Evidence Levels

Not all evidence is equal.

### Level A — Runtime Code Exists
Evidence comes from implementation code.
Example:
- existing runtime file
- existing service implementation

### Level B — Tests Prove It Works
Evidence comes from tests that confirm behavior.

### Level C — Documentation Only
Evidence is descriptive but not confirmatory.

### Level D — Proposal Only
Evidence is speculative and not backed by implementation or tests.

### Evidence standard
A recommendation based on Level D evidence is not sufficient for a new architecture component.

---

## 5. Architecture Lifecycle

Every architecture component should follow a lifecycle.

### Proposal
A new need or opportunity is identified.

### Audit
The repository is reviewed and evidence is collected.

### Approved
The proposal is accepted through the review process.

### Implemented
The component is created or extended.

### Stable
The component is adopted and used consistently.

### Deprecated
The component is marked as obsolete or replaced.

### Removed
The old component is retired after migration.

### Deprecation policy
A component should not be left as a duplicate indefinitely.
When a replacement exists, follow:
- Deprecate
- Migrate
- Remove

---

## 6. No Hidden Architecture

Architecture must not be hidden in generic folders or vague utility layers.

If a component owns an architectural responsibility, it must be declared and owned explicitly.

### Bad example
- helpers/themeManager.ts

### Good example
- STE
- Owner: Theme Runtime

This rule prevents hidden runtime logic from silently becoming platform architecture.

---

## 7. Fitness Functions

Architecture quality should be measured automatically.

### Suggested checks
- Duplicate Runtime
- Duplicate Registry
- Duplicate Theme Engine
- Manifest Compliance
- Studio Compliance
- Layer Ownership Compliance

### Release gate expectation
A release should not pass if architecture fitness checks fail.

---

## 8. AI Response Format

Every architecture proposal from an AI agent must follow a standard response structure.

### Required response format

```text
Architecture Audit

Evidence
- Existing components
- Runtime files
- Tests
- Documentation

Existing Components
- List each relevant component

Ownership
- Who owns the capability

Gap Analysis
- What is missing
- Why it matters

Options
- Reuse
- Extend
- Merge
- Rename
- Create New

Recommendation
- Final decision
- Why

Impact
- Affected layers
- Risk level

Decision
- Reuse / Extend / Merge / Rename / Create

Next Steps
- Implementation steps
```

AI must not respond with a vague instruction like “Create XYZ” without evidence and justification.

---

## 9. Naming Rules

Architecture naming must preserve platform identity.

### Allowed pattern
- SPK
- SUNEF
- SSEF
- SDS
- STE
- WorkspaceRegistry
- ActionRegistry
- ThemeContext

### Disallowed pattern
- MegaRuntime
- UniversalManager
- CoreSDK
- ExperienceEngine

If a new name is introduced, it must be justified by the platform vocabulary or a clear architectural reason.

---

## 10. Architecture Review Checklist

Every pull request should include the following review checklist.

### Architecture Review Checklist
- [ ] Evidence was collected
- [ ] Existing components were reviewed
- [ ] Ownership was identified
- [ ] A decision matrix was produced
- [ ] The proposal follows the constitution
- [ ] No duplicate architecture was introduced
- [ ] Naming follows the platform identity
- [ ] Impact was documented
- [ ] Deprecation plan was considered if relevant

---

## 11. PR Evidence Template

Each PR should include:

```text
Architecture Review

Audit ID:
Capability:
Existing Owner:
Evidence:
Decision:
Reason:
Impact:
Confidence:
```

Example:

```text
Architecture Review

Audit ID: AUD-004
Capability: Theme Resolution
Existing Owner: ThemeContext
Evidence: ThemeContext.tsx, theme tests, workspace shell usage
Decision: Extend
Reason: Existing runtime already satisfies the need
Impact: Low
Confidence: High
```

---

## 12. ADR Template

When a new architecture direction is proposed, an ADR should be created.

### Suggested ADR structure
- Title
- Status
- Context
- Decision
- Consequences
- Alternatives Considered
- Evidence
- Impact
- Deprecation Plan

---

## 13. Governance Stack

The governance stack for SMRITI should be:

```text
Level 0 — Platform Vision

Level 1 — Architecture Constitution

Level 2 — Architecture Principles

Level 3 — AI Review Protocol

Level 4 — Architecture Audit

Level 5 — Decision Matrix

Level 6 — Implementation

Level 7 — Compliance Audit

Level 8 — Release Gate
```

---

## 14. Final Principle

The goal of SMRITI architecture is not to create more frameworks.
The goal is to evolve the platform with evidence, governance, and measurable discipline.

The platform should become stronger over time, not more fragmented.
