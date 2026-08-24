<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Barcode PRN Dynamic Field Mapping System — v3.16.0

## 1. Purpose
This walkthrough documents the creation and verification of a dynamic field mapping system for ZPL/PRN barcode printing. This enables non-technical operators to map custom product parameters or pasted CSV worksheet columns directly to print variables.

---

## 2. Scope
- Modify the FastAPI print API endpoint to recursively replace ZPL/PRN template placeholders using all top-level and nested product fields.
- Modify the React frontend CSV parsing module to preserve all raw columns inside the printable item state.
- Create an interactive placeholders mapping guide that dynamically renders standard product properties and pasted worksheet column headers as clickable badges.
- Click triggers insert the correct placeholder syntax (e.g., `{custom_attribute}`) directly at the user's cursor within the PRN template input textarea.
- Implement an option to generate and download the ZPL/PRN command script directly as a `.prn` file on the client's browser.

---

## 3. Files Created
- `docs/implementation/foundation/Barcode_PRN_Dynamic_Field_Mapping_Plan_v3.16.0.md` (Implementation plan)
- `docs/walkthrough/foundation/Foundation_Barcode_PRN_Dynamic_Field_Mapping_v3.16.0.md` (This file)

---

## 4. Files Modified
- `backend/app/api/v1/barcode.py`
- `backend/app/schemas/barcode.py`
- `src/components/LabelPrintingSection.tsx`
- `backend/app/tests/test_barcode.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 5. Architecture Decisions
- **Traversable Attribute Injection:** Traverses and flattens all dictionary keys in the payload to make them available as placeholders.
- **Failsafe Placeholder Normalization:** Normalized column keys (lowercase and stripped of spaces) are registered alongside the original header case, allowing flexible mappings like `{Brand Name}` or `{brandname}`.
- **Cursor Selection Injection:** React refs/DOM triggers inspect the cursor index (`selectionStart`/`selectionEnd`) to drop the placeholder directly where the operator is typing.

---

## 6. Design Rationale
Custom ZPL layout coordinates are often loaded from preconfigured PRN templates supplied by thermal label printer manufacturers. Giving users the ability to map arbitrary fields by clicking badges prevents the need for manual script typing or developer code modifications.

---

## 7. Implementation Summary
1. **Backend Integration:** Replaced the static replace chain in `print_labels` API with dynamic loops traversing top-level keys and nested product attributes.
2. **CSV Parser Enhancement:** Updated `parseCsv` in the React frontend to map all original headers to dynamic item keys.
3. **UI Variables Grid:** Added an interactive "Click variables to map" layout under the text area displaying standard fields and dynamic CSV headers.
4. **Unit Tests Extension:** Added `test_print_labels_dynamic_placeholder_replacement` validating dynamic mapping coverage.
5. **PRN Script Download Option:** Extended the API print request schema with a `saveAsPrn` boolean flag. When enabled, the backend skips socket communication and returns the compiled ZPL command string directly. The frontend triggers a client-side `.prn` file download.

---

## 8. Tests Executed
```bash
$env:JWT_SECRET_KEY="9a12c418-5a48-43d9-90b5-555a6d71b87a"; $env:SGIP_VAULT_MASTER_KEY="sgip_vault_master_secret_key_12345"; & .venv\Scripts\python.exe -m pytest backend/app/tests/test_barcode.py
# Output:
# ============================= test session starts =============================
# platform win32 -- Python 3.11.6, pytest-8.2.1, pluggy-1.6.0
# rootdir: D:\IMP\GitHub\SMRITRretailNX\backend
# configfile: pyproject.toml
# plugins: anyio-4.14.2, asyncio-0.23.7, cov-5.0.0
# asyncio: mode=Mode.AUTO
# collected 3 items
# 
# backend\app\tests\test_barcode.py ...                                    [100%]
# ======================= 3 passed, 23 warnings in 14.37s =======================
```

---

## 9. Verification Results
- **Prerequisites scanning:** Done (Properly scans Git, Node, Python, and Docker).
- **Placeholder replacement:** Done (Custom placeholder variables replace correctly without raising schema failures).
- **User mapping triggers:** Done (Clicking standard or custom CSV variable pills correctly injects corresponding tags into the layout script).

---

## 10. Known Limitations
None.

---

## 11. Future Work
- Implement visual schema mappings validation before dispatching print queues.

---

## 12. Related ADRs
None.

---

## 13. Related RFCs
None.
