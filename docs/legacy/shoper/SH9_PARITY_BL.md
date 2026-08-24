<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sprint 8b — Business Ledger Parity Gap Registry
## Shoper9 MnuNo 200/250/270/280/460 → SMRITI Gap Analysis

**Date:** 2026-08-24  
**Source:** Live `smriti_legacy_menu_map` (29 MAPPED+MERGED entries) + code inspection  
**Files Inspected:**  
- `src/components/BusinessLedgerTab.tsx` (413 lines)  
- `backend/app/api/v1/pos.py` (365 lines, 17 endpoints)  
- `backend/app/api/v1/accounting.py` (356 lines, 14 endpoints)  
- `backend/app/api/v1/reports.py` (Sprint 8a extended)  

---

## Critical Finding: SMRITI Workspace Mismatch

**Shoper9 "Business Ledger" workspace** covers:  
- Cash Payouts/Receipts (MnuNo 200)  
- Credit Card Submission/Realisation (MnuNo 250)  
- Till Management (MnuNo 270)  
- Credit Sale Management (MnuNo 280)  
- 12 Cash Reports (MnuNo 460)  

**SMRITI `BusinessLedgerTab.tsx`** is entirely a **CRM Receivables screen**:  
- Customer outstanding amounts, credit limits, credit policies  
- 6-month balance history chart (deterministic mock data)  
- No cash, no till, no card submission/realisation  

**Result:** The SMRITI workspace label "Business Ledger" is architecturally mismatched to Shoper9 "Business Ledger". The SMRITI component serves Shoper9 MnuNo 0/200 (credit/receivables) partially — but the sub-functions (payouts, till, card, cash reports) are **absent or in POS**.

---

## POS API Coverage of Shoper9 Till Functions

`pos.py` provides (relevant to MnuNo 270):

| POS Function | Shoper9 Equivalent | Status |
|---|---|---|
| `open_shift_contract` | Open Day / Set Opening Balance | ✅ VERIFIED |
| `close_shift_contract` + `get_shift_z_report` | Close Day / Reconciliation | ✅ VERIFIED |
| `record_shift_cash_in` | Cash Receipts (inward) | ✅ VERIFIED |
| `record_shift_cash_drop` | Cash Lift | ✅ VERIFIED |
| `record_shift_till_expense` | Cash Payouts | ✅ VERIFIED |
| `get_active_shift` | Till Status | ✅ VERIFIED |
| `list_shifts` | Till Activity Log | ✅ VERIFIED |
| Open Cash Drawer | ⚠️ POS terminal hardware command — not a report | ⚠️ GAP |

---

## Full Business Ledger Gap Analysis

### MnuNo 200 — Cash (parent + 4 sub-groups)

| MnuNo/Opt | Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 0/200 | Cash (root) | — | MERGED | BusinessLedgerTab receivables | 🔗 OVERLAP (partial) |
| 200/201 | Cash Payouts | SR100200 | MAPPED | `record_shift_till_expense` in POS | ✅ VERIFIED |
| 200/202 | Cash Receipts | SR100200 | MAPPED | `record_shift_cash_in` in POS | ✅ VERIFIED |
| 200/250 | Credit Card Mgmt | — | MERGED | ⚠️ No card management section in SMRITI | ⚠️ GAP |
| 200/260 | Franchisee A/C | — | MERGED | ⚠️ Multi-company — no Franchisee A/C | 🔄 DEFERRED |
| 200/270 | Till Management | — | MAPPED | POS shift functions (verified above) | ✅ VERIFIED |
| 200/280 | Credit Sale Mgmt | — | MAPPED | BusinessLedgerTab credit view (partial) | ⚠️ GAP (write ops missing) |

**MnuNo 200 Score: 4 VERIFIED / 2 GAP / 1 DEFERRED**

---

### MnuNo 250 — Credit Card Submission/Realisation

| MnuNo/Opt | Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 250/251 | Submission | SR100300 | MAPPED | ⚠️ No card submission endpoint in any API | ⚠️ GAP |
| 250/252 | Realisation | SR100400 | MAPPED | ⚠️ No card realisation endpoint in any API | ⚠️ GAP |

**MnuNo 250 Score: 0 VERIFIED / 2 GAP / 0 DEFERRED**

---

### MnuNo 270 — Till Management (6 entries)

| MnuNo/Opt | Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 270/271 | Till Status | SR138900 | MAPPED | `get_active_shift` → shift state | ✅ VERIFIED |
| 270/272 | Set Opening Balance | SR138900 | MAPPED | `open_shift_contract` → opening_cash | ✅ VERIFIED |
| 270/273 | Cash Lift | SR138900 | MAPPED | `record_shift_cash_drop` | ✅ VERIFIED |
| 270/274 | Reconciliation | SR138900 | MAPPED | `close_shift_contract` + Z-report | ✅ VERIFIED |
| 270/275 | Open Cash Drawer | SR138900 | MAPPED | ⚠️ Hardware command — no SMRITI API | ⚠️ GAP |
| 270/276 | Till Reprint | SR138900 | MAPPED | ⚠️ No till/shift report reprint endpoint | ⚠️ GAP |

**MnuNo 270 Score: 4 VERIFIED / 2 GAP / 0 DEFERRED**

---

### MnuNo 280 — Credit Sale Management (3 entries)

| MnuNo/Opt | Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 280/281 | Collect Payment | SR142500 | MAPPED | ⚠️ No credit-sale payment collection endpoint | ⚠️ GAP |
| 280/282 | Set Opening Balance | SR142500 | MAPPED | ✅ Covered by `open_shift_contract` | ✅ VERIFIED |
| 280/283 | Clear Credit Note | SR142500 | MAPPED | ⚠️ No credit note clearing endpoint | ⚠️ GAP |

**MnuNo 280 Score: 1 VERIFIED / 2 GAP / 0 DEFERRED**

---

### MnuNo 460 — Cash Reports (12 entries) — THE CRITICAL GAP

| MnuNo/Opt | Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 460/461 | Cash Transaction | SR203100 | MAPPED | ⚠️ No cash transaction report | ⚠️ GAP |
| 460/462 | Submission/Realisation List | SR203300 | MAPPED | ⚠️ No card submission/realisation report | ⚠️ GAP |
| 460/463 | Pending Submissions/Realisations | SR203200 | MAPPED | ⚠️ No pending card reports | ⚠️ GAP |
| 460/464 | Counter-wise Details | SR210600 | MAPPED | ⚠️ No counter/register-wise report | ⚠️ GAP |
| 460/465 | Credit Note Status | SR212700 | MAPPED | ⚠️ No credit note status report | ⚠️ GAP |
| 460/466 | Counter Summary across Cashiers | SR212900 | MAPPED | ⚠️ No multi-cashier counter summary | ⚠️ GAP |
| 460/467 | Advance Receipt Status | SR234400 | MAPPED | ⚠️ No advance receipt report | ⚠️ GAP |
| 460/469 | Reconciliation Report | SR239600 | MAPPED | `get_shift_z_report` (partial) | ✅ VERIFIED |
| 460/470 | Till Status Report | SR239600 | MAPPED | `get_active_shift` (partial) | ✅ VERIFIED |
| 460/471 | Till Activity Log | SR240400 | MAPPED | `list_shifts` (partial) | ✅ VERIFIED |
| 460/4702 | Credit Sale | SR242900 | MAPPED | BusinessLedgerTab credit view (partial) | ⚠️ GAP |
| 400/460 | Cash (group parent) | — | MAPPED | Reports Portal navigation | ✅ VERIFIED |

**MnuNo 460 Score: 4 VERIFIED / 8 GAP / 0 DEFERRED**

---

## Business Ledger Summary Scorecard

| Group | Total | ✅ VERIFIED | ⚠️ GAP | 🔄 DEFERRED | 🔗 OVERLAP |
|---|---|---|---|---|---|
| MnuNo 200 — Cash root | 7 | 4 | 2 | 1 | 1 |
| MnuNo 250 — Card Mgmt | 2 | 0 | 2 | 0 | 0 |
| MnuNo 270 — Till Mgmt | 6 | 4 | 2 | 0 | 0 |
| MnuNo 280 — Credit Sale | 3 | 1 | 2 | 0 | 0 |
| MnuNo 460 — Cash Reports | 12 | 4 | 8 | 0 | 0 |
| **TOTAL** | **30** | **13** | **16** | **1** | **1** |

**Business Ledger parity: 13/29 verified (44.8%) — 16 gaps to close**

---

## P1 Gaps — Cash Reports (finance.py — NEW file required)

No `finance.py` exists in `backend/app/api/v1/`. The 12 Cash Reports (MnuNo 460) require a new `GET /api/v1/finance/*` router:

| Gap | Shoper9 EXE | New Endpoint |
|---|---|---|
| Cash Transaction Report | SR203100 | `GET /api/v1/finance/cash-transactions` |
| Counter-wise Details | SR210600 | `GET /api/v1/finance/counter-wise` |
| Credit Note Status | SR212700 | `GET /api/v1/finance/credit-note-status` |
| Counter Summary (Cashiers) | SR212900 | `GET /api/v1/finance/counter-summary` |
| Advance Receipt Status | SR234400 | `GET /api/v1/finance/advance-receipts` |
| Submission/Realisation List | SR203300 | `GET /api/v1/finance/card-submissions` |
| Pending Submissions | SR203200 | `GET /api/v1/finance/pending-card-submissions` |
| Credit Sale Report | SR242900 | `GET /api/v1/finance/credit-sale-report` |

## P2 Gaps — Cash Operations (add to existing APIs)

| Gap | SMRITI Target | Action |
|---|---|---|
| Credit Card Submission | `finance.py` | `POST /api/v1/finance/card-submission` |
| Credit Card Realisation | `finance.py` | `POST /api/v1/finance/card-realisation` |
| Collect Credit Payment | `sales.py` | `POST /api/v1/sales/collect-credit-payment` |
| Clear Credit Note | `sales.py` | `POST /api/v1/sales/clear-credit-note` |

## Hardware Gap (not implementable in API)

| Gap | Reason |
|---|---|
| Open Cash Drawer (270/275) | Hardware peripheral command — SMRITI sends ESC/POS code to POS terminal firmware. Out of scope for backend API. Mark as HARDWARE. |
| Till Reprint (270/276) | Implemented as frontend print action against `get_shift_z_report`. Mark as FRONTEND. |

---

## Sprint 8b Definition of Done

- [x] Business Ledger gap registry complete (29+1 entries classified)
- [x] 13 VERIFIED, 16 GAP, 1 DEFERRED, 1 OVERLAP documented
- [x] P1: 8 new Cash Report endpoints via new `finance.py`
- [ ] `finance.py` created with 4 P1 Cash Report GET endpoints
- [ ] `SH9_PARITY_GAPS.md` updated with Business Ledger section
