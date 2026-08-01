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
  Classification: Engineering Governance Charter
-->

# SMRITI Engineering Charter v1.0

**Status:** APPROVED — Architecture Baseline Complete  
**Effective:** 2026-08-01  
**Scope:** Platform Foundation, Product Foundation, and Studio delivery

---

## 1. Governance Principle

The platform exists to accelerate product development, not to become a product itself.

Any proposal that increases platform complexity without enabling multiple products or delivering measurable customer value should be challenged before implementation.

Governance is now complete as an operational framework. Future changes to governance artifacts should be driven by real implementation deficiencies, not by new governance ideas that have no evidence behind them.

---

## 2. Three-Layer Engineering Model

### Layer 1 — Platform Foundation (Frozen)

This layer contains only reusable platform capabilities and should evolve very slowly.

**Scope:**
- Platform Core
- Platform Kernel
- Registration
- Workspace
- Event Framework
- Notification Framework
- Audit Framework
- Public SDK contracts

**Rules:**
- Backward compatibility is mandatory.
- Breaking changes require a new major API version.
- Every public contract change requires an ADR.
- Platform work should remain a minority of engineering effort.

### Layer 2 — Product Foundation (Shared)

This becomes the reusable layer for all SMRITI products.

**Examples:**
- Retail workflow engine
- Pricing engine
- Tax/GST engine
- Document numbering
- Approval workflows
- Search framework
- Reporting framework
- Master-data framework
- Barcode framework
- Printing framework

This layer is still product-oriented and may evolve more frequently than the platform foundation, but it is shared across multiple products and should not be studio-specific.

### Layer 3 — Studios (Business Features)

Studios deliver direct customer value.

**Examples:**
- Sales Studio
- Inventory Studio
- Purchase Studio
- POS Studio
- CRM Studio
- Accounting Studio
- Reporting Studio
- Customer Portal

Studios depend on Product Foundation and Platform Foundation, but neither lower layer should depend on a Studio.

---

## 3. Dependency Rule

Dependencies flow downward only.

```text
Studios
      │
      ▼
Product Foundation
      │
      ▼
Platform Foundation
```

**Formal rules:**
- Neither Platform Foundation nor Product Foundation should import Studio-specific code.
- Product Foundation may consume Platform Foundation APIs, but not the reverse.
- Studios may consume both lower layers, but not depend on other Studios for core business logic.
- No circular dependencies across these layers.

---

## 4. Repository Structure

The repository should explicitly distinguish platform, product foundation, and studio ownership so shared business capabilities do not drift into platform infrastructure.

```text
SMRITI Ecosystem
│
├── smriti-platform/               ← Frozen platform
│   ├── platform-core/
│   ├── platform-kernel/
│   ├── runtime/
│   ├── sdk/
│   └── governance/
│
├── smriti-product-foundation/     ← Shared business engines
│   ├── workflow-engine/
│   ├── pricing-engine/
│   ├── gst-engine/
│   ├── barcode-engine/
│   ├── printing-engine/
│   ├── reporting-engine/
│   └── search-engine/
│
├── smriti-retail-os/              ← Retail product
│   ├── inventory/
│   ├── sales/
│   ├── purchase/
│   ├── pos/
│   ├── crm/
│   ├── accounting/
│   └── reporting/
│
└── smriti-architecture/           ← ADRs, governance, baselines
    ├── adrs/
    ├── governance/
    ├── release-baselines/
    └── compatibility/
```

This keeps business capabilities out of the platform while avoiding duplication across studios.

---

## 5. Platform Change Decision Matrix

Before implementation, each feature must be assigned to a destination using a quick governance check.

| Proposed feature | Destination |
| :--- | :--- |
| Generic infrastructure reused across products | Platform Foundation |
| Shared business capability reused across studios | Product Foundation |
| Retail workflow or UI with clear product scope | Studio |
| Customer-specific customization | Extension / Plugin |

If a feature is only useful to a single studio, it belongs in that Studio or a product extension layer, not the platform.

---

## 6. Platform Change Budget

The recommended split is measurable and enforced per release:

- Platform Foundation: ≤10% of engineering effort
- Product Foundation: ~30% of engineering effort
- Studios: ~60% of engineering effort

Platform work exceeding the budget requires a written architectural justification.

Every sprint or release should classify work items into Platform, Product Foundation, or Studio, and effort distribution should be tracked. If Platform work exceeds 10% without an approved ADR, it should trigger an architectural review.

---

### Operating Model Transition

The platform program is now expressed in four operating phases:

1. Platform Foundation — completed and frozen.
2. Platform Operations — ongoing stewardship of security, performance, compatibility, and developer enablement.
3. Product Foundation — primary shared engineering stream for reusable business capabilities.
4. Studios — primary delivery stream for customer-facing value.

This transition formalizes the shift from platform expansion to platform enablement. The platform remains important, but it is no longer the primary place where new engineering effort is spent.

The platform health dashboard becomes the primary operational artifact for ongoing governance. New foundational governance documents should be limited to amendments of the constitution or changes to the operating model itself.

---

## 7. Freeze Policy

"Frozen" means the platform contracts are intentionally stable and may change only for the following reasons:

- Security issues
- Critical defects
- Performance improvements without API changes
- New optional capabilities that preserve compatibility

Everything else waits for the next major platform version.

Breaking changes require a new major version and ADR approval.

---

## 8. Freeze States

The platform lifecycle should be expressed as four explicit states, applied independently to APIs, contracts, services, SDKs, and ADRs.

| State | Meaning |
| :--- | :--- |
| Draft | Design may change freely |
| Stable | Backward compatibility is expected |
| Frozen | Public contracts cannot break without a major version |
| Deprecated | Supported but scheduled for removal |

---

## 9. Product Roadmap Sequence

The next investment should be Product Foundation and Studio delivery rather than further Platform Foundation expansion.

The next milestone is M2 — Product Foundation v1.0, supported by a Product Foundation Architecture Reference that clarifies placement of capabilities between Platform Foundation, Product Foundation, and Studios.

### Milestone closure — M1

Milestone M1 — Platform Foundation v1.0 is now closed.

- Status: CLOSED
- Platform Foundation: FROZEN
- Governance: OPERATIONAL
- Runtime: VALIDATED
- Public Contracts: STABLE
- Product Foundation: INITIATED

### M2 charter

The M2 objective is:

> Build reusable retail business capabilities that accelerate all Studios while preserving Platform Foundation stability.

### Program transition order

The program transitions from architecture to product execution.

```text
Platform Foundation v1.0
Status          : COMPLETE
Architecture    : FROZEN
Contracts        : STABLE
Governance       : OPERATIONAL
Implementation   : EVOLVABLE

Product Foundation v1.0
Status          : ACTIVE
Purpose         : Shared business engines for retail products

Retail Studios
Status          : PRIMARY DELIVERY PROGRAM
Purpose         : Customer-facing product execution
```

↓

Product Foundation v1.0
Status          : ACTIVE

↓

Retail Studios
Status          : PRIMARY DELIVERY
```

### M2 backlog

- Workflow Engine
- Document Engine
- Pricing Engine
- GST Engine
- Barcode and Label Engine
- Promotion and Discount Engine
- Printing Engine
- Search Engine
- Reporting Engine
- Offline Synchronization Engine
- Approval Engine
- Business Rules Engine

### Studio roadmap

1. POS Studio
2. Sales Studio
3. Inventory Studio
4. Purchase Studio
5. Accounting Studio
6. CRM Studio
7. Reporting Studio

### Shared Capability Reuse (SCR)

The maturity of Product Foundation should be measured with a Shared Capability Reuse KPI.

```text
SCR = Shared engines used / Total engines available
```

Target:
- M2 → 60%
- M3 → 80%
- GA → 95%

### Reference-only governance posture

The governance documents are now reference documents rather than active design documents, except for ADR-approved amendments, compatibility updates, security-related governance, and version changes.

### Success criteria shift

From M2 onward, success should be measured by product completeness rather than platform completeness.

- Platform Foundation: stability and compatibility
- Product Foundation: reuse across Studios
- Studios: customer productivity and workflow completion

### Product Foundation v1.0 milestone

The first Product Foundation milestone should include the Workflow, Document, Pricing, GST, Barcode, Print, Reporting, Search, Offline Synchronization, and Business Rules engines.

### Engineering dashboard

The living engineering dashboard should summarize platform health, Product Foundation progress, and Studio delivery status each sprint.

### CI evolution

M2 should expand CI to include Platform tests, Product Foundation tests, Studio integration tests, and end-to-end retail workflow tests.

### Product Foundation priorities
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

### Product Foundation engine scope

#### Document Engine
Shared document lifecycle for draft, approved, posted, cancelled, and archived documents across Sales, Purchase, Inventory, and Accounting.

#### Workflow Engine
Shared approval and state transitions for purchase approval, discount approval, credit approval, and stock approval.

#### Pricing Engine
Single pricing implementation supporting price lists, customer pricing, quantity breaks, promotions, coupons, loyalty, and taxes.

#### GST Engine
Single GST implementation consumed by every Studio.

#### Reporting Engine
Single reporting abstraction where Studios provide datasets and the engine provides charts, dashboards, KPIs, exports, and scheduled reports.

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

### Release dashboard and PCI

Each release should report:
- Platform API compatibility
- Dependency violations
- Circular dependencies
- Architecture guardrail status
- Regression test status
- Platform Churn Index
- Studio delivery metrics

The recommended layer distribution is:
- Platform Foundation: ≤10%
- Product Foundation: 20–30%
- Studios: 60–70%

Platform Foundation is now a product, not a project.

### Platform Foundation
- Stable infrastructure
- Compatibility-first maintenance
- Performance and defect management
- Support for Products

### Product Foundation
- Reusable retail capabilities
- Shared business engines across Studios
- Faster product delivery

### Studios
- Customer-facing delivery
- Primary source of customer value

### Engineering decision hierarchy

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

### Release strategy

The program should maintain three independent version streams:

| Layer | Lifecycle | Example |
| :--- | :--- | :--- |
| Platform Foundation | Slow, compatibility-first | v1.0.x |
| Product Foundation | Regular feature releases | v1.x |
| Retail Studios | Fast customer-driven releases | v2026.x |

### Platform change gate

All proposed Platform Foundation changes must satisfy:
- reuse across at least two products or domains
- cannot reasonably be implemented in Product Foundation
- preserve backward compatibility or have an approved migration plan
- include automated tests and compatibility validation
- use an ADR if public contracts are affected

Going forward, every proposal should answer these questions in order:

1. Does this solve a customer problem?
2. Can this be implemented inside a Studio?
3. Can it live in Product Foundation?
4. Does it truly belong in Platform Foundation?

Only if the answer to the fourth question is unequivocally yes should Platform Foundation change.

### Wave 1 — Core retail
- POS Studio
- Sales Studio
- Inventory Studio

### Wave 2 — Operational
- Purchase Studio
- Accounting Studio
- CRM Studio

### Wave 3 — Management
- Reporting Studio
- Customer Portal
- License Studio
- Mobile Workspace

### Product Foundation priority backlog
- Document Engine
- Workflow Engine
- Approval Engine
- Pricing Engine
- GST Engine
- Barcode Engine
- Printing Engine
- Search Engine
- Reporting Engine
- Offline Synchronization Engine

The primary product roadmap should follow this value-first ordering.

### Wave 1 — Customer-visible value
1. POS Studio
2. Sales Studio
3. Inventory Studio

### Wave 2 — Operational completeness
1. Purchase Studio
2. Accounting Studio
3. CRM Studio

### Wave 3 — Management
1. Reporting Studio
2. Customer Portal
3. License Studio

### Wave 4 — Platform ecosystem
1. Telemetry
2. Configuration
3. API Gateway
4. Marketplace

The final wave supports products rather than redefining the platform.

---

## 10. CI Guardrails

Governance is now mature enough that enforcement should rely primarily on automation rather than documentation.

Recommended pipeline:

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

If a rule cannot be checked automatically, it should be reviewed periodically to determine whether it still has value.

Architecture tests are mandatory and should be expanded to include:

- Dependency direction validation
- Circular dependency detection
- Public API surface diff checking
- Breaking API compatibility detection
- ADR reference required for platform API changes
- Release compatibility validation against the frozen contract version

---

## 11. Platform Maturity Score

The platform qualifies as **Platform Foundation v1.x** only when all required release gates are green.

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

When all gates are green, the platform is eligible for a stable major-minor release baseline.

---

## 12. Platform Acceptance Criteria

Instead of adding more platform capabilities, every proposed platform enhancement must satisfy all of the following:

1. It benefits at least two products.
2. It is independent of retail business rules.
3. It is reusable outside a single studio.
4. It does not introduce a new architectural layer.
5. It has measurable operational value (performance, reliability, security, maintainability, or extensibility).

If any criterion is not met, the capability belongs in Product Foundation or a Studio rather than the platform.

---

## 13. Product Success Metrics

With the platform stabilized, engineering KPIs should shift toward customer-facing outcomes rather than platform abstraction counts.

### Primary product KPIs
- POS checkout time
- Sales workflow efficiency
- Inventory accuracy
- Purchase lifecycle completion
- Reporting responsiveness
- Offline synchronization reliability
- Mobile usability

### Platform KPIs
- API compatibility
- Regression pass rate
- Startup time
- Memory footprint
- Dependency integrity
- Security

These metrics are more meaningful than counting new platform abstractions.

---

## 14. Maintenance Mode Declaration

At this stage, the platform should be treated as maintenance mode rather than expansion mode.

The primary engineering objective is:

> Deliver the best Retail OS possible using the platform already built, instead of continuing to expand the platform itself.

This is the inflection point where platform investments begin to compound through faster product delivery rather than through additional infrastructure. The majority of engineering effort should now be directed toward Product Foundation and Retail OS studios.

---

## 15. Architecture Review Board (ARB)

Governance must be operational, not purely documentary.

| Change Type | Approval Authority |
| :--- | :--- |
| Studio feature | Studio lead |
| Product Foundation capability | Product Architecture Board |
| Platform Foundation change | Platform Architecture Review Board + ADR |
| Breaking public API | Major version approval |

The ARB is responsible for evaluating scope, reuse, compatibility impact, and release risk before a platform-level change proceeds.

---

## 16. Lifecycle States

Every reusable component should carry the same lifecycle vocabulary across platform services, Product Foundation engines, SDK APIs, extensions, and plugins.

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

This gives contributors immediate visibility into support expectations and maturity.

---

## 17. Compatibility Guarantees

Compatibility expectations must be stated explicitly.

- Platform Foundation: backward compatible within a major version.
- Product Foundation: backward compatible within a minor version where practical.
- Studios: feature evolution is allowed, but published APIs should follow semantic versioning.

This clarifies where stability is mandatory and where iteration is expected.

---

## 18. Architectural Fitness Functions

Architecture should be enforced continuously, not only in design reviews.

Examples include:
- No circular dependencies.
- No Studio importing another Studio.
- Product Foundation cannot import Studio code.
- Platform Foundation cannot import Product Foundation or Studio code.
- Public API compatibility checks.
- Maximum dependency depth.
- Forbidden import rules.
- Architecture test suite required for merge.

These become measurable fitness functions that continuously verify the architecture.

---

## 19. Product Foundation Roadmap

Product Foundation is a first-class engineering stream and should be managed as such.

**Examples:**
- Workflow Engine
- Pricing Engine
- GST Engine
- Barcode Engine
- Reporting Engine
- Search Engine
- Printing Engine

This layer captures reusable business capabilities without polluting the platform.

---

## 20. Promotion Criteria

Code should move upward only when the reuse case is proven.

```text
Studio
    │
    ▼
Product Foundation
    │
    ▼
Platform Foundation
```

### Studio → Product Foundation
- Used by at least two studios.
- Independent of one specific workflow.
- Has regression tests and documentation.

### Product Foundation → Platform Foundation
- Product-neutral.
- Reusable by multiple products.
- Stable API.
- ADR approved.

This avoids premature abstraction while still encouraging reuse.

---

## 21. Governance Artifact Versioning

Governance documents themselves should be treated as versioned assets.

| Document | Version |
| :--- | :--- |
| Engineering Charter | v1.0 |
| Platform Constitution | v1.0 |
| Compatibility Policy | v1.0 |
| Release Policy | v1.0 |
| Architecture Governance | v1.0 |

Future changes should produce v1.1, v1.2, or v2.0 rather than silently editing the originals.

---

## 22. Release Strategy

Adopt parallel versioning to separate platform stability from product evolution.

| Component | Versioning Strategy |
| :--- | :--- |
| Platform Foundation | Semantic versioning with infrequent major releases |
| Product Foundation | Minor releases as shared business capabilities evolve |
| Studios | Independent feature releases |

This allows business features to move quickly without destabilizing the platform.

---

## 23. Long-Term Governance

The platform should be treated as a durable substrate, not as a product in itself.

> The platform exists to accelerate product development, not to become a product itself.

Any proposal that increases platform complexity without enabling multiple products or delivering measurable customer value should be challenged before implementation.

---

## 8. Overall Assessment

Based on the maturity of the current platform foundation:

- Platform Foundation: Mature enough to freeze architecturally.
- Kernel contracts: Ready to be treated as stable public APIs.
- Service boundaries: Well separated into consumer-oriented layers.
- Governance: Mature, supported by ADRs, validation, compatibility documentation, and CI guardrails.
- Engineering focus: Should now shift primarily to Retail OS studios and shared product capabilities.

This transition—from building the platform to building products on the platform—is a natural milestone for a platform of this scope. The remaining platform work should emphasize stability, compatibility, performance, and maintainability rather than new foundational abstractions.

---

## 9. Formal Decision

```text
SMRITI Engineering Charter v1.0
Architecture Layers: 3
Platform Foundation: FROZEN
Product Foundation: SHARED
Studios: PRODUCT DELIVERY
```

This charter supersedes the previous two-layer framing and becomes the working governance baseline for all future platform and product decisions.
