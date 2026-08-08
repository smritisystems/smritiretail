<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0
  Created      : 2026-08-01
  Modified     : 2026-08-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Product Foundation Dependency Matrix
-->

# SMRITI Product Foundation Dependency Matrix

**Status:** ACTIVE — M2 execution planning artifact  
**Effective:** 2026-08-01  
**Scope:** Reuse guidance for Product Foundation engines and Studio implementation

---

## 1. Purpose

This matrix documents reuse rather than architecture. It is intended to guide decisions about whether a capability belongs in Product Foundation or in a specific Studio.

---

## 2. Dependency Matrix

| Engine / Capability | Sales | POS | Inventory | Purchase | Accounting | CRM | Reporting |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Pricing Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Discount Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Promotion Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Offer / Coupon Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Loyalty Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wallet Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stock Ledger Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reservation Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Allocation Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Warehouse Rules Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Batch & Serial Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reorder Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Purchase Lifecycle Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supplier Rules Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approval Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vendor Settlement Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GST Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tax Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Posting Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Receivable Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payable Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Banking Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Workflow Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Task Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SLA Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notification Integration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rule Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Number Series Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Printing / PDF Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Barcode / QR Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Label Printing Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Universal Search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard Framework | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reporting Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forecast Engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Assistant Integration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. Reuse Rule

A capability belongs in Product Foundation when it meets the following criteria:

1. It is reused by at least two Product Foundation engines.
2. It is reused by at least two Studios.
3. It reduces maintenance effort across the product suite.

If none of those conditions are true, the capability should remain in the relevant Studio.

---

## 4. Studio Alignment

### Wave 1
- POS Studio
- Sales Studio
- Inventory Studio

### Wave 2
- Purchase Studio
- Accounting Studio
- CRM Studio

### Wave 3
- Reporting Studio
- Customer Portal
- License Studio
- Mobile Workspace

---

## 5. Success Metrics

The product should be evaluated through customer-centered outcomes:

| Area | Target |
| :--- | :--- |
| POS checkout | <10 seconds |
| Sales invoice | <30 seconds |
| Inventory accuracy | >99.9% |
| Purchase completion | PO → GRN → Invoice without manual intervention |
| Dashboard load | <2 seconds |
| Offline sync | >99% success |
| First-time user onboarding | <30 minutes |
