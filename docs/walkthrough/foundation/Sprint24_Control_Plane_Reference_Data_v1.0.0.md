---
title: "Sprint 24: P1.1 Control Plane Reference Data & Global Localization Engine"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 24 — P1.1 Control Plane Reference Data & Global Localization Engine

## 1. Purpose
This sprint fulfills **Blueprint Section 4: P1 Control Plane Completion (P1.1 Global Reference Data and Localization)**. It implements versioned control-plane registries for countries, statutory Indian GST state codes, global currencies, standard UOMs with conversion calculations, statutory tax references, HSN/SAC master search, multi-lingual dictionary resolution with English fallback, and locale-aware number/currency formatting.

## 2. Scope
- **Control Plane Reference Registries**: ISO countries, all 36 Indian states/UTs with GST codes, ISO currencies, standard UOMs, UOM conversions, statutory GST tax references, HSN/SAC codes, and platform constants.
- **Multi-Lingual Localization & Translation Dictionary**: Multi-lingual dictionary resolution for English, Hindi (`hi`), and Marathi (`mr`) with automatic English fallback for untranslated keys.
- **Locale-Aware Formatters**: Number formatting supporting Indian numbering system (Lakh/Crore: `₹ 12,34,567.89`) and International system (Million/Billion: `$ 1,234,567.89`).
- **REST APIs**: FastAPI endpoints mounted under `/api/v1/control/reference/`.
- **Database Seeding**: Master data synchronization across `smritisys`, `smriti001`, and `smriti002`.
- **Automated Verification**: Integration test suite `backend/tests/t_localization_control_plane.py` (10/10 tests green).

## 3. Files Created
- [`backend/app/schemas/localization.py`](file:///F:/SMRITRretailNX/backend/app/schemas/localization.py) — Pydantic response models and conversion request/response schemas.
- [`backend/app/services/localization_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/localization_svc.py) — `GlobalReferenceService`, `LocalizationDictionaryService`, and `LocalizationService`.
- [`backend/app/api/v1/localization.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/localization.py) — REST endpoints for reference data, UOM conversion, translations, and formatters.
- [`backend/app/db/seed_ctrl_ref.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_ctrl_ref.py) — Authoritative control-plane reference data seeder.
- [`backend/tests/t_ctrl_ref.py`](file:///F:/SMRITRretailNX/backend/tests/t_ctrl_ref.py) — 10-part verification test suite.
- [`docs/walkthrough/foundation/Sprint24_Control_Plane_Reference_Data_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint24_Control_Plane_Reference_Data_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py) — Mounted `localization.router` under `/api/v1`.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 4.1 to `DONE / VERIFIED` with Rule 11 quantitative metrics, named mechanisms, and commit citations.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 24 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.40.0`.

## 5. Architecture Decisions
- **Control-Plane Master Isolation**: All global reference data resides in the `smritisys` control plane with multi-tenant read availability.
- **Bidirectional UOM Conversion**: Supports both direct and reciprocal factor calculations with validation guards against incompatible measurement categories.
- **Locale-Aware Number System Partitioning**: Formats currency amounts according to statutory standards (e.g. `en-IN` applies 2-digit grouping for Lakhs/Crores; `en-US` applies 3-digit grouping for Thousands/Millions).
- **Graceful Translation Fallback**: Any missing or unapproved translation string defaults to the English baseline (`default_text`) without returning HTTP errors or empty strings.

## 6. Design Rationale
Statutory compliance across Indian retail networks requires authoritative GST state code resolution (e.g., `27` for Maharashtra, `29` for Karnataka) to determine tax bifurcation between CGST+SGST (intra-state) and IGST (inter-state). Consolidating reference data in the control plane eliminates hardcoded client-side dictionaries and guarantees single-source-of-truth accuracy across POS terminals, back-office portals, and B2B EDI pipelines.

## 7. Implementation Summary
- **Countries**: ISO 3166 codes (IN, US, AE, GB, SG, DE, AU, CA).
- **Indian GST Jurisdictions**: Complete directory of all 36 states/UTs with official GST 2-digit codes (`01` through `38`, `97`).
- **Currencies**: INR (`₹`), USD (`$`), EUR (`€`), GBP (`£`), AED (`د.إ`), SGD (`S$`), CAD (`C$`).
- **UOM & Conversions**: Standard retail units (`PCS`, `NOS`, `KG`, `GM`, `LTR`, `ML`, `MTR`, `BOX`, `PAC`, `DOZ`) with bidirectional conversion calculations.
- **Tax Reference Slabs**: Standard GST slabs (`GST_0`, `GST_5`, `GST_12`, `GST_18`, `GST_28`, `GST_EXEMPT`).
- **HSN & SAC Codes**: Retail catalog master with description search.
- **Languages & Locales**: Multi-lingual dictionary resolution for English, Hindi, and Marathi with fallback.
- **Platform Reference Data**: Extensible lookup categories for payment methods, invoice statuses, and order types.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python app/db/seed_control_reference.py
python -m pytest tests/t_localization_control_plane.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 10 items

tests/t_localization_control_plane.py::test_countries_endpoint PASSED    [ 10%]
tests/t_localization_control_plane.py::test_all_36_indian_states_and_gst_codes PASSED [ 20%]
tests/t_localization_control_plane.py::test_state_by_gst_code_resolution PASSED [ 30%]
tests/t_localization_control_plane.py::test_currencies_registry PASSED   [ 40%]
tests/t_localization_control_plane.py::test_uoms_and_conversions PASSED  [ 50%]
tests/t_localization_control_plane.py::test_tax_references_and_hsn_sac PASSED [ 60%]
tests/t_localization_control_plane.py::test_languages_and_locales PASSED [ 70%]
tests/t_localization_control_plane.py::test_translation_dictionary_with_fallback PASSED [ 80%]
tests/t_localization_control_plane.py::test_currency_and_number_formatting PASSED [ 90%]
tests/t_localization_control_plane.py::test_platform_reference_constants PASSED [100%]

======================= 10 passed, 8 warnings in 9.58s ========================
```

## 10. Known Limitations
- Postal code auto-complete is seeded on-demand for operational postal clusters.

## 11. Future Work
- Sprint 25: `P1.2 Capability and Module Registry` and `P1.3 Workspace, Menu, and UI Experience Registry`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-004`: Control Plane and Multi-Tenant Isolation Model

## 13. Related RFCs
- `RFC-LOC-001`: Global Localization & Multi-Lingual Architecture
