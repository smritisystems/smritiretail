# SMRITI Architecture Documentation

This folder contains architecture-level documentation for SMRITI Retail OS.

## Overview

The architecture docs provide guidance for enterprise-grade design, governance, implementation, security, and operational readiness.

## Canonical Architecture

- **Primary Canonical Specification:** [`MULTI_COMPANY_2.md`](file:///F:/SMRITRretailNX/docs/architecture/MULTI_COMPANY_2.md)
- **AI Agent Governance Rules:** [`docs/AI_AGENT.md`](file:///F:/SMRITRretailNX/docs/AI_AGENT.md)
- **Master Documentation Index:** [`docs/DOCUMENTATION.md`](file:///F:/SMRITRretailNX/docs/DOCUMENTATION.md)

## Key Subsystem Documents

- `DATABASE_ROUTING.md` — database resolver runtime routing
- `PSV_ARCHITECTURE.md` — Party Stock Visibility shadow inventory projection
- `PRODUCT_IDENTITY_13.md` — core Product Identity Engine design
- `PLATFORM_ADAPTER.md` — platform adapter and PAL guidance
- `PLATFORM_2.md` — long-term microservices vision
- `PRODUCT_IDENTITY__6.md` — API contract for identity and barcode services
- `PRODUCT_IDENTITY_11.md` — ERD and entity relationships
- `PRODUCT_IDENTITY.md` — implementation phases, tasks, and acceptance criteria
- `PRODUCT_IDENTITY__8.md` — runtime sequence diagrams for PIE flows
- `PRODUCT_IDENTITY__3.md` — state machine for PIE lifecycle states
- `PRODUCT_IDENTITY_10.md` — canonical PIE error catalogue
- `PRODUCT_IDENTITY_2.md` — configuration guide for rules, providers, and workflows
- `PRODUCT_IDENTITY__7.md` — security model, roles, and audit requirements
- `PRODUCT_IDENTITY_12.md` — non-functional requirements and performance targets
- `PRODUCT_IDENTITY__5.md` — testing strategy and acceptance criteria
- `PRODUCT_IDENTITY__4.md` — migration strategy for legacy SKUs and barcodes
- `PRODUCT_IDENTITY__9.md` — phased product roadmap for PIE

## Architecture Decision Records (ADR)

The `decisions/` subfolder contains architecture decision records that document why key PIE design choices were made:

- `decisions/ADR-001-Product-Id.md`
- `decisions/ADR-002-Business-K.md`
- `decisions/ADR-003-GS1-Assign.md`
- `decisions/ADR-004-Event-Sour.md`
- `decisions/ADR-005-Multi-Barc.md`

## Purpose

These documents capture the target architecture for SMRITI's identity governance, barcode management, and modular product services.

## Navigation

- Architecture
  - `PRODUCT_IDENTITY_13.md`
  - `PRODUCT_IDENTITY_11.md`
  - `PRODUCT_IDENTITY__8.md`
  - `PRODUCT_IDENTITY__3.md`
- Data Model & API
  - `PRODUCT_IDENTITY__6.md`
  - `PRODUCT_IDENTITY_10.md`
- Implementation & Delivery
  - `PRODUCT_IDENTITY.md`
  - `PRODUCT_IDENTITY__4.md`
  - `PRODUCT_IDENTITY__9.md`
- Governance & Operations
  - `PRODUCT_IDENTITY_2.md`
  - `PRODUCT_IDENTITY__7.md`
  - `PRODUCT_IDENTITY_12.md`
  - `PRODUCT_IDENTITY__5.md`
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
