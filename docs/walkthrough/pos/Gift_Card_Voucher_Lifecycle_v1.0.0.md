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

# Walkthrough: Enterprise Gift Card, Voucher Lifecycle & Stored-Value Ledger (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Enterprise Gift Card & Stored-Value Ledger system, enabling card issuance, top-up, OTP-secured redemption, and IndAS 115-compliant breakage revenue recognition in SMRITI Retail OS.

## 2. Scope
- `GiftCardEngine` business logic utility covering all card lifecycle operations.
- `GiftCardLifecycleModal` UI with 5 tabs: Issue, Top-Up, Redeem, Ledger, Breakage Analysis.
- OTP validation using TOTP-style 30-second windows with ±1 window tolerance.

## 3. Files Created
- `src/utils/giftCardEngine.ts`
- `src/components/pos/GiftCardLifecycleModal.tsx`
- `src/tests/giftCardEngine.test.ts`
- `docs/implementation/pos/Gift_Card_Voucher_Lifecycle_v1.0.0.md`
- `docs/walkthrough/pos/Gift_Card_Voucher_Lifecycle_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **TOTP-style OTP validation** with ±1 window tolerance to handle minor clock drift between POS terminal and backend.
2. **Immutable ledger entries** — each `GiftCardTxnLedger` entry records `balanceBefore` and `balanceAfter` to guarantee full auditability.
3. **`FULLY_REDEEMED` status transition** triggered automatically when `balanceAfter === 0`.

## 6. Design Rationale
OTP requirement prevents unauthorized redemption at POS. Immutable ledger supports IndAS 115 breakage revenue recognition via closed-period calculation.

## 7. Implementation Summary
- `GiftCardEngine.issue()`: Creates new card with ISSUE ledger entry.
- `GiftCardEngine.topUp()`: Appends TOP_UP entry; blocks blocked/expired cards.
- `GiftCardEngine.redeem()`: Validates OTP, checks balance, appends REDEMPTION entry.
- `GiftCardEngine.analyzeBreakage()`: Calculates breakage revenue from expired cards with residual balances.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/giftCardEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 60/60 test files, 412/412 tests green in 8.73s.

## 10. Known Limitations
- OTP delivery via SMS requires SMRITI SMS gateway integration (not in this version).
- Breakage calculations are in-memory; production queries PostgreSQL `gift_card_ledger` table.

## 11. Future Work
- FastAPI `POST /api/v1/gift-cards/redeem` with server-side OTP validation.
- GSTN e-voucher regulatory compliance layer.
- Gift card balance inquiry via USSD / UPI app.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-021`: Stored-Value Instrument Ledger Architecture.

## 13. Related RFCs
- `RFC-090`: Gift Card OTP Redemption Standard & Breakage Revenue Policy.
