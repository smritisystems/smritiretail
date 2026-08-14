<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITRretailNX
  Organization : AITDL NETWORKS
  Version      : 1.0
  Created      : 2026-07-18
  Status       : Draft
  Owner        : Enterprise Architecture
  Reviewers    : Product, Architecture, Engineering
  Related Docs : PRODUCT_IDENTITY_ENGINE.md, PRODUCT_IDENTITY_ENGINE_CONFIGURATION.md
-->

# ADR-003: GS1 Assignment Policy

## Status
Draft

## Context
GS1 barcodes are a primary identity artifact for product distribution and regulatory compliance. The system must support GS1 issuance, pool exhaustion handling, and reuse policies.

## Decision
Implement GS1 assignment as a provider-backed pool with the following policy:

- Reserve GS1 codes only when a SKU identity is approved or imported with an approved decision.
- Support fallback barcode providers when GS1 pool is exhausted.
- Treat GS1 assignments as first-class identifiers with audit provenance.
- Allow reuse of barcodes only through explicit governance approval and state transition.

## Consequences
- Ensures GS1 compliance while preserving operational continuity
- Requires explicit provider and pool configuration
- Enforces audit controls for barcode reuse
