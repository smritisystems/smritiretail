<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.12.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough - Indian Retail Market Hardening Suite (v4.12.0)

**Status:** Done
**Evidence Level:** A (57/57 Automated Tests Passed + Git Diff)

---

## 1. Purpose

To deliver **v4.12.0 - Indian Retail Market Hardening Suite**: a domain-specific compliance layer forming the **Indian Compliance Core Layer (ICCL)** that addresses the 6 critical gaps identified in the Indian retail market deep audit.

---

## 2. Scope

- **HSN/SAC Validation Engine** (`backend/app/core/hsn_validator.py`)
- **UPI Payment Reference Validator** (`backend/app/core/upi_validator.py`)
- **Indian State Code Registry** (`backend/app/core/indian_state_registry.py`)
- **TCS/TDS Rate Engine** (`backend/app/core/tcs_tds_engine.py`)
- **Vernacular/Multilingual Product Label Schema** (`backend/app/schemas/multilingual.py`)
- **GST Filing Health Score Engine** (`backend/app/services/gst_health_score.py`)
- **Test Suite** (`backend/app/tests/test_v4_12_indian_market_hardening.py`) — 57 tests

---

## 3. Files Created

- `backend/app/core/hsn_validator.py`
- `backend/app/core/upi_validator.py`
- `backend/app/core/indian_state_registry.py`
- `backend/app/core/tcs_tds_engine.py`
- `backend/app/schemas/multilingual.py`
- `backend/app/services/gst_health_score.py`
- `backend/app/tests/test_v4_12_indian_market_hardening.py`
- `docs/implementation/foundation/v4_12_Indian_Market_Hardening_Plan.md`
- `docs/walkthrough/foundation/v4_12_Indian_Market_Hardening_Walkthrough.md`

---

## 4. Files Modified

- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions

1. **Indian Compliance Core Layer (ICCL)** - All 6 modules are pure business logic (no FastAPI routes). They form a standalone compliance layer that SGIP filing services and POS invoice endpoints reference in subsequent releases.
2. **HSN chapter-based tax band mapping** - Approximate slab classification covering all 99 GST chapters with known rate bands. Full slab table update handled via periodic GST Council notification sync.
3. **UPI 12-char alphanumeric ref ID** - Validated against NPCI standard. Known PSP handles validated separately from VPA format.
4. **Probabilistic TCS/TDS threshold logic** - Both thresholds (Rs 10Cr turnover / Rs 50L per-buyer) modeled as Decimal comparisons with ROUND_HALF_UP quantization to prevent floating-point errors on tax amounts.
5. **GST Health Score 7-check engine** - Weighted scoring (total 100 points): GSTIN (20), HSN (20), Tax Rate (15), POS Match (15), Date (10), RCM (10), Round-off (10). 100% error bypass protocol ensures all checks are evaluated.
6. **Multilingual schema as optional mixin** - `ProductVernacularExtension` is designed as an optional embedded field, not a mandatory model change, to keep backward compatibility.

---

## 6. Design Rationale

### Deep Audit: Indian Market Pros and Cons

| Capability | Gap Closed | Benefit | Limitation |
|---|---|---|---|
| HSN Validator | Wrong HSN causes GST mismatch | Pre-invoice validation prevents portal rejection | Chapter rate mapping is approximate; full 8-digit rate table needs GST Council API sync |
| UPI Validator | No VPA/UTR validation | Settlement reconciliation accuracy | Handle list requires periodic NPCI registry update |
| State Registry | Manual lookup errors | Intrastate/interstate determination automated | Some merged UTs (e.g., DD+DNH = 26) have historical code ambiguity |
| Multilingual Labels | No Tier-2/3 market support | Regional language labels increase adoption | 14 of 22 scheduled languages not yet covered in this release |
| TCS/TDS Engine | Non-compliance for high-turnover sellers | Auto-calculates applicable deduction | Thresholds subject to annual budget amendments; no Form 26AS integration |
| GST Health Score | Filing errors discovered post-submission | Pre-flight check eliminates GSTR rejections | Does not validate against GSTN portal live data |

---

## 7. Implementation Summary

6 new modules implemented, 57 test cases written and verified. All modules are additive — no existing routes or models modified.

---

## 8. Tests Executed

`ash
..\\.venv311\\Scripts\\python.exe -m pytest app/tests/test_v4_12_indian_market_hardening.py -v
`

---

## 9. Verification Results

`	ext
============================= test session starts =============================
platform win32 -- Python 3.11.6, pytest-8.2.1, pluggy-1.6.0
asyncio: mode=Mode.AUTO
collected 57 items

TestHSNValidator::test_valid_2_digit_hsn PASSED
TestHSNValidator::test_valid_4_digit_hsn PASSED
TestHSNValidator::test_valid_6_digit_hsn PASSED
TestHSNValidator::test_valid_8_digit_hsn PASSED
TestHSNValidator::test_sac_code_chapter_99 PASSED
TestHSNValidator::test_invalid_non_numeric_hsn PASSED
TestHSNValidator::test_invalid_5_digit_hsn PASSED
TestHSNValidator::test_textile_hsn_chapter PASSED
TestHSNValidator::test_pharma_hsn_chapter PASSED
TestHSNValidator::test_hsn_description_chapter_64 PASSED
TestHSNValidator::test_hsn_description_chapter_99 PASSED
TestUPIValidator::test_valid_vpa_known_handle PASSED
TestUPIValidator::test_valid_vpa_phonepay PASSED
TestUPIValidator::test_valid_vpa_unknown_handle PASSED
TestUPIValidator::test_invalid_vpa_no_at PASSED
TestUPIValidator::test_invalid_vpa_too_short_local PASSED
TestUPIValidator::test_invalid_vpa_special_chars_in_handle PASSED
TestUPIValidator::test_valid_upi_ref_id PASSED
TestUPIValidator::test_valid_upi_ref_id_numeric PASSED
TestUPIValidator::test_invalid_upi_ref_too_short PASSED
TestUPIValidator::test_invalid_upi_ref_special_chars PASSED
TestUPIValidator::test_valid_upi_amount_within_limit PASSED
TestUPIValidator::test_invalid_upi_amount_exceeds_limit PASSED
TestUPIValidator::test_invalid_upi_amount_zero PASSED
TestIndianStateRegistry::test_lookup_maharashtra_by_code PASSED
TestIndianStateRegistry::test_lookup_karnataka_by_code PASSED
TestIndianStateRegistry::test_lookup_delhi_by_code PASSED
TestIndianStateRegistry::test_lookup_by_abbreviation_mh PASSED
TestIndianStateRegistry::test_lookup_by_name_goa PASSED
TestIndianStateRegistry::test_lookup_by_name_partial PASSED
TestIndianStateRegistry::test_extract_state_from_gstin PASSED
TestIndianStateRegistry::test_is_intrastate_same_state PASSED
TestIndianStateRegistry::test_is_interstate_different_states PASSED
TestIndianStateRegistry::test_states_by_region_south PASSED
TestIndianStateRegistry::test_unknown_state_code_returns_none PASSED
TestMultilingualSchema::test_create_multilingual_label_hindi_tamil PASSED
TestMultilingualSchema::test_available_locales PASSED
TestMultilingualSchema::test_get_label_for_locale PASSED
TestMultilingualSchema::test_is_empty_true PASSED
TestMultilingualSchema::test_is_empty_false PASSED
TestMultilingualSchema::test_product_vernacular_extension PASSED
TestMultilingualSchema::test_empty_vernacular_extension PASSED
TestTCSTDSEngine::test_tcs_not_applicable_low_turnover PASSED
TestTCSTDSEngine::test_tcs_not_applicable_buyer_threshold_not_crossed PASSED
TestTCSTDSEngine::test_tcs_applicable_full_scenario PASSED
TestTCSTDSEngine::test_tds_not_applicable_threshold_not_crossed PASSED
TestTCSTDSEngine::test_tds_applicable_full_scenario PASSED
TestTCSTDSEngine::test_tds_not_applicable_no_tan PASSED
TestGSTHealthScore::test_perfect_invoice_score_100 PASSED
TestGSTHealthScore::test_invalid_gstin_deducts_score PASSED
TestGSTHealthScore::test_missing_hsn_deducts_score PASSED
TestGSTHealthScore::test_invalid_tax_rate_deducts_score PASSED
TestGSTHealthScore::test_pos_mismatch_deducts_score PASSED
TestGSTHealthScore::test_rcm_flag_mismatch_deducts_score PASSED
TestGSTHealthScore::test_roundoff_excess_deducts_score PASSED
TestGSTHealthScore::test_recommendations_generated_on_failure PASSED
TestGSTHealthScore::test_multiple_failures_compound_score_reduction PASSED

============================= 57 passed in 0.34s ==============================
`

---

## 10. Known Limitations

- HSN chapter-to-tax-band mapping is approximate; full 8-digit product-level rate requires GST Council notification API.
- UPI PSP handle list requires periodic update from NPCI registry.
- Multilingual schema covers 8 of 22 constitutionally recognized languages.
- TCS/TDS thresholds are FY 2025-26; subject to annual Finance Act amendments.
- GST Health Score does not call the live GSTN validation API.

---

## 11. Future Work

- v4.13: HSN Rate API integration with official GST Council notification feed.
- v4.13: UPI NPCI handle registry auto-sync.
- v4.14: Extend multilingual schema to cover Odia, Malayalam, Urdu, Assamese, Sindhi.
- v4.14: Form 26AS reconciliation integration for TCS/TDS.
- v4.15: GST Health Score live GSTN validation API integration.

---

## 12. Related ADRs

- ADR-001: Platform Architecture Overview
- ADR-INDIA-001: Indian Compliance Core Layer (ICCL)

---

## 13. Related RFCs

- RFC-4.12.0: Indian Retail Market Hardening — ICCL Foundation
