<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.76.0
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal / Formal Walkthrough
-->

# Walkthrough: Purchase Order Supplier Commercial Terms Mapping & Snapshot Immutability (v6.76.0)

**Walkthrough ID:** WGP-PUR-6.76.0  
**Area:** Procurement & Purchase Order Commercials  
**Status:** Certified & Verified  
**Date:** 2026-10-14  

---

## 1. Purpose
This walkthrough documents the end-to-end design, implementation, and automated headless verification of mapping default Commercial Terms from Supplier/Vendor Master (`Party` / `SupplierProfile`) directly into the Purchase Order's `4. Other Details → Commercial Terms` section across both **Sizewise Matrix Mode** (`PoSizewiseTab.tsx`) and **Standard Mode** (`PoGenerateTab.tsx`), whilst guaranteeing snapshot immutability upon PO generation and maintaining a clean, unbloated UX for Article, Style, and Color selection.

---

## 2. Scope
1. **Master Commercial Profile Extension:**
   - Enriched Supplier Profile and Vendor Commercial Profile DTOs with Default PO Commercial Terms:
     - `payment_terms` (e.g. `30 Days`, `45 Days`, `15 Days`, `Immediate`)
     - `freight_terms` (e.g. `Paid by Supplier`, `To Pay`)
     - `currency` (e.g. `INR - Indian Rupee`, `USD - US Dollar`, `EUR - Euro`)
     - `buyer` (e.g. `Rohit Sharma (Procurement Lead)`)
     - `department` (e.g. `Footwear & Leather`)
     - `special_instructions` (e.g. `Fragile footwear, palletized shipment`)
2. **Purchase Order Auto-Mapping & Refreshes:**
   - Auto-filling terms when selecting a vendor in both Sizewise and Standard PO modes.
   - Fallback to established defaults (`30 Days`, `Paid by Supplier`, `INR - Indian Rupee`) if supplier values are empty.
   - Changing supplier dynamically refreshes commercial terms while preserving existing line items, quantities, and user-entered `supplier_reference`.
   - PO-level inline editing of all commercial terms.
3. **Snapshot Immutability (System-of-Record):**
   - Freezing commercial terms upon saving into `purchase_orders.rule_snapshots["commercial_terms"]`.
   - On recall or edit, restoring commercial terms from the frozen snapshot rather than current Supplier Master state.
4. **Clean UX Invariant:**
   - Strict preservation of the minimalist Article, Style, and Color layout with zero extraneous panels, accordions, or bloat.

---

## 3. Files Created
- `docs/walkthrough/purchase/Purchase_Order_Supplier_Commercial_Terms_Mapping_v6.76.0.md` — This formal walkthrough document.
- `scripts/verify_po_commercial_terms_mapping_headless.py` — Automated headless Playwright verification test suite with 10 validation checkpoints.
- `docs/walkthrough/purchase/evidence/01_po_sizewise_commercial_terms_populated.png` — Evidence of Sizewise auto-population.
- `docs/walkthrough/purchase/evidence/02_po_sizewise_supplier_changed_terms_refreshed.png` — Evidence of dynamic refresh & line retention on supplier change.
- `docs/walkthrough/purchase/evidence/03_po_sizewise_saved_po_snapshot.png` — Evidence of committed PO snapshot.
- `docs/walkthrough/purchase/evidence/04_po_recalled_frozen_commercial_terms.png` — Evidence of recalled immutable terms.
- `docs/walkthrough/purchase/evidence/05_po_standard_commercial_terms_populated.png` — Evidence of Standard Mode auto-population & vendor change guard.
- `docs/walkthrough/purchase/evidence/06_po_clean_article_style_color_interface.png` — Evidence of clean, unbloated matrix interface.

---

## 4. Files Modified
- `backend/app/schemas/purchase.py`: Added commercial terms fields and dictionary object to `SupplierResponse`; added Pydantic field validator to `PurchaseOrderResponse`.
- `backend/app/schemas/vendor.py`: Added `payment_terms`, `freight_terms`, `currency`, `buyer`, `department`, `special_instructions` to `VendorCommercialProfileDTO`.
- `backend/app/services/purchase.py`: Joined `parties` with `supplier_profiles` to fetch terms in `list_suppliers()`; persisted `commercial_terms` into `rule_snapshots["commercial_terms"]` in `create_purchase_order` and `update_purchase_order`.
- `backend/app/services/vendor_svc.py`: Persisted PO commercial terms into `party.metadata_json["commercial_terms"]` in `update_commercial_profile` and loaded them in `get_commercial_profile`.
- `src/types/vendor.ts`: Added commercial terms fields to `VendorCommercialProfile` TypeScript interface.
- `src/components/vendor/tabs/VendorCommercialTab.tsx`: Added Default Purchase Order Commercial Terms card in Vendor 360 Commercial tab.
- `src/components/purchase/PoSizewiseTab.tsx`: Added auto-mapping in `SupplierSelect.onChange`, persisted snapshot in `handleSavePO`, restored frozen snapshot in `loadPOForEditing()`, and assigned testing DOM IDs.
- `src/components/purchase/PoGenerateTab.tsx`: Added commercial terms hydration in `suppliersList` and `handleVendorChangeRequest` / `handleVendorChangeConfirmed`, and assigned testing DOM IDs.
- `docs/walkthrough/README.md`: Updated master index table with entry `v6.76.0`.

---

## 5. Architecture Decisions
1. **Rule Snapshots Immutability Pattern:**
   In compliance with SMRITI statutory audit governance, agreed commercial terms on an issued Purchase Order cannot change retroactively if a vendor changes payment credit policies in Master Data later. Commercial terms are serialized into `purchase_orders.rule_snapshots["commercial_terms"]` on save and rehydrated verbatim when recalling.
2. **Supplier Reference Independence:**
   The `supplierReference` / quotation number represents a transaction-specific external document number. It is never populated from Supplier Master and is permanently preserved when switching suppliers.
3. **Dual-Mode Consistency:**
   Both Sizewise Horizontal Matrix mode (`PoSizewiseTab`) and Standard Barcode Item mode (`PoGenerateTab`) share the identical underlying commercial terms model and API synchronization contracts.

---

## 6. Design Rationale
- **Non-Invasive UI:** Commercial terms are housed cleanly inside `4. Other Details → Commercial Terms` in Sizewise mode and Cards 3 & 4 in Standard mode. The primary line item and matrix entry screens remain completely unencumbered by peripheral commercial metadata.
- **Defensive Fallbacks:** If a supplier profile has undefined or null terms, robust fallbacks prevent blank or unselectable form inputs, ensuring immediate readiness for checkout.

---

## 7. Implementation Summary
- **Backend API:** Updated `GET /api/v1/purchase/suppliers` to query both `parties.metadata_json` and `supplier_profiles` to return unified `commercial_terms` objects. Updated `POST /api/v1/purchase/orders/` and `PUT /api/v1/purchase/orders/{id}` to store `commercial_terms` in `rule_snapshots`.
- **Frontend Master Setup:** In `VendorCommercialTab.tsx`, vendors can configure standard payment days, freight arrangements, preferred currency, dedicated buyer/agent, department code, and packaging instructions.
- **Frontend PO Execution:** In `PoSizewiseTab.tsx` and `PoGenerateTab.tsx`, selecting a vendor maps these fields immediately, while allowing buyer overrides. On save, the terms are sealed into the PO record.

---

## 8. Tests Executed
1. **Unit & Linter Suite:**
   - Command: `npm run lint` (`tsc --noEmit`)
   - Result: 0 errors, exit code 0.
2. **Headless Playwright Automated Test Suite:**
   - Script: `scripts/verify_po_commercial_terms_mapping_headless.py`
   - Mode: Fully headless (`headless=True`), zero GUI popups.
   - Terminal Execution: Exit code 0, 10/10 verification checks green.

---

## 9. Verification Results

| Check # | Phase / Feature Checked | Expected Value | Observed Result | Status |
|:---:|:---|:---|:---|:---:|
| 1 | Auth & Environment | LocalStorage pre-seeded | Token acquired, domain accessible | Done |
| 2 | Sizewise Mode Initialization | `#po-mode-sizewise-btn` active | Sizewise Tab mounted | Done |
| 3 & 4 | Sizewise Supplier Auto-Population | Terms populated for `V-TATTLY` | 45 Days, To Pay, USD, Rohit Sharma, Footwear & Leather | Done |
| 5 & 5b | Supplier Change & Line Retention | Article `SH-03-I`, Size 40 Qty 10 preserved | Line items & Qty 100% retained | Done |
| 6 | Sizewise Terms Refresh | Terms refreshed for `SUP-136093` | 30 Days, Paid by Supplier, INR | Done |
| 7 | PO Save & Snapshot Seal | Snapshot in `rule_snapshots` | Saved PO `PO-978764` | Done |
| 8 | Recalled PO Immutability | Recalled terms match saved snapshot | 30 Days, Paid by Supplier, QUOT-2026-9901 | Done |
| 9 | Standard Mode Mapping & Vendor Guard | Vendor change guard & auto-population | 45 Days, To Pay, USD, Rohit Sharma | Done |
| 10 | Clean UX Invariant | Unbloated Article, Style, Color fields | Simple matrix `#sw-items-grid` preserved | Done |

---

## 10. Known Limitations
- Offline mode (`ProPosOfflineSyncEngine`) caches default terms from last known catalog sync; real-time supplier master updates made while offline sync only upon network reconnection.

---

## 11. Future Work
- Add statutory E-Way Bill transporter ID and GST distance auto-calculation into the Freight Terms drawer.

---

## 12. Related ADRs
- `ADR-042`: System Parameter Dual-Key Governance Architecture.
- `ADR-019`: Transaction Rule Snapshotting & Immutability Contract.

---

## 13. Related RFCs
- `RFC-2026-08`: Purchase Order Workflow and Vendor Commercial Terms Alignment.
