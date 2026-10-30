<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.1
  Created      : 2026-10-30
  Modified     : 2026-10-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Purchase Order Prefix & Canonical Serialization Remediation

**Document ID:** IP-PUR-PO-PREFIX-REMEDIATION-v6.50.1  
**Area:** Procurement & Document Serialization Architecture  
**Status:** In Progress  
**Target Version:** v6.50.1  

---

## 1. Objective
Eliminate formatting drift and visual defect regressions in Purchase Order (PO) prefix resolution and display:
1. Align `PurchaseService.get_next_order_number` return keys (`suggested_order_no`, `suggested_number`) to return canonical statutory format `PO/{FY}/{seq:04d}` (e.g. `PO/26-27/0029`) instead of diverging into simple legacy integer `PO-15`.
2. Permanently fix the double-prefix rendering defect (`PO-PO/26-27/0001`) in `PoGenerateTab.tsx` and `PoSizewiseTab.tsx`.
3. Fix the hyphen-splitting regex bug in `PoSizewiseTab.tsx` that split fiscal years `26-27` into fragmented prefix `"PO/26"` and number `"27/0001"`.
4. Correct Document Series Studio categorization in `documentSeries.con.tsx` to automatically map `"Purchase Order"` and `"Goods Receipt"` to module `"PURCHASE"` and transaction group `"PROCUREMENT"`.
5. Sanitize CSV export file naming in `PoSizewiseTab.tsx` to prevent slash `/` characters in download filenames.

---

## 2. Business Motivation
- SMRITI Retail OS standardized canonical Purchase Orders and Goods Receipt Notes in v6.95.0 to `{PREFIX}/{FY}/{SEQ:04d}` conforming strictly to statutory Indian GST Rule 46(b).
- A subsequent collision patch introduced ad-hoc format splitting (`PO-15` vs `PO/26-27/0001`), leading to UI double prefixes (`PO-PO/26-27/0001`) and corrupted CSV export filenames.
- Procurement staff require unambiguous, consistent serial numbers across orders, sizewise matrix generation, and goods receipt inwarding.

---

## 3. Scope
- **Backend Service (`backend/app/services/purchase.py`):**
  - Standardize `get_next_order_number` and `get_next_receipt_number` return dictionary so `suggested_order_no`, `suggested_number`, and `next_order_no` all return canonical `f"{pfx}/{fy}/{next_canonical:0{run_len}d}"`.
  - Maintain `suggested_simple` key for backward compatibility.
  - Respect `active_ds.running_length` if configured in Document Series Studio.
- **Frontend UI Workspaces (`src/components/purchase/PoGenerateTab.tsx` & `PoSizewiseTab.tsx`):**
  - Remediate header bar display and PO Number badge to conditionally omit prefix duplication when `orderNumber` already contains prefix or `/`.
  - Fix sequence parsing in `PoSizewiseTab.tsx` (lines 1350 and 1650) to preserve slash-separated canonical numbers without splitting on `-`.
  - Sanitize CSV export download filenames by replacing slashes with underscores.
- **Frontend Studio Config (`src/components/global/configs/documentSeries.con.tsx`):**
  - Map `"Purchase Order"` and `"Goods Receipt"` to module `"PURCHASE"` and transaction group `"PROCUREMENT"`.
- **Unit & Integration Test Verification:**
  - Update `src/tests/documentSeriesStudio.test.ts` to assert correct module and transaction group mapping for Purchase Orders.

---

## 4. Current State
- `get_next_order_number` returns `suggested_order_no: "PO-15"` while `next_order_no: "PO/26-27/0029"`.
- `PoGenerateTab` renders `{header.prefix}-{header.orderNumber}`, yielding `PO-PO/26-27/0001`.
- `PoSizewiseTab` parses `PO/26-27/0001` via `lastIndexOf("-")`, corrupting `header.prefix` to `"PO/26"`.
- Studio config saves Purchase Order series under module `"SALES"` and transaction group `"SALES"`.

---

## 5. Gap Analysis
| Component | Existing Behavior | Target Canonical Behavior |
|---|---|---|
| `get_next_order_number` | Returns simple `PO-15` as `suggested_order_no` | Returns canonical `PO/26-27/0029` across all primary keys |
| `PoGenerateTab` Display | Hardcodes `{header.prefix}-{header.orderNumber}` | Smart formatter checks if prefix already present |
| `PoSizewiseTab` Parser | Blindly splits at `lastIndexOf("-")` | Detects `/` and preserves full canonical document number |
| `PoSizewiseTab` CSV | Exports `PO_PO_26-27/0001_matrix.csv` (illegal `/`) | Exports `PO_26-27_0001_matrix.csv` (sanitized) |
| Studio Config | Defaults module/txGroup to `SALES` | Defaults to `PURCHASE` / `PROCUREMENT` |

---

## 6. Architecture Impact
Zero database schema changes. Full backward compatibility preserved: callers relying on `suggested_simple` still receive `PO-15`, while callers relying on `suggested_order_no` receive canonical statutory numbering.

---

## 7. Proposed Design
1. **Backend Service Return Parity:**
   ```python
   suggested_simple = f"{pfx}-{next_simple}"
   suggested_canonical = f"{pfx}/{fy}/{next_canonical:0{run_len}d}"
   return {
       "prefix": pfx,
       "financial_year": fy,
       "next_number": next_canonical,
       "next_order_no": suggested_canonical,
       "suggested_number": suggested_canonical,
       "suggested_order_no": suggested_canonical,
       "suggested_canonical": suggested_canonical,
       "suggested_simple": suggested_simple,
   }
   ```
2. **Frontend Smart Number Formatter:**
   ```tsx
   {(header.orderNumber.startsWith(header.prefix) || header.orderNumber.includes("/"))
     ? header.orderNumber
     : `${header.prefix}-${header.orderNumber}`}
   ```

---

## 8. Files Created
1. `docs/implementation/procurement/Purchase_Order_Prefix_And_Canonical_Serialization_Remediation_Plan_v6.50.1.md`
2. `docs/walkthrough/procurement/Purchase_Order_Prefix_And_Canonical_Serialization_Remediation_v6.50.1.md`

---

## 9. Files Modified
1. `backend/app/services/purchase.py`
2. `src/components/purchase/PoGenerateTab.tsx`
3. `src/components/purchase/PoSizewiseTab.tsx`
4. `src/components/global/configs/documentSeries.con.tsx`
5. `src/tests/documentSeriesStudio.test.ts`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`
8. `CHANGELOG.md`
9. `RELEASE_NOTES.md`

---

## 10. Dependencies
- FastAPI, SQLAlchemy, React 18, Vite, Vitest

---

## 11. Risks & Mitigations
- **Risk:** Existing legacy tests expecting `PO-15` in `suggested_order_no`.
  **Mitigation:** `suggested_simple` is explicitly retained in the response payload.

---

## 12. Rollback Strategy
Git revert the commit to restore legacy integer suggestions and hyphen splitting.

---

## 13. Verification Plan
- Run Vitest suite: `src/tests/documentSeriesStudio.test.ts`.
- Run Python fiscal year and numbering unit test: `scripts/test_purchase_numbering.py`.
- Run TypeScript compiler: `npm run lint`.

---

## 14. Test Plan
- Verify `documentSeriesConfig.payloadTransform` sets `module: "PURCHASE"` and `transactionGroup: "PROCUREMENT"`.
- Verify `get_next_order_number` returns canonical format for both empty table and sequential state.
- Verify header display does not double-prefix when `orderNumber` contains `PO/`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`.

---

## 16. Deployment Plan
Commit and push to `smritiNX`. Deploy to test instance `F:\Smriti9` via `git pull origin smritiNX`.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- ADR-0042: Canonical PostgreSQL Numbering Authority & Gapless Serialization

---

## 19. Related Walkthroughs
- `docs/walkthrough/procurement/PO_And_GRN_Canonical_Numbering_And_Date_Alignment_v6.95.0.md`
- `docs/walkthrough/purchase/Purchase_Order_Smart_Numbering_And_Collision_Recovery_Walkthrough_v1.0.0.md`

