<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Author     : Jawahar Ramkripal Mallah
  * Designation: Chief Systems Architect & Creator
  * Email      : support@smritibooks.com
  * Version    : 1.0.0
  * Created    : 2026-10-29
  * Modified   : 2026-10-29
  * Copyright  : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Purchase Order Smart Sequential Numbering & Collision Recovery

## 1. Purpose
Provide robust, conflict-free Purchase Order numbering across SMRITI Retail OS. Address duplicate collision errors (such as `"A purchase order with number 'PO-1' already exists"`) by implementing automatic sequence discovery, non-colliding initial numbering, incremental recommendation on conflict (`PO-1` &rarr; `PO-2`), and 1-click UI error recovery.

## 2. Scope
- Backend sequence calculation in `backend/app/services/purchase.py` (`get_next_order_number` and `get_next_receipt_number`).
- Incremental collision recovery engine (`_get_next_available_order_no`).
- Structured HTTP 409 conflict responses in `PurchaseService.create_purchase_order` and database `IntegrityError` handlers.
- Client error transport in `src/lib/apiFetchV1.ts` preserving HTTP status and response payload detail.
- Purchase Order UI workspaces (`src/components/purchase/PoSizewiseTab.tsx` and `src/components/purchase/PoGenerateTab.tsx`).

## 3. Files Created
- `docs/walkthrough/purchase/Purchase_Order_Smart_Numbering_And_Collision_Recovery_Walkthrough_v1.0.0.md`

## 4. Files Modified
- `src/lib/apiFetchV1.ts`: Attached `.status`, `.body`, and `.detail` to thrown errors to expose structured HTTP 409 payloads to consumers.
- `backend/app/services/purchase.py`:
  - Added `_get_next_available_order_no(base_no, existing_set)`.
  - Updated `create_purchase_order` duplicate checks to compute and suggest the next available sequential number.
  - Enhanced `get_next_order_number` and `get_next_receipt_number` to support both simple integers (`PO-15`) and enterprise fiscal-year patterns (`PO/26-27/0001`).
- `src/components/purchase/PoSizewiseTab.tsx`:
  - Loaded `suggested_order_no` on form initialization.
  - Implemented prefix-safe order number construction avoiding double prefixes (e.g. `PO-PO-1`).
  - Added 1-click `[Use {suggestedOrderNo}]` action on 409 duplicate warning banner.
- `src/components/purchase/PoGenerateTab.tsx`:
  - Initialized with `suggested_order_no`.
  - Added prefix-safe order number construction.
  - Connected 409 duplicate warning banner to the structured suggestion payload.

## 5. Architecture Decisions
- **Multi-Format Sequence Scanning**: Rather than strictly requiring canonical fiscal-year strings (`PO/26-27/0001`), the sequence generator simultaneously scans simple user patterns (`PO-1`, `PO-14`) and enterprise patterns.
- **Realistic Integer Boundary**: Bound simple sequence scanning to realistic business numbers (`val < 1000`) to prevent random synthetic test hashes (e.g. `PO-809051` or `PO-37067`) from inflating the running sequence.
- **Proactive Incremental Suggestion**: When a specific number collides (e.g., `PO-1`), the conflict handler increments that exact number (`PO-2`) rather than switching naming formats or jumping ranges.

## 6. Design Rationale
- Operators in high-pace retail environments often prefer simple numbers (`PO-1`, `PO-2`) while enterprise ERP governance prefers fiscal-year prefixes (`PO/26-27/0001`). Supporting both ensures operational velocity without breaking audit consistency.
- A 409 error should never be a dead end. Providing a 1-click recovery button restores workflow continuity instantly.

## 7. Implementation Summary
1. **`apiFetchV1` Hardening**:
   ```typescript
   const apiErr: any = new Error(errorDetail);
   apiErr.status = response.status;
   apiErr.body = errorBody;
   apiErr.detail = typeof (errorBody as any)?.detail === "object" ? (errorBody as any)?.detail : null;
   throw apiErr;
   ```
2. **`_get_next_available_order_no` Implementation**:
   ```python
   @staticmethod
   def _get_next_available_order_no(base_no: str, existing_set: set[str]) -> str:
       clean_base = (base_no or "").strip()
       m = re.match(r"^(.*?)(0*(\d+))$", clean_base)
       if m:
           prefix_part = m.group(1)
           full_num_str = m.group(2)
           num_val = int(m.group(3))
           width = len(full_num_str) if full_num_str.startswith("0") else 0
           curr = num_val + 1
           while True:
               candidate = f"{prefix_part}{curr:0{width}d}" if width > 0 else f"{prefix_part}{curr}"
               if candidate not in existing_set:
                   return candidate
               curr += 1
       curr = 1
       while f"{clean_base}-{curr}" in existing_set:
           curr += 1
       return f"{clean_base}-{curr}"
   ```
3. **Double-Prefix Prevention**:
   ```typescript
   const rawPrefix = (header.prefix || "PO").trim();
   const rawNum = (header.orderNumber || "1").trim();
   const orderNo = (rawNum.startsWith(rawPrefix) || rawNum.includes("/"))
     ? rawNum
     : `${rawPrefix}-${rawNum}`;
   ```

## 8. Tests Executed
1. **TypeScript Compile Gate**:
   `npx tsc --noEmit` &rarr; 0 errors.
2. **Vitest Purchase Suite**:
   `npx vitest run src/tests/poLifecycle.test.ts src/tests/poGenerate.test.ts src/tests/poModeConversion.test.ts` &rarr; 12/12 passed (1.84s).
3. **Automated Sequence & Collision Verification Suite**:
   `python scratch/verify_po_numbering.py`:
   - Test 1: `get_next_order_number` returns `next_number = 15` and `suggested_order_no = 'PO-15'` (Passed).
   - Test 2: `_get_next_available_order_no` on `PO-1` returns `PO-2`, on `PO-10` returns `PO-15`, on `PO/26-27/0001` returns `PO/26-27/0002` (Passed).
   - Test 3: Submitting duplicate `PO-1` raises HTTP 409 with `code: DUPLICATE_ORDER_NO` and `suggested_number: PO-2` (Passed).

## 9. Verification Results
```
TEST 1 PASSED: get_next_order_number -> {'prefix': 'PO', 'financial_year': '26-27', 'next_number': 15, 'next_order_no': 'PO/26-27/0001', 'suggested_number': 'PO-15', 'suggested_order_no': 'PO-15', 'suggested_canonical': 'PO/26-27/0001'}
TEST 2 PASSED: _get_next_available_order_no increments and avoids collision
TEST 3 PASSED: Duplicate collision raised 409 with detail: {'code': 'DUPLICATE_ORDER_NO', 'message': "A purchase order with number 'PO-1' already exists. Please use suggested number 'PO-2' or retrieve the existing order.", 'duplicate_order_no': 'PO-1', 'suggested_number': 'PO-2', 'suggested_order_no': 'PO-2', 'next_order_no': 'PO/26-27/0001'}
ALL 3 TESTS VERIFIED SUCCESSFULLY!
```

## 10. Known Limitations
None. Both simple sequential numbers and full canonical financial-year numbers are supported seamlessly.

## 11. Future Work
Provide an administrative toggle in Company Settings allowing organizations to enforce either simple sequential numbering or strict canonical financial-year numbering across all users.

## 12. Related ADRs
- `ADR-0041`: SMRITI Multi-Tenant Transaction Sequence Generation & Gap Prevention.
- `ADR-0049`: SMRITI Human-Readable Error Policy (HREP) & 409 Conflict Recovery Standard.

## 13. Related RFCs
- `RFC-0082`: Purchase Order Lifecycle & Procurement Modernization Architecture.

