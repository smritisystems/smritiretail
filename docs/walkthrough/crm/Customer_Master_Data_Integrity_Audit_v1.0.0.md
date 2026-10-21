# Customer Master Data Integrity Audit Report

**Phase 3 — Audit Report (Read-Only Baseline)**

| Field | Value |
|---|---|
| **Target** | https://tattlythreads.smritisys.com |
| **Audit Mode** | Headless HTTPS API - no browser, no DB writes |
| **Run Timestamp** | 2026-10-21 21:57:16 IST |
| **Customers Audited** | 3 (all records) |
| **GST Registrations** | 14 (Reliance Retail Limited) |
| **Delivery Locations** | 68 (all RRL store network) |
| **Billing Locations** | 0 (none on file for any customer) |
| **Company Profile** | Tattly Threads - GSTIN 27AAXFT2508H1ZR / Maharashtra / Mumbai |

---

## Executive Summary

8 findings were identified across 4 severity categories:

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 3 |
| Medium | 2 (data completeness gaps) |
| Informational | 3 |

> **No data was modified during this audit.** All findings are read-only observations.

---

## Phase 1 - Database Discovery

### Customer List Response Shape

All sub-objects embedded in list response (no separate detail fetch needed):
- `gst_registrations[]` - 14 for RRL-001
- `delivery_locations[]` - 68 for RRL-001
- `billing_locations[]` - 0 (empty)
- `external_identities[]` - 0 (empty)
- `company_relationships[]` - present

### GST Registration State Fields - Data Gap

All 14 GST registrations for RRL-001 have `state_name = NULL`, `state_code = NULL`, `is_primary = NULL`.

| GSTIN | Prefix | Implied State |
|---|---|---|
| 27AABCR1718E1ZP | 27 | Maharashtra |
| 07AABCR1718E1ZR | 07 | Delhi |
| 09AABCR1718E1ZN | 09 | Uttar Pradesh |
| 10AABCR1718E1Z4 | 10 | Bihar |
| 16AABCR1718E1ZS | 16 | Tripura |
| 18AABCR1718E1ZO | 18 | Assam |
| 19AABCR1718E1ZM | 19 | West Bengal |
| 20AABCR1718E1Z3 | 20 | Jharkhand |
| 29AABCR1718E1ZL | 29 | Karnataka |
| 32AABCR1718E1ZY | 32 | Kerala |
| 33AABCR1718E1ZW | 33 | Tamil Nadu |
| 36AABCR1718E1ZQ | 36 | Telangana |
| 06AABCR1718E1ZT | 06 | Haryana |
| 37AABCR1718E1ZO | 37 | Andhra Pradesh |

---

## Phase 2 - Existing-Data Validation

### CLEAN locations (63/68 - 92.6%)

63 of 68 RRL delivery locations passed all validations. City/state/GSTIN combinations are internally consistent. Sample of clean records:

| Store | City | State | GSTIN | GSTIN State | Result |
|---|---|---|---|---|---|
| TV78 | Tumkur | Karnataka | 29AABCR1718E1ZL | Karnataka | PASS |
| TV81 | Guwahati | Assam | 18AABCR1718E1ZO | Assam | PASS |
| TDL9 | Hyderabad | Telangana | 36AABCR1718E1ZQ | Telangana | PASS |
| TKF4 | Bangalore | Karnataka | 29AABCR1718E1ZL | Karnataka | PASS |
| TFW4 | Mumbai | Maharashtra | 27AABCR1718E1ZP | Maharashtra | PASS |
| TVT0 | Delhi | Delhi | 07AABCR1718E1ZR | Delhi | PASS |

---

## Phase 3 - Findings

### F-001 [Critical] - GSTIN_STATE_MISMATCH

| Field | Value |
|---|---|
| Record ID | cdl-42776609 |
| Customer | Reliance Retail Limited [RRL-001] |
| Store Code | TEST-BLR-001 |
| City | BENGALURU URBAN |
| State in DB | Karnataka |
| PIN | 560001 |
| GSTIN on location | 27AAACR7055N1ZV |
| GSTIN prefix | 27 -> Maharashtra |
| Verification Status | Unverified |

**Analysis:** Bengaluru is Karnataka (prefix 29). GSTIN prefix 27 = Maharashtra. Wrong-state GSTIN on this location will produce an invalid GST invoice with wrong IGST/CGST determination.

**Recommended Correction:** Replace `27AAACR7055N1ZV` with `29AABCR1718E1ZL` (the Karnataka registration). Confirm with compliance before applying.

---

### F-002 [Critical] - GSTIN_STATE_MISMATCH

| Field | Value |
|---|---|
| Record ID | cdl-4a251458 |
| Customer | Reliance Retail Limited [RRL-001] |
| Store Code | TEST-HYD-001 |
| City | HYDERABAD |
| State in DB | Telangana |
| PIN | 500081 |
| GSTIN on location | 27AAACR7055N1ZV |
| GSTIN prefix | 27 -> Maharashtra |
| Verification Status | Unverified |

**Analysis:** Hyderabad is Telangana (prefix 36). GSTIN prefix 27 = Maharashtra. Same systematic error as F-001 - both TEST stores were set up with the same Maharashtra GSTIN regardless of delivery state.

**Recommended Correction:** Replace with `36AABCR1718E1ZQ` (Telangana registration). Confirm with compliance before applying.

---

### F-003 [High] - CITY_STATE_MISMATCH

| Field | Value |
|---|---|
| Record IDs | cdl-2b59acde, cdl-d2e8c97f |
| Customer | Reliance Retail Limited [RRL-001] |
| City | Mumbai |
| State in DB | KARNATAKA |
| PIN | 400001 |
| GSTIN prefix | 29 -> Karnataka |
| Verification Status | Unverified - requires human decision |

**Analysis:** Two records have `city = Mumbai` with `state = KARNATAKA`. Mumbai PIN 400001 is in Maharashtra. The GSTIN prefix 29 (Karnataka) contradicts the city. This is a compound error - either the city name is wrong OR the state is wrong. The store name in WMS/dispatch must be checked first.

**Do NOT auto-correct.** Options:
- Option A: If Karnataka stores - correct city to actual Karnataka city
- Option B: If Maharashtra stores - correct state to `Maharashtra` and GSTIN to `27AABCR1718E1ZP`

---

### F-004 [High] - CITY_STATE_MISMATCH (Normalization)

| Field | Value |
|---|---|
| Record ID | cdl-aa6e7e5b |
| City | Tumkur |
| State in DB | KARNATAKA |
| PIN | 572101 |
| GSTIN prefix | 29 -> Karnataka |
| Verification Status | Partially Verified |

**Analysis:** Tumkur (Tumakuru) IS in Karnataka - the state is factually correct. However, the state is stored as ALL-CAPS `KARNATAKA` which may break case-sensitive invoice comparisons. Normalization only - no geographic error.

**Recommended Correction:** Normalize `KARNATAKA` -> `Karnataka` (safe formatting change).

---

### F-005 to F-007 [Informational] - STATE_CASE_INCONSISTENCY

Three records store state as ALL-CAPS `KARNATAKA`:
- cdl-aa6e7e5b (Tumkur)
- cdl-2b59acde (Mumbai)
- cdl-d2e8c97f (Mumbai)

Normalize to `Karnataka`.

---

### F-008 to F-009 [Medium] - GST_REG_STATE_FIELDS_NULL

All 14 GST registration rows: `state_name = NULL`, `state_code = NULL`, `is_primary = NULL`.
- Invoice state rendering must derive from GSTIN prefix (brittle)
- No primary GSTIN designated

---

## Proposed Corrections (Awaiting Approval)

> **CAUTION:** None applied yet. Each correction will be applied transactionally with a before-snapshot.

| ID | Record | Field | Current | Proposed | Safety |
|---|---|---|---|---|---|
| C-001 | cdl-42776609 | gstin | 27AAACR7055N1ZV | 29AABCR1718E1ZL | Safe after compliance confirm |
| C-002 | cdl-4a251458 | gstin | 27AAACR7055N1ZV | 36AABCR1718E1ZQ | Safe after compliance confirm |
| C-003 | cdl-2b59acde, cdl-d2e8c97f | city or state | Mumbai/KARNATAKA | TBD | Needs WMS check first |
| C-004 | cdl-aa6e7e5b, cdl-2b59acde, cdl-d2e8c97f | state | KARNATAKA | Karnataka | Safe - formatting only |
| C-005 | All 14 GST regs | state_name, state_code, is_primary | NULL | Derived from GSTIN | Safe - data fill |

---

## Phase 5 - Prevention Recommendations

1. **Backend:** On `POST delivery-locations` - validate GSTIN prefix matches state name. Reject mismatches.
2. **Backend:** On `POST gst-registrations` - auto-derive `state_name` and `state_code` from GSTIN prefix. Never allow NULL.
3. **Backend:** Enforce `is_primary = true` on exactly one active GST registration per customer.
4. **Backend:** Normalize state field to title-case on write.
5. **Backend:** City/state compatibility warning (non-blocking) when city is in the known reference map.
6. **Frontend:** Show field-level GSTIN state derivation so the user sees "GSTIN 29 = Karnataka" while typing.

---

## Evidence

**Evidence:** Literal terminal output from `scratch/customer_deepdive.py` run at 2026-10-21 21:57:16 IST. SYSADMIN JWT obtained from production login endpoint. All 68 delivery locations traversed. Raw CSV: `scratch/delivery_locations_full_audit.csv` (68 rows), `scratch/audit_findings_full.csv` (8 rows).

**Interpretation:** 63/68 locations clean. 5 locations have issues. F-001 and F-002 are TEST stores that appear to have been added with a copy-paste GSTIN error. F-003/F-004 are likely test data or import artifacts. All 14 GST registration metadata fields are NULL - a systematic data-fill gap, not corruption.

**Recommendation:** Apply C-001/C-002 after compliance confirm. Investigate C-003 against WMS. Apply C-004 (safe normalization). Apply C-005 (state fill) as a scripted migration. Implement Phase 5 backend validators before the next data import.

---

*Generated by SMRITI Audit Engine v1.0.0. No database writes performed during this audit.*
