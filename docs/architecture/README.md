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

# SMRITI Architecture Documentation

This folder contains architecture-level documentation for SMRITI Retail OS.

## Overview

The architecture docs provide guidance for enterprise-grade design, governance, implementation, security, and operational readiness.

## Key Documents

- `SMRITI_BUSINESS_OS_V2_SPECIFICATION.md` — SMRITI Business OS v2.0 Enterprise Architecture Baseline Specification (Frozen)
- `RC2_EXECUTION_CONTRACT_v1.0.md` — RC2 delivery governance, capability sequencing, business document lifecycle, and exit criteria
- `PLATFORM_ADAPTER_RULES.md` — platform adapter and PAL guidance
- `../templates/business-document/README.md` — reusable template for future business-document implementation packages
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
- `adr-0006.md` — Retail OS implementation note for SPK Stage 3B registration integration
- `SPK-COMPATIBILITY.md` — Retail OS compatibility declaration for the published SPK registration contract
- For the authoritative ecosystem compatibility dashboard, see: `F:\SMRITI\smriti-architecture\compatibility\PLATFORM-COMPATIBILITY-MATRIX.md`
- For milestone planning and release sequencing, see: `F:\SMRITRretailNXmgrt\smriti-roadmap\ROADMAP.md`

## Purpose

These documents capture the target architecture for SMRITI's identity governance, barcode management, and modular product services.

## Navigation

- Architecture
  - `RC2_EXECUTION_CONTRACT_v1.0.md`
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
