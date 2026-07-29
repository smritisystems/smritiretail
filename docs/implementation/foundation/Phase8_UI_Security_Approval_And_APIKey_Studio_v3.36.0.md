<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.36.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 8 Implementation Plan: Security-Aware Menu & Layout Rendering, Approval Engine Studio & Service Account API Keys UI — v3.36.0

## 1. Objective
Connect frontend UI components (`ApprovalMatrixTab.tsx`, `ApiKeyManagementSection.tsx`, navigation menus) directly to Phase 6 (`/api/v1/approvals`) and Phase 7 (`/api/v1/api-keys`) FastAPI endpoints. Enable real-time document approval actions (Approve / Reject / Override), pending approval badges, Service Account creation, API Key generation with single-view secret copy modals, key revocation, and IP CIDR restriction rules.

## 2. Business Motivation
Provide enterprise retail administrators and store managers with a unified, state-of-the-art UI dashboard for managing approval workflows and external programmatic API integrations (WMS sync, e-commerce connectors, POS terminals) directly within SMRITI Retail OS.

## 3. Scope
- **Approval Engine Integration in UI (`ApprovalMatrixTab.tsx`):**
  - Connect `ApprovalMatrixTab` to `/api/v1/approvals/pending` and `/api/v1/approvals/dashboard`.
  - Add single-click Approve / Reject / Override action modal with remarks and expected payload version locking.
  - Render real-time dashboard metrics (Pending Requests, Active Policies, Outbox Events, Cache Hit Rate %).
- **Service Account & API Keys Studio (`ApiKeyManagementSection.tsx`):**
  - Create new React component `src/components/ApiKeyManagementSection.tsx`.
  - Service Account creation modal (`POST /api/v1/api-keys/service-accounts`).
  - Cryptographic API Key generation modal (`POST /api/v1/api-keys/generate`) displaying raw `smriti_live_<prefix>_<secret>` token once with clipboard copy button.
  - Active API Key list with IP CIDR whitelisting display, expiration badge, rate limit per minute badge, and one-click key revocation (`DELETE /api/v1/api-keys/{key_id}`).
  - API Key usage audit log drawer (`GET /api/v1/api-keys/{key_id}/logs`).
- **Tab Integration:**
  - Mount `ApiKeyManagementSection` as a dedicated sub-tab in `MasterManagementTab.tsx` or `StaffManagementTab.tsx`.

## 4. Current State
- Phase 6 and Phase 7 FastAPI endpoints and Postgres backend services are complete and tested (10/10).
- Frontend `ApprovalMatrixTab.tsx` used legacy stubbed data structures.
- Service Account API Key management section did not have a dedicated React UI component.

## 5. Proposed Design
- Update `ApprovalMatrixTab.tsx` to fetch real approval requests from `/api/v1/approvals/pending` and send state transitions via `/api/v1/approvals/{request_id}/action`.
- Create `src/components/ApiKeyManagementSection.tsx` with glassmorphic cards, search filtering, status badges, and copy-to-clipboard secret modals.

## 6. Verification Plan
- Verify React UI rendering without console errors.
- Test pending approval fetching and approval submission.
- Test Service Account creation and API key secret generation modal.

## 7. Status
In Progress.
