<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 30.0.0
  Created      : 2026-07-22
  Modified     : 2026-07-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan Standard (IPGP)
-->

# Phase 36: Customer Workspace Portal & License Management System (v30.0.0) — Implementation Plan

## 1. Objective
Establish the **SMRITI Customer Workspace Portal & License Management System (`v30.0.0`)** as an authenticated portal within the SMRITI Digital Platform (`DPF-001`, `SIP-001`). This phase provides a unified customer control panel for managing active software licenses, store terminal caps, automated database backups, over-the-air updates, technical support tickets, and organization billing settings.

## 2. Business Motivation
Following the launch of the Official Product Website (`v28.0.0`) and Live Documentation Portal (`v29.0.0`), existing retail customers require an authenticated self-service portal to view active license keys, request store capacity expansions, download database backups, track support SLAs, and manage organizational billing.

## 3. Scope
- **License Key Management Engine (`license_service.py`):** License key issuance, store count limits, POS counter caps, edition validation, and activation status.
- **Automated Backup & Cloud Restore Manager (`backup_manager.py`):** Scheduled database snapshot history, cloud backup downloads, and one-click restore triggers.
- **Technical Support Ticket Engine (`ticket_service.py`):** Support ticket creation (`NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), priority management (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and SLA tracking.
- **Organization & Billing Manager (`organization_service.py`):** Store network profile, invoice history, and subscription plan renewals.
- **Customer Workspace REST API Gateway (`backend/app/api/v1/customer/workspace.py`):** Endpoints under `/api/v1/customer/workspace`.
- **Frontend Customer Workspace Portal (`CustomerWorkspacePortal.tsx`):** Tabbed workspace UI for Licenses, Backups, Tickets, and Org Settings.

## 4. Current State
- `v27.0.0` provides `customer_portal.py` stub and `SIP-001` identity standard.
- `v29.0.0` provides the Live Documentation Portal.
- Need dedicated customer workspace services and frontend control panel.

## 5. Gap Analysis
- Need backend services under `backend/app/core/customer/`: `license_service.py`, `backup_manager.py`, `ticket_service.py`, `organization_service.py`.
- Need REST API router `backend/app/api/v1/customer/workspace.py`.
- Need React UI components in `src/components/customer/`.

## 6. Architecture Impact
- Reuses `SIP-001` for authenticated tenant context (`tenant_id`).
- Reuses `PortalRegistry` metadata (`v27.0.0`).
- Zero changes to platform foundation layers (Layers 1-7 remain 100% untouched).

## 7. Proposed Design
```text
                     Customer Workspace Portal (v30.0.0)
                                        │
    ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
    ▼                   ▼                               ▼                   ▼
License Manager       Backup & Restore Panel        Support Ticket Desk     Org & Billing Settings
(Keys & Terminal Caps)(Snapshots & Restores)        (SLA & Escalations)    (Stores & Invoices)
```

## 8. Files Created
- `backend/app/core/customer/license_service.py`
- `backend/app/core/customer/backup_manager.py`
- `backend/app/core/customer/ticket_service.py`
- `backend/app/core/customer/organization_service.py`
- `backend/app/schemas/customer.py`
- `backend/app/api/v1/customer/workspace.py`
- `src/components/customer/CustomerWorkspacePortal.tsx`
- `src/components/customer/LicenseCardManager.tsx`
- `src/components/customer/BackupRestorePanel.tsx`
- `src/components/customer/SupportTicketDesk.tsx`
- `src/components/customer/OrganizationBillingSettings.tsx`
- `backend/app/tests/test_customer_workspace.py`
- `docs/implementation/customer/Customer_Workspace_Portal_Plan_v30.0.0.md`
- `docs/walkthrough/customer/Customer_Workspace_Portal_v30.0.0.md`

## 9. Files Modified
- `backend/app/core/release_manifest.py`
- `backend/app/core/master_health.py`
- `backend/app/tests/test_master_release.py`
- `backend/app/main.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- `DPF-001 Digital Platform Framework`
- `SIP-001 SMRITI Identity Platform Standard`
- `PortalRegistry` (`v27.0.0`)
- `FastAPI + Pydantic`
- `React + Lucide Icons`

## 11. Risks
- *Risk:* Unauthorized access to another customer's backup or license data.
- *Mitigation:* Strict tenant isolation filtering via `SIP-001` JWT claims (`tenant_id`).

## 12. Rollback Strategy
Revert Phase 36 `git` commit without affecting core Retail OS or Documentation Portal.

## 13. Verification Plan
- Pytest suite `test_customer_workspace.py` (License key validation, backup trigger, ticket workflow, organization profile).
- Full backend Pytest execution.
- `npx tsc --noEmit` check.

## 14. Test Plan
- `test_license_service_validation()`: Validates license key generation, store count limits, and terminal caps.
- `test_backup_manager_snapshots()`: Validates backup creation and restore trigger.
- `test_ticket_service_lifecycle()`: Validates ticket creation, status transitions, and priority escalation.

## 15. Documentation Impact
- Create Walkthrough `docs/walkthrough/customer/Customer_Workspace_Portal_v30.0.0.md`.
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
Deploy REST router under `/api/v1/customer/workspace` and mount `CustomerWorkspacePortal.tsx` at `/customer`.

## 17. Status
Approved — In Progress

## 18. Related ADRs
- `PAR-001 Master Platform Architecture Reference`
- `SIP-001 Identity Platform Standard`
- `DPF-001 Digital Platform Framework`

## 19. Related Walkthroughs
- `Live_Documentation_Portal_v29.0.0.md`
