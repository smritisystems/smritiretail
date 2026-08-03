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

# SMRITI Barcode & Printing Kernel Specification (SBPK v1.0)

**Status:** FROZEN — Universal Printing Kernel v1.0 (2026-08-04)
**Scope:** Universal Barcode Generation, Thermal ESC/POS, ZPL, PDF & Shelf Label Engine

---

## 1. Kernel Architecture & Platform Integration

`SBPK v1.0` serves as the centralized, high-performance barcode generation and document rendering kernel for all SMRITI business studios.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SBPK V1.0 KERNEL ENGINE (UNIVERSAL BARCODE & PRINT KERNEL)              │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Barcode Engine: 1D (EAN-13, EAN-8, Code-128) & 2D (QR Code, DataMatrix)│
 │ 2. Label Layout Engine: Shelf Labels, Item Barcode Stickers, Box Labels│
 │ 3. Document Renderers: ESC/POS Thermal, ZPL II Industrial, PDF/A, HTML │
 │ 4. Hardware Driver Bridge: Direct Thermal, QZ Tray, USB, Serial, Network│
 │ 5. Template Registry: Universal Print Templates (UPRT Integration)    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Studio Consumer Integration Matrix

All SMRITI Business Studios route document rendering and label printing through `SBPK v1.0`:

| Business Studio / Domain | Primary Print Artifacts | Target Format | Driver Output |
|---|---|---|---|
| **Purchase Studio** | PO Copy, GRN Receipt, Supplier Item Stickers | PDF, Thermal, ESC/POS | USB / Direct / QZ Tray |
| **Sales Studio** | GST Tax Invoice, E-Way Bill, Delivery Challan, Waybill | PDF, ZPL II, HTML | Network / Local Spooler |
| **POS Studio** | Counter Receipt, Gift Receipt, Cash Drop Slip, Hold Bill | ESC/POS Thermal | ESC/POS Serial / USB Pulse |
| **Inventory Studio** | Barcode Tags, Shelf Labels, Bin Location Markers | ZPL II, 2D QR Code | Industrial Zebra / TSC |
| **CRM Studio** | Membership Cards, Loyalty Vouchers | PDF, QR Code | Desktop PDF / Card Printer |
| **Accounting Studio** | Financial Vouchers, GST Tax Registers | PDF | Standard Desktop Printer |
