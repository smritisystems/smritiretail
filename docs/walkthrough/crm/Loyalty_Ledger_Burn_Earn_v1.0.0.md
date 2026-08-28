<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.96.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Dynamic Loyalty Points Burn & Earn Ledger (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Loyalty Ledger Engine — a double-entry loyalty ledger with EARN events (purchase, signup, referral, birthday, manual credit), BURN events (redemption, voucher conversion, expiry write-off), TTL-based expiry scheduling, redemption caps (20% of invoice value), minimum balance guard, and real-time expiry-aware balance computation.

## 2. Scope
- `LoyaltyLedgerEngine` covering earn entry creation, balance computation, redemption validation, and expiry sweep.
- `LoyaltyLedgerModal` with 3-tab view: Earn/Burn ledger, live redemption panel with cap preview, and expiry sweep results.
- 10 event types across EARN and BURN categories.
- Configurable policy constants via `LOYALTY_CONFIG`.

## 3. Files Created
- `src/utils/loyaltyLedgerEngine.ts`
- `src/components/crm/LoyaltyLedgerModal.tsx`
- `src/tests/loyaltyLedgerEngine.test.ts`
- `docs/walkthrough/crm/Loyalty_Ledger_Burn_Earn_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Double-entry ledger model**: Every earn and burn is a separate `LoyaltyLedgerEntry` — balance computed by aggregate, enabling full audit reconstruction at any point in time.
2. **Expiry-aware available balance**: `computeBalance()` iterates entries and excludes any EARN entry whose `expiresAt` has passed, giving a live safe-to-redeem figure without marking entries in place.
3. **Redemption cap as policy constant**: `maxRedemptionPct` (20%) applied against invoice value converted to points at `rupeePerPoint` rate — preventing full-balance wipeout on high-value purchases.
4. **Expiry sweep write-off**: `runExpirySweep()` produces a `BURN_EXPIRY_WRITEOFF` entry per customer for each sweep date, maintaining a clean audit trail for accounting reconciliation.

## 6. Design Rationale
Loyalty programs fail when customers cannot trust their balance. The double-entry model with expiry-aware balance display prevents surprise zero-balances and lets the POS cashier accurately quote redeemable value before confirming.

## 7. Implementation Summary
- `earnFromPurchase()`: 1 pt per ₹1, expiry at +365 days, ACTIVE status.
- `earnBonus()`: Configurable bonus for SIGNUP (200), REFERRAL (100), BIRTHDAY (150), MANUAL events.
- `computeBalance()`: Iterates all entries for customer, separates expired/redeemed from active, computes expiring-in-30-days and next expiry date.
- `processRedemption()`: Validates against cap, min balance guard, creates BURN_REDEMPTION entry with monetary value.
- `runExpirySweep()`: Marks expired ACTIVE entries, generates consolidated BURN_EXPIRY_WRITEOFF per customer.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/loyaltyLedgerEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 69/69 test files, 448/448 tests green in 12.70s.

## 10. Known Limitations
- Ledger is in-memory; production persists to `loyalty_ledger_entries` Postgres table with `customer_id` FK.
- Expiry sweep is manual trigger; production runs on a scheduled FastAPI background task (APScheduler cron).
- Voucher conversion (`BURN_VOUCHER_CONVERSION`) creates the ledger entry but voucher issuance via gift-card engine is a future integration.

## 11. Future Work
- FastAPI `POST /api/v1/loyalty/earn`, `POST /api/v1/loyalty/redeem`, `POST /api/v1/loyalty/sweep` endpoints.
- Scheduled nightly expiry sweep via APScheduler in FastAPI backend.
- Integration with `GiftCardEngine` for voucher conversion redemption flow.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-030`: Loyalty Double-Entry Ledger Architecture and Expiry Policy.

## 13. Related RFCs
- `RFC-099`: Loyalty Earn/Burn Rate Policy, Redemption Cap, and Expiry TTL Standard.
