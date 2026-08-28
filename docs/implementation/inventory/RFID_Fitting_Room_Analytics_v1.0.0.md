<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.89.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: RFID Smart Fitting Room & Garment Interaction Analytics Engine (v1.0.0)

## Objective
Implement RFID-based real-time garment tracking for fitting rooms with automated session management, AI-driven cross-sell recommendation generation, and conversion analytics for store management.

## Business Motivation
Fitting room conversion rates directly impact sales per sq ft. Real-time RFID tracking enables proactive associate assistance, automated customer display recommendations, and rich analytics that identify abandoned garments and high-performing SKUs for merchandising decisions.

## Scope
- Multi-room fitting room session management.
- RFID garment scan-in/scan-out event logging.
- Affinity-based cross-sell recommendation engine (top 5 per session, >0.7 affinity threshold).
- Customer display integration for cross-sell push.
- Per-session and aggregate analytics: conversion rate, avg trial duration, top trialled SKUs, abandoned garments.

## Current State
No fitting room management, garment tracking, or customer display recommendation system exists.

## Gap Analysis
- No RFID garment event model.
- No session lifecycle management.
- No recommendation engine for fitting rooms.
- No conversion analytics.

## Architecture Impact
- New engine: `src/utils/fittingRoomEngine.ts`.
- Production: FastAPI `POST /api/v1/fitting-rooms/{room_id}/sessions`, WebSocket `/ws/fitting-room/{room_id}` for real-time RFID events.
- PostgreSQL: `fitting_room_sessions`, `fitting_room_garment_events`, `rfid_garment_tags` tables.

## Proposed Design
See `src/utils/fittingRoomEngine.ts` for engine. Affinity catalog is an inline constant pending ML-backed recommendation API.

## Files Created
- `src/utils/fittingRoomEngine.ts`
- `src/components/inventory/RFIDFittingRoomStudioModal.tsx`
- `src/tests/fittingRoomEngine.test.ts`
- `docs/implementation/inventory/RFID_Fitting_Room_Analytics_v1.0.0.md`
- `docs/walkthrough/inventory/RFID_Fitting_Room_Analytics_v1.0.0.md`

## Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## Dependencies
- No new third-party dependencies for UI layer.
- Production: FastAPI RFID WebSocket consumer + PostgreSQL.

## Risks
- Physical RFID hardware (reader + tags) must be provisioned per fitting room.
- Affinity catalog is static; production must be ML-backed using Postgres transaction history.

## Rollback Strategy
Remove `fittingRoomEngine.ts` and `RFIDFittingRoomStudioModal.tsx`; restore index docs.

## Verification Plan
- 4/4 Vitest unit tests covering session open, cross-sell generation, garment exit recording, and multi-session analytics.

## Test Plan
```bash
npm test
```

## Documentation Impact
- Implementation Plan (this document)
- Walkthrough document
- CHANGELOG

## Deployment Plan
1. Merge to main.
2. Provision RFID readers per fitting room bay.
3. Connect FastAPI WebSocket consumer to RFID hardware API.

## Status
Completed

## Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-023`: RFID Garment Tracking & Fitting Room Telemetry Standard.

## Related Walkthroughs
- [RFID Fitting Room Analytics Walkthrough](../../walkthrough/inventory/RFID_Fitting_Room_Analytics_v1.0.0.md)
