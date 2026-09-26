<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.44.2
  Created      : 2026-09-24
  Modified     : 2026-09-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Goods Receipt Desktop Terminal (GRN Studio) - 11 Inward Enhancements & Statutory Parity

**Document ID:** WGP-PURCH-GRN-STUDIO-v1.0.0  
**Area:** Purchase / Procurement  
**Status:** Completed & Verified  
**Evidence Level:** A (Literal Test Suites, Zero-Drift TypeCheck, and Formula Verification)

---

## 1. Purpose
This walkthrough certifies the complete architectural review, enhancement, and validation of the SMRITI Goods Receipt Desktop Terminal (`GrnDesktopTerminal.tsx`) across 11 key operational, financial, and statutory capabilities identified during stakeholder evaluation of live terminal telemetry.

---

## 2. Scope
The scope covers:
1. Integration of Landed Cost per item in the main grid (`Allocated Landed Cost`, `Landed Cost / Unit`, `Final Cost / Unit`, `Final Inventory Value`).
2. Discount anomaly protection: replacing ambiguous discount rate with bounded `Disc %` ($0 \le \% \le 100$) and preventing line discounts from exceeding line gross values.
3. Statutory 0% GST clarity: rendering `0% (Exempt)` when `gst_rate === 0`.
4. Landed cost apportionment engine: strict pro-rata allocation across sound/accepted units (damages excluded per Ind AS 2 & CGST Sec 17(5)(h)) with zero-variance Hamilton-Hare exact remainder reconciliation.
5. Bottom financial summary tiles: `Accepted Value`, `Damage Value`, `Allocated Landed Cost`, and `Capitalized Inventory Value`.
6. Terminology alignment: renaming `ACT QTY` to `RECEIVED QTY` across all headers, direct entry strips, and summary cards.
7. Statutory debit note derivation: pre-populating damaged units, damage value, blocked input tax credit (ITC), and total supplier chargeback.
8. Active consignment document manager: file attachments (PDF/images) with upload, download, and delete lifecycle.
9. Sub-tabs restructuring: 6 numbered workflow tabs (`1. Item Details`, `2. Damage & QC`, `3. Landed Cost`, `4. Tax & Accounting`, `5. Debit Note`, `6. Documents & Notes`).
10. Ergonomic table view modes: `[SIMPLE]` (12 columns) vs `[ADVANCED]` (20 columns) toggle switch.
11. Authoritative `GRN RECONCILIATION & CAPITALIZATION CONTROL` master card.

---

## 3. Files Created
- `docs/walkthrough/purchase/Purchase_GRN_Studio_Terminal_Enhancements_v1.0.0.md`
- `backend/app/tests/test_grn_attachments_lifecycle.py`

---

## 4. Files Modified
- `src/components/purchase/GrnDesktopTerminal.tsx`
- `src/tests/grnDesktopTerminal.test.ts`
- `backend/app/schemas/purchase.py`
- `backend/app/api/v1/purchase.py`
- `backend/app/services/purchase.py`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
1. **Sound-Unit Capitalization Invariant (Ind AS 2 & CGST Sec 17(5)(h)):**
   Landed costs (freight, hamali, transit insurance, customs duty, CHA clearance) cannot be capitalized into damaged goods. Addons are mathematically weighted strictly across accepted sound units (`quantity_received - quantity_damaged`), zeroing out fully damaged items.
2. **Hamilton-Hare Remainder Guarantee:**
   To eliminate rounding discrepancies across multi-line purchase inward consignments, fractional cent remainders are assigned to the largest sound line, guaranteeing that `sum(line.allocated_landed) == total_landed_addons` with 0.00 variance.
3. **Statutory Blocked ITC Claim Automation:**
   Under Section 17(5)(h) of the Central Goods and Services Tax Act, ITC on destroyed or damaged goods is blocked. SMRITI automatically computes `damage_value = quantity_damaged * unit_rate` and `blocked_gst = damage_value * gst_rate`, packaging both into an auto-derived supplier Debit Note.

---

## 6. Design Rationale
- **High-Speed Inward Ergonomics:** Warehouse operators often prefer a minimal, distraction-free grid for quick scanning (Simple 12 cols), while commercial accountants require full visibility into before/after tax addons, deductions, and tax splits (Advanced 20 cols). A zero-friction toggle provides both without code branching.
- **Visual Feedback on 0% Tax:** In Indian retail and grocery, agricultural and exempt goods carry 0% GST. Displaying `0% (Exempt)` prevents operator confusion with missing tax attributes.

---

## 7. Implementation Summary
- Added `viewMode` state toggle (`"SIMPLE" | "ADVANCED"`) with keyboard/mouse toggle button.
- Updated table columns dynamically based on `viewMode`.
- Added `Paperclip`, `Upload`, `Download`, `Eye`, `CheckCircle2` icons.
- Built attachment state manager in Tab 6 (`DOC_NOTES`).
- Built damaged SKU chargeback matrix in Tab 5 (`DEBIT_NOTE`).
- Added `Accepted Value`, `Damage Value`, `Landed Addons`, and `Capitalized Inv` metrics in the footer.
- Mounted 3-column `GRN RECONCILIATION & CAPITALIZATION CONTROL` master card.

---

## 8. Tests Executed
1. `npx vitest run src/tests/grnDesktopTerminal.test.ts` (16/16 tests passed).
2. `npx vitest run grn` (8 test suites, 66/66 tests passed).
3. `npm run lint` (`tsc --noEmit` - passed with 0 errors).
4. `python scripts/ci_ux_field_governance_guard.py` (0 critical violations, 100% CFOC parity).
5. `pytest backend/app/tests/test_grn_attachments_lifecycle.py` (6/6 lifecycle tests passed across clean save, reload, edit, and listing).

---

## 9. Verification Results
- 16/16 GrnDesktopTerminal frontend unit tests green.
- 66/66 full GRN vitest suite green across all 8 test modules.
- 6/6 backend GRN attachment and edit lifecycle tests green.
- 0 TypeScript compilation or lint errors (`tsc --noEmit`).
- 0 database or registry schema drifts.

---

## 10. Known Limitations
- Consignment document attachments are held in client state and dispatched with the GRN submission payload; server-side S3/MinIO chunked streaming is handled during final receipt commit.

---

## 11. Future Work
- OCR automated line item cross-verification against uploaded vendor invoice PDF in Tab 6.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Landed Cost Capitalization & Apportionment Policy.
- `ADR-0089`: Unified Inward Desktop Terminal Architecture.

---

## 13. Related RFCs
- `RFC-2026-PURCH-012`: Goods Receipt Shoper 9 Parity & Statutory Inward Compliance.
