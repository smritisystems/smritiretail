<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Barcode PRN Dynamic Field Mapping System

This plan outlines the design and implementation of an intuitive field mapping system for thermal barcode print templates. This allows non-technical users to map any standard or custom product fields from the Item Master or uploaded worksheets directly to printer script placeholders.

## 1. Objective
Implement a dynamic placeholder replacement engine in the FastAPI backend and an interactive variable insertion UI helper in the Label Printing frontend module.

---

## 2. Business Motivation
Enabling non-technical staff to easily map custom inventory attributes (like style numbers, materials, rack numbers) to ZPL/PRN template scripts eliminates the need for software code adjustments when print layout specifications change.

---

## 3. Scope
- Modify `backend/app/api/v1/barcode.py` to recursively and dynamically replace placeholders in ZPL/PRN templates using all top-level and nested product attributes.
- Modify `src/components/LabelPrintingSection.tsx` to preserve all CSV-imported headers as dynamic properties on printable items.
- Build an interactive "Placeholders Mapping Guide" in the custom script manager UI containing quick-insert click triggers for both standard item fields and dynamically parsed CSV worksheet columns.

---

## 4. Current State
- The backend replaces only a hardcoded list of variables (`{barcode}`, `{style_code}`, `{name}`, `{brand}`, `{color}`, `{size}`, `{mrp}`, `{mfg_date}`).
- The CSV parser normalizes headers and discards all columns not matching the standard `PrintableItem` schema.

---

## 5. Gap Analysis
- **Missing Dynamic Fields:** Users cannot map custom product master attributes (like `{fabric}`, `{gender}`) or custom CSV columns to the PRN script.
- **Complexity for Non-Technical Users:** Users must manually type formatting tags without an interactive variable lookup or selection list.

---

## 6. Architecture Impact
- **Database:** No schema changes required (uses existing `BarcodeLayout.elements_json` structure for templates).
- **Backend:** Dynamic replacement logic in the print execution API endpoint.
- **Frontend:** Improved CSV processing and new layout component triggers.

---

## 7. Proposed Design

### Backend Variable Replacement
In `print_labels` API call, read the incoming item payload dictionary, loop through all keys, and call `raw_stream.replace(f"{{{key}}}", str(val))` dynamically.

### Frontend UI Enhancement
Add a dynamic variable suggestion grid directly underneath the template text area:
- Core variables: `{name}`, `{code}`, `{barcode}`, `{price}`, `{mrp}`, `{size}`, `{color}`, `{brand}`, `{cost_price}`, `{sku}`, `{hsn_code}`, `{weight_grams}`.
- CSV dynamic variables: Detect imported headers and display them as clickable buttons.
- Clicking any variable inserts `{var_name}` at the cursor position inside the script textarea.

---

## 8. Files Created
None.

---

## 9. Files Modified
- `backend/app/api/v1/barcode.py`
- `src/components/LabelPrintingSection.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
No new libraries. Uses standard Python dictionary traversal and React cursor/state hooks.

---

## 11. Risks
- **Special Characters in Placeholders:** Placeholders with complex symbols might fail to replace cleanly.
  *Mitigation:* Restrict placeholder insertion to alphanumeric characters and strip brackets from insertion.

---

## 12. Rollback Strategy
Revert code changes in `barcode.py` and `LabelPrintingSection.tsx` via git.

---

## 13. Verification Plan

### Automated Tests
Run backend tests to verify print execution:
```bash
pytest backend/app/tests/test_barcode.py
```

### Manual Verification
1. Import a custom CSV with headers `Code,Name,Barcode,RackNumber,Material`.
2. Navigate to custom ZPL creation and verify that `RackNumber` and `Material` appear in the dynamic variable helper.
3. Construct a script using `{RackNumber}` and `{Material}` and verify they are correctly replaced on print runs.

---

## 14. Test Plan
Add test cases in `backend/app/tests/test_barcode.py` to validate dynamic replacement of custom attributes.

---

## 15. Documentation Impact
- Update Walkthrough.
- Register plan in index.

---

## 16. Deployment Plan
Commit and push changes to developer and test environments.

---

## 17. Status
Draft.

---

## 18. Related ADRs
None.

---

## 19. Related Walkthroughs
None.
