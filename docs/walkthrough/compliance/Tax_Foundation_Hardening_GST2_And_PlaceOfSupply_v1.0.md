<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-04
  Modified     : 2026-10-04
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Tax Foundation Hardening v1.0 -- GST 2.0 Slab Correction & place_of_supply_code Schema Fix

**Area:** compliance
**Commit:** ``b2b5284e``
**Branch:** smritiNX
**Date:** 2026-10-04
**Status:** Done
**Tests:** 13/13 passed (0 failed, 17 warnings)

---

## 1. Purpose

Resolve two distinct but co-located tax-domain defects causing live production issues:

1. **``place_of_supply_code`` Pydantic/ORM mismatch** - Pydantic enforced ``max_length=2`` on response serialization but the database contained ``'18-Assam'`` style values (up to 15 chars). This caused HTTP 500 errors on all sales invoice API responses that included a ``place_of_supply_code``.

2. **GST 2.0 slab data non-compliance** - India's GST 2.0 rationalization (effective 22-Sep-2025) set approved slabs to ``{0%, 5%, 18%, 40%}``. The ``master_values`` table in ``smritisys`` contained: a duplicate active 12% record; an active 28% slab; and 35 items in ``smriti001`` with ``tax_rate=12`` still classified PASS or NULL.

## 2. Scope

| Layer | Change Type |
|---|---|
| ``backend/app/schemas/sales.py`` | Pydantic field width fix (max_length 2->20) |
| ``smritisys.master_values`` | Data: retire duplicate 12% and active 28% GST slabs |
| ``smriti001.items`` | Data: flag 35 items with tax_rate=12 as REQUIRES_REVIEW |

Out of scope: No new migrations, no new APIs, no frontend changes, no ORM changes.

## 3. Files Created

None.

## 4. Files Modified

| File | Change |
|---|---|
| ``backend/app/schemas/sales.py`` | ``place_of_supply_code`` ``max_length`` widened 2->20 |

## 5. Architecture Decisions

**AD-1: Widen Pydantic max_length, not normalize data.**
Options: (A) widen to 20 (chosen), (B) normalize 67 legacy records, (C) split field. ORM column is String(50). Pydantic constraint was the sole source of the 500. Data normalization carries migration risk for 900 records. ``max_length=20`` safely covers both ``'27'`` and ``'18-Assam'``.

**AD-2: Soft-retire, never hard-delete GST slabs.**
All retired slabs remain with ``is_deleted=TRUE`` and a JSONB audit trail. Preserves audit lineage for historical invoices.

**AD-3: Flag items, do not reclassify automatically.**
Items with ``tax_rate=12`` flagged ``REQUIRES_REVIEW``. Actual new slab is a CA decision per Indian GST law.

## 6. Design Rationale

The GST 2.0 slab correction was partially complete (40% added, one 12% record retired) by a prior run. This scope completed the gaps. The ``t_tenant_sec`` 500 was caused by Pydantic rejecting DB values at response serialization time -- a common pattern when ``max_length`` is added after data is already written.

## 7. Implementation Summary

1. Queried ``smritisys`` and ``smriti001`` via psycopg2 on port 2781. Confirmed 967 non-null ``place_of_supply_code`` records (67 in ``'NN-StateName'`` format, 900 already 2-char). Confirmed duplicate active 12% slab and active 28% slab.
2. Changed ``max_length=2`` -> ``max_length=20`` on ``SalesInvoiceBase.place_of_supply_code`` with explanatory comment.
3. Script ``retire_dup_gst12.py`` soft-retired ``id=3464abab`` (name=``'12'``, was active).
4. Script ``gst_hardening_phase2.py`` soft-retired ``id=8844ddee`` (28% slab) and flagged 35 items as ``REQUIRES_REVIEW``.
5. 13/13 targeted tests green. Committed ``b2b5284e``.

## 8. Tests Executed

```
Command: ..\.venv\Scripts\pytest.exe tests\test_gst_2_slab_validation.py tests\t_tenant_sec.py -v

tests/test_gst_2_slab_validation.py::TestGst20SlabCorrection::test_gst_40_slab_is_active_in_control_plane PASSED
tests/test_gst_2_slab_validation.py::TestGst20SlabCorrection::test_gst_12_slab_is_retired_in_control_plane PASSED
tests/test_gst_2_slab_validation.py::TestGst20SlabCorrection::test_all_approved_gst_slabs_are_active PASSED
tests/test_gst_2_slab_validation.py::TestGst20SlabCorrection::test_no_unapproved_active_gst_slabs PASSED
tests/test_gst_2_slab_validation.py::TestGst20SlabCorrection::test_no_active_items_use_12_percent_gst PASSED
tests/test_gst_2_slab_validation.py::TestGst20SlabCorrection::test_flagged_12_percent_items_have_review_message PASSED
tests/t_tenant_sec.py::test_unauthenticated_request_rejected PASSED
tests/t_tenant_sec.py::test_authorized_company_request_success PASSED
tests/t_tenant_sec.py::test_header_tampering_cross_tenant_attack_blocked PASSED
tests/t_tenant_sec.py::test_barcode_layout_company_isolation PASSED
tests/t_tenant_sec.py::test_barcode_printer_settings_and_test_print_isolation PASSED
tests/t_tenant_sec.py::test_approval_matrix_anonymous_and_role_protection PASSED
tests/t_tenant_sec.py::test_ecom_reserve_and_portal_anonymous_protection PASSED

====================== 13 passed, 17 warnings in 24.34s ======================
```

## 9. Verification Results

**Evidence:**

git commit: ``b2b5284e fix(tax): GST 2.0 slab data hardening + place_of_supply_code schema fix``
git diff: 1 file changed, 4 insertions(+), 1 deletion(-)

DB state after (smritisys gst_rate slabs):
```
   0%  name=0%    [ACTIVE]
  12%  name=12%   [RETIRED]
  12%  name=12    [RETIRED]
  18%  name=18%   [ACTIVE]
  28%  name=28    [RETIRED]
  40%  name=40%   [ACTIVE]
   5%  name=5%    [ACTIVE]
```

DB state after (smriti001.items): Unflagged 12% items remaining: 0 (was 35)

**Interpretation:** All 6 GST slab tests pass. ``t_tenant_sec::test_authorized_company_request_success`` (was HTTP 500) now passes. DB is GST 2.0 compliant.

**Recommendation:** Run full regression suite to confirm no regressions. The 17 warnings are pre-existing Pydantic V2 deprecation warnings unrelated to this scope.

## 10. Known Limitations

- ``place_of_supply_code`` widened to ``max_length=20``, not enforced as strict 2-char. A future scope should add a validator that normalizes ``'18-Assam'`` to ``'18'`` on write.
- 35 items flagged ``REQUIRES_REVIEW`` require manual CA review and reclassification.
- ORM ``String(50)`` not reduced -- a future migration can enforce ``String(20)`` once data is fully normalized.
- Data remediation scripts run outside Alembic (data-only corrections acceptable but noted).

## 11. Future Work

- Add ``@field_validator`` to normalize ``'NN-StateName'`` -> ``'NN'`` on write.
- Reduce ORM ``String(50)`` -> ``String(20)`` with migration after data normalized.
- Build CA Review Dashboard for bulk reclassification of ``REQUIRES_REVIEW`` items.
- Add ``place_of_supply_code`` to ``states_ref`` FK validation pipeline.

## 12. Related ADRs

- ADR-005: One-Way Canonical Master to Compatibility Projection Architecture
- GOVERNANCE_FREEZE.md: Baseline v1.0 @ SHA ``617570892c``

## 13. Related RFCs

None.
