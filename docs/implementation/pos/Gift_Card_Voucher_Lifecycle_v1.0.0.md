<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.87.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Enterprise Gift Card, Voucher Lifecycle & Stored-Value Ledger (v1.0.0)

## Objective
Implement a complete gift card lifecycle system covering card issuance, top-up, OTP-secured redemption, and automated breakage revenue recognition within the SMRITI Retail OS POS engine.

## Business Motivation
Gift cards and stored-value instruments represent a significant working capital pool and revenue recognition opportunity. Breakage (unredeemed balances on expired cards) must be recognized as revenue per IndAS 115 / ASC 606 standards, and OTP-secured redemption prevents fraudulent use at POS.

## Scope
- Gift card issuance with configurable validity periods.
- Balance top-up by authorized operators.
- OTP-secured (TOTP-style) redemption at POS.
- Full stored-value ledger per card with immutable transaction history.
- Breakage revenue analysis engine.

## Current State
No gift card or stored-value instrument support exists in the system.

## Gap Analysis
- No card issuance workflow.
- No OTP validation at POS terminal.
- No breakage analysis or revenue recognition.

## Architecture Impact
- New engine: `src/utils/giftCardEngine.ts` — client-side ledger simulation; production moves to `backend/app/gift_cards/` router.
- FastAPI `POST /api/v1/gift-cards/issue`, `POST /api/v1/gift-cards/topup`, `POST /api/v1/gift-cards/redeem` endpoints (future backend work).

## Proposed Design
See engine architecture in `src/utils/giftCardEngine.ts`.

## Files Created
- `src/utils/giftCardEngine.ts`
- `src/components/pos/GiftCardLifecycleModal.tsx`
- `src/tests/giftCardEngine.test.ts`
- `docs/implementation/pos/Gift_Card_Voucher_Lifecycle_v1.0.0.md`
- `docs/walkthrough/pos/Gift_Card_Voucher_Lifecycle_v1.0.0.md`

## Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## Dependencies
- No new third-party dependencies.
- Production: FastAPI OTP backend via `POST /api/v1/gift-cards/validate-otp`.

## Risks
- OTP delivery requires SMRITI SMS gateway integration (not in scope for this version).
- Breakage percentages are computed client-side; production must query PostgreSQL ledger table.

## Rollback Strategy
Remove `giftCardEngine.ts` and `GiftCardLifecycleModal.tsx`; restore CHANGELOG.

## Verification Plan
- 4/4 Vitest unit tests covering issuance, top-up, OTP redemption, and breakage analysis.

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
2. Deploy FastAPI gift card endpoints in future sprint.

## Status
Completed

## Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-021`: Stored-Value Instrument Ledger Architecture.

## Related Walkthroughs
- [Gift Card Voucher Lifecycle Walkthrough](../../walkthrough/pos/Gift_Card_Voucher_Lifecycle_v1.0.0.md)
