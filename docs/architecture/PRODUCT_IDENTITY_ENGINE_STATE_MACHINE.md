<!--
  Title: Product Identity Engine State Machine
  Version: 1.0
  Status: Draft
  Owner: Enterprise Architecture
  Reviewers: Product, Architecture, Engineering
  Last Updated: 2026-07-18
  Dependencies: PRODUCT_IDENTITY_ENGINE.md
  Related Documents: PRODUCT_IDENTITY_ENGINE_SEQUENCE.md, PRODUCT_IDENTITY_ENGINE_ERRORS.md
  Change History:
    - v1.0 2026-07-18 Created.
-->

# Product Identity Engine State Machine

## Purpose

Defines the lifecycle states for SKU identity, barcode assignment, and identity governance operations in SMRITI PIE.

## State Machine Overview

The primary identity lifecycle is:

- Available
- Reserved
- Assigned
- Verified
- Printed
- Active
- Retired

### Transitions

- Available → Reserved: when a barcode is selected for future assignment or a candidate identity is locked for review.
- Reserved → Assigned: when the barcode is bound to a SKU and persisted.
- Assigned → Verified: when the SKU identity and barcode are validated against rule and provider constraints.
- Verified → Printed: when physical labels, packaging, or certificates are generated.
- Printed → Active: when the SKU is released for production, distribution, or store upload.
- Active → Retired: when the identity is withdrawn, deprecated, or replaced.

## State Definitions

### Available

The identity or barcode is in the pool and may be consumed. No SKU claim exists yet.

### Reserved

The barcode is reserved or candidate identity is locked pending approval, import completion, or rule resolution.

### Assigned

The SKU business key/fingerprint and barcode are bound together and recorded in the identity store.

### Verified

The assigned identity has passed governance validation checks, including business rule compliance and provider constraints.

### Printed

A physical or digital label/ID artifact has been generated for the SKU. This state is especially relevant for GS1 labels and packaging.

### Active

The SKU identity is approved for usage in operations, distribution, reporting, and downstream systems.

### Retired

The identity is withdrawn. It remains in the audit history but is not eligible for new transactions or reuse unless explicitly reactivated.

## Guard Conditions

- Reservation may expire if not confirmed within the configured hold window.
- Assignment is blocked if a duplicate business key or fingerprint conflict is detected.
- Verification requires rule execution results to be successful.
- Printing may be skipped for digital-only items, but the state remains available for traceability.
- Retired identities must not be reused unless explicitly authorized by governance.

## Sub-State Models

### Barcode Pool State

- Pooled
- Reserved
- Assigned
- Decommissioned

### Import Transaction State

- Pending
- Evaluated
- Committed
- Rolled back
- Failed
