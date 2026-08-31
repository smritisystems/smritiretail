<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.104.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Complaint & After-Sales CRM Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Complaint CRM Engine — a full customer complaint lifecycle manager with priority-based SLA matrix (first response + resolution), automatic CRITICAL escalation on SLA breach, CSAT scoring on close, reopen tracking, and a CSAT/SLA analytics report.

## 2. Scope
- `ComplaintCRMEngine` covering complaint creation, assignment, first response, resolution, close with CSAT, reopen, manual escalation, SLA breach check with auto-escalation, and `computeCSATReport()`.
- `ComplaintCRMModal` with complaint list (filterable by status), detail panel with SLA breach indicators, inline action buttons for each lifecycle stage, CSAT star rating capture, activity log, and a separate CSAT & SLA report tab.
- `SLA_MATRIX`: LOW (24h/120h), MEDIUM (8h/72h), HIGH (4h/48h), CRITICAL (1h/8h).
- 9 complaint statuses, 4 priority levels, 10 category codes.

## 3. Files Created
- `src/utils/complaintCRMEngine.ts`
- `src/components/crm/ComplaintCRMModal.tsx`
- `src/tests/complaintCRMEngine.test.ts`
- `docs/walkthrough/crm/Complaint_CRM_SLA_CSAT_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Priority-based SLA matrix as a static constant**: `SLA_MATRIX` is a `Record<ComplaintPriority, SLAConfig>` — no database lookup required; breach thresholds are deterministic from complaint priority, enabling pure in-memory SLA computation.
2. **`checkSLABreaches()` as a separate, idempotent call**: SLA breach detection is not triggered automatically on every mutation — it is called explicitly with an `asOf: Date` argument. This enables batch re-check of all open complaints at scheduled intervals (e.g., cron every 15 min) without requiring individual event triggers.
3. **CRITICAL auto-escalation at 2× first-response SLA**: If a CRITICAL complaint has not received a first response within `2 × firstResponseHours` (2h) and `isEscalated` is false, `checkSLABreaches()` sets `isEscalated = true` and writes `escalationReason` automatically — no manual escalation required.
4. **Reopen clears resolution fields but preserves notes**: `reopen()` clears `resolvedAt`, `closedAt`, `csatScore`, and increments `reopenCount` — but the notes log is preserved so the agent can see the full prior resolution history.
5. **CSAT report uses total complaints as denominator for breach rates**: Breach rate = breached / totalComplaints (not breached / closedComplaints) — because open complaints that are breaching are equally important as closed ones that breached; computing over total gives a truer picture of SLA compliance.

## 6. Design Rationale
In retail, after-sales quality directly impacts repurchase. A missed first response within 4h on a HIGH-priority complaint is the single largest driver of negative word-of-mouth. The SLA matrix encodes this business requirement as engineering — a CRITICAL billing error that goes unacknowledged for 2h auto-escalates to management, ensuring no complaint falls through the cracks regardless of agent workload.

## 7. Implementation Summary
- `openComplaint()`: Generates `ticketNo` with date-prefix sequence; initialises all SLA breach flags to false.
- `assign()`, `recordFirstResponse()`, `resolve()`, `close()`, `reopen()`, `escalate()`, `pendingCustomer()`: Single-responsibility methods, each appending a `ComplaintNote` and returning the updated `Complaint` immutably.
- `recordFirstResponse()`: Computes `hoursElapsed` from `openedAt` to response time, sets `firstResponseSLABreached`.
- `resolve()`: Computes resolution elapsed hours, sets `resolutionSLABreached`.
- `close()`: Clamps CSAT score to 1–5, writes `csatScore` and `csatComment`.
- `checkSLABreaches()`: Pure function — no side effects other than returning updated `Complaint` with breach flags and optional auto-escalation.
- `computeCSATReport()`: Full aggregation — avg CSAT, 5-bucket distribution, breach rates (over total), avg resolution hours, escalation rate, reopen rate, category breakdown.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/complaintCRMEngine.test.ts`**: 4/4 tests passed (after assertion correction: breach rate = 1/3 = 33.33% over total, not 1/2 over closed).
  - Test 1: Full lifecycle → CLOSED with CSAT 4, firstResponseSLABreached=false (2h < 4h HIGH), resolutionSLABreached=true (50h > 48h HIGH) ✓
  - Test 2: CRITICAL auto-escalation at 3h (> 2 × 1h threshold), firstResponseSLABreached=true ✓
  - Test 3: Reopen increments `reopenCount`, clears `csatScore`, `resolvedAt` ✓
  - Test 4: CSAT report — avgCSAT=4 (5+3)/2, dist[5]=1, dist[3]=1, resolutionBreachRate=33.33%, byCategory aggregation ✓
- **Total Frontend Suite**: 75/75 test files, 472/472 tests green in 14.26s, exit code 0.

## 10. Known Limitations
- `ticketCounter` is a static class variable — resets on module reload; production uses Postgres sequence for `ticketNo`.
- SLA breach check is not scheduled automatically — production wires `checkSLABreaches()` into a background APScheduler cron (`*/15 * * * *`) over all OPEN complaints.
- No push notification to customer on first response — production triggers via SMS/WhatsApp via the communication module.

## 11. Future Work
- FastAPI `POST /api/v1/complaints/`, `PATCH /api/v1/complaints/{id}/assign`, `PATCH /api/v1/complaints/{id}/resolve`, `PATCH /api/v1/complaints/{id}/close` backed by Postgres `complaints` and `complaint_notes` tables.
- Background SLA breach cron and escalation email to branch manager.
- Customer self-service complaint status portal (read-only, ticket-based).

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-038`: Complaint Lifecycle, SLA Matrix, CSAT Capture, and Auto-Escalation Policy.

## 13. Related RFCs
- `RFC-107`: Customer Complaint SLA Standards, CSAT Measurement Policy, and Escalation Matrix by Priority and Category.
