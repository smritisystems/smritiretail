# SMRITI Platform Foundation v1.0 — Engineering Freeze

## Status

- Architecture: FROZEN
- Implementation: Production Candidate (Evolvable)
- Product Focus: SMRITI Retail OS

## Purpose

This document records the formal transition from platform experimentation to platform stabilization and product delivery. The platform foundation is now considered mature enough to support product engineering without continuing to grow the foundational abstraction layer.

Governance is now complete as an operating framework. The platform baseline is stable, and future governance updates should occur only when implementation exposes an actual deficiency.

## RC1 Architecture Freeze Declaration

Status: RC1 Architecture Freeze is now active for product delivery.

This freeze is based on verified release readiness:
- Build validation: `npm run build` passed
- Regression validation: `npm test` passed
- Test coverage: 63/63 test files passed and 224/224 tests passed

The frozen engineering contract is now:
- Kernel APIs remain stable and backward compatible
- Document Definition Registry remains the canonical extension point for business documents
- Pipeline Factory and Business Transaction Pipeline remain the canonical execution model
- Stage Registry, Policy Registry, Workflow, Ledger, Finance Engine, Inventory Engine, and Document Lifecycle remain the shared product foundation
- New business features must be delivered through configuration and policy composition rather than new foundational abstractions

## RC1 Delivery Model

Future product work must follow this pattern:

```text
New Feature
  ↓
Document Definition
  ↓
Policy Definition
  ↓
Workflow / Print / Notification / Numbering Policies
  ↓
Pipeline
  ↓
Done
```

Examples:
- Purchase Order → `PurchaseOrderDefinition` + transaction policy + workflow policy + print policy + notification policy
- Delivery Challan → `DeliveryChallanDefinition` + pipeline
- GRN → `GRNDefinition` + pipeline
- Sales Return → `SalesReturnDefinition` + pipeline

## RC1 Product Roadmap

### Phase A — Business Documents (Highest Priority)
- Sales Order
- Purchase Order
- Quotation
- GRN
- Delivery Challan
- Credit Note
- Debit Note

### Phase B — Retail Operations
- Physical Verification
- Consignment Stock
- Warehouse Operations
- Batch and Serial Enhancements

### Phase C — Finance
- Cash Book
- Bank Book
- Receipt Voucher
- Payment Voucher
- Bank Reconciliation

### Phase D — Reports and Dashboards
- MIS
- GST Reports
- Financial Statements
- Inventory Reports
- Executive Dashboards

## Governance Rules for the Freeze

The following rules are now non-negotiable:
- No new platform abstractions without ADR review and explicit approval
- No breaking changes to frozen kernel contracts
- New capabilities must be expressed as document definitions and policies where possible
- Foundation services must remain reusable and policy-driven
- Business logic should be extended through composition, not by adding fresh architectural layers

## Frozen Platform Baseline

The following components are the canonical frozen platform foundation:

- Platform Core
- Platform Kernel
- Registration
- Workspace
- Events
- Notifications
- Audit

These components evolve only through backward-compatible changes or ADR-approved major versions.

## Platform Change Budget

From this point forward, the engineering program is divided into three tracks:

### 1. Platform Stewardship (approximately 10%)
Allowed work:
- Security fixes
- Performance optimization
- Adapter implementations
- Documentation
- CI/CD improvements
- SDK improvements
- Bug fixes
- Backward-compatible enhancements

Requires ADR review:
- New platform abstractions
- Public API changes
- Kernel contract changes
- New platform services

### 2. Product Foundation (approximately 30%)
Priority order:
1. Workflow Engine
2. Pricing Engine
3. GST Engine
4. Barcode Engine
5. Document Engine
6. Reporting Engine
7. Search Engine
8. Printing Engine

### 3. Studio Delivery (approximately 60%)
Priority order:
1. Inventory Studio
2. Sales Studio
3. POS Studio
4. Purchase Studio
5. Accounting Studio
6. CRM Studio
7. Reporting Studio
8. Customer Portal
9. License Studio
10. Mobile Workspace

## Operating Model: Foundation, Operations, Product Foundation, and Studios

The platform program is now organized into four operating phases:

### Phase 1 — Platform Foundation (Completed)

**Status:** Complete and architecturally frozen.

Deliverables:
- Platform Constitution
- Platform Foundation
- Core and Kernel
- Registration
- Workspace
- Events
- Notifications
- Audit
- Public contracts
- CI guardrails

Primary KPI:
- Architectural stability

### Phase 2 — Platform Operations (Ongoing)

The platform team now acts as a steward rather than a builder.

Responsibilities:
- Security updates
- Performance optimization
- SDK maintenance
- Adapter development
- Compatibility certification
- Developer documentation
- Architecture reviews
- Release management

Success is measured by stability and developer productivity, not by adding services.

### Phase 3 — Product Foundation

This becomes the primary shared engineering stream for reusable business logic.

Suggested ownership:
- Workflow engine
- High-document engine
- GST / tax engine
- Pricing engine
- Barcode engine
- Printing engine
- Reporting engine
- Search engine
- Offline sync engine

### Phase 4 — Studios

This is where engineering velocity should be concentrated.

A practical implementation sequence is:
1. POS Studio
2. Sales Studio
3. Inventory Studio
4. Purchase Studio
5. Accounting Studio
6. CRM Studio
7. Reporting Studio
8. Customer Portal
9. License Studio
10. Mobile Workspace

## Platform Health Dashboard

The governance model is now mature enough to shift from creating new foundational documents to maintaining a lightweight health dashboard that supports stewardship instead of expansion.

| Metric | Target |
| :--- | :--- |
| Regression tests | 100% passing |
| Public API compatibility | 100% |
| Architecture guardrails | 100% |
| Circular dependencies | 0 |
| Critical security issues | 0 |
| CI validation uptime | 100% |
| SDK compatibility | 100% |

This becomes the ongoing indicator that the platform remains healthy.

---

## Non-Negotiable Dependency Rule

The dependency graph is frozen as follows:

```text
Platform Core
      │
      ▼
Kernel
      │
      ▼
Registration
      │
      ▼
Workspace
      │
      ▼
Events
      │
      ▼
Notifications
      │
      ▼
Audit
      │
      ▼
Telemetry
      │
      ▼
Configuration
      │
      ▼
API Gateway
```

Rules:
- No upward dependencies.
- No service orchestration.
- Only downstream consumption.

## Product Architecture Layer

The platform is a substrate for product architecture. Above the platform sits the Retail Product Architecture layer, which constrains business workflows and studio composition without redefining the platform itself.

```text
SMRITI Platform
        │
        ▼
Retail Product Architecture
        │
 ┌──────┼───────────────┐
 │      │               │
Sales Inventory Purchase
 │      │               │
 POS  Accounting     CRM
```

## Repository Structure and Layer Ownership

The repository should explicitly distinguish between Platform Foundation, Product Foundation, and Studios so that business capability code does not migrate into platform infrastructure.

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

This creates very clear ownership:
- `smriti-platform` owns reusable infrastructure.
- `smriti-product-foundation` owns reusable business capabilities.
- `smriti-retail-os` owns customer-facing workflows.
- `smriti-architecture` owns governance, ADRs, compatibility matrices, and release baselines.

## Freeze States

The platform lifecycle should be expressed as four explicit states, applied independently to APIs, contracts, services, SDKs, and ADRs.

## Definition of Done for Platform Foundation

Platform Foundation is considered done when it remains intentionally small, backward-compatible, well-tested, and changes only in response to demonstrated multi-product needs.

| State | Meaning |
| :--- | :--- |
| Draft | Design may change freely |
| Stable | Backward compatibility is expected |
| Frozen | Public contracts cannot break without a major version |
| Deprecated | Supported but scheduled for removal |

Transitions are allowed only through the governing ADR and compatibility process.

## Platform Maturity Score

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

## Product Governance and Promotion Path

Reusable code should follow a controlled promotion path.

```text
Studio
    │
    ▼
Product Foundation
    │
    ▼
Platform Foundation
```

Promotion requires evidence:
- reused by at least two studios;
- business-neutral at the Product Foundation layer;
- infrastructure-neutral at the Platform Foundation layer.

This prevents premature generalization and keeps platform scope narrow.

## Platform Change Decision Matrix

Before implementation, each feature must be assigned to one destination using this governance check:

| Proposed feature | Destination |
| :--- | :--- |
| Generic infrastructure reused across products | Platform Foundation |
| Shared business capability reused across studios | Product Foundation |
| Retail workflow or UI with clear product scope | Studio |
| Customer-specific customization | Extension / Plugin |

**Rule:** if a feature is only useful to a single studio, it belongs in that Studio or in a product extension layer, not the platform.

## Platform Change Budget

From this point forward, the platform budget is capped and measurable.

Per release:
- Platform Foundation: ≤20% of engineering effort
- Product Foundation + Studios: ≥80% of engineering effort

Any platform work beyond budget requires a written architectural justification explaining why the capability is genuinely cross-product, reusable, and not better placed in Product Foundation or a Studio.

## Freeze Policy

"Frozen" means the platform contracts are intentionally stable and may change only for the following reasons:

- Security issues
- Critical defects
- Performance improvements without API changes
- New optional capabilities that preserve compatibility

Everything else waits for the next major platform version.

Breaking changes require a new major contract version and ADR approval.

## Product Roadmap Sequence

The next six months should focus on Product Foundation and Studios rather than additional platform structure.

### Phase A — Product Foundation
- Workflow Engine
- Document Engine
- GST Engine
- Pricing Engine
- Barcode and Print Engine

### Phase B — Retail Studios
- POS Studio
- Sales Studio
- Inventory Studio
- Purchase Studio
- Accounting Studio

### Phase C — Supporting capabilities
- CRM
- Reporting and Analytics
- Customer Portal
- Mobile Workspace

### Phase D — Platform Operations
- Maintenance
- Security
- Performance
- Compatibility
- SDK evolution
- Adapter ecosystem

The primary product roadmap should follow this value-first order:

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
4. Mobile Workspace

### Wave 4 — Platform ecosystem
1. Telemetry
2. Configuration
3. API Gateway
4. Marketplace

The final wave is ecosystem support rather than platform expansion.

## Product Foundation Roadmap

The Product Foundation should be treated as an active roadmap stream with explicit ownership and delivery priorities.

| Capability | Initial Owner | Priority |
| :--- | :--- | :--- |
| Workflow Engine | Product Foundation | High |
| Document Engine | Product Foundation | High |
| Pricing Engine | Product Foundation | High |
| GST / Tax Engine | Product Foundation | High |
| Barcode Engine | Product Foundation | High |
| Reporting Engine | Product Foundation | Medium |
| Search Engine | Product Foundation | Medium |
| Printing Engine | Product Foundation | Medium |
| Offline Sync Engine | Product Foundation | High |

This layer should be managed as a primary reuse stream for Retail OS studios rather than as a secondary platform concern.

## CI Guardrails

The architecture tests are mandatory but should be expanded to include:

- Dependency direction validation
- Circular dependency detection
- Public API surface diff checking
- Breaking API compatibility detection
- ADR reference required for platform API changes
- Release compatibility validation against the frozen contract version

These checks protect the platform discipline already established.

## Maintenance Mode Declaration

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

The next milestone is M2 — Product Foundation v1.0. Product Foundation should become the active investment layer for reusable retail business capabilities, while the Platform Foundation remains intentionally small and stable.

### Product Foundation and Studio orientation

The Platform Foundation should remain intentionally small. The next shared investment is business capability delivery through Product Foundation and Studios.

### Release dashboard

Each release should report:
- Platform API compatibility
- Dependency violations
- Circular dependencies
- Architecture guardrail status
- Regression test status
- Platform Churn Index
- Studio delivery metrics

### Platform Churn Index target

| Layer | Healthy Target |
| :--- | :--- |
| Platform Foundation | ≤10% |
| Product Foundation | 20–30% |
| Studios | 60–70% |

Platform Foundation is now a product, not a project.

### Operating posture
- Platform Foundation: stable infrastructure and stewardship
- Product Foundation: active innovation and shared business capability development
- Studios: primary delivery of customer value

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

| Layer | Lifecycle | Example |
| :--- | :--- | :--- |
| Platform Foundation | Slow, compatibility-first | v1.0.x |
| Product Foundation | Regular feature releases | v1.x |
| Retail Studios | Fast customer-driven releases | v2026.x |

### Platform change gate

Proposed Platform Foundation changes must prove reuse, justify platform placement, preserve compatibility, include tests, and use ADRs for contract-affecting changes.

Rather than adding more governance documents, the program should use a lightweight review rhythm.

| Review | Frequency | Focus |
| :--- | :--- | :--- |
| Studio Review | Weekly | Customer value, UX, delivery |
| Product Foundation Review | Monthly | Shared business capabilities |
| Platform Review | Quarterly | Compatibility, security, performance |
| Constitution Review | Annually | Strategic governance only |

This keeps governance active without becoming burdensome.

### Platform success criteria
- Public API compatibility
- Regression test pass rate
- Architecture guardrail compliance
- Build reliability
- Security findings
- Startup performance
- Memory footprint

### Retail OS success criteria
- POS checkout time
- Sales workflow efficiency
- Inventory accuracy
- Purchase cycle completion
- Reporting performance
- Offline synchronization reliability
- Customer adoption and satisfaction

The platform has entered a maintenance mode rather than expansion mode.

The primary engineering objective is now:

> Deliver the best Retail OS possible using the platform already built, instead of continuing to expand the platform itself.

At this point, platform investment should be treated as an enabler for compounding product velocity, not as a self-justifying engineering objective.

## ADR Separation

Future ADRs should be split into two categories:

### Platform ADRs
Examples:
- Kernel API
- Platform Core
- Event Contracts

These change rarely and require strong justification.

### Product ADRs
Examples:
- Sales workflow
- Inventory valuation
- Purchase lifecycle
- POS checkout UX
- Reporting model

These are expected to evolve as product requirements are validated.

## Success Criteria

The platform is no longer the primary measure of success. Customer-visible outcomes are the primary measure.

Examples:
- POS checkout under 10 seconds
- Accurate stock movements
- Complete PO → GRN → Invoice workflow
- Minimal-click invoice creation
- Fast dashboard rendering
- Reliable offline synchronization
- Consistent adaptive workspace experience

## Roadmap

### Milestone A — Completed
- Platform Core
- Kernel
- Registration
- Workspace
- Events
- Notifications
- Audit

### Milestone B — Current
- Inventory Studio
- Sales Studio
- POS Studio
- Purchase Studio
- Accounting Studio
- CRM Studio
- Reporting Studio

### Milestone C
- Telemetry
- Configuration
- API Gateway
- Plugin Marketplace
- Advanced Analytics

These support the ecosystem rather than redefining the platform.

## Governing Principle

> Platform-First, Product-Focused Principle
>
> The platform exists to enable products.
> New abstractions require clear reuse across multiple products.
> Retail-specific workflows belong in Retail OS, not in the platform.
> The platform should remain intentionally small and stable.

## Final Declaration

The Platform Foundation is now approved as v1.0 Architecture Frozen. The remaining risk is execution and product completeness, not technical architecture.

From this point forward, the highest-value engineering work is the delivery of complete retail workflows that customers can use every day:

1. Build reusable Product Foundation engines.
2. Implement POS, Sales, and Inventory Studios on top of those engines.
3. Validate the architecture through real retail scenarios such as sales, purchasing, inventory, accounting, returns, and reporting.
4. Promote reusable business capabilities into Product Foundation only after they have demonstrated value across multiple Studios.

The permanent architectural rule is:

> Every new capability must first answer three questions before it enters the Platform Foundation: whether it will be reused by at least two Product Foundation engines, reused by at least two Studios, and whether it reduces long-term maintenance across the product suite. If the answer is no to all three, the capability should be implemented in the relevant Studio rather than the platform.


```text
SMRITI Platform Foundation
Version: 1.0.0
Architecture: FROZEN
Contracts: STABLE
Implementation: EVOLVABLE
Product Status: READY
```

From this point onward, every proposed change must answer the governing question:

> Does this create measurable value for Retail OS users, or is it simply making the platform more sophisticated?

If the answer is the latter, the change should generally be deferred.

## Related Artifacts

- [docs/architecture/adr-0006-platform-kernel-contracts-frozen.md](./adr-0006-platform-kernel-contracts-frozen.md)
- [src/sdk/swsdk/runtime/core/index.ts](../../src/sdk/swsdk/runtime/core/index.ts)
- [src/tests/swsdk.runtime.architecture.test.ts](../../src/tests/swsdk.runtime.architecture.test.ts)
