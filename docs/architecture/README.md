# SMRITI Architecture Documentation

This folder contains architecture-level documentation for SMRITI Retail OS.

## Overview

The architecture docs provide guidance for enterprise-grade design, governance, implementation, security, and operational readiness.

## Key Documents

- `PLATFORM_ADAPTER_RULES.md` — platform adapter and PAL guidance
- `PLATFORM_MICROSERVICES_ROADMAP.md` — long-term microservices vision
- `PRODUCT_IDENTITY_ENGINE.md` — core Product Identity Engine design
- `PRODUCT_IDENTITY_ENGINE_API_SPEC.md` — API contract for identity and barcode services
- `PRODUCT_IDENTITY_ENGINE_ERD.md` — ERD and entity relationships
- `PRODUCT_IDENTITY_ENGINE_IMPLEMENTATION_PLAN.md` — implementation phases, tasks, and acceptance criteria
- `PRODUCT_IDENTITY_ENGINE_SEQUENCE.md` — runtime sequence diagrams for PIE flows
- `PRODUCT_IDENTITY_ENGINE_STATE_MACHINE.md` — state machine for PIE lifecycle states
- `PRODUCT_IDENTITY_ENGINE_ERRORS.md` — canonical PIE error catalogue
- `PRODUCT_IDENTITY_ENGINE_CONFIGURATION.md` — configuration guide for rules, providers, and workflows
- `PRODUCT_IDENTITY_ENGINE_SECURITY.md` — security model, roles, and audit requirements
- `PRODUCT_IDENTITY_ENGINE_NFR.md` — non-functional requirements and performance targets
- `PRODUCT_IDENTITY_ENGINE_TEST_PLAN.md` — testing strategy and acceptance criteria
- `PRODUCT_IDENTITY_ENGINE_MIGRATION.md` — migration strategy for legacy SKUs and barcodes
- `PRODUCT_IDENTITY_ENGINE_ROADMAP.md` — phased product roadmap for PIE

## Architecture Decision Records (ADR)

The `decisions/` subfolder contains architecture decision records that document why key PIE design choices were made:

- `decisions/ADR-001-Product-Identity-Engine.md`
- `decisions/ADR-002-Business-Key-Strategy.md`
- `decisions/ADR-003-GS1-Assignment-Policy.md`
- `decisions/ADR-004-Event-Sourcing.md`
- `decisions/ADR-005-Multi-Barcode-Support.md`

## Purpose

These documents capture the target architecture for SMRITI's identity governance, barcode management, and modular product services.

## Navigation

- Architecture
  - `PRODUCT_IDENTITY_ENGINE.md`
  - `PRODUCT_IDENTITY_ENGINE_ERD.md`
  - `PRODUCT_IDENTITY_ENGINE_SEQUENCE.md`
  - `PRODUCT_IDENTITY_ENGINE_STATE_MACHINE.md`
- Data Model & API
  - `PRODUCT_IDENTITY_ENGINE_API_SPEC.md`
  - `PRODUCT_IDENTITY_ENGINE_ERRORS.md`
- Implementation & Delivery
  - `PRODUCT_IDENTITY_ENGINE_IMPLEMENTATION_PLAN.md`
  - `PRODUCT_IDENTITY_ENGINE_MIGRATION.md`
  - `PRODUCT_IDENTITY_ENGINE_ROADMAP.md`
- Governance & Operations
  - `PRODUCT_IDENTITY_ENGINE_CONFIGURATION.md`
  - `PRODUCT_IDENTITY_ENGINE_SECURITY.md`
  - `PRODUCT_IDENTITY_ENGINE_NFR.md`
  - `PRODUCT_IDENTITY_ENGINE_TEST_PLAN.md`
  - `decisions/`

## Governance and Traceability

Each document includes a standard header with:

- Title
- Version
- Status
- Owner
- Reviewers
- Last Updated
- Dependencies
- Related Documents
- Change History

This ensures consistent governance and traceability across architecture artifacts.
