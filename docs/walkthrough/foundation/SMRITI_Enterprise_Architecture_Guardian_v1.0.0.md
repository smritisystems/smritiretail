<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-07-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Governance Walkthrough
-->

# Walkthrough - SMRITI 11/10 Enterprise Ecosystem Architecture Guardian & Separation Principles

## 1. Purpose
Establish the **SMRITI 11/10 Enterprise Ecosystem Architecture Guardian & Application Independence Policy (AOP-002 v5)**, defining strict product boundaries across **SMRITI Website (Marketing)**, **SMRITI Portal (Customer Self-Service)**, **SMRITI Workspace (Retail Operations App)**, and **SMRITI Platform API (Core System-of-Record Engine)**.

## 2. Scope
- Governance policy update in `.agents/AGENTS.md`.
- Automated Architecture Guardian static analysis tool (`scripts/architecture_guardian.py`).
- Ecosystem platform rules: SDK Layer, Event Bus, Plugin Registry, Domain Ownership, and Replaceable Applications.

## 3. Files Created
- `scripts/architecture_guardian.py`
- `docs/walkthrough/foundation/SMRITI_Enterprise_Architecture_Guardian_v1.0.0.md`

## 4. Files Modified
- `.agents/AGENTS.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **The 5 Golden Rules of Application Independence**:
  - **Rule 1**: No application shall directly depend on another application. Every application communicates ONLY with the Platform API through published contracts.
  - **Rule 2**: Every SMRITI application must be installable, deployable, upgradeable, and removable independently without affecting any other application.
  - **Rule 3**: Platform owns business logic (GST, inventory valuation, accounting ledger). Applications own user experience (screens, themes, layouts).
  - **Rule 4**: Each business domain has exactly one authoritative owner (Identity, License, Retail, Accounting, Workflow).
  - **Rule 5**: Applications are replaceable. Platform services are reusable. Business data is permanent.
- **Ecosystem Architecture Capabilities**:
  - **SMRITI SDK Layer**: Centralized JWT auth, automatic retries, offline queues, and contract compatibility.
  - **Event Bus Integration**: Asynchronous event-driven service coupling (`Invoice Created` → `Accounting` + `Notification` + `Audit` + `Analytics`).
  - **Plugin Architecture & Registry**: Dynamic extension plugins (GST, POS, WhatsApp, Tally, Barcode, Payment Gateways, AI).
- **Public vs. Internal API Gateways**:
  - `/api/public/v1/*` (Consumed by Portal, Website, Mobile Apps, Partner/Vendor Portals).
  - `/api/internal/v1/*` (Consumed strictly by SMRITI Workspace).

## 6. Design Rationale
Decoupling Website, Portal, Workspace, and Platform API prevents monolithic drift, isolates security footprints, and ensures future extensibility for Mobile Apps, Vendor Portals, and AI Assistants.

## 7. Implementation Summary
- Locked Policy ID `AOP-002 v5` in `.agents/AGENTS.md`.
- Updated static analysis script `scripts/architecture_guardian.py` for 4-tier module inventory scanning.

## 8. Tests Executed
- Module inventory scan via `scripts/architecture_guardian.py`.
- Docker test environment verification in `F:\SMRITI9TEST`.

## 9. Verification Results
- 1. SMRITI Website Modules: Public Marketing & Docs Components
- 2. SMRITI Portal Modules: Customer Self-Service & License Panels
- 3. SMRITI Workspace Modules: Retail Operations Components
- 4. SMRITI Platform API Modules: 17 Core Backend Service Directories
- Boundary Violations: 0 Violations Detected

## 10. Known Limitations
- Static analysis checks raw `fetch()` and DB engine creation; future iterations will include AST-based import graph parsing.

## 11. Future Work
- Deploy dedicated container services (`smriti-website`, `smriti-portal`, `smriti-workspace`, `smriti-api`, `smriti-db`, `smriti-redis`, `smriti-worker`, `smriti-scheduler`, `smriti-nginx`).

## 12. Related ADRs
- ADR-001: Strangler-Fig Migration Strategy
- AOP-001: AI Optionality Principle

## 13. Related RFCs
- RFC-022: Multi-Tenant Architecture & Domain Separation
