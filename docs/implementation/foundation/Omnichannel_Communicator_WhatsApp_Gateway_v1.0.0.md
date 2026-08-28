<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.80.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Omnichannel Communicator & WhatsApp Gateway UI (v1.0.0-GA)

## 1. Objective
Construct the central interactive Omnichannel Communicator Studio UI (`CommunicatorStudioTab.tsx`) in SMRITI Retail OS, providing unified WhatsApp Cloud API v19.0 direct messaging, batch campaign broadcasting, live template variable previews, and real-time delivery status webhook tracking (`SENT`, `DELIVERED`, `READ`, `FAILED`).

## 2. Business Motivation
Modern retail requires automated customer engagement across omnichannel touchpoints: instant WhatsApp invoices upon POS billing, scheduled daily sales summaries to owners, loyalty point updates, and promotional broadcasts compliant with TRAI Quiet Hours regulations.

## 3. Scope
- Omnichannel Communicator Studio (`CommunicatorStudioTab.tsx`).
- Multi-channel support: WhatsApp (Meta Cloud API), SMS (DLT certified), Transactional Email (SMTP/SES), Push notifications.
- Mustache template interpolation and live handset message preview.
- Inbound webhook delivery tracking with real-time status updates (`SENT`, `DELIVERED`, `READ`, `FAILED`).
- Integration with FastAPI `/api/v1/communicator/*` endpoints.

## 4. Current State
The backend communicator engine (`CommunicatorEngine`) and API routes (`/api/v1/communicator/*`) were implemented, but lacked a dedicated visual Communicator Studio in the frontend.

## 5. Gap Analysis
- Needed dedicated visual broadcast studio for marketing, store managers, and accounting to dispatch messages and monitor webhook delivery logs.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: UI calls `apiFetchV1` (`/api/v1/communicator/send`, `/api/v1/communicator/webhook/delivery-event`) against the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────┐
│                   SMRITI COMMUNICATOR STUDIO                           │
├────────────────────────────────────────────────────────────────────────┤
│  [ Direct Dispatch ]  [ Campaigns ]  [ Templates ]  [ Delivery Logs ]  │
│  - Channel Selector: WhatsApp / SMS / Email                            │
│  - Category: Transactional / Alerts / OTP / Marketing                  │
│  - Live Handset Message Preview with Variable Interpolation            │
│  - Real-Time Webhook Activity Feed (Sent -> Delivered -> Read)        │
└────────────────────────────────────────────────────────────────────────┘
```

## 8. Files Created
- `src/components/communicator/CommunicatorStudioTab.tsx`
- `src/tests/communicatorStudio.test.ts`
- `docs/implementation/foundation/Omnichannel_Communicator_WhatsApp_Gateway_v1.0.0.md`
- `docs/walkthrough/foundation/Omnichannel_Communicator_WhatsApp_Gateway_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Over-quota or throttling by Meta Cloud API.
  *Mitigation:* Async queue backoff and auto-fallback to DLT SMS.

## 12. Rollback Strategy
Modular studio component that can be disabled or navigated away from without impacting checkout billing.

## 13. Verification Plan
- Unit tests verifying component exports, data models, message dispatch POST, and webhook simulation.
- Full Vitest suite pass rate (`376/376 green`).

## 14. Test Plan
- Run `npm test` and `pytest tests/t_communicator.py`.

## 15. Documentation Impact
- Update SMRITI Omnichannel Communicator Manual.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`376/376 frontend tests green, 6/6 communicator backend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-016`: Omnichannel Notification & DLT Gateway Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Omnichannel_Communicator_WhatsApp_Gateway_v1.0.0.md`.
