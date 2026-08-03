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

# SMRITI Integration Kernel Specification (SIK v1.0)

**Status:** FROZEN — Universal Integration Kernel v1.0 (2026-08-04)
**Scope:** Standard Connector Interface, External API Gateways, Payment Devices, & Statutory Sync Engine

---

## 1. Universal Connector Architecture & Abstraction

`SIK v1.0` acts as the centralized integration kernel for external third-party software, payment gateways, messaging services, weighing scales, and statutory portals.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SIK V1.0 INTEGRATION KERNEL (UNIVERSAL CONNECTOR & API GATEWAY)        │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Statutory Sync Engine: GST Portal (GSTR-1, GSTR-2B), E-Way Bill     │
 │ 2. Financial Connectors: TallyPrime XML Sync, Marg ERP, Banking APIs   │
 │ 3. Messaging Gateways: WhatsApp Business, SMS Gateways, SMTP Email      │
 │ 4. Payment Device Drivers: UPI QR Standees, PinPad Card Swipers        │
 │ 5. Peripheral Hardware: Digital Weighing Scales, Fiscal Devices        │
 │ 6. E-Commerce Connectors: Shopify, WooCommerce, Open Cart Sync         │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Universal Connector Contract & Consumer Matrix

All external communication and synchronization MUST execute through standard `SIK v1.0` connector interfaces without embedding vendor-specific API code inside business studios:

| Business Studio / Domain | External Target System | SIK Connector Interface | Target Protocol |
|---|---|---|---|
| **Accounting Studio** | TallyPrime / Marg ERP | `FinancialExportConnector` | XML / REST Sync |
| **Accounting / Sales** | Government GST Portal | `GSTINStatutoryConnector` | JSON / GSTN API |
| **Sales / CRM Studio** | WhatsApp Business / SMS | `MessagingGatewayConnector` | HTTP REST Webhooks |
| **POS Studio** | PinPad Swiper / UPI QR | `PaymentTerminalConnector` | Serial / USB / MQTT |
| **POS / Inventory** | Digital Weighing Scale | `WeighingScaleConnector` | RS-232 / USB HID |
| **Merchandising / Sales**| Shopify / E-Commerce | `EcommerceSyncConnector` | GraphQL / REST |
