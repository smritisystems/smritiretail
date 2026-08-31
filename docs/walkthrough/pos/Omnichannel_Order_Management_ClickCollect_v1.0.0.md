<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.93.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Omnichannel Order Management & Click-and-Collect Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Omni-Channel Order Engine — a unified order pool across POS, Website, Mobile App, WhatsApp, and Phone channels with BOPIS slot reservation, OTP-secured pickup tokens, line-level pick recording, and auto-READY_FOR_PICKUP transition.

## 2. Scope
- `OmniOrderEngine` covering order placement, status lifecycle, slot reservation, pick recording, and metrics.
- `OmniOrderStudioModal` with order queue, status transition controls, pickup token display, audit trail, and channel/fulfilment metrics.
- 9-status lifecycle: PLACED → CONFIRMED → SLOT_RESERVED / PICKING → READY_FOR_PICKUP → DISPATCHED → DELIVERED / CANCELLED.
- 5 order channels: POS, WEBSITE, MOBILE_APP, WHATSAPP, PHONE.
- 4 fulfilment modes: BOPIS, HOME_DELIVERY, CURBSIDE, SHIP_FROM_STORE.

## 3. Files Created
- `src/utils/omniOrderEngine.ts`
- `src/components/pos/OmniOrderStudioModal.tsx`
- `src/tests/omniOrderEngine.test.ts`
- `docs/implementation/pos/Omnichannel_Order_Management_ClickCollect_v1.0.0.md`
- `docs/walkthrough/pos/Omnichannel_Order_Management_ClickCollect_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Unified order model**: A single `OmniOrder` type captures all channels — no channel-specific sub-types — enabling a true unified order pool view per branch.
2. **OTP pickup token**: Generated as a 6-digit random string at SLOT_RESERVED transition, enabling cashier-side customer verification without a loyalty card scan.
3. **Auto-READY_FOR_PICKUP**: `recordPick()` automatically transitions when all line items have `pickedQty >= qty`, eliminating manual picker override.
4. **Immutable audit log**: Every transition appends a new entry — the order never mutates in place, following the event-sourcing philosophy.

## 6. Design Rationale
Omnichannel fulfilment is the single largest source of customer dissatisfaction if order status is not visible across channels. The unified order pool and slot reservation model removes channel silos and gives the store a single operational view.

## 7. Implementation Summary
- `OmniOrderEngine.placeOrder()`: Creates order with computed line totals, initial PLACED status, and first audit entry.
- `OmniOrderEngine.transition()`: Appends audit entry, sets timestamped fields (`confirmedAt`, `slotReservedAt`, etc.).
- `OmniOrderEngine.reserveSlot()`: Validates capacity and branch, increments `slot.booked`, generates pickup token.
- `OmniOrderEngine.recordPick()`: Updates line `pickedQty`, auto-transitions to READY_FOR_PICKUP when complete.
- `OmniOrderEngine.computeMetrics()`: Aggregates byChannel, byFulfilmentMode, byStatus, avg fulfilment time, slot utilisation %, cancellation rate.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/omniOrderEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 66/66 test files, 436/436 tests green in 9.76s.

## 10. Known Limitations
- Orders are in-memory; production persists to `omni_orders` and `omni_order_lines` Postgres tables.
- Slot management does not enforce date/time windowing in this frontend model.

## 11. Future Work
- FastAPI `POST /api/v1/omni-orders` and `PUT /api/v1/omni-orders/{id}/status` endpoints.
- Real-time slot availability polling via WebSocket push to POS terminals.
- Customer WhatsApp/SMS notification on status transitions.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-027`: Omni-Channel Order Unified Pool and BOPIS Slot Reservation Architecture.

## 13. Related RFCs
- `RFC-096`: Click-and-Collect OTP Pickup Verification Policy and Slot Capacity Management.
