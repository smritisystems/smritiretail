<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Matrix
-->

# SMRITI Digital Commerce Platform v2.0 Dependency Matrix & Kernel Mapping Index

**Status:** FROZEN — Platform Dependency Matrix v2.0 (2026-08-04)
**Scope:** Complete Coupling Map Across Platform Kernels, Registries, & Business Studios

---

## 1. Studio-to-Kernel Dependency Matrix

This matrix documents the exact shared platform kernel dependencies consumed by each certified business studio. Studios operate strictly as generic clients of these kernels without introducing custom uncertified engine code:

| Certified Business Studio | Inventory Kernel | SDK Document Kernel | SBPK Printing Kernel | SIK Integration Kernel | SPPK Pricing Kernel | Universal Registries (UFR/UWR/URR/USR/UPRT) |
|---|---|---|---|---|---|---|
| **Inventory Studio** | ✅ Primary | ✅ (`STK`) | ✅ Barcodes/Labels | ✅ Weighing Scale | — | ✅ All |
| **Purchase Studio** | ✅ Receipts | ✅ (`PO`,`GRN`,`VINV`)| ✅ PO/GRN Print | ✅ Vendor EDI | — | ✅ All |
| **Sales Studio** | ✅ ATP/Reserve | ✅ (`SO`,`SINV`) | ✅ Tax Invoice/Challan | ✅ GST Portal | ✅ Price Lists | ✅ All |
| **POS Studio** | ✅ Stock Deduct| ✅ (`POS`) | ✅ ESC/POS Thermal | ✅ PinPad/UPI | ✅ BOGO/Happy Hour | ✅ All |
| **CRM Studio** | ✅ History Audit| — | ✅ Loyalty Cards | ✅ WhatsApp/SMS | ✅ Loyalty Discount | ✅ All |
| **Accounting Studio** | ✅ COGS Valuation| ✅ (`JV`) | ✅ Voucher Print | ✅ Tally XML Sync | — | ✅ All |
| **Warehouse Studio** | ✅ Bin Routing | ✅ (`WMS`) | ✅ Shipping Labels | ✅ Mobile Handheld | — | ✅ All |
| **Merchandising Studio**| ✅ Stock Status| — | ✅ Shelf Labels | ✅ Shopify Catalog | ✅ Markdowns | ✅ All |
| **Replenishment Studio**| ✅ Reorder ROP | ✅ (`PO` Draft) | — | ✅ EDI Purchase Push | — | ✅ All |
| **Omnichannel Studio** | ✅ Stock Sync | ✅ (`SO`,`SINV`) | ✅ Shipping Labels | ✅ Marketplace Sync | ✅ Web Pricing | ✅ All |

---

## 2. Shared Platform Service Contracts

- **Inventory Kernel v1.0:** Stock ledgers, version locking, bin allocation, journal audit.
- **SDK Document Kernel v1.0:** Document state machine (`Draft` $\rightarrow$ `Submitted` $\rightarrow$ `Approved` $\rightarrow$ `Posted` $\rightarrow$ `Archived`).
- **SBPK Printing Kernel v1.0:** 1D/2D Barcode generation, ESC/POS Thermal, ZPL, PDF/A.
- **SIK Integration Kernel v1.0:** GST Portal, Tally XML, WhatsApp API, Weighing Scales, Shopify.
- **SPPK Pricing Kernel v1.0:** Store price lists, BOGO, Mix & Match, Happy Hours, Coupons.
- **Universal Registries (UFR/UWR/URR/USR/UPRT):** Dynamic forms, workflow state locks, report exports, ABAC security, print schemas.
