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

# Walkthrough - SMRITI Four-Tier Enterprise Architecture Guardian & Separation Principles

## 1. Purpose
Establish the **SMRITI Four-Tier Enterprise Architecture Guardian & Application Independence Policy (AOP-002 v4)**, defining strict product boundaries across **SMRITI Website (Marketing)**, **SMRITI Portal (Customer Self-Service)**, **SMRITI Workspace (Retail Operations App)**, and **SMRITI Platform API (Core System-of-Record Engine)**.

## 2. Scope
- Governance policy update in `.agents/AGENTS.md`.
- Automated Architecture Guardian static analysis tool (`scripts/architecture_guardian.py`).
- Four-tier product independence rules for Website (`www.smritisys.com`), Portal (`portal.smritisys.com`), Workspace (`workspace.smritisys.com`), and Platform API (`api.smritisys.com`).

## 3. Files Created
- `scripts/architecture_guardian.py`
- `docs/walkthrough/foundation/SMRITI_Enterprise_Architecture_Guardian_v1.0.0.md`

## 4. Files Modified
- `.agents/AGENTS.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **The Golden Rules of Application Independence**:
  - **Rule 1**: No application shall directly depend on another application. Every application communicates ONLY with the Platform API through published contracts.
  - **Rule 2**: Every SMRITI application must be installable, deployable, upgradeable, and removable independently without affecting any other application.
  - **Rule 3**: Platform owns business logic (GST, inventory valuation, accounting ledger). Applications own user experience (screens, themes, layouts).
- **Public vs. Internal API Gateways**:
  - `/api/public/v1/*` (Consumed by Portal, Website, Mobile Apps, Vendor/Partner Portals).
  - `/api/internal/v1/*` (Consumed strictly by SMRITI Workspace).
- **Modular Platform Services**:
  - Identity, License, Organization, Notification, Integration, Retail, Accounting, and Workflow Services.
- **Zero Database Cross-Contamination**: Marketing/Portal app operates on its own store; it must never directly query the Retail Application's transactional database.

## 6. Design Rationale
Decoupling Website, Portal, Workspace, and Platform API prevents monolithic drift, isolates security footprints, and ensures future extensibility for Mobile Apps, Vendor Portals, and AI Assistants.

## 7. Implementation Summary
- Locked Policy ID `AOP-002 v4` in `.agents/AGENTS.md`.
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
