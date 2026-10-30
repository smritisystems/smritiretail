<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.2
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: PO Workspace Receiving Date Resolution Based on Vendor Bill

**Document ID:** `WGP-PROC-PO-WORKSPACE-RECV-DATE-VENDOR-BILL-v6.92.2`  
**Area:** Procurement & PO Workspace (`docs/walkthrough/procurement/`)  
**Status:** Completed  
**Version:** 6.92.2  
**Target Environments:** Local Workspace (`F:\SMRITRretailNX`) & Live Remote Instance (`https://tattlythreads.smritisys.com/`)

---

## 1. Purpose

This walkthrough documents the root-cause resolution, schema enrichment, and UI presentation hardening to dynamically resolve and display the authoritative **Receiving Date** across the Purchase Order Workspace, PO Print Preview modal, and A4 print templates based on the supplier's commercial **Vendor Bill** date.

---

## 2. Scope

- **Backend Response Schemas**:
  - `backend/app/schemas/purchase.py`: Extended `PurchaseOrderResponse` with `received_date`, `vendor_bill_date`, and `vendor_bill_no`. Added model validator resolution to auto-extract vendor bill dates and bill numbers from `rule_snapshots` or document `notes` when `delivery_date` is not explicitly set.
- **Frontend Workspace & Presentation**:
  - `src/components/purchase/POWorkspaceTab.tsx`: Updated table header from ambiguous `Delivery` to `Receiving Date` (`w-[105px]`). Formatted and displayed `po.delivery_date || po.received_date || po.vendor_bill_date`. Extended `PORow` interface.
  - `src/components/purchase/POPrintPreviewModal.tsx`: Updated `expectedDelivery` resolution to prioritize `received_date`, `vendor_bill_date`, and vendor bill date regex match.
  - `src/print_engine/templates/PurchaseOrderPrintA4.tsx`: Replaced dummy hardcoded fallback `"25 Oct 2026"` with clean dash `"—"`.
  - `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`: Replaced dummy hardcoded fallback `"05-Oct-2026"` with clean dash `"—"`.
- **Database Alignment**:
  - Local PostgreSQL: Updated `rule_snapshots` across all 28 statutory purchase orders to permanently store `delivery_date`, `received_date`, and `vendor_bill_date`.

---

## 3. Files Created

- `docs/walkthrough/procurement/PO_Workspace_Receiving_Date_Vendor_Bill_Resolution_v6.92.2.md` (this document)

---

## 4. Files Modified

1. `backend/app/schemas/purchase.py`
2. `src/components/purchase/POWorkspaceTab.tsx`
3. `src/components/purchase/POPrintPreviewModal.tsx`
4. `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
5. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
6. `docs/walkthrough/README.md`

---

## 5. Architecture Decisions

### ADR-01: Canonical Vendor Bill Receiving Date Auto-Resolution
Purchase Orders created via bulk ingestion or historical inward frequently have internal system generation timestamps (`created_at`) that differ from the actual physical vendor invoice date. Rather than requiring destructive database schema migrations or manual data entry:
1. `PurchaseOrderResponse` automatically inspects `rule_snapshots["delivery_date"]`, `rule_snapshots["received_date"]`, and `rule_snapshots["vendor_bill_date"]`.
2. If absent, it auto-extracts the canonical Vendor Bill date and number from document remarks:
   `re.search(r"dated\s+([0-9]{4}-[0-9]{2}-[0-9]{2})", self.notes)`
   `re.search(r"Vendor Bill\s+([^ |]+)", self.notes)`
3. Populates `delivery_date`, `received_date`, and `vendor_bill_date` synchronously, ensuring backward-compatible zero-drift responses.

### ADR-02: Semantic Table Column Refactoring (`Delivery` -> `Receiving Date`)
In wholesale and footwear procurement, buyers track when goods were physically received against vendor invoices. Renaming the table column to `Receiving Date` and displaying the formatted vendor bill date gives cashiers, auditors, and purchase executives immediate clarity on stock receipt dates.

---

## 6. Design Rationale

- Zero database schema migrations required (pure JSONB snapshot and schema validator enrichment).
- Backward compatible with all existing API consumers.
- Eliminated all static dummy dates (`"25 Oct 2026"`, `"05-Oct-2026"`) across print engine templates in favor of authoritative dynamic data.

---

## 7. Implementation Summary

### Date Resolution Flow:
```
PO Document Notes / Snapshots
  ("Statutory Purchase Order for Vendor Bill 463 dated 2026-07-22")
             │
             ▼
   PurchaseOrderResponse Model Validator
     • delivery_date    = "2026-07-22"
     • received_date    = "2026-07-22"
     • vendor_bill_date = "2026-07-22"
     • vendor_bill_no   = "463"
             │
             ▼
   POWorkspaceTab & POPrintPreviewModal
     • Column: "Receiving Date" -> "22 Jul 2026"
     • Printout: "Expected Delivery / Received: 22 Jul 2026"
```

---

## 8. Tests Executed

1. **Vitest Unit & Integration Suites**:
   - `src/tests/poPrintBrandingAndTerms.test.tsx` (9 tests)
   - `src/tests/poSizewiseGrouping.test.tsx` (8 tests)
   - Total: 17/17 passed (100% green).
2. **TypeScript Compiler**:
   - `npx tsc --noEmit`
3. **Architecture Duplication & CI Gate**:
   - `python scripts/architecture_duplication_gate.py` (11/11 checks passed, 0 violations).

---

## 9. Verification Results

- All 28 statutory purchase orders dynamically resolve their exact Vendor Bill dates (e.g. `2026-06-26`, `2026-07-22`, `2026-08-24`, `2026-10-05`).
- The PO Workspace table renders the `Receiving Date` column with formatted dates instead of blanks/dashes (`—`).
- Print engine templates render authentic receiving dates with zero hardcoded fallbacks.

---

## 10. Known Limitations

- For POs created without vendor bill notes or snapshots, `delivery_date` remains blank (`—`) until specified.

---

## 11. Future Work

- Add inline date picker in PO Workspace allowing managers to edit the receiving date directly from the table row.

---

## 12. Related ADRs

- ADR-0012: FastAPI + PostgreSQL sole backend architecture
- ADR-0017: Unified Ledger & Purchasing Architecture
- ADR-0065: Opening Stock Chronological Sequencing

---

## 13. Related RFCs

- RFC-2026-PO-01: Purchase Order Workspace Modernization
