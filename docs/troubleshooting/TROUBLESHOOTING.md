<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.2
  * Created    : 2026-07-11
  * Modified   : 2026-10-16
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Troubleshooting & Support Manual

This document details common operational issues and resolutions.

---

## 1. CRM Server Sync Discrepancies
- **Symptom:** Customers modified in the CRM tab do not show up immediately in other registers.
- **Cause:** Network offline state or pending sync queue failure.
- **Resolution:**
  1. Verify the network status in the browser console.
  2. If the browser shows offline, verify that mutations are saved in the `smriti_pending_customers` local storage array.
  3. Re-establish network connectivity to trigger automated online queue synchronization.

## 2. Keyboard Shortcut Collisions
- **Symptom:** Pressing F12 launches browser DevTools instead of executing standard checkout.
- **Cause:** Browser default hotkeys taking precedence.
- **Resolution:** The POS terminal calls `e.preventDefault()` to intercept keys. Ensure the focus resides inside the active viewport window of the POS application tab.

## 3. Split Payment Ledger Discrepancies
- **Symptom:** Total debits in General Ledger do not balance with sales invoice.
- **Cause:** Incomplete split payment breakdown payload.
- **Resolution:** Check `/api/pos/checkout` request logs. The payment mode must be set to `"Split"` with a valid `breakup` mapping.

## 4. Mandatory Delivery Location Validation on Modern Trade
- **Symptom:** Cashier clicks Complete Settlement or F12 and receives an alert: *"Delivery Location / Store Code is mandatory for Modern Trade sales channel. Please select a valid store."* (or API returns 422 `SMRITI-VAL-004`).
- **Cause:** The sales channel is set to `MODERN_TRADE`, but no delivery location is selected in the corporate B2B bar.
- **Resolution:**
  1. In the Billing Terminal Header (Row 3), click the **Delivery Location** dropdown.
  2. Select the customer's registered store delivery location for this shipment.
  3. If billing standard counter retail or wholesale without store tracking, change the **Sales Channel** dropdown in Row 1 to `General Trade` or `B2B Wholesale`.

