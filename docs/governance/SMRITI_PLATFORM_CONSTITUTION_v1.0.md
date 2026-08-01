<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0
  Created      : 2026-08-01
  Modified     : 2026-08-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Platform Constitution
-->

# SMRITI Platform Constitution v1.0

**Status:** FROZEN — Constitutional baseline for Platform Foundation governance  
**Effective:** 2026-08-01  
**Scope:** Platform Foundation, Product Foundation, Studio architecture, compatibility, and release governance

---

## 1. Purpose

This constitution establishes the authoritative governance model for the SMRITI platform and product architecture. It defines the architectural boundaries, approval model, compatibility requirements, and release discipline required to keep platform evolution intentional, stable, and value-driven.

The platform exists to accelerate product development, not to become a product itself.

Governance is now complete as an operating framework. The constitutional baseline is frozen. From this point onward, governance artifacts should be modified only when implementation exposes a real deficiency, not because a new governance idea exists.

---

## 2. Constitutional Documents

The following documents are constitutional and shall change only through formal amendment procedures rather than routine editing:

- Platform Constitution
- Engineering Charter
- Platform Foundation Freeze
- ADRs
- Standards
- Policies
- Procedures

The governance hierarchy is now frozen as follows:

```text
SMRITI Platform Constitution
        │
        ▼
Engineering Charter
        │
        ▼
Platform Foundation Freeze
        │
        ▼
ADRs
        │
        ▼
Standards
        │
        ▼
Policies
        │
        ▼
Procedures
```

Only the top three layers require ARB approval for changes. Lower layers may evolve through normal maintenance, provided they remain compatible with the constitutional baseline.

- Engineering Charter
- Platform Foundation Freeze
- Repository Ownership
- Architecture Governance
- Compatibility Policy
- Versioning Policy
- ADR Process
- Release Policy
- Architecture Fitness Rules
- Platform Change Budget

These are the authoritative governance artifacts for the platform baseline.

---

## 3. Governance Hierarchy

### Level 1 — Constitution (Rarely changes)

Examples:
- Engineering Charter
- Platform Constitution
- Repository Ownership
- Dependency Rules
- Platform Principles

**Approval:** Architecture Review Board (ARB) only

### Level 2 — Standards

Examples:
- Coding standards
- API standards
- SDK standards
- Testing standards
- Documentation standards

**Approval:** Platform maintainers

### Level 3 — Policies

Examples:
- Release cadence
- Compatibility policy
- Security policy
- CI policy
- Versioning policy

**Approval:** Product and platform leads

### Level 4 — Procedures

Examples:
- Release checklist
- ADR template
- Pull request template
- Code review checklist
- Deployment checklist

**Approval:** Repository maintainers

This hierarchy ensures that foundational decisions are not diluted by operational documents or routine process changes.

---

## 4. Architectural Layers

From this point forward, governance artifacts should be modified only when implementation exposes a real deficiency, not because a new governance idea exists.

Future architectural change shall be represented through one of only three artifact types:
- ADR — architectural decisions
- Standard — implementation rules
- Release Note — compatibility changes

New governance document types should not be introduced unless there is a compelling organizational need.

### Layer 1 — Platform Foundation

Frozen platform capabilities and reusable infrastructure.

Included:
- Platform Core
- Platform Kernel
- Registration
- Workspace
- Event Framework
- Notification Framework
- Audit Framework
- Public SDK contracts

**Rules:**
- Backward compatibility is mandatory within a major version.
- Breaking changes require a new major API version and ADR approval.
- Public contract changes require formal review.
- Platform work remains a minority of total engineering effort.

### Layer 2 — Product Foundation

Reusable business capability layer shared across multipleStudio / product contexts.

Examples:
- Workflow Engine
- Pricing Engine
- GST Engine
- Barcode Engine
- Reporting Engine
- Search Engine
- Printing Engine

### Layer 3 — Studios

Customer-facing product delivery units.

Examples:
- POS Studio
- Sales Studio
- Inventory Studio
- Purchase Studio
- Accounting Studio
- CRM Studio
- Reporting Studio
- Customer Portal
- License Studio

**Dependency rule:**

```text
Studios
  │
  ▼
Product Foundation
  │
  ▼
Platform Foundation
```

Only downward dependencies are permitted. No studio-specific code may be imported by lower layers.

---

## 5. Frozen State Model

Every reusable component shall use a formal lifecycle vocabulary.

```text
Draft
  ↓
Experimental
  ↓
Stable
  ↓
Frozen
  ↓
Deprecated
  ↓
Retired
```

Applied to:
- APIs
- Contracts
- Services
- SDKs
- ADRs
- Extensions
- Plugins

---

## 6. Compatibility Program

Governance enforcement is now primarily automated through CI.

```text
Source Code
      │
      ▼
Architecture Guardrails
      │
      ▼
Dependency Validation
      │
      ▼
Contract Compatibility
      │
      ▼
Platform Health Dashboard
      │
      ▼
Regression Tests
      │
      ▼
Release Approval
```

If a rule cannot be checked automatically, it should be reviewed periodically to determine whether it still delivers value.

Compatibility is governed through certification levels.

| Level | Meaning |
| :--- | :--- |
| P0 | Internal prototype |
| P1 | Platform compatible |
| P2 | Platform certified |
| P3 | Production certified |
| P4 | LTS certified |

Studios, plugins, and extensions should be evaluated against these levels before production acceptance.

### Compatibility guarantees
- Platform Foundation: backward compatible within a major version.
- Product Foundation: backward compatible within a minor version where practical.
- Studios: feature evolution is allowed, but published APIs should follow semantic versioning.

---

## 7. Long-Term Support

Support channels are defined explicitly.

- Current — active development
- Stable — recommended
- LTS — long-term support
- Legacy — security fixes only
- Retired — unsupported

This ensures contributors and customers have a clear upgrade and support path.

---

## 8. Platform Change Budget

A Platform Stability SLA is now part of the governance baseline.

| Area | Target |
| :--- | :--- |
| Public API compatibility | 100% within major version |
| Architecture guardrail compliance | 100% |
| Circular dependencies | 0 |
| Critical security findings | 0 |
| Regression suite | 100% pass |
| Breaking platform changes | ADR required |

This SLA provides measurable operational goals rather than descriptive governance alone.

Engineering effort must remain bounded.

Per release:
- Platform Foundation: ≤20% of engineering effort
- Product Foundation + Studios: ≥80% of engineering effort

Platform work beyond the budget requires written architectural justification and ARB review.

A more explicit annual allocation should be treated as:
- Platform Foundation: ~10–20% (maintenance, security, compatibility, performance)
- Product Foundation: ~20–30% (shared business capabilities)
- Studios: ~50–70% (customer-facing delivery)

---

## 8.1 Operating Model and Platform Operations

The platform now operates in four phases:

1. Platform Foundation — completed and architecturally frozen.
2. Platform Operations — ongoing stewardship of security, performance, SDK maintenance, compatibility, documentation, and release hygiene.
3. Product Foundation — shared business engines and reusable retail capabilities.
4. Studios — customer-facing product delivery.

The majority of engineering effort should now be invested in Product Foundation and Studios, while Platform Foundation remains stable, governable, and backward compatible.

### Platform Operations Responsibilities

Platform Operations is responsible for:
- Security updates
- Performance optimization
- Adapter development
- Compatibility certification
- Developer documentation
- Architecture reviews
- Release management

Platform Operations does not replace the platform constitution; it applies the constitution in day-to-day stewardship.

### Platform Health Dashboard

The operating model should be measured through a lightweight dashboard rather than through additional foundational governance documents.

| Metric | Target |
| :--- | :--- |
| Regression tests | 100% passing |
| Public API compatibility | 100% |
| Architecture guardrails | 100% |
| Circular dependencies | 0 |
| Critical security issues | 0 |
| CI validation uptime | 100% |
| SDK compatibility | 100% |

This dashboard is the preferred operational indicator that the platform remains healthy.

---

## 20. Success Metrics and KPI Shift

Architecture quality remains essential, but it becomes a constraint rather than the primary objective.

### Platform KPIs
- Zero breaking contracts
- Stable APIs
- Regression pass rate
- Performance
- Security

### Product KPIs
- POS checkout time
- Invoice creation time
- Inventory accuracy
- Purchase workflow completion
- Dashboard responsiveness
- Offline synchronization reliability
- Customer adoption

These metrics are closer to customer value than platform abstraction counts.

---

## 21. Maturity Model

Rather than treating layers as simply finished or unfinished, each layer should be classified by maturity and change policy.

| Layer | Status | Change Policy |
| :--- | :--- | :--- |
| Platform Constitution | Frozen | ARB only |
| Platform Foundation | Stable | Compatibility-first |
| Product Foundation | Active | Incremental |
| Studios | Fast-moving | Product roadmap |
| Plugins | Independent | Community lifecycle |

This gives clear expectations for change velocity and governance intensity.

---

## 22. Final Milestone Declaration

Platform Foundation is now a product, not a project.

This changes the operating model as follows:

### Platform Foundation
**Status:** Stable infrastructure

Mission:
- Maintain compatibility
- Improve performance
- Fix defects
- Support Products

Success is measured by stability, not by new features.

### Product Foundation
**Status:** Active innovation

Mission:
- Build reusable retail capabilities
- Share business engines across Studios
- Accelerate product delivery

### Studios
**Status:** Customer value

Mission:
- Deliver features customers buy and use

---

## 23. Engineering Decision Hierarchy

Every proposal should pass this decision tree:

```text
Customer Problem?
        │
        ▼
Can Studio solve it?
        │
      Yes ─────► Studio
        │
       No
        │
        ▼
Can Product Foundation solve it?
        │
      Yes ─────► Product Foundation
        │
       No
        │
        ▼
Is it reusable across multiple products?
        │
      Yes ─────► Platform Foundation (ADR Required)
        │
       No
        │
        ▼
Do Not Add It
```

This is the default decision flow for future engineering proposals.

---

## 24. Release Strategy

From this point forward, the program should maintain three independent version streams:

| Layer | Lifecycle | Example |
| :--- | :--- | :--- |
| Platform Foundation | Slow, compatibility-first | v1.0.x |
| Product Foundation | Regular feature releases | v1.x |
| Retail Studios | Fast customer-driven releases | v2026.x |

---

## 25. Platform Change Gate

All proposed Platform Foundation changes must satisfy the following criteria:

- Demonstrates reuse across at least two products or domains.
- Cannot reasonably be implemented in Product Foundation.
- Preserves backward compatibility, or has an approved migration plan.
- Includes automated tests and compatibility validation.
- Has an approved ADR if it affects public contracts.

If any criterion is not met, the change belongs elsewhere.

---

## 26. Definition of Success

At this stage, success is no longer measured by architectural sophistication.

### Platform Foundation
- API stability
- Compatibility
- Performance
- Reliability
- Security

### Product Foundation
- Reusable business capabilities
- Reduction in duplicated logic
- Studio adoption

### Studios
- Checkout speed
- Inventory accuracy
- Purchase workflow completion
- User productivity
- Customer adoption
- Support ticket reduction

---

## 27. Canonical Platform Foundation API Surface

The following are now treated as the canonical Platform Foundation API surface:

- Platform Core
- Platform Kernel
- Registration
- Workspace
- Events
- Notifications
- Audit
- Public Platform APIs
- Platform contracts
- Governance hierarchy

Everything else remains implementation detail or product functionality.

---

## 28. ARB Decision and Operating Posture

The Architecture Review Board approves the current state as follows:

```text
SMRITI Platform Foundation v1.0

Architecture        : FROZEN
Public Contracts    : STABLE
Governance          : OPERATIONAL
Implementation      : EVOLVABLE
Product Status      : EXECUTION PHASE
```

The remaining work should overwhelmingly be product engineering rather than platform engineering.

### Layer-specific ADR structure

Future architectural decisions should be recorded close to the layer they affect:

```text
docs/
├── platform/
│   ├── constitution/
│   ├── governance/
│   ├── adr/
│   └── standards/
│
├── product-foundation/
│   ├── adr/
│   ├── workflow-engine/
│   ├── pricing-engine/
│   ├── gst-engine/
│   ├── barcode-engine/
│   └── document-engine/
│
└── studios/
    ├── sales/
    ├── inventory/
    ├── purchase/
    ├── pos/
    ├── accounting/
    ├── crm/
    └── reporting/
```

This keeps architectural decisions close to the layer where they have impact.

### Product Foundation investment priorities

The next shared investment should be business capabilities such as:
- Document Engine
- Workflow Engine
- Pricing Engine
- Promotion and Discount Engine
- GST and Tax Engine
- Barcode and Label Engine
- Print Engine
- Approval Engine
- Search Engine
- Offline Sync Engine
- Reporting Engine

These are reusable by every Studio without changing the Platform Foundation.

### Studio roadmap

#### Phase 1
- POS Studio
- Sales Studio
- Inventory Studio

#### Phase 2
- Purchase Studio
- Accounting Studio
- CRM Studio

#### Phase 3
- Reporting Studio
- Customer Portal
- License Studio
- Mobile Workspace

### Platform Churn Index (PCI)

A measurable governance rule should track each release:

| Layer | Healthy Target |
| :--- | :--- |
| Platform Foundation | ≤10% |
| Product Foundation | 20–30% |
| Studios | 60–70% |

This makes the product-first philosophy measurable rather than aspirational.

### Release dashboard

Each release should report:
- Platform API compatibility
- Dependency violations
- Circular dependencies
- Architecture guardrail status
- Regression test status
- Platform Churn Index
- Studio delivery metrics

This provides concise engineering leadership visibility into platform health each release.

---

## 29. Final Milestone Declaration

```text
SMRITI Platform Foundation v1.0

Architecture        : COMPLETE
Public Contracts    : FROZEN
Governance          : OPERATIONAL
Compatibility Model : ESTABLISHED
Implementation      : EVOLVABLE
Primary Investment  : PRODUCT FOUNDATION
Primary Delivery    : RETAIL STUDIOS
```

With this milestone reached, Platform Foundation engineering has transitioned into maintenance and stewardship, while the overwhelming majority of new engineering effort should be directed toward Product Foundation and the Retail Studios that customers interact with every day.

---

## 29. Expansion Rule

No new foundational concepts should be introduced unless implementation exposes a concrete limitation.

This includes:
- new governance documents
- new architectural layers
- new kernel abstractions
- new runtime primitives
- new platform services

If a capability can be delivered inside a Studio or in Product Foundation, it should not be promoted to Platform Foundation.

---

## 30. Promotion Criteria

The current state of the engineering program is now considered:

```text
SMRITI Platform Foundation
Version: 1.0.0

Architecture:      FROZEN
Public Contracts:  STABLE
Governance:        COMPLETE
Implementation:    EVOLVABLE
Product Foundation: ACTIVE
Studios:           PRIMARY DELIVERY
```

At this point, the platform should be treated as a stable substrate for Retail OS delivery. Further platform evolution should be conservative, evidence-based, and backward-compatible. The majority of innovation should occur in Product Foundation and Studio layers.

---

## 23. Expansion Rule

No new foundational concepts should be introduced unless implementation exposes a concrete limitation.

This includes:
- new governance documents
- new architectural layers
- new kernel abstractions
- new runtime primitives
- new platform services

If a capability can be delivered inside a Studio or in Product Foundation, it should not be promoted to Platform Foundation.

---

## 24. Promotion Criteria

Reusable code must progress upward only through measured evidence.

### Studio → Product Foundation
Required evidence:
- used by at least two studios;
- not tied to one specific workflow;
- has regression tests and documentation.

### Product Foundation → Platform Foundation
Required evidence:
- product-neutral;
- reusable across multiple products;
- stable API;
- ADR approved.

This prevents premature abstraction while encouraging meaningful reuse.

---

## 10. Architecture Fitness Functions

Architecture health must be automated rather than assumed.

Required checks:
- No circular dependencies.
- No Studio importing another Studio.
- Product Foundation cannot import Studio code.
- Platform Foundation cannot import Product Foundation or Studio code.
- Public API compatibility checks.
- Maximum dependency depth.
- Forbidden import rules.
- Architecture test suite required for merge.

These are mandatory quality gates for architectural integrity.

---

## 11. Platform Maturity Score

The platform qualifies as **Platform Foundation v1.x** only when all release gates are green.

| Area | Gate |
| :--- | :--- |
| Architecture | Guardrails ✅ |
| Contracting | Versioning ✅ |
| Runtime | Regression ✅ |
| Dependencies | Validation ✅ |
| Documentation | Complete ✅ |
| Governance | Automation ✅ |
| SDK | Compatibility ✅ |
| Public API | Freeze ✅ |

---

## 12. Architecture Review Board (ARB)

Governance must be operational and accountable.

| Change Type | Approval Authority |
| :--- | :--- |
| Studio feature | Studio lead |
| Product Foundation capability | Product Architecture Board |
| Platform Foundation change | Platform Architecture Review Board + ADR |
| Breaking public API | Major version approval |

### Review cadence
- Weekly: Studio design reviews
- Monthly: Product Foundation review
- Quarterly: Platform Architecture Review
- Yearly: Constitution review

This keeps governance lightweight while preserving deliberate evolution.

---

## 13. Architecture KPIs

Architectural health should be measured alongside product health.

### Platform KPIs
- API compatibility
- Startup time
- Memory footprint
- Regression pass rate
- Dependency violations
- ADR compliance

### Product Foundation KPIs
- Code reuse across studios
- Shared engine adoption
- Duplication reduction
- Test coverage
- Ownership and version maturity per engine

### Studio KPIs
- User workflow completion time
- Customer-facing performance
- Feature adoption
- Defect escape rate
- Checkout speed
- Inventory accuracy
- Reporting responsiveness
- Offline synchronization reliability
- Mobile adaptive experience

---

## 14. Success Criterion

The ultimate measure of success is:

> A new Studio should be buildable almost entirely by composing Platform Foundation and Product Foundation capabilities, with minimal new infrastructure work.

When this becomes routine, the platform has achieved its purpose.

---

## 15. Platform Foundation Completion Criteria

Platform Foundation is considered healthy when the following conditions are met:

- Public APIs remain stable.
- No architectural guardrail regressions occur.
- CI fitness functions continue to pass.
- Backward compatibility is preserved.
- No unresolved critical platform defects remain.
- Security patches are applied promptly.

These are the objective exit criteria for Platform Foundation health.

---

## 16. Product Foundation Success Criteria

Product Foundation should now become the primary shared investment.

Success is measured by:
- Number of Studios reusing shared engines.
- Reduction in duplicated business logic.
- Faster Studio development through composition.
- Stable business APIs.
- Independent evolution without Platform Foundation changes.

---

## 17. Studio Success Criteria

The success of the platform should ultimately be reflected in customer outcomes.

Examples include:
- Faster POS checkout.
- More accurate inventory.
- Complete purchase lifecycle.
- Reliable offline synchronization.
- Responsive reporting.
- Consistent adaptive mobile experience.

---

## 18. Platform Decision Register (PDR)

The governance model must also explicitly record deferred decisions that are intentionally not being implemented yet.

The Platform Decision Register captures what is intentionally deferred, not just what is approved.

**Example:**
- GraphQL Gateway — Deferred to v2
- Distributed Event Bus — Deferred to v2
- Multi-cluster Kernel — Deferred to v3
- Runtime Scheduler — Deferred after Product Foundation

This keeps the architecture stable while preventing repeated re-opening of ideas that have already been consciously postponed.

This prevents repeated re-opening of decisions that have already been consciously postponed.

The PDR complements ADRs:
- ADR captures why a decision was made.
- PDR captures what has been intentionally deferred.

---

## 19. Amendment Process

This constitution may be amended only through the following process:

1. ADR proposal describing the change and rationale.
2. ARB review and approval.
3. Compatibility assessment.
4. Version bump for affected governance artifacts.
5. Publication of the revised constitutional baseline.

Routine edits to governance artifacts are prohibited without formal amendment.

---

## 20. Formal Declaration

```text
SMRITI Platform Foundation v1.0
Status: COMPLETE
Architecture: COMPLETE
Governance: COMPLETE
Public Contracts: FROZEN
Runtime Baseline: VALIDATED
Product Ready: YES

Next Program: SMRITI Product Foundation v1.0
```

This constitution is the authoritative governance baseline for the SMRITI platform and product architecture.

---

## 21. Transition Statement

From this point forward, progress should be measured by shipped product capabilities rather than by additional platform artifacts.

The next chapter is not Platform Foundation v1.1. It is:

> SMRITI Product Foundation v1.0 — building shared business capabilities,

followed by:

> Retail OS Studio releases — delivering customer-facing functionality.

```text
SMRITI Platform Constitution v1.0
Status: FROZEN
Platform Foundation: STABLE (maintenance mode)
Product Foundation: ACTIVE DEVELOPMENT
Retail OS Studios: PRIMARY DELIVERY PROGRAM
```

This constitution is the authoritative governance baseline for the SMRITI platform and product architecture.

---

## Related Artifacts

- [docs/governance/SMRITI_ENGINEERING_CHARTER_v1.0.md](SMRITI_ENGINEERING_CHARTER_v1.0.md)
- [docs/architecture/SMRITI_PLATFORM_FOUNDATION_V1.0_FREEZE.md](../architecture/SMRITI_PLATFORM_FOUNDATION_V1.0_FREEZE.md)
- [docs/governance/CMP_001_Compatibility_And_Versioning_Policy.md](CMP_001_Compatibility_And_Versioning_Policy.md)
- [docs/governance/PAR_001_Platform_Architecture_Reference.md](PAR_001_Platform_Architecture_Reference.md)
