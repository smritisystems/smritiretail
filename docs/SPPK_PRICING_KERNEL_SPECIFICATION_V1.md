<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Pricing & Promotion Kernel Specification (SPPK v1.0)

**Status:** FROZEN — Universal Pricing & Promotion Kernel v1.0 (2026-08-04)
**Scope:** Universal Price Lists, Discount Rules Engine, Coupons, Mix & Match, & Happy Hours

---

## 1. Kernel Architecture & Consumer Integration

`SPPK v1.0` serves as the centralized pricing, discount, and promotion engine for all SMRITI transactional studios.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SPPK V1.0 KERNEL ENGINE (UNIVERSAL PRICING & PROMOTION KERNEL)         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Price List Engine: Base MRP, Store-Wise, Regional, & B2B Tiers      │
 │ 2. Promotional Discount Rules: Volume Tiered, Happy Hours, Flash Sales│
 │ 3. Multi-Buy Engine: Mix & Match, Buy X Get Y Free (BOGO), Bundles     │
 │ 4. Coupon & Voucher Engine: Promo Codes, Gift Vouchers, Store Credits  │
 │ 5. Customer Specific Discounts: Loyalty Tier Discounts, Special Rates  │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Studio Consumer Integration Matrix

All SMRITI business studios query `SPPK v1.0` dynamically for item pricing and discount calculations:

| Consumer Studio / System | Pricing Request Type | SPPK Kernel Service Evaluated |
|---|---|---|
| **POS Studio** | Counter Barcode Scan | Store Price List + Active Mix & Match + Loyalty Discount |
| **Sales Studio** | Sales Order / Invoice | Customer Tier Price List + Volume Discount + Coupon Code |
| **CRM Studio** | Wallet & Member Checkout | Loyalty Tier Discount + Personalized Promotional Voucher |
| **Merchandising Studio** | Markdown Rule Definition | Margin Threshold Audit + Clearance Discount Schedule |
| **SIK / E-Commerce** | Store Front Catalog | Regional Web Price List + Flash Sale Promotion |
