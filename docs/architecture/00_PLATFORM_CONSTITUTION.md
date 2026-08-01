# SMRITI Platform Constitution v1.0

## Status

- Version: 1.0
- Status: Frozen for RC1 and onward governance
- Purpose: Define the non-negotiable platform principles, extension model, and change process for SMRITI Retail OS

## 1. Platform Principles

The following principles are the constitutional foundation of the SMRITI platform:

1. Platform First
   - The platform must remain stable, reusable, and predictable.

2. Composition over Modification
   - New capabilities should be added through definitions, policies, and modules rather than by modifying the core platform.

3. Registry Driven
   - Discovery and runtime behavior should be driven through registries and metadata.

4. Metadata Driven
   - Business behavior should be configurable wherever possible.

5. Pipeline Driven
   - Business execution must follow the canonical pipeline model.

6. Backward Compatible
   - Platform evolution must preserve compatibility with existing contracts.

7. Zero Breaking Changes
   - Core contracts should not be broken without explicit ADR review and migration planning.

8. Plugin First
   - Extensions should be deployable as modules, policies, definitions, and templates rather than invasive platform changes.

9. Offline First
   - Core business workflows should remain usable without depending on external AI or cloud-only services.

10. Multi Industry
   - The platform must remain reusable across retail, distribution, manufacturing, and other domain extensions.

## 2. Platform Governance Model

The platform is divided into two layers:

### Layer 1 — Frozen Platform Core
This layer includes:
- Kernel APIs
- Business Transaction Pipeline contract
- Stage Registry
- Document Definition schema
- Policy interfaces
- Lifecycle state machine
- Event contracts
- Startup validation framework

These contracts are stable and should not be changed casually.

### Layer 2 — Extensible Product Layer
This layer includes:
- new document definitions
- transaction policies
- workflow policies
- print templates
- numbering policies
- notification policies
- reports and dashboards
- industry-specific modules

These are the primary extension points for product growth.

## 3. Change Policy

Any change to the frozen platform must follow this process:

```text
Can the need be solved using a Definition or Policy?
    ↓
    YES → implement through extension
    NO  → create ADR → architecture review → approval → platform change
```

## 4. ADR Requirement

No platform-level change is permitted without:
- an Architecture Decision Record
- rationale for the change
- compatibility impact assessment
- migration or fallback plan where relevant

## 5. Extension Rules

The following are the default rules for contributors:

### Do this
- create a new document definition
- register a new policy
- add a new print template
- add a new numbering policy
- add a new notification policy
- add a new workflow policy
- add a new module or plugin
- write tests for the extension

### Do not do this
- edit the core pipeline without ADR approval
- edit the kernel contract casually
- change the stage registry contract without review
- bypass the pipeline execution model
- hardcode numbering logic into business services
- hardcode notifications into domain services
- create duplicative workflow implementations
- modify the definition schema without governance

## 6. Business Document Delivery Checklist

Every new business document should satisfy the following checklist:

- Definition ✓
- Workflow ✓
- Numbering ✓
- Print ✓
- Notification ✓
- Pipeline ✓
- Tests ✓
- Documentation ✓

## 7. Plugin Certification Rules

Extensions intended for marketplace or ecosystem use must satisfy:
- no core modification required
- uses registry-based discovery
- uses policy-based behavior
- stays compatible with the pipeline model
- maintains backward compatibility

## 8. Long-Term Direction

SMRITI is a platform for building products, not a product that must be re-architected for each new capability.

The future roadmap should prioritize:
- business documents
- operations workflows
- finance capabilities
- reporting and analytics
- industry-specific modules

The platform remains stable while the product layer grows.
