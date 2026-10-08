<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.47.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Dynamic Client PRN Barcode Label Engine & Footwear 3-Stub Template

## 1. Objective
Transform the client-supplied static `.PRN` barcode stream (`smriti_barcodes_2026-10-08.prn`) into an authoritative, dynamically rendered ZPL label template (`lay-footwear-100x50-3stub`) within SMRITI Retail OS. Preserve 100% of the client's physical layout geometry, reverse white-on-black blocks, fonts, and dual tear-off stub architecture while binding all printed variables directly to PostgreSQL canonical Item Master records (`items`, `item_variants`, `item_barcodes`).

## 2. Business Motivation
Retail footwear operations require specialized 3-part hang tags / shoe box labels consisting of a primary box label and two perforated tear-off counter/inventory control stubs. Previously, client PRNs were static printer dumps or simulated by synthetic backend strings that deviated from the client's actual printer stream. This implementation guarantees that production labels printed via Zebra direct thermal/thermal transfer printers match the exact physical label approved by the client, with zero hardcoding.

## 3. Scope
- **In Scope:**
  - Registration of `lay-footwear-100x50-3stub` (100mm × 50.7mm, 203 DPI) in `backend/app/api/v1/barcode.py`.
  - Byte-for-byte preservation of client PRN ZPL geometry, graphic boxes (`^GB`), lines, and fonts (`^A0`, `^AA`, `^AB`, `^AD`).
  - Dynamic placeholder substitution for Barcode (`^BC`), Human-Readable Digits, Article No (`^FR`), Color, Size (`^FR`), MRP (`/-`), Mfg Date (`MM/YY`), Brand, and Legal Metrology marketer info.
  - Right-padding logic for Article No (14 characters) to fill the 284-dot solid black box cleanly in reverse print.
  - Multi-label concatenation format supporting batch runs with XPML driver framing.
  - Frontend integration in `PrintLabelsStudio.tsx` with layout selection and deterministic 3-zone visual SVG preview.
  - Pytest automated test suite verifying exact ZPL token compliance against all 12 variants of Article `CH-30-K`.
- **Out of Scope:**
  - Altering the physical dimensions, margins, or barcode heights defined in the client PRN.
  - Modifying underlying database schema or table structures.

## 4. Current State
- `backend/app/api/v1/barcode.py` contains a legacy `lay-premium-zpl` template that uses rotated vertical barcodes (`^BCB`), incorrect box coordinates, and dummy placeholder text (`contact@yourstore.com`).
- `PrintLabelsStudio.tsx` only offers standard single-box layouts (`retail-50x25`, `thermal-40x20`, `hang-tag-50x80`) without support for 100x50mm multi-stub footwear tags.
- Client PRN `smriti_barcodes_2026-10-08.prn` exists as an unlinked static file in `assets/BarcodePRN/`.

## 5. Gap Analysis
1. **ZPL Geometry Drift:** Legacy backend used vertical barcode rotation; client PRN uses horizontal Code 128 (`^BCN,66` on main, `^BCN,30` on stubs).
2. **Reverse Box Formatting:** Article No and Size require reverse-print (`^FR`) over solid black rectangles (`^GB`), requiring exact padding so white text remains centered.
3. **Legal Metrology Authority:** Marketer address and support email were hardcoded in code; they must resolve dynamically from `SystemConfig` / tenant settings with graceful fallbacks.
4. **Studio Visualization:** Studio had no 3-zone SVG preview reflecting the tear-off stub perforations.

## 6. Architecture Impact
- **Backend:** `backend/app/api/v1/barcode.py` replaces hardcoded templates with the canonical `lay-footwear-100x50-3stub` renderer.
- **Frontend:** `src/components/barcode/PrintLabelsStudio.tsx` exposes the 100x50mm template and updates SVG preview rendering.
- **Zero Schema Changes:** Uses existing `items`, `item_variants`, `item_barcodes`, `companies`, and `system_configs` tables.

## 7. Proposed Design
1. **Canonical Template Constant (`ZPL_FOOTWEAR_3STUB_TEMPLATE`):**
   A parameterized ZPL string preserving every byte of `smriti_barcodes_2026-10-08.prn` with standardized placeholders:
   `{barcode}`, `{art_no}`, `{art_no_padded}`, `{size}`, `{color}`, `{mrp}`, `{mfg_date}`, `{brand}`, `{company_name}`, `{address}`, `{email}`, `{net_contents}`, `{qty}`.
2. **Dynamic Generation Pipeline:**
   - Resolve `company_id` and tenant settings.
   - For each item in print request:
     - Truncate `.00` from MRP: `1199.00` → `1199`.
     - Pad Article No: `CH-30-K` → `CH-30-K     `.
     - Format Mfg Date: `MM/YY` → `MFG.Dt.:10/26`.
     - Substitute placeholders into format block.
   - Wrap format blocks in XPML driver tags for seamless raw printer spooling.

## 8. Files Created
- `docs/implementation/inventory/Barcode_ClientPRN_DynamicMapping_And_Template_Plan_v6.47.0.md`
- `docs/walkthrough/barcode/Barcode_ClientPRN_DynamicMapping_And_Template_v6.47.0.md`
- `backend/app/tests/test_barcode_client_prn_dynamic.py`

## 9. Files Modified
- `backend/app/api/v1/barcode.py`
- `src/components/barcode/PrintLabelsStudio.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI + PostgreSQL backend.
- React 18 + Vite frontend.
- Zebra Programming Language II (ZPL II) thermal printing subsystem.

## 11. Risks
- **Risk:** Variations in Article Code string length exceeding 14 characters could overflow the 284-dot reverse box.
  - **Mitigation:** Implement safe truncation / auto-fit check so strings > 14 chars fit the bounding box without breaking reverse print.
- **Risk:** Null attributes for non-variant items.
  - **Mitigation:** Fallback logic provides sensible defaults (`FS` for size, blank for color, Item Code for article).

## 12. Rollback Strategy
Git revert commit to restore previous `barcode.py` and `PrintLabelsStudio.tsx` states. Database is untouched, ensuring zero data risk.

## 13. Verification Plan
- Column-by-column diff against client PRN.
- Test all 12 variants of `CH-30-K` against live PostgreSQL tenant `smriti001`.
- Verify ZPL token syntax using regex and string comparator.

## 14. Test Plan
- Run `pytest backend/app/tests/test_barcode_client_prn_dynamic.py -v`.
- Run frontend linter / TypeScript checks.

## 15. Documentation Impact
- Update Walkthrough Index and Master Implementation Index.
- Update `CHANGELOG.md` with version 6.47.0 release notes.

## 16. Deployment Plan
- Commit and push to repository branch `smritiNX`.
- Deploy to test environment via standard git pull.

## 17. Status
Approved — In Execution.

## 18. Related ADRs
- `ADR-0021`: Canonical Item Master & Variant Attribute Hierarchy.
- `ADR-0034`: ZPL Thermal Label Stream Generation & Raw Dispatch.

## 19. Related Walkthroughs
- `Barcode_PrintLabelsStudio_RemoteIntake_And_LegacyRetirement_v6.46.2.md`
- `Barcode_ClientPRN_DynamicMapping_And_Template_v6.47.0.md`
