<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.45.4
  * Created    : 2026-09-26
  * Modified   : 2026-09-26
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough — Sales Orders URL Parameter Sanitization, Document Inspection Hardening & Navigation Aliases

**Version:** 6.45.4  
**Date:** 2026-09-26  
**Status:** Completed & Verified  
**Area:** Sales & Billing Infrastructure  

---

## 1. Purpose
Resolve runtime browser console HTTP 400 Bad Request errors (`/api/v1/sales/orders/:1 Failed to load resource: the server responded with a status of 400 ()`) by hardening universal client-side URL parameter sanitization in `apiFetchV1`, protecting order lookup endpoints against colon-prefixed parameters, correctly discriminating between Customer Purchase Orders and Sales Orders during document inspection in `BillingTerm`, and establishing top-level shell navigation aliases for Credit Billing.

---

## 2. Scope
- Universal client API fetch sanitization in `src/lib/apiFetchV1.ts`.
- Document inspection and schema line mapping in `src/components/billing/BillingTerm.tsx`.
- Direct tab router aliasing for Credit Billing in `src/components/shell/TabRenderer.tsx`.
- Order preview and conversion hardening in `src/components/ReportDesignerTab.tsx`.
- Order recall hardening in `src/components/sales/SalesOrderFormPremium.tsx`.
- Line item update hardening in `src/components/SalesStudioTab.tsx`.

---

## 3. Files Created
- `docs/walkthrough/sales/Sales_Orders_Url_Param_Sanitization_And_Navigation_Aliases_v6.45.4.md` — This official WGP walkthrough document.

---

## 4. Files Modified
- `src/lib/apiFetchV1.ts` — Added path segment colon sanitization (`.replace(/\/:(?=[a-zA-Z0-9_-]+)/g, "/")`) to eliminate accidental Express-style parameter tokens from outgoing requests.
- `src/components/billing/BillingTerm.tsx` — Hardened `handleSelectDocumentFromBrowser` to clean IDs, discriminate Customer POs (`po_number && !order_no`) from Sales Orders, route to `/sales/customer-pos/${id}`, and parse lines from both `items` and `lines`.
- `src/components/shell/TabRenderer.tsx` — Registered direct navigation cases for `credit-billing` and `credit-sale` routing to `BillingWorkspace` with `initialView="CREDIT_BILLING"`.
- `src/components/ReportDesignerTab.tsx` — Sanitized `orderId` in `handleConvertToInvoice` and `handlePreviewSO` using `.replace(/^:/, "").trim()` and URL component encoding.
- `src/components/sales/SalesOrderFormPremium.tsx` — Sanitized `transactionId` in `handleRecall`.
- `src/components/SalesStudioTab.tsx` — Sanitized `selectedOrder.id` and `line.id` in `handleSalesOrderLineAction`.

---

## 5. Architecture Decisions
- **Universal Gateway Cleansing:** In Express/REST documentation, parameters are denoted with leading colons (`:id`). In HTTP URLs, path segments should never start with a colon. Sanitizing `cleanEndpoint` inside `apiFetchV1` ensures that accidental parameter token leakage never reaches the FastAPI backend or reverse proxy.
- **Entity Identity Discrimination:** In `InvoicingTransactionBrowserModal`, the "ORDERS" tab lists both finalized Sales Orders (`/sales/orders`) and Customer Purchase Orders (`/sales/customer-pos?status=ALL`). `BillingTerm` must identify when an inspected document is a PO versus a Sales Order and invoke the respective authoritative backend service.

---

## 6. Design Rationale
- **Zero Ambiguity for End Users:** SMRITI Human-Readable Error Policy (HREP) mandates that users should never see raw server errors. Preventing malformed requests pre-flight stops 400 Bad Request console errors before network dispatch.
- **Fail-Safe Line Parsing:** Customer POs carry line items in `doc.lines` with fields `quantity_ordered` and `unit_price`, whereas Sales Orders use `doc.items` with `quantity` and `price`. Normalizing mapping across both schemas guarantees consistent read-only audit inspection.

---

## 7. Implementation Summary
1. **URL Path Sanitization in `apiFetchV1`:** Added regex normalization rule stripping colons at the start of path segments.
2. **Tab Router Credit Aliases:** Added `case "credit-billing":` and `case "credit-sale":` in `renderTabNode` of `TabRenderer.tsx`.
3. **Billing Terminal Audit Mode:** Updated `BillingTerm.tsx` document inspection to support both PO and SO endpoints with safe ID encoding.
4. **Studio & Form Hardening:** Guarded all single-order fetch sites against undefined, empty, or colon-prefixed identifiers.

---

## 8. Tests Executed
```bash
# 1. Full TypeScript compile check
npx tsc --noEmit
# Exit code: 0, Errors: 0

# 2. Billing terminal regression test suite
npm test -- src/tests/billingTerm.test.ts
# ✓ src/tests/billingTerm.test.ts (8 tests) 9ms

# 3. Sales normalization test suite
npm test -- src/tests/salesAuditAndFormatters.test.ts
# ✓ src/tests/salesAuditAndFormatters.test.ts (12 tests) 38ms
```

---

## 9. Verification Results
- `tsc --noEmit`: 0 errors.
- Vitest suites: 20/20 targeted tests passed, 0 failures.
- Git push: Committed (`a2ab9dc2`) and pushed cleanly to `origin/smritiNX`.

---

## 10. Known Limitations
- If a mock transaction is generated without an `id`, `order_no`, or `po_number`, the inspection will fall back gracefully to the row object without triggering remote synchronization.

---

## 11. Future Work
- Add dedicated unit tests for `apiFetchV1` URL path segment sanitization regex.
- Implement unified batch inspection modal across commercial transaction families.

---

## 12. Related ADRs
- `ADR-API-001`: Universal FastAPI Core Client Gateway & Tenant Isolation
- `ADR-BIL-004`: Billing Workspace Unified Container & Auxiliary Sub-Views

---

## 13. Related RFCs
- `RFC-2026-BIL-08`: Commercial Transaction Browser & Read-Only Audit Mode
