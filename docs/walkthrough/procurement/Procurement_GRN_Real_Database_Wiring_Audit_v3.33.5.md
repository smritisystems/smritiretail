# Walkthrough: Procurement Goods Receipt Note (GRN) Live Database Wiring Audit & Mock Data Eradication

**Version:** 3.33.5  
**Area:** Procurement (`PURCHASE` / `GRN_RECEIPT`)  
**Date:** 2026-09-20  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Internal Governance & Verification  

---

## 1. Purpose
Conduct an exhaustive forensic audit of the Goods Receipt Note (GRN) subsystem across frontend (`GrnReceiptTab.tsx`), backend (`backend/app/api/v1/purchase.py`, `backend/app/services/purchase.py`), and PostgreSQL database (`smritisys` control-plane and `smriti001` tenant business database). Eradicate 100% of hardcoded mockups, placeholders, sample lines, and dummy fallbacks, and wire every single GRN operational element directly into real live database records and FastAPI endpoints.

---

## 2. Scope
- **Frontend Subsystem:** `src/components/purchase/GrnReceiptTab.tsx`.
- **Backend Service Layer:** `backend/app/services/purchase.py`.
- **Database Scope:** PostgreSQL server (`localhost:5432`), tenant database `smriti001`, and control plane `smritisys`.
- **Verification Tests:** Automated live end-to-end Python database audit script (`scripts/verify_grn_real_database_wiring.py`), Vitest suites (`grnBarcodeScanner.test.ts`, `grnCsvImportEngine.test.ts`), and Architecture Duplication Gate (`scripts/architecture_duplication_gate.py`).

---

## 3. Files Created
- `scripts/verify_grn_real_database_wiring.py` — Live end-to-end integration test validating PO querying, live inward cost types, GRN HTTP 201 posting, direct PostgreSQL row inspection across `purchase_receipts`, `purchase_receipt_items`, `inward_cost_components`, and `stock_movements`, and API retrieval.
- `scripts/inspect_live_purchase_data.py` — Diagnostics script for live tenant token generation and inspection.
- `docs/walkthrough/procurement/Procurement_GRN_Real_Database_Wiring_Audit_v3.33.5.md` — This governance walkthrough document.

---

## 4. Files Modified
- `src/components/purchase/GrnReceiptTab.tsx` — Eradicated `DEFAULT_SAMPLE_LINES` and `DEFAULT_SAMPLE_COST_COMPONENTS`, replaced dummy Footwear Demo button with live "Inward Latest Open PO", converted attachments to a live interactive multi-file uploader, dynamic document sequence generator, and enforced strict database supplier foreign key validation.
- `backend/app/services/purchase.py` — Enhanced `_get_product` query to resolve items seamlessly by `Product.id`, `Product.code`, `Product.sku`, and `Product.barcode`.
- `CHANGELOG.md` — Added `[6.43.4] - 2026-09-20` release entry.
- `docs/walkthrough/README.md` — Appended chronological master index entry.

---

## 5. Architecture Decisions
- **ADR-GRN-001 (Zero-Mockup Strict Policy):** Prohibited any fallback to artificial strings (`ABC Footwear`, `SUP-001`, `SUP-DIRECT`, `VT-982142`). All entities must reference real records in PostgreSQL (`suppliers`, `purchase_orders`, `products`).
- **ADR-GRN-002 (Multi-Identifier Master Resolution):** Product resolution in `_get_product` expanded to accept `id`, `code`, `sku`, or `barcode` to ensure seamless catalog matching across barcode scanners, CSV imports, and PO lines without ID discrepancies.
- **ADR-GRN-003 (Tenant Isolation Guarantee):** GRN transactional data, landed costs, and WMS inventory stock movements reside exclusively in the resolved company database (`smriti001`), preserving `smritisys` strictly as control-plane.

---

## 6. Design Rationale
- **Dynamic GRN Sequencing:** Generating `GRN-YYYYMMDD-XXXX` dynamically prevents accidental duplicate key collisions during high-throughput dock receiving.
- **Interactive File Upload:** Enabling real drag-and-drop file attachment handling allows dock operators to attach real bill-of-lading scans and lorry receipts directly to the GRN before posting.
- **Immediate Landed Cost Valuation:** Inward expenses (freight, handling) update `stock_movements.unit_cost` automatically in PostgreSQL to ensure real-time GAAP/Ind-AS 2 inventory balance valuation.

---

## 7. Implementation Summary
1. Audited all references in `GrnReceiptTab.tsx` and removed 100% of hardcoded sample lines (`DEFAULT_SAMPLE_LINES`, `DEFAULT_SAMPLE_COST_COMPONENTS`).
2. Replaced "Load Footwear Demo" action with `handleInwardLatestOpenPo` which queries `/purchase/orders/` in real-time.
3. Implemented stateful `attachments` state array with file type, size in KB, deletion handler, and drag-and-drop file drop handler.
4. Strengthened `handleSubmitGRN` to enforce supplier presence from the database before submission.
5. Enhanced `backend/app/services/purchase.py` `_get_product` to match `Product.sku` and `Product.barcode`.
6. Verified production build and Docker container startup.

---

## 8. Tests Executed
1. `python scripts/verify_grn_real_database_wiring.py`
2. `npx vitest run src/tests/grnBarcodeScanner.test.ts src/tests/grnCsvImportEngine.test.ts`
3. `python scripts/architecture_duplication_gate.py`
4. `npm run build`

---

## 9. Verification Results
- **Live Database E2E Test:** 100% PASS. Posted real GRN `GRN-AUDIT-20260920090729` against confirmed PO `PO13-65` (Supplier `sup-v-00j`). Verified PostgreSQL rows in `purchase_receipts`, `purchase_receipt_items`, `inward_cost_components`, and `stock_movements` (Unit Cost Rs 320.00 reflecting Rs 120 base + Rs 200 landed freight/handling).
- **Vitest Suites:** 2/2 test files passed, 9/9 tests passed.
- **Architecture Duplication Gate:** 11/11 checks passed (0 P0/P1 violations, 0 registered debt).
- **TypeScript Production Build:** 3584 modules transformed, 0 errors, built in 43.51s.

---

## 10. Known Limitations
- Camera barcode scanning depends on client browser support for HTML5 `BarcodeDetector` API; fallback manual wedge scanning is active for environments without native barcode detector.

---

## 11. Future Work
- Direct S3/MinIO attachment persistence for uploaded lorry receipts and vendor invoice PDFs.
- Automated two-way Purchase Bill matching against posted GRN records.

---

## 12. Related ADRs
- `ADR-0019`: Multi-Tenant Dual-Database Router Architecture (`smritisys` vs `smriti001`).
- `ADR-0042`: Ind-AS 2 Inventory Valuation & Inward Landed Cost Component Engine.

---

## 13. Related RFCs
- `RFC-2026-081`: Real-Time WMS Inward Goods Receiving Architecture.
- `RFC-2026-094`: Physical Barcode & PDT CSV Reconciled Inward Protocol.
