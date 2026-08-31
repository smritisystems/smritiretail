<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.77.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: UI Automation Hub & Report Scheduling Modal (v1.0.0-GA)

## 1. Objective
Establish an interactive, multi-channel automated report distribution modal (`ScheduleReportModal.tsx`) in SMRITI Reporting Studio, allowing users to configure cron schedules, export formats, distribution channels (Email, WhatsApp, Statutory Vault), and trigger immediate executions.

## 2. Business Motivation
Store directors, accountants, and CFOs require automated delivery of daily EOD sales digests, weekly tax summaries, and monthly statutory registers to their inboxes and WhatsApp without requiring manual report generation.

## 3. Scope
- Automated Report Distribution Hub Modal (`ScheduleReportModal.tsx`).
- Frequency presets: Daily EOD (9 PM), Daily Morning (8 AM), Weekly Monday (8 AM), Monthly 1st (6 AM), and custom cron expressions.
- Export format selection: `XLSX`, `PDF`, `CSV`, `JSON`.
- Multi-channel delivery targets: Email recipients, WhatsApp phone numbers, Statutory Compliance Vault directory path.
- Active schedule management tab with "Run Now" on-demand dispatch and deletion.

## 4. Current State
The backend distribution service (`ReportDistributionEngine`) and endpoints (`/reporting/schedules`) were certified, but the frontend lacked a dedicated UI modal for schedule authoring.

## 5. Gap Analysis
- Needed dedicated visual modal for end users to schedule automated reports directly from the UI.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 2: UI calls `apiFetchV1` (`/api/v1/reporting/schedules`) against the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────┐
│             REPORT AUTOMATION & DISTRIBUTION HUB MODAL                 │
├───────────────────────────────────┬────────────────────────────────────┤
│  TAB 1: New Schedule Definition   │  TAB 2: Active Schedules           │
│  - Schedule Name & Cron Preset    │  - Schedule Cards with Cron Badges │
│  - Format: XLSX / PDF / CSV / JSON│  - Run Now (On-Demand Dispatch)    │
│  - Email / WhatsApp / Vault Inputs│  - Delete Schedule                 │
└───────────────────────────────────┴────────────────────────────────────┘
```

## 8. Files Created
- `src/components/reports/ScheduleReportModal.tsx`
- `src/tests/scheduleReportModal.test.ts`
- `docs/implementation/foundation/UI_Automation_Hub_Scheduling_Modal_v1.0.0.md`
- `docs/walkthrough/foundation/UI_Automation_Hub_Scheduling_Modal_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Spamming invalid email addresses or mobile numbers.
  *Mitigation:* Validates recipient lists and format requirements before saving.

## 12. Rollback Strategy
Modular UI component that can be disabled or closed cleanly.

## 13. Verification Plan
- Unit tests verifying component exports, data shapes, schedule creation POST, and on-demand trigger POST.
- Full Vitest suite pass rate (`364/364 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update SMRITI Reporting User Guide.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`364/364 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-018`: Automated Scheduled Reports & Multi-Channel Distribution Engine.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/UI_Automation_Hub_Scheduling_Modal_v1.0.0.md`.
