<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.108.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Price Override Approval Engine (v1.0.0-GA)

## 1. Purpose
Documents the Price Override Engine — manager-authorized price exceptions with a configurable deviation matrix, auto-approve for small deviations, approval authority enforcement, expiry, and immutable audit logging.

## 2. Scope
- `PriceOverrideEngine` covering `createRequest()`, `approve()`, `reject()`, `expireIfDue()`, `expireBatch()`, `auditReport()`.
- `DEFAULT_OVERRIDE_CONFIG`: `autoApproveLimitPct=2`, `expiryMinutes=10`, matrix (0–2%→CASHIER, 2–5%→SUPERVISOR, 5–10%→MANAGER, 10–20%→GM, 20%+→DIRECTOR).
- `approve()` enforces `AUTHORITY_RANK` — throws if approver rank < required rank.
- Auto-approve adds a SYSTEM audit entry at the moment of creation.
- `PriceOverrideModal` with request list, price/deviation card, authority matrix with active rule highlight, approval action panel, audit trail.

## 3. Files Created
- `src/utils/priceOverrideEngine.ts`
- `src/components/pos/PriceOverrideModal.tsx`
- `src/tests/priceOverrideEngine.test.ts`
- `docs/walkthrough/pos/Price_Override_Approval_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Deviation % is always absolute**: `|standardPrice − requestedPrice| / standardPrice × 100` — prevents negative deviation from bypassing the matrix.
2. **Auto-approve happens at creation time**: If `deviationPct ≤ autoApproveLimitPct`, status is set to `AUTO_APPROVED` and a SYSTEM audit entry is appended in the same `createRequest()` call — no asynchronous approval step.
3. **Authority rank enforcement is explicit**: `AUTHORITY_RANK` map in `approve()` converts `AuthorityLevel` to ordinal; strict `<` check throws with a descriptive message before state mutation.
4. **Expiry is pure and idempotent**: `expireIfDue()` only changes status if `status === "PENDING"` and `asOf >= expiresAt`; calling it multiple times on the same request is safe.
5. **`auditReport()` aggregates by status, not by time**: Designed for a dashboard, not for a time-series chart — counts and totals are computed over all requests passed in regardless of creation date.

## 6. Design Rationale
Uncontrolled price overrides are a major margin leak in retail. The deviation matrix creates a graduated approval chain proportional to the financial risk — a 1.5% discount on a single item does not need GM involvement, but a 25% slash should.

## 7. Implementation Summary
- `createRequest()`: Computes `deviationAmt`, `deviationPct`, resolves `requiredAuthority` via `resolveAuthority()`, sets `expiresAt = now + expiryMinutes`, auto-approves if below limit.
- `resolveAuthority()`: Iterates `deviationMatrix` array (sorted ascending by `fromPct`), returns first matching rule's `requiredAuthority`; defaults to DIRECTOR if none matched.
- `approve()`: Checks `AUTHORITY_RANK[approver] >= AUTHORITY_RANK[required]`; throws with clear message if insufficient.
- `expireBatch()`: Maps over all requests, applies `expireIfDue()` per item.
- `auditReport()`: Groups by status using `byStatus()` helper, sums `|deviationAmt|`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/priceOverrideEngine.test.ts`**: 4/4 tests passed.
  - Test 1: 1.6% deviation → AUTO_APPROVED, SYSTEM audit entry ✓
  - Test 2: 7% deviation → PENDING, MANAGER required ✓
  - Test 3: SUPERVISOR throws on MANAGER request; MANAGER approves ✓
  - Test 4: Expiry + reject + audit report (autoApproved=1, expired=1, rejected=1) ✓
- **Total Frontend Suite**: 81/81 test files, 496/496 tests green in 15.37s, exit code 0.

## 10. Known Limitations
- `expiresAt` is computed client-side — production uses a Postgres-backed APScheduler cron to expire pending requests and notify the requester.
- No partial approval (e.g., approve a smaller discount) — production adds an `override_approved_price` field.

## 11. Future Work
- FastAPI `POST /api/v1/price-overrides/`, `PATCH /api/v1/price-overrides/{id}/approve`.
- POS terminal push notification when override is approved by manager.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-042`: Price Override Deviation Matrix, Authority Enforcement, and Expiry Policy.

## 13. Related RFCs
- `RFC-111`: Price Override Governance, Authority Matrix Configuration, and Audit Reporting Cadence.
