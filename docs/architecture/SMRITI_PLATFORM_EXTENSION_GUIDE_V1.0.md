<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Platform Extension Guide v1.0

## Status

- Purpose: Developer playbook for extending SMRITI without modifying the frozen platform core
- Scope: Business documents, policies, workflows, print templates, numbering, notifications, reports, and module extensions
- Governance: Extensions must follow the frozen platform contracts and should prefer composition over core modification

## Core Principle

SMRITI is a frozen platform with extensible product capabilities.

The default rule is:

- If a requirement can be implemented by adding a definition or policy, do that
- If the requirement needs a new platform abstraction, treat it as an exception and require ADR review

## Extension Model

The recommended extension pattern is:

```text
Business Capability
  ↓
Document Definition / Module Definition
  ↓
Policy Definitions
  ↓
Pipeline / Workflow / Print / Notification / Numbering
  ↓
Runtime execution
```

## What Is Allowed to Extend

The following are first-class extension points and should be used for most product work:

### 1. Document Definitions
Use document definitions to introduce new business documents such as:
- Sales Order
- Purchase Order
- Quotation
- GRN
- Delivery Challan
- Credit Note
- Debit Note

### 2. Transaction Policies
Use transaction policies to define rules for document behavior such as:
- validation rules
- posting behavior
- approval behavior
- financial impact rules
- inventory impact rules

### 3. Workflow Policies
Use workflow policies to define:
- approval stages
- step transitions
- escalation rules
- review requirements

### 4. Print Policies
Use print policies to define:
- document templates
- print layout rules
- print format variants
- export behavior

### 5. Notification Policies
Use notification policies to define:
- email, SMS, or WhatsApp triggers
- event-based notifications
- document status changes
- approval reminders

### 6. Numbering Policies
Use numbering policies to define:
- document numbering series
- prefix/suffix logic
- reset rules
- year-based or month-based numbering

### 7. Reports and Dashboards
Use reporting and dashboard definitions to expose business analytics without modifying platform services.

## Extension Rules

### Rule 1 — Prefer Definition over Platform Change
Before changing the platform, ask:

> Can this be solved with a new definition or policy?

If yes, implement it through extension points.

### Rule 2 — Keep Core Stable
Do not change:
- kernel contracts
- pipeline interfaces
- registry contracts
- lifecycle state machine contracts
- event contracts
- startup validation contracts

unless the change is explicitly required and approved through ADR review.

### Rule 3 — Favor Composition
Prefer:
- adding a new policy
- adding a new definition
- adding a new template
- adding a new module

instead of:
- changing the core pipeline
- changing the registry engine
- changing the kernel lifecycle

### Rule 4 — Backward Compatibility
All extensions must remain compatible with existing runtime behavior.

Extensions must not:
- break older document definitions
- break existing policy contracts
- assume hidden platform internals
- bypass lifecycle enforcement

## How to Add a New Business Document

### Step 1 — Define the document
Create a new document definition that describes:
- document type
- fields
- default state
- allowed transitions
- required policies

### Step 2 — Attach policies
Attach the relevant policies:
- transaction policy
- workflow policy
- print policy
- notification policy
- numbering policy

### Step 3 — Register the document
Register the document in the relevant registry so it becomes discoverable by the runtime.

### Step 4 — Add runtime behavior through policies
Any special behavior should be expressed through policies and definitions instead of direct platform branching.

### Step 5 — Validate and test
Verify:
- creation flow
- state transition
- print output
- notification behavior
- numbering behavior
- audit trail

## How to Add a New Policy

A new policy should implement the appropriate interface and be registered with the policy registry.

### Policy guidance
- Keep policies focused on one responsibility
- Use the existing policy interfaces
- Keep policy logic declarative when possible
- Avoid hard-coded coupling to unrelated modules

## How to Add a New Workflow

Create or configure a workflow policy that defines:
- starting state
- allowed next states
- approval roles
- conditions
- escalation rules

Do not change the lifecycle engine unless the workflow model itself is not expressive enough.

## How to Add a Print Template

Add a print template definition and bind it through a print policy.

The template should include:
- layout definition
- field mapping
- formatting rules
- localization support where relevant

## How to Add a Numbering Series

Create a numbering policy or series definition that specifies:
- prefix
- suffix
- reset frequency
- format rules
- document type mapping

## How to Add Notifications

Add a notification policy that binds:
- trigger event
- message template
- target channel
- recipient resolution

## Plugin and Module Extension Rules

Industry-specific or marketplace extensions should be added as:
- new modules
- new definitions
- new policies
- new templates

They should not require mutation of the frozen kernel or pipeline base contracts.

## Backward Compatibility Requirements

All extensions must satisfy these rules:
- Existing document definitions remain valid
- Existing policy interfaces remain valid
- Existing workflows remain compatible unless explicitly versioned
- Existing event contracts remain compatible unless ADR-approved

## Decision Threshold

Modify the platform core only when:
- the limitation affects multiple document types or domains
- the solution cannot be expressed with definitions or policies
- the capability is truly reusable across the product foundation

If the requirement is document-specific or module-specific, solve it through extension rather than platform change.

## Recommended Delivery Pattern for RC2+

For each new feature, use this sequence:

```text
1. Add document definition
2. Add required policies
3. Add workflow / print / notification behavior
4. Register the feature
5. Validate end-to-end
6. Ship without core modification unless truly necessary
```

## Summary

The platform is frozen for stability.
The product layer is extensible for growth.

The goal is to keep SMRITI scalable by allowing contributors to add capabilities through definitions, policies, templates, and modules rather than by rewriting the core platform.
