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

  * Author     : Jawahar Ramkripal Mallah
  * Designation: Chief Systems Architect & Creator
  * Email      : support@smritibooks.com
  * Version    : 6.99.1
  * Created    : 2026-07-11
  * Modified   : 2026-10-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Troubleshooting & Support Manual

This document details common operational issues and resolutions.

## Shell and workspace context

### [SMRITI-UX-001] A Classic menu item is not visible in the top bar
**Symptom:** Some Classic menu groups are not shown beside the brand and account controls.
**Cause:** The available header space is limited at the current window size.
**Resolution:** Select **More** to open the remaining navigation groups. Use the search icon to open global search on a narrow screen.
**Fixed In:** v6.99.1

### [SMRITI-CONTEXT-001] Company or branch context is unavailable
**Symptom:** The header or status bar says that company or branch context is unavailable.
**Cause:** The current session has not supplied a company or branch name.
**Resolution:** Open the company and branch control and select an available workspace. If no choices are listed, sign in again or ask an administrator to confirm your workspace access.
**Fixed In:** v6.99.1

### [SMRITI-NET-001] The application connection check fails
**Symptom:** The status bar shows **APP UNAVAILABLE** or remains at **CHECKING APP**.
**Cause:** The authenticated `/auth/me` request failed, or the browser is offline.
**Resolution:** Restore network access and retry. If the status remains unavailable, sign in again; contact your administrator if the authenticated request continues to fail.
**Fixed In:** v6.99.1

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

