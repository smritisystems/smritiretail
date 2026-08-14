<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITRretailNX
  Organization : AITDL NETWORKS
  Version      : 1.0
  Created      : 2026-07-18
  Status       : Draft
  Owner        : Enterprise Architecture
  Reviewers    : Product, Architecture, Engineering
  Related Docs : PRODUCT_IDENTITY_ENGINE.md, PRODUCT_IDENTITY_ENGINE_API_SPEC.md
-->

# ADR-001: Product Identity Engine

## Status
Draft

## Context
SMRITI requires a governance-grade identity service for SKU and barcode management that supports configurable business rules, GS1 issuance, lifecycle state tracking, audit history, and import simulation.

## Decision
Adopt a dedicated Product Identity Engine (PIE) as a centralized service responsible for:

- SKU business key generation
- barcode provider assignment and pool management
- rule evaluation, priority, and inheritance
- audit and decision logging
- import simulation and rollback

The PIE will be designed as a bounded domain service, integrated with the existing item master and inventory modules through APIs.

## Consequences
- Improves consistency for SKU identity and barcode assignment
- Provides a single source of truth for product identity decisions
- Enables enterprise governance over barcodes and rule changes
- Requires migration of legacy SKU and barcode data into PIE
