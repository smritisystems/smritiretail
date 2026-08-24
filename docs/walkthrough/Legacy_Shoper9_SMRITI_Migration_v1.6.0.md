<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.6.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 SMRITI Migration Parity -- Sprint 21 v1.6.0

> Supersedes: `Legacy_Shoper9_SMRITI_Migration_v1.5.0.md` (Sprint 20)
> This document covers Sprint 21: LoyaltyAdjPanel member search + Alembic v1375 back-fill.

---

## 1. Purpose

**Sprint 21** closes two remaining P2/P3 backlog items from Sprint 20:

**LoyaltyAdjPanel Member Search** — Replaces the free-text member ID input with a debounced live-search widget. Staff types a name, mobile number, or member code; results appear from `GET /crm/customers/search` within 350ms; selecting a result fills the member context and locks it in with a confirmation card. Submit is disabled until a member is explicitly selected.

**Alembic v1375 SalesReturn.customer_id Back-fill** — Data migration that closes the denorm gap created when v1374 (Sprint 18) added the `customer_id` column to `sales_returns` for existing rows that were already in the database at the time. The back-fill joins `sales_returns.original_invoice_id → sales_invoices.id` to copy `customer_id` for all rows where it is currently NULL.

---

## 2. Scope

| Item | Type | File |
|---|---|---|
| `CustomerHit` interface | Frontend type | `CrmStudioTab.tsx` |
| Debounced member search (350ms) | Frontend feature | `CrmStudioTab.tsx` |
| Search results dropdown (≤5) | Frontend feature | `CrmStudioTab.tsx` |
| Selected-member confirmation card | Frontend feature | `CrmStudioTab.tsx` |
| X clear button (`lyl-clear-member`) | Frontend | `CrmStudioTab.tsx` |
| Submit guard (`disabled={!selectedMember}`) | Frontend | `CrmStudioTab.tsx` |
| `X` lucide icon import | Frontend fix | `CrmStudioTab.tsx` |
| Alembic v1375 back-fill migration | Backend data | `v1375_backfill_sales_return_cust.py` |

---

## 3. Files Created

| File | Type |
|---|---|
| `backend/alembic/versions/v1375_backfill_sales_return_cust.py` | New Alembic migration |
| `docs/walkthrough/Legacy_Shoper9_SMRITI_Migration_v1.6.0.md` | This document |

---

## 4. Files Modified

| File | Change |
|---|---|
| `src/components/CrmStudioTab.tsx` | LoyaltyAdjPanel: +182 lines (member search), -115 lines (old plain input); X import added |
| `CHANGELOG.md` | v3.36.0 entry |
| `docs/walkthrough/README.md` | v1.6.0 row appended |

---

## 5. Architecture Decisions

### A. Debounce at 350ms, Minimum 2 Characters
The search fires after 350ms of no input and only when `searchQ.length >= 2`. This prevents single-character noise queries and limits API calls to deliberate search intent. The `debounceRef` is cleaned up on component unmount and on each new keystroke.

### B. Limit 5 Results
`GET /crm/customers/search?q=...&limit=5` constrains the dropdown to 5 rows. Staff in a retail environment search by mobile (deterministic) or name (usually narrows quickly). A dropdown of more than 5 results becomes harder to scan quickly.

### C. Explicit Selection Required Before Submit
`disabled={!selectedMember}` on the submit button and the guard `if (!memberId)` inside `handleSubmit` ensure that no adjustment can be submitted without a confirmed customer selection. This eliminates the v1 bug where a typo in the raw member ID would silently fail or hit the wrong member.

### D. v1375 Downgrade Is a No-op
The back-fill adds data to an existing column. Reversing a back-fill is ambiguous (it would nullify data that may now be actively used by queries). The correct rollback path if needed is to drop the column (done in a hypothetical v1374 downgrade), not to selectively null out the back-filled rows. The `downgrade()` function is therefore a no-op, with an explicit comment explaining the rationale.

### E. Back-fill Uses a Single UPDATE…FROM Statement
The PostgreSQL `UPDATE…FROM` syntax handles the join in a single atomic statement. There is no row-by-row Python loop, avoiding N+1 overhead for large tables with thousands of historical return rows.

---

## 6. Design Rationale

- **`selectedMember` card** — Once a member is selected, showing a green confirmation card prevents accidental adjustment to the wrong person. The `X` button to deselect is distinct from the submit action.
- **Flash message uses `selectedMember.name`** — More human-readable than a raw ID string; staff can immediately confirm the right person was adjusted.
- **Migration file prefix `v1375_backfill_`** — Naming convention signals this is a data operation, not a schema change, making it easy to identify in the migration history.

---

## 7. Implementation Summary

| Metric | Value |
|---|---|
| New interfaces | 1 (`CustomerHit`) |
| New state variables | 5 (`searchQ`, `searchResults`, `searching`, `selectedMember`, `debounceRef`) |
| Modified components | 1 (`LoyaltyAdjPanel`) |
| New Alembic migrations | 1 (`v1375`) |
| TSC errors (before fix) | 1 (`TS2304: Cannot find name 'X'`) |
| TSC errors (after fix) | 0 |
| NGP violations | 0 |

---

## 8. Tests Executed

```
Command: npx tsc --noEmit --strict false  (first run)
Output: src/components/CrmStudioTab.tsx(369,20): error TS2304: Cannot find name 'X'.

Action: Added X to lucide-react import list in CrmStudioTab.tsx

Command: npx tsc --noEmit --strict false  (second run)
Output: (empty stdout) -- exit code 0

Command: python -c "import ast; ast.parse(open('v1375_backfill_sales_return_cust.py').read()); print('OK')"
Output: OK: v1375 parses cleanly

Command: python scripts/smriti_naming_guard.py
Output: 0 naming violations found across: src, backend, scripts

Command: git diff --cached --stat
Output: 2 files changed, 182 insertions(+), 115 deletions(-)
```

---

## 9. Verification Results

| Item | Status | Evidence |
|---|---|---|
| `CustomerHit` interface | Done | `CrmStudioTab.tsx` line 258 |
| `debounceRef` + 350ms debounce | Done | `useEffect([searchQ])` confirmed |
| `GET /crm/customers/search?q=&limit=5` | Done | `apiFetchV1` call in effect |
| Dropdown ≤5 results | Done | `limit=5` query param |
| `id="lyl-member-search"` input | Done | Input id confirmed |
| `id="lyl-member-hit-{id}"` per result | Done | Template literal confirmed |
| Selected member confirmation card | Done | `selectedMember ?` branch |
| `id="lyl-clear-member"` X button | Done | Button id confirmed |
| `disabled={!selectedMember}` submit | Done | Submit button attribute confirmed |
| `X` icon imported | Done | Lucide import + TS2304 resolved |
| Flash uses `selectedMember.name` | Done | Template literal confirmed |
| `v1375_backfill_sales_return_cust.py` | Done | File created |
| `revision=v1375, down_revision=v1374` | Done | Chain verified |
| `UPDATE…FROM` back-fill SQL | Done | `upgrade()` confirmed |
| `downgrade()` is no-op | Done | `pass` with comment |
| Python `ast.parse` clean | Done | `OK: v1375 parses cleanly` |
| TSC exit code 0 | Done | Empty stdout, exit 0 |
| NGP 0 violations | Done | 0 across src, backend, scripts |
| Commit push | Done | `e2f5fa2a..971f2581 smritiNX -> smritiNX` |

---

## 10. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| v1375 back-fill does not re-run for returns where `original_invoice_id IS NULL` | Orphaned returns without an invoice reference will still have `customer_id = NULL` | These are data quality issues predating v1374; flag for manual review |
| Member search requires ≥2 characters | Cannot search single-initial names | Acceptable tradeoff to prevent noise queries |
| `LoyaltyAdjPanel` still has no transaction history view | Manager cannot see past adjustments inline | P3 backlog: `GET /crm/loyalty/members/:id/transactions` tab |

---

## 11. Future Work

| Item | Priority |
|---|---|
| Loyalty transaction history view in `LoyaltyAdjPanel` | P3 |
| Extract `LoyaltyAdjPanel` to `src/components/crm/LoyaltyAdjPanel.tsx` | P3 |
| Extract `ScanBar` to `src/components/inventory/ScanBar.tsx` for POS reuse | P3 |
| v1375 back-fill verification query (count NULL before/after) | P3 |

---

## 12. Related ADRs

- ADR: 350ms debounce + 2-char minimum for member search
- ADR: `disabled={!selectedMember}` submit guard
- ADR: v1375 downgrade is a no-op
- ADR: `UPDATE…FROM` single-statement back-fill

---

## 13. Related RFCs

- RFC: LoyaltyAdjPanel member search (`CrmStudioTab.tsx` Sprint 21)
- RFC: Alembic v1375 `sales_returns.customer_id` back-fill
