<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.18.0
  Created      : 2026-09-27
  Modified     : 2026-09-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Standard v2.2 Audit & Formula Remediation

**Area:** Inventory / Merchandising  
**Topic:** Item Master Creation Standard v2.1 Audit & v2.2 Remediation  
**Status:** Completed  
**Evidence Level:** Level A (Forensic Code & Workbook AST Inspection + Automated Test Verification)

---

## 1. Purpose
Provide a complete forensic audit and comprehensive engineering remediation of the canonical ingestion template `SMRITI_Item_Master_Creation_Standard_v2.1.xlsx`. Resolve Excel formula traps (`COUNTA` empty-formula evaluation and `COUNTIF` blank collision), expand rigid 1-row data validation ranges into enterprise multi-brand/multi-color/multi-size catalog lists, eliminate status-vs-message formula contradictions, institutionalize GST 2.0 dynamic threshold rule `IM-013`, and ensure seamless live template distribution via `universal_import.py`.

---

## 2. Scope
1. **Spreadsheet Formula Remediation (`Item Master Template`):**
   - Correct Col B (`SKU_PREVIEW`) to conditionally delimit components and prevent double/trailing hyphens.
   - Correct Col AI (`VALIDATION_STATUS`) to detect empty rows via `AND(A5="",C5="")` and guard against counting blank formula results.
   - Correct Col AJ (`VALIDATION_MESSAGE`) to guard `COUNTIF` against empty strings and flag missing mandatory attributes.
2. **Data Validation & Range Expansion (`Validation Lists`):**
   - Expand hardcoded 1–2 item ranges across 19 dimensions into full retail lists (Brands, Colors, Sizes, Silhouettes, Materials, Departments, Categories).
   - Configure Excel Data Validation alerts to `warning` / `information` so operators are guided rather than blocked by hard modal dialogs when introducing new master values.
3. **Validation Rules & Governance (`Validation Rules` & `Field Notes`):**
   - Add rule `IM-013` governing GST 2.0 ₹2,500 selling price threshold.
   - Document ratification history in `Field Notes & Corrections`.
4. **Backend Pipeline Sync (`universal_import.py`):**
   - Honor `price_mode` (`DO_NOT_CREATE`, `CREATE_AS_DRAFT`, `CREATE_LIVE_RETAIL`) in universal import commit.
   - Avoid duplicate parent `PriceBookEntry` when variants are present.
   - Verify `GET /api/v1/universal-import/templates/item-master.xlsx` live streaming.

---

## 3. Files Created
1. `assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx` — Official enterprise release of the Item Master Creation Standard.
2. `scripts/remediate_item_master_standard.py` — Automated workbook transformer and audit remediation script.
3. `docs/walkthrough/inventory/Item_Master_Standard_v2.2_Audit_And_Formula_Remediation.md` — This walkthrough document.

---

## 4. Files Modified
1. `assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.1.xlsx` — In-place formula and validation range updates.
2. `backend/app/api/v1/universal_import.py` — Price mode enforcement and variant-level PBE scoping.
3. `docs/walkthrough/README.md` — Master walkthrough index updated chronologically.

---

## 5. Architecture Decisions
- **ADR-IMS-001: Separation of Spreadsheet Preview from Canonical Identity:** `SKU_PREVIEW` in Col B remains strictly non-authoritative. The backend `IdentityEngine` generates canonical variant SKUs and barcodes during import.
- **ADR-IMS-002: Soft Validation Alerts for Master Dimensions:** Data validation dropdowns in Excel are configured with `warning`/`information` severity instead of modal `stop`, allowing operators to enter new brands or shades that trigger SMRITI master value onboarding during import.
- **ADR-IMS-003: Pricing Domain Scoping:** Item creation commits generate `PriceBookEntry` records exclusively when `price_mode` is set to `CREATE_AS_DRAFT` or `CREATE_LIVE_RETAIL`. When variants are created, PBEs attach directly to the variant level.

---

## 6. Design Rationale
- **The `COUNTA` Formula Trap:** In Microsoft Excel, `COUNTA` returns 1 for any cell containing a formula that evaluates to `""`. Because row 5 to 500 contained `=IF(C5="","",...)`, `COUNTA(A5:AG5)=0` was permanently false, causing all 492 unused rows to display `ERROR`. Checking `AND(A5="",C5="")` cleanly identifies truly empty rows.
- **The `COUNTIF` Blank String Trap:** `COUNTIF($B$5:$B$500, B5) > 1` on a blank cell counts all 492 empty formulas, triggering `Duplicate SKU_PREVIEW` as soon as an operator types a barcode in Col A. Guarding with `AND(B5<>"", COUNTIF(...) > 1)` completely resolves this issue.

---

## 7. Implementation Summary
- Fixed 496 formula rows in `Item Master Template`.
- Seeded 19 defined lists in `Validation Lists` covering top footwear, apparel, and retail dimensions.
- Added Rule `IM-013` to `Validation Rules`.
- Appended 6 ratification notes to `Field Notes & Corrections`.
- Updated `backend/app/api/v1/universal_import.py` commit handler.

---

## 8. Tests Executed
1. `f:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/tests/test_universal_import_item_master.py -q`
   - Output: `8 passed, 9 warnings in 25.37s` (100% green).
2. `f:\SMRITRretailNX\.venv\Scripts\python.exe scratch/verify_remediation.py`
   - Output: Verified Row 5 sample formulas, Row 9 empty formulas (`EMPTY`), and defined name ranges.
3. Dynamic template streaming test (`download_item_master_template`):
   - Output: `Status code: 200`, `Content disposition: attachment; filename="SMRITI_Item_Master_Standard_v2.1_COMP-001.xlsx"`, size `143,873 bytes`.

---

## 9. Verification Results
- Empty row status evaluates to `EMPTY`.
- Populated row status evaluates to `READY`.
- Duplicate barcodes and duplicate SKUs are flagged only when non-empty.
- Missing mandatory fields report `Missing Mandatory Attributes`.
- Price mode gate correctly produces 0 PBEs on `DO_NOT_CREATE` and 1 PBE on `CREATE_LIVE_RETAIL`.

---

## 10. Known Limitations
- The Excel workbook does not execute VBA macros (by design, to avoid security warnings and maximize cross-platform compatibility with LibreOffice and Google Sheets).

---

## 11. Future Work
- Build a web-based batch spreadsheet editor inside `smritiretail` frontend using React-Data-Grid with real-time API schema validation.

---

## 12. Related ADRs
- `ADR-IMS-001`: Non-authoritative SKU preview in bulk templates.
- `ADR-IMS-002`: Soft validation on master lookup dimensions.
- `ADR-IMS-003`: Pricing domain isolation via `PriceBookEntry`.

---

## 13. Related RFCs
- `RFC-IMS-012`: Universal Item Master Ingestion Pipeline & Verification Gates.
