# Billing_CreditBillingTerminal_v6.44.5

<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 6.44.5
  Created      : 2026-09-26
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

## 1. Purpose
Implement the SMRITI Credit Billing Terminal — a dedicated React/TSX component for B2B credit-sale invoicing, routed from the Billing Workspace navigation header. Matches architect-provided reference UX screenshot.

## 2. Scope
IN: SmritiCreditBillingTerminal.tsx, BillingWorkspace routing, real POST /api/v1/sales/invoices (payment_mode=CREDIT), customer typeahead, barcode scan, inline editing, F-key shortcuts, Draft/Submitted banners, right-sidebar credit info.
OUT: Backend SalesService changes, print/PDF flow, Delivery/Other sidebar (stubbed), vitest unit tests.

## 3. Files Created
| File | Lines | Purpose |
|---|---|---|
| src/components/billing/SmritiCreditBillingTerminal.tsx | 592 | New Credit Billing Terminal |
| docs/walkthrough/billing/Billing_CreditBillingTerminal_v6.44.5.md | this | WGP walkthrough |

## 4. Files Modified
| File | Change |
|---|---|
| src/components/billing/BillingWorkspace.tsx | CREDIT_BILLING aux view, import, CreditCard icon, nav button, route |

## 5. Architecture Decisions
AD-1: New self-contained file (not BillingTerm extension) — avoids coupling to 3930-line distributor terminal.
AD-2: Real API integration from day one — payment_mode:CREDIT to existing /sales/invoices endpoint.
AD-3: Credit limit display is advisory (frontend warns; backend enforces via credit_hold flag).
AD-4: Barcode scan wired to /item-barcodes, deduplication by productId.

## 6. Design Rationale
Two-panel layout (scrollable item grid + fixed 280px sidebar). Billing mode bar matches BillingTerm.tsx paradigm. Right sidebar tabs: Customer Details / Credit Info (live) / Delivery / Other (stubbed). Draft/Submitted explainer banners communicate financial posting implications per HREP policy. F-key hints in status bar for high-volume operators.

## 7. Implementation Summary
1. Component scaffolded with types, state, computed totals.
2. Customer typeahead -> /crm/customers?search=
3. Barcode scan -> /item-barcodes?barcode=
4. Inline Qty + Disc% editing with reactive totals.
5. handleSubmit -> POST /api/v1/sales/invoices (payment_mode:CREDIT, all schema fields mapped).
6. BillingWorkspace: CREDIT_BILLING view added with Credit Billing nav button.

Payload sent: { paymentMode: CREDIT, customerId, customerName, customerGstin, date, grandTotal, taxTotal, discountAmount, netAmount, taxableValue, remarks, poReference, salespersonName, status:Submitted, items:[{productId, code, name, price, quantity, discPct, taxAmount, totalAmount, hsnCode, gstRate, lineNo, mrp}] }
All fields use camelCase AliasChoices accepted by SalesInvoiceBase.

## 8. Tests Executed
| Test | Command | Result |
|---|---|---|
| TSC (new file) | npx tsc --noEmit --skipLibCheck | exit 0 — 0 errors |
| TSC (BillingWorkspace) | npx tsc --noEmit --skipLibCheck | exit 0 — 0 errors |
| TSC (after API wiring) | npx tsc --noEmit --skipLibCheck | task-706 pending |
| Git diff new file | git add -N; git diff HEAD | 559 lines confirmed |
| Git diff BillingWorkspace | git diff HEAD | 5 hunks confirmed |

## 9. Verification Results
Status: Partially Verified

| Claim | Status | Evidence |
|---|---|---|
| TSC 0 errors (new file) | Done | task-656 exit 0 |
| TSC 0 errors (BillingWorkspace wiring) | Done | task-671 exit 0 |
| TSC 0 errors (API wiring) | Unverified | task-706 running |
| Git diff new file 559 lines | Done | diff output |
| Git diff BillingWorkspace 5 hunks | Done | diff output |
| Runtime browser rendering | Unverified | No dev server this session |
| POST /sales/invoices integration | Unverified | Backend not started |

## 10. Known Limitations
1. Delivery/Other sidebar tabs stubbed (pending CustomerDeliveryLocation model).
2. No vitest unit tests (deferred to API endpoint test suite sprint).
3. Credit limit enforcement is advisory only on frontend.
4. Transport field collected but not sent in API payload (field missing from backend schema).
5. Print/Preview buttons present but not wired (requires submittedInvoiceId + pdf endpoint).
6. Salesperson sent as name string, not ID (salesperson master lookup deferred).

## 11. Future Work
- Wire Print (F9) to GET /api/v1/sales/invoices/{id}/pdf using submittedInvoiceId.
- Populate Delivery tab from CustomerDeliveryLocation API.
- Add Alt+2 keyboard shortcut in BillingWorkspace for Credit Billing.
- Persist Draft to backend (status:Draft on Save Draft).
- Add transport_mode to payload when backend adds field.
- Wire View Statement button to customer ledger endpoint.

## 12. Related ADRs
- ADR-008: Strangler-Fig Migration (FastAPI sole backend)
- ADR-015: BillingWorkspace Auxiliary View Architecture
- ADR-021: Credit Sale Payment Mode on SalesInvoice

## 13. Related RFCs
- RFC-112: Credit Billing Terminal UX (reference screenshot from architect)
- RFC-089: Customer Credit Limit Advisory Pattern
