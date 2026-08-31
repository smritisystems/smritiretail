<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.114.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Gift Voucher & Store Credit Engine (v1.0.0-GA)

## 1. Purpose
Documents the Gift Voucher Engine — full lifecycle for gift vouchers, store credits, refund credits, and promo credits including issuance, partial redemption, expiry, balance adjustment, and portfolio analytics.

## 2. Scope
- `GiftVoucherEngine` covering `issueVoucher()`, `redeemVoucher()`, `refundToCredit()`, `expireIfDue()`, `expireBatch()`, `adjust()`, `portfolioSummary()`.
- Voucher types: GIFT_VOUCHER, STORE_CREDIT, REFUND_CREDIT, PROMO_CREDIT.
- Statuses: ACTIVE → PARTIALLY_REDEEMED → REDEEMED; ACTIVE → EXPIRED / CANCELLED.
- Partial redemption: `redeemedAmt = min(requested, balance)`; `fullySettled = requested ≤ balance`.
- `GiftVoucherModal`: voucher sidebar, 3-tab (Detail with redeem form + clamp warning, Ledger with signed amounts, Portfolio with type/status breakdowns).

## 3. Files Created
- `src/utils/giftVoucherEngine.ts`
- `src/components/pos/GiftVoucherModal.tsx`
- `src/tests/giftVoucherEngine2.test.ts`
- `docs/walkthrough/pos/Gift_Voucher_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`balance` is derived on every mutation, never stored separately from the ledger**: Every operation appends a `VoucherTxn` with `balanceAfter`; the `balance` field is kept in sync on the voucher object for O(1) lookup without replaying the ledger.
2. **`redeemVoucher()` clamps to balance rather than throwing**: Partial redemption is the correct retail behaviour — if a ₹1000 voucher is used on a ₹1200 bill, it covers ₹1000 and the shortfall is collected by another method. Throwing would break the POS flow.
3. **`fullySettled` returned in `RedemptionResult`**: The POS needs to know whether to prompt for an additional payment method — `fullySettled=false` means a balance is due.
4. **`refundToCredit()` delegates to `issueVoucher()`**: No parallel code paths for credit issuance — reduces bugs and ensures all credits go through the same audit trail.
5. **`expireIfDue()` is idempotent**: Calling it multiple times on an already-EXPIRED voucher returns the unchanged object — safe to run as a nightly batch without deduplication logic.
6. **`voucherCode` is a random 12-char alphanumeric string**: Designed for physical gift card printing. Production uses a cryptographically secure generator with check digit.

## 6. Design Rationale
Gift vouchers and store credits are a key customer retention tool in retail. The partial redemption model enables correct POS flows where vouchers cover part of a transaction. The `portfolioSummary()` function gives finance teams a real-time view of outstanding liability (total balance = cash owed to customers).

## 7. Implementation Summary
- `issueVoucher()`: Generates code; sets `expiresAt = now + validDays * 86400000`; appends ISSUE ledger entry with `balanceAfter = amount`.
- `redeemVoucher()`: Guards status/expiry/zero-balance; clamps; appends REDEEM ledger entry; enforces single-use (`multiUse=false → REDEEMED` even if balance > 0).
- `expireIfDue()`: Guards status (only ACTIVE/PARTIALLY_REDEEMED); checks `expiresAt < asOf`; appends EXPIRE.
- `portfolioSummary()`: Reduces all vouchers to `byType` (balance per type) and `byStatus` (count per status); `expiringSoon30d` filters ACTIVE/PARTIALLY_REDEEMED with `expiresAt ≤ now + 30d`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/giftVoucherEngine2.test.ts`**: 4/4 tests passed.
  - Test 1: GIFT_VOUCHER ₹1000; full redeem → REDEEMED, balance=0, ledger 2 entries ✓
  - Test 2: STORE_CREDIT ₹500; partial 300 → PARTIALLY_REDEEMED; second 300 clamped to 200, fullySettled=false → REDEEMED; 3 ledger entries ✓
  - Test 3: REFUND_CREDIT — type, issuedTo, note contain saleRefNo; expiry sets EXPIRED; idempotent (no extra entry) ✓
  - Test 4: adjust ₹2000+500=₹2500; portfolio totalBalance=3200, byType.GIFT_VOUCHER=2500, byStatus.ACTIVE=3 ✓
- **Total Frontend Suite**: 87/87 test files, 520/520 tests green in 16.36s, exit code 0.

## 10. Known Limitations
- `voucherCode` uses `Math.random()` — not cryptographically secure. Production uses `crypto.randomBytes()`.
- No voucher transfer or gifting workflow (transfer between customers).

## 11. Future Work
- FastAPI `POST /api/v1/vouchers/issue`, `POST /api/v1/vouchers/{code}/redeem`, `GET /api/v1/vouchers/portfolio`.
- Physical gift card batch generation with check-digit validation.
- Voucher transfer and split (split one voucher into multiple smaller ones).

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-048`: Gift Voucher Partial Redemption Policy, Expiry Governance, and Store Credit Accounting.

## 13. Related RFCs
- `RFC-117`: Gift Voucher Programme Configuration, Refund-to-Credit Policy, and Portfolio Liability Reporting.
