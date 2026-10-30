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

# Walkthrough: Purchase Order Prefix & Canonical Serialization Remediation

**Document ID:** WT-PUR-PO-PREFIX-REMEDIATION-v6.50.1  
**Area:** Procurement & Document Serialization Architecture  
**Status:** Done  
**Release Target:** v6.50.1  

---

## 1. Purpose
This implementation remediates Purchase Order (PO) prefix resolution and document identity formatting across backend services, frontend workspaces, and Document Series Studio. It permanently resolves the dual-format return drift in `PurchaseService.get_next_order_number`, eliminates the double-prefix rendering defect (`PO-PO/26-27/0001`), prevents the fiscal year hyphen-splitting corruption bug (`PO/26` / `27/0001`), and maps Purchase Order series to module `"PURCHASE"` and transaction group `"PROCUREMENT"`.

---

## 2. Scope
1. **Backend Service (`backend/app/services/purchase.py`):**
   - Unified `get_next_order_number` and `get_next_receipt_number` return keys (`suggested_order_no`, `suggested_number`, `next_order_no`) to canonical statutory format `f"{pfx}/{fy}/{next_canonical:0{run_len}d}"`.
   - Retained `suggested_simple` for backward-compatible legacy integer access.
   - Respected `active_ds.running_length` if configured in Document Series Studio.
2. **Frontend UI Workspaces:**
   - `src/components/purchase/PoGenerateTab.tsx`: Fixed header display at line 1944 to avoid double prefixes when `orderNumber` contains `prefix` or `/`.
   - `src/components/purchase/PoSizewiseTab.tsx`: Fixed sequence parser (lines 1350 and 1650) to detect `/` and prevent fiscal year hyphen splitting; updated header bar (line 3141) and PO Number badge (line 3216); sanitized CSV export download filename (line 2545).
3. **Frontend Studio Config (`src/components/global/configs/documentSeries.con.tsx`):**
   - In `payloadTransform`, automatically mapped `"Purchase Order"` and `"Goods Receipt"` to module `"PURCHASE"` and transaction group `"PROCUREMENT"`.
4. **Unit Tests:**
   - Updated `src/tests/documentSeriesStudio.test.ts` with test verifying `"Purchase Order"` module and transaction group mapping (16/16 passed).

---

## 3. Files Created
1. `docs/implementation/procurement/Purchase_Order_Prefix_And_Canonical_Serialization_Remediation_Plan_v6.50.1.md`
2. `docs/walkthrough/procurement/Purchase_Order_Prefix_And_Canonical_Serialization_Remediation_v6.50.1.md`

---

## 4. Files Modified
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

## 5. Architecture Decisions
- **Canonical Standardization over Simple Integers:** Indian GST Rule 46(b) mandates clear, gapless, consecutive document numbering with fiscal year isolation. Enforcing canonical `{PREFIX}/{FY}/{SEQ:04d}` across all response fields guarantees consistency across PO creation, GRN receiving, and ledger accounting.
- **Smart Prefix Display Guard:** Client-side components should never blindly concatenate `{prefix}-{orderNumber}`. If `orderNumber` already starts with the prefix or contains path separators (`/`), it is already a fully formed document number and should be displayed directly.

---

## 6. Design Rationale
- Operators in `PoGenerateTab` and `PoSizewiseTab` were confused by seeing `PO-PO/26-27/0001` or having their prefix corrupted to `PO/26`. The smart formatter ensures clean display as `PO/26-27/0001` regardless of which tab is active.
- Studio administrators configuring series for Purchase Orders expect the backend to classify them under Procurement rather than Sales.

---

## 7. Implementation Summary
```
+---------------------------------------------------------------------------------+
|                       PURCHASE ORDER NUMBERING ARCHITECTURE                     |
|                                                                                 |
|  BACKEND (PurchaseService.get_next_order_number):                               |
|  - Queries active DocumentSeries ('Purchase Order' / 'PURCHASE_ORDER')          |
|  - Returns canonical format across:                                             |
|    - next_order_no       = 'PO/26-27/0029'                                      |
|    - suggested_order_no  = 'PO/26-27/0029'                                      |
|    - suggested_number    = 'PO/26-27/0029'                                      |
|    - suggested_canonical = 'PO/26-27/0029'                                      |
|    - suggested_simple    = 'PO-15' (legacy compatibility)                       |
|                                                                                 |
|  FRONTEND DISPLAY (PoGenerateTab & PoSizewiseTab):                              |
|  - If orderNumber already starts with prefix or contains '/':                   |
|    Render: 'PO/26-27/0029'  (NO DOUBLE PREFIX!)                                 |
|  - Otherwise:                                                                   |
|    Render: '{prefix}-{orderNumber}'                                             |
|                                                                                 |
|  STUDIO CONFIG (documentSeries.con.tsx):                                        |
|  - documentType = 'Purchase Order' ➔ module = 'PURCHASE', txGroup = 'PROCUREMENT'|
+---------------------------------------------------------------------------------+
```

---

## 8. Tests Executed
1. `npx vitest run src/tests/documentSeries.test.ts src/tests/documentSeriesStudio.test.ts src/tests/numbering.test.ts src/tests/smritiBillPrefix.test.ts` — 45/45 passed.
2. `python -c "import sys; sys.path.insert(0, '.'); import scripts.test_purchase_numbering as tpn; tpn.test_financial_year(); tpn.test_sequential_number_resolution()"` — All assertions passed.
3. `npm run lint` (`tsc --noEmit`) — Exit code 0, 0 errors.

---

## 9. Verification Results
```
Implementation Status

✓ Code Complete
✓ Tests Passed
✓ Documentation Updated
✓ Wiki Updated
✓ CHANGELOG Updated
✓ Release Notes Updated
✓ Architecture Updated
✓ GitHub Published
✓ Links Verified

Evidence Level: A (Full source code, tests verified, and documentation synchronized)
```

---

## 10. Known Limitations
None. Legacy simple formats remain accessible via `suggested_simple`.

---

## 11. Future Work
- Connect PO creation directly to atomic `DocumentsEngine.allocate_next_number_in_transaction` for centralized sequence locking.

---

## 12. Related ADRs
- ADR-0042: Canonical PostgreSQL Numbering Authority & Gapless Serialization

---

## 13. Related RFCs
- RFC-2026-10-19: Statutory PO and GRN Canonical Serialization Standard


